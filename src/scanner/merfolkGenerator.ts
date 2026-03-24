import type { Elements, RepoType, FileContainerInfo } from '../types';
import { sanitizeNodeId } from '../utils';

/** Compute the final nodeId for a file container, resolving name collisions. */
function computeContainerNodeId(
  info: FileContainerInfo,
  allNames: Set<string>
): string {
  const stem = info.displayName;
  if (info.isBackend) return `backend_${stem}`;
  if (allNames.has(stem)) return `${stem}_file`;
  return stem;
}

/** Format prop list for a component relationship label. */
function formatProps(props: string[]): string {
  if (props.length === 0 || (props.length === 1 && props[0] === 'uses')) return 'uses';
  if (props.length <= 3) return props.join(', ');
  return `${props.slice(0, 3).join(', ')}...`;
}

/** Extract the filename stem (no directory, no extension) from a file path. */
function getFileStem(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
}

/**
 * Generate routed connection lines, routing through parent containers when
 * either the source or target is a child node inside a file container.
 *
 * Routing rules (mirroring Hoverchart's generateRoutedConnection logic):
 *  - Both have parents, same parent  → direct connection
 *  - Both have parents, diff parents → 3-hop: child→srcParent : "calls out", srcParent→tgtParent : label, tgtParent→child : "receives"
 *  - Only source has parent          → 2-hop: child→srcParent : "calls out", srcParent→target : label
 *  - Only target has parent          → 2-hop: source→tgtParent : label, tgtParent→child : "receives"
 *  - Neither has parent              → direct connection
 *
 * Returns [] when source or target is completely unknown (not in nodeIds and
 * not in childToParentMap).
 */
function generateRoutedConnection(
  sourceNode: string,
  targetNode: string,
  label: string,
  childToParentMap: Map<string, { parentId: string }>,
  nodeIds: Set<string>,
  filesNeedingSuffix: Set<string>
): string[] {
  const CALLS_OUT = 'calls out';
  const RECEIVES = 'receives';

  const resolveId = (name: string): string =>
    filesNeedingSuffix.has(name) ? `${name}_file` : name;

  const srcId = resolveId(sourceNode);
  const tgtId = resolveId(targetNode);

  // Skip if source or target is completely unknown
  if (!nodeIds.has(srcId) && !childToParentMap.has(sourceNode)) return [];
  if (!nodeIds.has(tgtId) && !childToParentMap.has(targetNode)) return [];

  const connections: string[] = [];
  const sourceParent = childToParentMap.get(sourceNode);
  const targetParent = childToParentMap.get(targetNode);

  if (sourceParent && targetParent) {
    if (sourceParent.parentId === targetParent.parentId) {
      // Same parent – direct connection between the two children
      connections.push(`${srcId} --> ${tgtId} : "${label}"`);
    } else {
      // Different parents – route through both containers
      connections.push(`${srcId} --> ${sourceParent.parentId} : "${CALLS_OUT}"`);
      connections.push(`${sourceParent.parentId} --> ${targetParent.parentId} : "${label}"`);
      connections.push(`${targetParent.parentId} --> ${tgtId} : "${RECEIVES}"`);
    }
  } else if (sourceParent && !targetParent) {
    connections.push(`${srcId} --> ${sourceParent.parentId} : "${CALLS_OUT}"`);
    connections.push(`${sourceParent.parentId} --> ${tgtId} : "${label}"`);
  } else if (!sourceParent && targetParent) {
    connections.push(`${srcId} --> ${targetParent.parentId} : "${label}"`);
    connections.push(`${targetParent.parentId} --> ${tgtId} : "${RECEIVES}"`);
  } else {
    connections.push(`${srcId} --> ${tgtId} : "${label}"`);
  }
  return connections;
}

