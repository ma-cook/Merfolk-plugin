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

  // %% Hooks — use [Hook: name] syntax
  if (hooks.length > 0) {
    lines.push('%% Hooks');
    for (const hook of hooks) {
      lines.push(`${hook}[Hook: ${hook}]`);
    }
    lines.push('');
  }

  // %% Services — use ((Service: name)) syntax
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
      lines.push(`${rel.parent} --> ${rel.child} : "${rel.propsStr}"`);
    }
    lines.push('');
  }

  // %% Component Dependencies
  // Each call site is emitted as-is (no deduplication) with a two-line chain
  // for non-store targets: Caller --> container : label + container --> target : "receives"
  const compDeps = elements.componentDependencies ?? [];
  const hookReturnValueRels = elements.hookReturnValueRelationships ?? new Map<string, { hook: string; returnValues: string[] }[]>();
  const depLines: string[] = [];
  for (const dep of compDeps) {
    if (!componentSet.has(dep.component)) continue;
    // Resolve to file container if available
    const resolvedTarget = funcToContainerNodeId.get(dep.target) ?? dep.target;
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
    depLines.push(`${dep.component} --> ${resolvedTarget} : "${label}"`);
    // Add "receives" line for non-store targets (two-line chain pattern)
    if (!storeSet.has(dep.target) && !storeSet.has(resolvedTarget)) {
      depLines.push(`${resolvedTarget} --> ${dep.target} : "receives"`);
    }
  }
  if (depLines.length > 0) {
    lines.push('%% Component Dependencies');
    lines.push(...depLines);
    lines.push('');
  }

  // %% Function Call Relationships
  // Per-call-site (NOT deduplicated) two-line chains for function calls and
  // single-line store method calls discovered via deep body traversal.
  const rawCallSites = elements.rawCallSites ?? [];
  const callRelLines: string[] = [];
  for (const site of rawCallSites) {
    if (site.method) {
      // Store method call: single-line entry
      if (storeSet.has(site.calleeName)) {
        callRelLines.push(`${site.caller} --> ${site.calleeName} : "${site.method}"`);
      }
    } else {
      // Regular function call: two-line chain
      const container = funcToContainerNodeId.get(site.calleeName);
      if (container) {
        callRelLines.push(`${site.caller} --> ${container} : "calls ${site.calleeName}"`);
        callRelLines.push(`${container} --> ${site.calleeName} : "receives"`);
      }
    }
  }
  if (callRelLines.length > 0) {
    lines.push('%% Function Call Relationships');
    lines.push(...callRelLines);
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
        storeUsageLines.push(`${comp} --> ${store} : "{${parts.join(', ')}}"`);
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
