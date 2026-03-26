import type { Elements, RepoType, FileContainerInfo } from '../types';
import { sanitizeNodeId } from '../utils';

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

// ==================== MAIN EXPORT ====================

export function generateMerfolkMarkdown(
  elements: Elements,
  repoName: string,
  repoType: RepoType
): string {
  const isVanilla = repoType === 'vanilla' || repoType === 'python' || repoType === 'vue';
  const isNextjs = repoType === 'nextjs';
  const filesNeedingSuffix = new Set<string>(elements.filesNeedingSuffix ?? []);

  // Build allSymbolNames for file container collision detection
  const allSymbolNames = new Set<string>([
    ...(elements.components ?? []),
    ...(elements.functions ?? []),
    ...(elements.hooks ?? []),
    ...(elements.services ?? []),
    ...(elements.stores ?? []),
    ...(elements.utilities ?? []),
  ]);
  
  // ========== SAFETY FILTERS (matching hoverchart) ==========
  
  // Remove duplicates
  elements.components = [...new Set(elements.components ?? [])];
  elements.functions = [...new Set(elements.functions ?? [])];
  elements.hooks = [...new Set(elements.hooks ?? [])];
  elements.services = [...new Set(elements.services ?? [])];
  elements.stores = [...new Set(elements.stores ?? [])];
  elements.utilities = [...new Set(elements.utilities ?? [])];
  elements.classes = [...new Set(elements.classes ?? [])];
  elements.interfaces = [...new Set(elements.interfaces ?? [])];
  elements.variables = [...new Set(elements.variables ?? [])];
  elements.constants = [...new Set(elements.constants ?? [])];
  if (elements.imports?.libraries) {
    elements.imports.libraries = [...new Set(elements.imports.libraries)];
  }

  // Filter invalid components (must start with uppercase)
  elements.components = (elements.components ?? []).filter((comp: string) => /^[A-Z]/.test(comp));

  // Cross-category dedup (prioritize more specific categories)
  const storesSet = new Set(elements.stores ?? []);
  elements.services = (elements.services ?? []).filter((item: string) => !storesSet.has(item));
  elements.utilities = (elements.utilities ?? []).filter((item: string) => !storesSet.has(item));
  const servicesSet = new Set(elements.services ?? []);
  elements.utilities = (elements.utilities ?? []).filter((item: string) => !servicesSet.has(item));
  const classesSet = new Set(elements.classes ?? []);
  const constantsSet = new Set(elements.constants ?? []);
  const variablesSet = new Set(elements.variables ?? []);
  elements.utilities = (elements.utilities ?? []).filter(
    (item: string) => !classesSet.has(item) && !constantsSet.has(item) && !variablesSet.has(item)
  );
  elements.services = (elements.services ?? []).filter((item: string) => !classesSet.has(item));

  // Remove component-internal functions from general functions list
  const componentInternalFunctionNames = new Set<string>();
  for (const fn of elements.componentInternalFunctions ?? []) {
    componentInternalFunctionNames.add(fn.functionName);
  }
  elements.functions = (elements.functions ?? []).filter((fn: string) => !componentInternalFunctionNames.has(fn));

  // ========== NODE ID TRACKING ==========
  const nodeIds = new Set<string>();
  
  // ========== BUILD childToParentMap (matching hoverchart) ==========
  const childToParentMap = new Map<string, { parentId: string; parentName: string; type: string }>();

  // Map component internal functions to their parent component
  const componentFunctionsMap = new Map<string, Set<string>>();
  for (const fn of elements.componentInternalFunctions ?? []) {
    if (!componentFunctionsMap.has(fn.componentName)) {
      componentFunctionsMap.set(fn.componentName, new Set());
    }
    componentFunctionsMap.get(fn.componentName)!.add(fn.functionName);
  }
  componentFunctionsMap.forEach((functions, componentName) => {
    const parentNeedsSuffix = filesNeedingSuffix.has(componentName);
    const parentNodeId = parentNeedsSuffix ? `${componentName}_file` : componentName;
    functions.forEach((funcName) => {
      childToParentMap.set(funcName, { parentId: parentNodeId, parentName: componentName, type: 'component' });
    });
  });

  // Map file container children to their parent file container
  const fileContainers = elements.fileContainers ?? new Map<string, FileContainerInfo>();
  fileContainers.forEach((fileInfo, _filePath) => {
    const fileName = fileInfo.displayName;
    const needsSuffix = filesNeedingSuffix.has(fileName);
    let fileNodeId: string;
    if (fileInfo.isBackend) {
      fileNodeId = `backend_${fileName}`;
    } else if (fileInfo.type === 'worker') {
      fileNodeId = `worker_${fileName}`;
    } else if (fileInfo.type === 'utility' && fileName === 'shaders') {
      fileNodeId = `shader_${fileName}`;
    } else {
      fileNodeId = (fileInfo.functions.has(fileName) || needsSuffix || allSymbolNames.has(fileName))
        ? `${fileName}_file`
        : fileName;
    }
    fileInfo.nodeId = fileNodeId;
    fileInfo.functions.forEach((funcName: string) => {
      childToParentMap.set(funcName, { parentId: fileNodeId, parentName: fileName, type: fileInfo.type });
    });
  });

  // Map internal helper components to their parent
  const internalHelperComponents = elements.internalHelperComponents ?? [];
  for (const h of internalHelperComponents) {
    const parentNeedsSuffix = filesNeedingSuffix.has(h.parent);
    const parentNodeId = parentNeedsSuffix ? `${h.parent}_file` : h.parent;
    childToParentMap.set(h.child, { parentId: parentNodeId, parentName: h.parent, type: 'component' });
  }

  // Map internal hooks to their parent
  const internalHooks = elements.internalHooks ?? new Map<string, { parent: string; parentType: string }>();
  internalHooks.forEach((data: { parent: string; parentType: string }, hookName: string) => {
    const parentNodeId = `${data.parent}_file`;
    childToParentMap.set(hookName, { parentId: parentNodeId, parentName: data.parent, type: data.parentType });
  });

  // ========== GENERATE MARKDOWN OUTPUT ==========
  let markdown = `%% ${repoName} Repository Analysis\n\n`;

  // ── Components ────────────────────────────────────────────────────────────
  if ((elements.components ?? []).length > 0) {
    markdown += `%% Components\n`;
    for (const comp of elements.components!) {
      const needsSuffix = filesNeedingSuffix.has(comp);
      const nodeId = needsSuffix ? `${comp}_file` : comp;
      if (nodeIds.has(nodeId)) continue;
      nodeIds.add(nodeId);
      markdown += `${nodeId}{Component: ${comp}}\n`;
    }
  }

  // ── Internal Helper Components (dashed arrows for nesting) ────────────────
  if (internalHelperComponents.length > 0) {
    markdown += '\n%% Internal Helper Components\n';
    for (const h of internalHelperComponents) {
      const parentNeedsSuffix = filesNeedingSuffix.has(h.parent);
      const parentNodeId = parentNeedsSuffix ? `${h.parent}_file` : h.parent;
      if (h.parent === h.child) continue;
      markdown += `${parentNodeId} -.-> ${h.child} : "internal"\n`;
    }
  }

  // ── Functions ─────────────────────────────────────────────────────────────
  if ((elements.functions ?? []).length > 0) {
    markdown += `\n%% Functions\n`;
    for (const func of elements.functions!) {
      if (nodeIds.has(func)) continue;
      nodeIds.add(func);
      markdown += `${func}[Function: ${func}]\n`;
    }
  }

  // ── Hooks (as [Function:], NOT [Hook:]) ───────────────────────────────────
  if ((elements.hooks ?? []).length > 0) {
    markdown += `\n%% Hooks\n`;
    for (const hook of elements.hooks!) {
      if (nodeIds.has(hook)) continue;
      nodeIds.add(hook);
      markdown += `${hook}[Function: ${hook}]\n`;
    }
  }

  // ── Internal Hooks (same name as parent) ──────────────────────────────────
  if (internalHooks.size > 0) {
    markdown += '\n%% Internal Hooks (same name as parent)\n';
    internalHooks.forEach((data: { parent: string; parentType: string }, hookName: string) => {
      const parentNodeId = `${data.parent}_file`;
      markdown += `${parentNodeId} -.-> ${hookName} : "internal hook"\n`;
    });
  }

  // ── Services (as [Function:], NOT ((Service:))) ───────────────────────────
  if ((elements.services ?? []).length > 0) {
    markdown += `\n%% Services\n`;
    for (const service of elements.services!) {
      if (nodeIds.has(service)) continue;
      nodeIds.add(service);
      markdown += `${service}[Function: ${service}]\n`;
    }
  }

  // ── Stores ────────────────────────────────────────────────────────────────
  if ((elements.stores ?? []).length > 0) {
    markdown += `\n%% Stores\n`;
    for (const store of elements.stores!) {
      if (nodeIds.has(store)) continue;
      nodeIds.add(store);
      markdown += `${store}[[Store: ${store}]]\n`;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  if ((elements.utilities ?? []).length > 0) {
    markdown += `\n%% Utilities\n`;
    for (const util of elements.utilities!) {
      if (nodeIds.has(util)) continue;
      nodeIds.add(util);
      markdown += `${util}[Function: ${util}]\n`;
    }
  }

  // ── Classes ───────────────────────────────────────────────────────────────
  if ((elements.classes ?? []).length > 0) {
    markdown += `\n%% Classes\n`;
    for (const cls of elements.classes!) {
      if (nodeIds.has(cls)) continue;
      nodeIds.add(cls);
      markdown += `${cls}[[Class: ${cls}]]\n`;
    }
  }

  // ── Constants ─────────────────────────────────────────────────────────────
  if ((elements.constants ?? []).length > 0) {
    markdown += `\n%% Constants\n`;
    for (const cnst of elements.constants!) {
      if (nodeIds.has(cnst)) continue;
      nodeIds.add(cnst);
      markdown += `${cnst}[Constant: ${cnst}]\n`;
    }
  }

  // ── Variables ─────────────────────────────────────────────────────────────
  if ((elements.variables ?? []).length > 0) {
    markdown += `\n%% Variables\n`;
    for (const v of elements.variables!) {
      if (nodeIds.has(v)) continue;
      nodeIds.add(v);
      markdown += `${v}[Variable: ${v}]\n`;
    }
  }

  // ── Interfaces ────────────────────────────────────────────────────────────
  if ((elements.interfaces ?? []).length > 0) {
    markdown += `\n%% Interfaces\n`;
    for (const iface of elements.interfaces!) {
      if (nodeIds.has(iface)) continue;
      nodeIds.add(iface);
      markdown += `${iface}[[Interface: ${iface}]]\n`;
    }
  }

  // ── External Libraries (raw names, NO sanitization) ───────────────────────
  if ((elements.imports?.libraries ?? []).length > 0) {
    markdown += `\n%% External Libraries\n`;
    for (const lib of elements.imports!.libraries) {
      if (nodeIds.has(lib)) continue;
      nodeIds.add(lib);
      markdown += `${lib}<Library: ${lib}>\n`;
    }
  }

  // ── Component Internal Functions (node declarations FIRST) ────────────────
  if (componentFunctionsMap.size > 0) {
    markdown += '\n%% Component Internal Functions\n';
    const allComponentFunctions = new Set<string>();
    componentFunctionsMap.forEach((functions) => {
      functions.forEach((func) => allComponentFunctions.add(func));
    });
    allComponentFunctions.forEach((func) => {
      if (nodeIds.has(func)) return;
      nodeIds.add(func);
      markdown += `${func}[Function: ${func}]\n`;
    });

    // Then arrow relationships with descriptive labels
    markdown += '\n%% Component-Function Relationships\n';
    componentFunctionsMap.forEach((functions, component) => {
      const componentNeedsSuffix = filesNeedingSuffix.has(component);
      const componentNodeId = componentNeedsSuffix ? `${component}_file` : component;
      functions.forEach((func) => {
        let label = 'internal function';
        const lower = func.toLowerCase();
        if (lower.includes('handle')) label = 'event handler';
        else if (lower.includes('render')) label = 'render helper';
        else if (lower.includes('update')) label = 'update helper';
        else if (lower.includes('get')) label = 'getter function';
        else if (lower.includes('set')) label = 'setter function';
        else if (lower.includes('calculate') || lower.includes('compute')) label = 'calculation helper';
        else if (lower.includes('should') || lower.includes('is')) label = 'boolean check';
        else if (lower.includes('debounced')) label = 'debounced helper';
        markdown += `${componentNodeId} -.-> ${func} : "${label}"\n`;
      });
    });
  }

  // ── Vanilla root entry-point ──────────────────────────────────────────────
  let vanillaRootId: string | null = null;
  if (isVanilla && fileContainers.size > 0) {
    vanillaRootId = `${sanitizeNodeId(repoName)}_root`;
    markdown += `\n%% Entry-point root\n`;
    markdown += `${vanillaRootId}{Component: ${repoName}}\n`;
    nodeIds.add(vanillaRootId);
  }

  // ── File Container Nodes ──────────────────────────────────────────────────
  if (fileContainers.size > 0) {
    markdown += '\n%% File Container Nodes\n';
    fileContainers.forEach((fileInfo, _filePath) => {
      const fileName = fileInfo.displayName;
      const fileNodeId = fileInfo.nodeId!;

      if (isVanilla) {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}{Component: ${fileName}}\n`;
        }
      } else if (fileInfo.isBackend) {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}((Service: ${fileName}))\n`;
        }
      } else if (fileInfo.type === 'service') {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}((Service: ${fileName}))\n`;
        }
      } else if (fileInfo.type === 'hook') {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}[Hook: ${fileName}]\n`;
        }
      } else if (fileInfo.type === 'store') {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}[[Store: ${fileName}]]\n`;
        }
      } else if (fileInfo.type === 'worker') {
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}[Function: ${fileName}]\n`;
        }
      } else {
        // utility (and shaders container)
        if (!nodeIds.has(fileNodeId)) {
          nodeIds.add(fileNodeId);
          markdown += `${fileNodeId}[Function: ${fileName}]\n`;
        }
      }
    });

    // File→function containment connections (dashed arrows)
    markdown += '\n%% File-Function Relationships\n';
    fileContainers.forEach((fileInfo, _filePath) => {
      const fileNodeId = fileInfo.nodeId!;
      fileInfo.functions.forEach((funcName: string) => {
        if (!nodeIds.has(funcName)) {
          nodeIds.add(funcName);
          markdown += `${funcName}[Function: ${funcName}]\n`;
        }
        if (fileNodeId) {
          markdown += `${fileNodeId} -.-> ${funcName} : "contains"\n`;
        }
      });
    });

    // Vanilla: nest file containers inside root
    if (vanillaRootId) {
      markdown += '\n%% Vanilla hierarchy (root → file containers)\n';
      fileContainers.forEach((fileInfo) => {
        const fileNodeId = fileInfo.nodeId;
        if (fileNodeId) {
          markdown += `${vanillaRootId} --> ${fileNodeId} : "module"\n`;
        }
      });
    }
  }

  // ── Next.js Route Hierarchy ───────────────────────────────────────────────
  const nextjsRouteMap = elements.nextjsRouteMap ?? new Map();
  if (isNextjs && nextjsRouteMap.size > 0) {
    const nextRootId = `${sanitizeNodeId(repoName)}_root`;
    markdown += `\n%% Next.js Route Hierarchy\n`;
    if (!nodeIds.has(nextRootId)) {
      markdown += `${nextRootId}{Component: ${repoName}}\n`;
      nodeIds.add(nextRootId);
    }
    const resolveRouteNodeId = (fileName: string): string | null => {
      const info = nextjsRouteMap.get(fileName);
      if (info && info.isApi) {
        const apiId = `backend_${fileName}`;
        if (nodeIds.has(apiId)) return apiId;
      }
      const suffixed = `${fileName}_file`;
      if (nodeIds.has(suffixed)) return suffixed;
      if (nodeIds.has(fileName)) return fileName;
      return null;
    };
    const routeGroups = new Map<string, { layouts: string[]; pages: string[]; others: string[] }>();
    nextjsRouteMap.forEach((info: any, fileName: string) => {
      const rp = info.routePath;
      if (!routeGroups.has(rp)) routeGroups.set(rp, { layouts: [], pages: [], others: [] });
      const group = routeGroups.get(rp)!;
      if (info.isLayout || info.isAppShell) group.layouts.push(fileName);
      else if (info.isPage) group.pages.push(fileName);
      else group.others.push(fileName);
    });
    const routeRepresentative = new Map<string, string>();
    routeGroups.forEach((group, routePath) => {
      const rep = group.layouts[0] || group.pages[0] || group.others[0];
      if (rep) routeRepresentative.set(routePath, rep);
    });
    nextjsRouteMap.forEach((info: any, fileName: string) => {
      const existingId = resolveRouteNodeId(fileName);
      if (existingId) return;
      let label = info.segment;
      if (info.isLayout) label = `${info.segment} layout`;
      else if (info.isPage) label = `${info.segment} page`;
      else if (info.isLoading) label = `${info.segment} loading`;
      else if (info.isError) label = `${info.segment} error`;
      else if (info.isNotFound) label = `${info.segment} not-found`;
      else if (info.isMiddleware) label = 'middleware';
      if (info.isApi) {
        const apiId = `backend_${fileName}`;
        if (!nodeIds.has(apiId)) {
          markdown += `${apiId}((Service: ${label}))\n`;
          nodeIds.add(apiId);
        }
      } else {
        markdown += `${fileName}{Component: ${label}}\n`;
        nodeIds.add(fileName);
      }
    });
    markdown += '\n%% Next.js Route Nesting\n';
    const rootRep = routeRepresentative.get('');
    if (rootRep) {
      const rootRepId = resolveRouteNodeId(rootRep);
      if (rootRepId) markdown += `${nextRootId} --> ${rootRepId} : "root layout"\n`;
    }
    routeRepresentative.forEach((repFileName, routePath) => {
      if (routePath === '') return;
      const info = nextjsRouteMap.get(repFileName);
      if (!info) return;
      const parentRep = routeRepresentative.get(info.parentRoutePath);
      const childId = resolveRouteNodeId(repFileName);
      if (!childId) return;
      if (parentRep) {
        const parentId = resolveRouteNodeId(parentRep);
        if (parentId) markdown += `${parentId} --> ${childId} : "route"\n`;
      } else {
        markdown += `${nextRootId} --> ${childId} : "route"\n`;
      }
    });
    routeGroups.forEach((group, routePath) => {
      const rep = routeRepresentative.get(routePath);
      if (!rep) return;
      const repId = resolveRouteNodeId(rep);
      if (!repId) return;
      const siblings = [...group.pages, ...group.others].filter(f => f !== rep);
      siblings.forEach((fileName) => {
        const sibId = resolveRouteNodeId(fileName);
        if (sibId && sibId !== repId) markdown += `${repId} -.-> ${sibId} : "contains"\n`;
      });
    });
  }

  // ── Component Relationships (routed through parent containers) ────────────
  const componentRelationships = elements.componentRelationships ?? [];
  // Group by parent component
  const compRelMap = new Map<string, Set<string>>();
  for (const rel of componentRelationships) {
    if (!compRelMap.has(rel.parent)) compRelMap.set(rel.parent, new Set());
    compRelMap.get(rel.parent)!.add(rel.child);
  }
  // Filter to only include components that exist
  const componentsSet = new Set(elements.components ?? []);
  for (const [component, usedComps] of compRelMap) {
    const filtered = new Set([...usedComps].filter(comp => componentsSet.has(comp)));
    compRelMap.set(component, filtered);
  }
  for (const [component, usedComps] of compRelMap) {
    if (usedComps.size === 0) compRelMap.delete(component);
  }
  if (compRelMap.size > 0) {
    markdown += '\n%% Component Relationships\n';
    const componentPropsRelationships = elements.componentPropsRelationships ?? new Map();
    compRelMap.forEach((usedComponents, component) => {
      usedComponents.forEach((usedComp) => {
        const propsMap = componentPropsRelationships.get(component);
        let label = 'uses';
        if (propsMap && propsMap.has(usedComp)) {
          const props = Array.from(propsMap.get(usedComp)!) as string[];
          const displayProps = props.slice(0, 3);
          label = props.length > 3 ? `${displayProps.join(', ')}...` : displayProps.join(', ');
        } else {
          const lower = usedComp.toLowerCase();
          if (lower.includes('renderer')) label = 'renders';
          else if (lower.includes('ui') || lower.includes('input') || lower.includes('picker')) label = 'displays UI';
          else if (lower.includes('camera')) label = 'camera';
          else if (lower.includes('connection')) label = 'connections';
        }
        const routedConnections = generateRoutedConnection(component, usedComp, label, childToParentMap, nodeIds, filesNeedingSuffix);
        routedConnections.forEach(conn => { markdown += `${conn}\n`; });
      });
    });
  }

  // ── Component Dependencies (hooks/services/stores/utilities) ──────────────
  const componentDependencies = elements.componentDependencies ?? [];
  // Group by component and deduplicate
  const compDepMap = new Map<string, Set<{ target: string; label: string; type?: string }>>();
  for (const dep of componentDependencies) {
    if (!compDepMap.has(dep.component)) compDepMap.set(dep.component, new Set());
    compDepMap.get(dep.component)!.add(dep);
  }
  if (compDepMap.size > 0) {
    markdown += '\n%% Component Dependencies\n';
    const hookReturnValueRelationships = elements.hookReturnValueRelationships ?? new Map();
    compDepMap.forEach((deps, component) => {
      deps.forEach((dep) => {
        let label = dep.label || `uses`;

        // Check for detailed hook return values
        const hookReturns = hookReturnValueRelationships.get(component);
        if (hookReturns) {
          for (const hookInfo of hookReturns) {
            if (hookInfo.hook === dep.target && hookInfo.returnValues.length > 0) {
              const displayValues = hookInfo.returnValues.slice(0, 3);
              label = hookInfo.returnValues.length > 3
                ? `{${displayValues.join(', ')}...}`
                : `{${displayValues.join(', ')}}`;
              break;
            }
          }
        }

        const routedConnections = generateRoutedConnection(component, dep.target, label, childToParentMap, nodeIds, filesNeedingSuffix);
        routedConnections.forEach(conn => { markdown += `${conn}\n`; });
      });
    });
  }

  // ── Function Call Relationships (routed) ──────────────────────────────────
  const functionCallRelationships = elements.functionCallRelationships ?? new Map();
  if (functionCallRelationships.size > 0) {
    markdown += '\n%% Function Call Relationships\n';
    functionCallRelationships.forEach((calls: Set<{ target: string; label: string; type: string }>, caller: string) => {
      calls.forEach((callInfo) => {
        const routedConnections = generateRoutedConnection(caller, callInfo.target, callInfo.label, childToParentMap, nodeIds, filesNeedingSuffix);
        routedConnections.forEach(conn => { markdown += `${conn}\n`; });
      });
    });
  }

  // ── Store Usage Details (routed, with state/action details) ───────────────
  const storeUsageRelationships = elements.storeUsageRelationships ?? new Map();
  if (storeUsageRelationships.size > 0) {
    markdown += '\n%% Store Usage Details\n';
    storeUsageRelationships.forEach((storeMap: Map<string, { properties: Set<string> | string[]; actions: Set<string> | string[] }>, component: string) => {
      storeMap.forEach((usage, storeName) => {
        const allItems: string[] = [];
        const properties = usage.properties instanceof Set ? Array.from(usage.properties) : (usage.properties ?? []);
        const actions = usage.actions instanceof Set ? Array.from(usage.actions) : (usage.actions ?? []);
        if (properties.length > 0) allItems.push(...properties);
        if (actions.length > 0) allItems.push(...actions.map((a: string) => `${a}()`));
        if (allItems.length > 0) {
          const displayItems = allItems.slice(0, 4);
          let label = displayItems.join(', ');
          if (allItems.length > 4) label += '...';
          const routedConnections = generateRoutedConnection(component, storeName, label, childToParentMap, nodeIds, filesNeedingSuffix);
          routedConnections.forEach(conn => { markdown += `${conn}\n`; });
        }
      });
    });
  }

  // ── API Endpoints ─────────────────────────────────────────────────────────
  const apiEndpoints = elements.apiEndpoints ?? new Map();
  if (apiEndpoints.size > 0) {
    markdown += '\n%% API Endpoints\n';
    apiEndpoints.forEach((ep: any, epKey: string) => {
      if (!nodeIds.has(epKey)) {
        nodeIds.add(epKey);
        markdown += `${epKey}[Endpoint: ${ep.method} ${ep.path}]\n`;
      }
    });
    markdown += '\n%% API Handler Chains\n';
    apiEndpoints.forEach((ep: any, epKey: string) => {
      for (const handler of (ep.handlers ?? [])) {
        markdown += `${epKey} --> ${handler} : "handler"\n`;
      }
    });
  }

  // ── Database Models ───────────────────────────────────────────────────────
  const dbModels = elements.dbModels ?? new Map();
  if (dbModels.size > 0) {
    markdown += '\n%% Database Models\n';
    dbModels.forEach((_rels: any, modelName: string) => {
      const nodeId = `${modelName}_model`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        markdown += `${nodeId}[[Store: ${modelName}]]\n`;
      }
    });
    const hasRelationships = [...dbModels.values()].some((s: any) => s.size > 0);
    if (hasRelationships) {
      markdown += '\n%% Model Relationships\n';
      dbModels.forEach((related: any, modelName: string) => {
        const srcId = `${modelName}_model`;
        related.forEach((relName: string) => {
          const tgtId = `${relName}_model`;
          if (nodeIds.has(srcId) && nodeIds.has(tgtId)) {
            markdown += `${srcId} --> ${tgtId} : "references"\n`;
          }
        });
      });
    }
  }

  // ── Auth Guards ───────────────────────────────────────────────────────────
  const authGuards = elements.authGuards ?? new Set<string>();
  if (authGuards.size > 0) {
    markdown += '\n%% Auth Guards\n';
    authGuards.forEach((guardName: string) => {
      const nodeId = sanitizeNodeId(guardName);
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        markdown += `${nodeId}[Guard: ${guardName}]\n`;
      }
    });
    const authFlows = elements.authFlows ?? [];
    if (authFlows.length > 0) {
      markdown += '\n%% Auth Flows\n';
      authFlows.forEach(({ source, target, type }: { source: string; target: string; type: string }) => {
        const srcId = sanitizeNodeId(source);
        const tgtId = sanitizeNodeId(target);
        if (nodeIds.has(srcId) || childToParentMap.has(source)) {
          markdown += `${srcId} --> ${tgtId} : "${type}"\n`;
        }
      });
    }
  }

  // ── Events (inverted from plugin's Map<objName, Set<evtName>> to hoverchart's Map<evtName, Set<objName>>) ──
  const pluginEmitters = elements.eventEmitters ?? new Map<string, Set<string>>();
  const pluginListeners = elements.eventListeners ?? new Map<string, Set<string>>();
  // Invert: plugin stores Map<objectName, Set<eventName>>, hoverchart needs Map<eventName, Set<objectName>>
  const eventEmitters = new Map<string, Set<string>>();
  const eventListeners = new Map<string, Set<string>>();
  for (const [objName, events] of pluginEmitters) {
    for (const evtName of events) {
      if (!eventEmitters.has(evtName)) eventEmitters.set(evtName, new Set());
      eventEmitters.get(evtName)!.add(objName);
    }
  }
  for (const [objName, events] of pluginListeners) {
    for (const evtName of events) {
      if (!eventListeners.has(evtName)) eventListeners.set(evtName, new Set());
      eventListeners.get(evtName)!.add(objName);
    }
  }
  const allEventNames = new Set([...eventEmitters.keys(), ...eventListeners.keys()]);
  if (allEventNames.size > 0) {
    markdown += '\n%% Events\n';
    allEventNames.forEach(evtName => {
      const nodeId = `${evtName}_event`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        markdown += `${nodeId}((Service: ${evtName}))\n`;
      }
    });
    markdown += '\n%% Event Flows\n';
    eventEmitters.forEach((sources, evtName) => {
      const tgtId = `${evtName}_event`;
      if (!nodeIds.has(tgtId)) return;
      sources.forEach(src => {
        const srcId = sanitizeNodeId(src);
        if (nodeIds.has(srcId) || childToParentMap.has(src)) {
          markdown += `${srcId} --> ${tgtId} : "emits"\n`;
        }
      });
    });
    eventListeners.forEach((sources, evtName) => {
      const evtNodeId = `${evtName}_event`;
      if (!nodeIds.has(evtNodeId)) return;
      sources.forEach(listener => {
        const listId = sanitizeNodeId(listener);
        if (nodeIds.has(listId) || childToParentMap.has(listener)) {
          markdown += `${evtNodeId} --> ${listId} : "listened by"\n`;
        }
      });
    });
  }

  // ── Error Boundaries ──────────────────────────────────────────────────────
  const errorBoundaries = elements.errorBoundaries ?? new Set<string>();
  const suspenseBoundaries = elements.suspenseBoundaries ?? new Set<string>();
  if (errorBoundaries.size > 0 || suspenseBoundaries.size > 0) {
    markdown += '\n%% Error Boundaries\n';
    errorBoundaries.forEach((boundaryName: string) => {
      if (!nodeIds.has(boundaryName)) {
        nodeIds.add(boundaryName);
        markdown += `${boundaryName}[Boundary: ${boundaryName}]\n`;
      }
    });
    suspenseBoundaries.forEach((boundaryId: string) => {
      if (!nodeIds.has(boundaryId)) {
        nodeIds.add(boundaryId);
        markdown += `${boundaryId}[Boundary: Suspense]\n`;
      }
    });
    const errorContainment = elements.errorContainment ?? new Map<string, Set<string>>();
    if (errorContainment.size > 0) {
      markdown += '\n%% Error Containment\n';
      errorContainment.forEach((wrappedSet: Set<string>, boundary: string) => {
        const srcId = sanitizeNodeId(boundary);
        const isErrorBoundary = errorBoundaries.has(boundary);
        const label = isErrorBoundary ? 'catches errors from' : 'suspends';
        wrappedSet.forEach((wraps: string) => {
          const tgtId = sanitizeNodeId(wraps);
          if ((nodeIds.has(srcId) || childToParentMap.has(boundary)) &&
              (nodeIds.has(tgtId) || childToParentMap.has(wraps))) {
            markdown += `${srcId} -.-> ${tgtId} : "${label}"\n`;
          }
        });
      });
    }
  }

  // ── Shared Interfaces ─────────────────────────────────────────────────────
  const sharedInterfaces = elements.sharedInterfaces ?? new Map();
  if (sharedInterfaces.size > 0) {
    markdown += '\n%% Shared Interfaces\n';
    sharedInterfaces.forEach((_sourceFile: any, ifaceName: string) => {
      if (!nodeIds.has(ifaceName)) {
        nodeIds.add(ifaceName);
        markdown += `${ifaceName}[[Interface: ${ifaceName}]]\n`;
      }
    });
    const interfaceUsages = elements.interfaceUsages ?? new Map();
    if (interfaceUsages.size > 0) {
      markdown += '\n%% Interface Dependencies\n';
      interfaceUsages.forEach((ifaces: any, consumer: string) => {
        const srcId = sanitizeNodeId(consumer);
        if (!nodeIds.has(srcId) && !childToParentMap.has(consumer)) return;
        ifaces.forEach((ifaceName: string) => {
          if (nodeIds.has(ifaceName)) {
            markdown += `${srcId} --> ${ifaceName} : "uses type"\n`;
          }
        });
      });
    }
  }

  // Wrap in Merfolk code blocks
  return `\`\`\`merfolk\n${markdown}\`\`\`\n`;
}