export function generateMerfolkMarkdown(
  elements: Elements,
  repoName: string,
  repoType: RepoType
): string {
  // 1. Deduplicate all element arrays
  const components = [...new Set(elements.components)];
  const functions_ = [...new Set(elements.functions)];
  const hooks = [...new Set(elements.hooks)];
  const libraries = [...new Set(elements.imports.libraries)];
  const stores = [...new Set(elements.stores)];

  // 2. Priority resolution: stores > services > utilities
  const storeSet = new Set(stores);
  const services = [...new Set(elements.services)].filter(s => !storeSet.has(s));
  const serviceSet = new Set(services);
  const utilities = [...new Set(elements.utilities)].filter(
    u => !storeSet.has(u) && !serviceSet.has(u)
  );

  // 3. Component set for collision detection
  const componentSet = new Set(components);

  // 4. All known function/hook/etc. names for container nodeId collision detection
  const allNames = new Set([
    ...functions_,
    ...hooks,
    ...services,
    ...utilities,
    ...stores,
  ]);

  // 5. Resolve file container nodeIds
  const fileContainers = elements.fileContainers ?? new Map<string, FileContainerInfo>();
  const resolvedContainers: Array<{ nodeId: string; info: FileContainerInfo }> = [];
  const seenContainerIds = new Set<string>();

  for (const [, info] of fileContainers) {
    const nodeId = computeContainerNodeId(info, allNames);
    if (!seenContainerIds.has(nodeId)) {
      seenContainerIds.add(nodeId);
      info.nodeId = nodeId;
      resolvedContainers.push({ nodeId, info });
    }
  }

  // 6. Build lookup: function name → file container nodeId
  const funcToContainerNodeId = new Map<string, string>();
  for (const { nodeId, info } of resolvedContainers) {
    for (const fn of info.functions) {
      funcToContainerNodeId.set(fn, nodeId);
    }
  }

  // 7. Build filesNeedingSuffix: function/utility names that collide with a
  //    component name.  These nodes are emitted as `name_file` and must be
  //    resolved to that ID when used in connections.
  const filesNeedingSuffix = new Set<string>();
  for (const fn of functions_) {
    if (componentSet.has(fn)) filesNeedingSuffix.add(sanitizeNodeId(fn));
  }
  for (const util of utilities) {
    if (componentSet.has(util)) filesNeedingSuffix.add(sanitizeNodeId(util));
  }

  // 8. Build childToParentMap: maps every child symbol to its parent container.
  //    Sources:
  //    - componentInternalFunctions  (fn.functionName → fn.componentName)
  //    - fileContainers              (each contained function → container nodeId)
  //    - internalHelperComponents    (h.child → h.parent)
  const childToParentMap = new Map<string, { parentId: string }>();
  for (const fn of elements.componentInternalFunctions ?? []) {
    childToParentMap.set(fn.functionName, { parentId: fn.componentName });
  }
  for (const { nodeId, info } of resolvedContainers) {
    for (const fn of info.functions) {
      childToParentMap.set(fn, { parentId: nodeId });
    }
  }
  for (const h of elements.internalHelperComponents ?? []) {
    childToParentMap.set(h.child, { parentId: h.parent });
  }

  // 9. Build nodeIds: the set of all top-level node IDs that will be emitted.
  //    Used by generateRoutedConnection to validate that a node exists before
  //    wiring a connection to it.
  const nodeIds = new Set<string>();
  for (const comp of components) nodeIds.add(comp);
  for (const fn of functions_) {
    nodeIds.add(componentSet.has(fn) ? `${sanitizeNodeId(fn)}_file` : fn);
  }
  for (const hook of hooks) nodeIds.add(hook);
  for (const svc of services) nodeIds.add(svc);
  for (const store of stores) nodeIds.add(store);
  for (const util of utilities) {
    nodeIds.add(componentSet.has(util) ? `${sanitizeNodeId(util)}_file` : util);
  }
  for (const { nodeId } of resolvedContainers) nodeIds.add(nodeId);

  const lines: string[] = [];

  // Header (inside code fence per foldspace-diagram.md format)
  lines.push('```merfolk');
  lines.push(`%% ${repoName} Repository Analysis`);
  lines.push('');

  // %% Components
  if (components.length > 0) {
    lines.push('%% Components');
    for (const comp of components) {
      lines.push(`${comp}{Component: ${comp}}`);
    }
    lines.push('');
  }

  // %% Internal Helper Components
  const helperComps = elements.internalHelperComponents ?? [];
  if (helperComps.length > 0) {
    lines.push('%% Internal Helper Components');
    const seen = new Set<string>();
    for (const h of helperComps) {
      const key = `${h.parent}|${h.child}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(`${h.parent} -.-> ${h.child} : "${h.label}"`);
      }
    }
    lines.push('');
  }

  // %% Functions
  if (functions_.length > 0) {
    lines.push('%% Functions');
    for (const fn of functions_) {
      const id = componentSet.has(fn) ? `${sanitizeNodeId(fn)}_file` : fn;
      lines.push(`${id}[Function: ${id}]`);
    }
    lines.push('');
  }

  // %% Hooks
  if (hooks.length > 0) {
    lines.push('%% Hooks');
    for (const hook of hooks) {
      lines.push(`${hook}[Hook: ${hook}]`);
    }
    lines.push('');
  }

  // %% Services
  if (services.length > 0) {
    lines.push('%% Services');
    for (const svc of services) {
      lines.push(`${svc}((Service: ${svc}))`);
    }
    lines.push('');
  }

  // %% Stores
  if (stores.length > 0) {
    lines.push('%% Stores');
    for (const store of stores) {
      lines.push(`${store}[[Store: ${store}]]`);
    }
    lines.push('');
  }

  // %% Utilities
  if (utilities.length > 0) {
    lines.push('%% Utilities');
    for (const util of utilities) {
      const id = componentSet.has(util) ? `${sanitizeNodeId(util)}_file` : util;
      lines.push(`${id}[Function: ${id}]`);
    }
    lines.push('');
  }

  // %% External Libraries
  if (libraries.length > 0) {
    lines.push('%% External Libraries');
    for (const lib of libraries) {
      lines.push(`${lib}<Library: ${lib}>`);
    }
    lines.push('');
  }

  // %% Component Internal Functions
  const internalFunctions = elements.componentInternalFunctions ?? [];
  if (internalFunctions.length > 0) {
    lines.push('%% Component Internal Functions');
    const seenFns = new Set<string>();
    for (const fn of internalFunctions) {
      if (!seenFns.has(fn.functionName)) {
        seenFns.add(fn.functionName);
        lines.push(`${fn.functionName}[Function: ${fn.functionName}]`);
      }
    }
    lines.push('');
  }

  // %% Component-Function Relationships
  if (internalFunctions.length > 0) {
    lines.push('%% Component-Function Relationships');
    for (const fn of internalFunctions) {
      lines.push(`${fn.componentName} -.-> ${fn.functionName} : "${fn.label}"`);
    }
    lines.push('');
  }

  // %% File Container Nodes
  if (resolvedContainers.length > 0) {
    lines.push('%% File Container Nodes');
    for (const { nodeId, info } of resolvedContainers) {
      switch (info.type) {
        case 'Hook':
          lines.push(`${nodeId}[Hook: ${info.displayName}]`);
          break;
        case 'Service':
          lines.push(`${nodeId}((Service: ${info.displayName}))`);
          break;
        case 'Store':
          lines.push(`${nodeId}[[Store: ${info.displayName}]]`);
          break;
        default:
          lines.push(`${nodeId}[Function: ${info.displayName}]`);
      }
    }
    lines.push('');
  }

  // %% File-Function Relationships
  if (resolvedContainers.length > 0) {
    const fileFuncLines: string[] = [];
    for (const { nodeId, info } of resolvedContainers) {
      for (const fn of info.functions) {
        fileFuncLines.push(`${nodeId} -.-> ${fn} : "contains"`);
      }
    }
    if (fileFuncLines.length > 0) {
      lines.push('%% File-Function Relationships');
      lines.push(...fileFuncLines);
      lines.push('');
    }
  }

  // %% Component Relationships
  const compRels = elements.componentRelationships ?? [];
  const validRels: Array<{ parent: string; child: string; propsStr: string }> = [];
  {
    const seenRels = new Set<string>();
    for (const rel of compRels) {
      if (!componentSet.has(rel.parent) || !componentSet.has(rel.child)) continue;
      const propsStr = formatProps(rel.props);
      const key = `${rel.parent}|${rel.child}|${propsStr}`;
      if (!seenRels.has(key)) {
        seenRels.add(key);
        validRels.push({ parent: rel.parent, child: rel.child, propsStr });
      }
    }
  }
  if (validRels.length > 0) {
    lines.push('%% Component Relationships');
    for (const rel of validRels) {
      lines.push(...generateRoutedConnection(rel.parent, rel.child, rel.propsStr, childToParentMap, nodeIds, filesNeedingSuffix));
    }
    lines.push('');
  }

  // %% Component Dependencies
  // Use generateRoutedConnection to produce routed chains through parent
  // containers.  Store targets have no parent so they produce a single direct
  // connection; non-store targets route through their file container.
  const compDeps = elements.componentDependencies ?? [];
  const hookReturnValueRels = elements.hookReturnValueRelationships ?? new Map<string, { hook: string; returnValues: string[] }[]>();
  const depLines: string[] = [];
  for (const dep of compDeps) {
    if (!componentSet.has(dep.component)) continue;
    // Enhance label using hookReturnValueRelationships when dep label is generic
    let label = dep.label;
    if (label === 'uses hook') {
      const hookRVs = hookReturnValueRels.get(dep.component);
      if (hookRVs) {
        const hookInfo = hookRVs.find(h => h.hook === dep.target);
        if (hookInfo && hookInfo.returnValues.length > 0) {
          label = `{${hookInfo.returnValues.join(', ')}}`;
        }
      }
    }
    depLines.push(...generateRoutedConnection(dep.component, dep.target, label, childToParentMap, nodeIds, filesNeedingSuffix));
  }
  if (depLines.length > 0) {
    lines.push('%% Component Dependencies');
    lines.push(...depLines);
    lines.push('');
  }

  // %% Function Call Relationships
  // Per-call-site (NOT deduplicated).  Store method calls are emitted as a
  // single direct line; regular function calls are routed through parent
  // containers via generateRoutedConnection.
  const rawCallSites = elements.rawCallSites ?? [];
  const callRelLines: string[] = [];
  for (const site of rawCallSites) {
    if (site.method) {
      // Store method call: single-line entry
      if (storeSet.has(site.calleeName)) {
        callRelLines.push(`${site.caller} --> ${site.calleeName} : "${site.method}"`);
      }
    } else {
      // Regular function call: route through parent containers
      callRelLines.push(...generateRoutedConnection(site.caller, site.calleeName, `calls ${site.calleeName}`, childToParentMap, nodeIds, filesNeedingSuffix));
    }
  }
  if (callRelLines.length > 0) {
    lines.push('%% Function Call Relationships');
    lines.push(...callRelLines);
    lines.push('');
  }

  // %% Classes
  const classes = [...new Set(elements.classes ?? [])];
  if (classes.length > 0) {
    lines.push('%% Classes');
    for (const cls of classes) {
      lines.push(`${cls}[[Class: ${cls}]]`);
    }
    lines.push('');
  }

  // %% Shared Interfaces
  const sharedInterfaces = elements.sharedInterfaces ?? new Map();
  if (sharedInterfaces.size > 0) {
    lines.push('%% Shared Interfaces');
    for (const [name] of sharedInterfaces) {
      lines.push(`${sanitizeNodeId(name)}{{Interface: ${name}}}`);
    }
    lines.push('');
  }

  // %% Interface Usages
  const interfaceUsages = elements.interfaceUsages ?? new Map();
  if (interfaceUsages.size > 0) {
    lines.push('%% Interface Usages');
    for (const [ifaceName, users] of interfaceUsages) {
      const ifaceId = sanitizeNodeId(ifaceName);
      for (const user of users) {
        lines.push(`${user} --> ${ifaceId} : "uses type"`);
      }
    }
    lines.push('');
  }

  // %% Next.js Route Hierarchy
  const nextjsRouteMap = elements.nextjsRouteMap ?? new Map();
  if (nextjsRouteMap.size > 0) {
    lines.push('%% Next.js Route Hierarchy');
    const routeNodes: Map<string, string> = new Map(); // routePath → nodeId
    for (const [, info] of nextjsRouteMap) {
      const nodeId = sanitizeNodeId(info.routePath === '/' ? 'route_root' : `route_${info.routePath.replace(/\//g, '_')}`);
      const nodeLabel = info.isLayout ? 'Layout'
        : info.isPage ? 'Page'
          : info.isApi ? 'API Route'
            : info.isLoading ? 'Loading'
              : info.isError ? 'Error'
                : 'Route';
      if (!routeNodes.has(info.routePath)) {
        routeNodes.set(info.routePath, nodeId);
        lines.push(`${nodeId}[${nodeLabel}: ${info.routePath || '/'}]`);
      }
    }
    // Parent-child nesting connections
    for (const [, info] of nextjsRouteMap) {
      if (info.parentRoutePath && info.routePath !== info.parentRoutePath) {
        const parentNodeId = routeNodes.get(info.parentRoutePath);
        const childNodeId = routeNodes.get(info.routePath);
        if (parentNodeId && childNodeId && parentNodeId !== childNodeId) {
          lines.push(`${parentNodeId} --> ${childNodeId} : "contains"`);
        }
      }
    }
    lines.push('');
  }

  // %% API Endpoints
  const apiEndpoints = elements.apiEndpoints ?? new Map();
  if (apiEndpoints.size > 0) {
    lines.push('%% API Endpoints');
    for (const [key, info] of apiEndpoints) {
      const nodeId = sanitizeNodeId(`api_${info.method}_${info.path.replace(/\//g, '_')}`);
      lines.push(`${nodeId}((API: ${info.method} ${info.path}))`);
      for (const handler of info.handlers) {
        lines.push(`${nodeId} --> ${handler} : "handled by"`);
      }
    }
    lines.push('');
  }

  // %% Database Models
  const dbModels = elements.dbModels ?? new Map();
  if (dbModels.size > 0) {
    lines.push('%% Database Models');
    for (const [name, info] of dbModels) {
      const nodeId = sanitizeNodeId(name);
      lines.push(`${nodeId}[(Model: ${name})]`);
    }
    lines.push('');
  }

  // %% Auth Guards
  const authGuards = elements.authGuards ?? new Set();
  if (authGuards.size > 0) {
    lines.push('%% Auth Guards');
    for (const guard of authGuards) {
      const nodeId = sanitizeNodeId(guard);
      lines.push(`${nodeId}[/Auth Guard: ${guard}/]`);
    }
    lines.push('');
  }

  // %% Auth Flows
  const authFlows = elements.authFlows ?? [];
  if (authFlows.length > 0) {
    lines.push('%% Auth Flows');
    for (const flow of authFlows) {
      lines.push(`${sanitizeNodeId(flow.source)} --> ${sanitizeNodeId(flow.target)} : "${flow.type}"`);
    }
    lines.push('');
  }

  // %% Event Emitters
  const eventEmitters = elements.eventEmitters ?? new Map();
  const eventListeners = elements.eventListeners ?? new Map();
  if (eventEmitters.size > 0 || eventListeners.size > 0) {
    lines.push('%% Event Emitters');
    const allEmitterNames = new Set([...eventEmitters.keys(), ...eventListeners.keys()]);
    for (const name of allEmitterNames) {
      const nodeId = sanitizeNodeId(name);
      lines.push(`${nodeId}[Emitter: ${name}]`);
    }
    for (const [name, events] of eventEmitters) {
      const nodeId = sanitizeNodeId(name);
      for (const event of events) {
        lines.push(`${nodeId} --> ${sanitizeNodeId(event)} : "emits"`);
      }
    }
    for (const [name, events] of eventListeners) {
      const nodeId = sanitizeNodeId(name);
      for (const event of events) {
        lines.push(`${sanitizeNodeId(event)} --> ${nodeId} : "listens"`);
      }
    }
    lines.push('');
  }

  // %% Error Boundaries
  const errorBoundaries = elements.errorBoundaries ?? new Set();
  if (errorBoundaries.size > 0) {
    lines.push('%% Error Boundaries');
    for (const boundary of errorBoundaries) {
      lines.push(`${boundary}[/Error Boundary: ${boundary}/]`);
    }
    const errorContainment = elements.errorContainment ?? new Map();
    for (const [boundary, contained] of errorContainment) {
      if (errorBoundaries.has(boundary)) {
        for (const child of contained) {
          lines.push(`${boundary} --> ${child} : "catches errors from"`);
        }
      }
    }
    lines.push('');
  }

  // %% Suspense Boundaries
  const suspenseBoundaries = elements.suspenseBoundaries ?? new Set();
  if (suspenseBoundaries.size > 0) {
    lines.push('%% Suspense Boundaries');
    for (const boundary of suspenseBoundaries) {
      lines.push(`${boundary}[/Suspense: ${boundary}/]`);
    }
    const errorContainment = elements.errorContainment ?? new Map();
    for (const [boundary, contained] of errorContainment) {
      if (suspenseBoundaries.has(boundary)) {
        for (const child of contained) {
          lines.push(`${boundary} --> ${child} : "suspends"`);
        }
      }
    }
    lines.push('');
  }

  // %% Worker Modules
  const workerModules: string[] = [];
  for (const [, info] of fileContainers) {
    // Check if file path suggests worker
    const stem = info.displayName;
    if (/[Ww]orker/.test(stem)) {
      workerModules.push(stem);
    }
  }
  if (workerModules.length > 0) {
    lines.push('%% Worker Modules');
    for (const worker of workerModules) {
      const nodeId = sanitizeNodeId(worker);
      lines.push(`${nodeId}[Worker: ${worker}]`);
    }
    lines.push('');
  }

  // %% Web Workers
  const workers = [...new Set(elements.workers ?? [])];
  if (workers.length > 0) {
    lines.push('%% Web Workers');
    for (const worker of workers) {
      const nodeId = sanitizeNodeId(worker);
      lines.push(`${nodeId}[Worker: ${worker}]`);
    }
    lines.push('');
  }

  // %% Store Usage Details
  const storeUsage = elements.storeUsageRelationships ?? new Map<string, Map<string, { properties: Set<string>; actions: Set<string> }>>();
  const storeUsageLines: string[] = [];
  for (const [comp, storeMap] of storeUsage) {
    if (!componentSet.has(comp)) continue;
    for (const [store, info] of storeMap) {
      const parts = [...info.properties, ...info.actions];
      if (parts.length > 0) {
        storeUsageLines.push(...generateRoutedConnection(comp, store, `{${parts.join(', ')}}`, childToParentMap, nodeIds, filesNeedingSuffix));
      }
    }
  }
  if (storeUsageLines.length > 0) {
    lines.push('%% Store Usage Details');
    lines.push(...storeUsageLines);
    lines.push('');
  }

  // %% Module Import Relationships (vanilla repos)
  if (repoType === 'vanilla') {
    const moduleImports = elements.moduleImportRelationships ?? new Map<string, Set<string>>();
    const importLines: string[] = [];
    for (const [filePath, importedFiles] of moduleImports) {
      const sourceStem = getFileStem(filePath);
      if (!sourceStem) continue;
      for (const imported of importedFiles) {
        importLines.push(`${sourceStem} --> ${imported} : "imports"`);
      }
    }
    if (importLines.length > 0) {
      lines.push('%% Module Import Relationships');
      lines.push(...importLines);
      lines.push('');
    }
  }

  // Close code fence
  lines.push('```');

  return lines.join('\n');
}
