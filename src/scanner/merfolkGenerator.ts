import type { Elements, RepoType, FileContainerInfo, RegistryNode, NodeRegistry, RelationIntent, ResolvedConnection } from '../types';
import { sanitizeNodeId } from '../utils';

// ==================== BUILT-IN & EXTERNAL API DETECTION ====================

/**
 * JS built-ins and global functions that should not generate diagram nodes.
 * Mirrors Hoverchart's defensive filtering.
 */
const JS_BUILTINS = new Set([
  // Global functions
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'eval', 'alert', 'typeof',
  'instanceof', 'delete', 'void', 'in', 'of', 'new',
  // Math methods
  'Math.abs', 'Math.ceil', 'Math.floor', 'Math.round', 'Math.max', 'Math.min',
  // Array methods
  'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'includes',
  'slice', 'splice', 'concat', 'join', 'split', 'push', 'pop', 'shift',
  'unshift', 'reverse', 'sort', 'some', 'every', 'flat', 'flatMap',
  // Object methods
  'Object.assign', 'Object.create', 'Object.keys', 'Object.values',
  'Object.entries', 'Object.defineProperty', 'Object.freeze', 'Object.seal',
  'Object.getOwnPropertyNames', 'Object.getPrototypeOf',
  // String methods
  'charAt', 'charCodeAt', 'concat', 'indexOf', 'lastIndexOf', 'match',
  'replace', 'search', 'slice', 'split', 'substring', 'substr', 'toLowerCase',
  'toUpperCase', 'trim', 'startsWith', 'endsWith', 'includes',
  // Browser globals
  'fetch', 'localStorage', 'sessionStorage', 'JSON', 'console',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'Promise', 'async', 'await',
  // React/Vue internal
  'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
  'useMemo', 'useRef', 'useLayoutEffect', 'useImperativeHandle', 'ref',
  'createElement', 'Fragment', 'StrictMode', 'Suspense', 'lazy',
  'forwardRef', 'memo', 'createContext', 'provides', 'inject',
]);

/**
 * Check if a symbol name is a JS built-in or browser global.
 * These should NOT generate nodes in the diagram.
 */
function isBuiltinOrGlobal(name: string): boolean {
  const lower = name.toLowerCase();
  if (JS_BUILTINS.has(name)) return true;
  if (JS_BUILTINS.has(lower)) return true;
  // Check for patterns like setXxx (React state setters from useState)
  if (/^set[A-Z]/.test(name)) return true;
  // Check for math methods
  if (name.startsWith('Math.')) return true;
  // Check for object/array method aliases
  if (['slice', 'splice', 'map', 'filter', 'reduce'].includes(name)) return true;
  return false;
}

/**
 * Canonical node ID resolver — applies consistent ID strategy everywhere.
 * Ensures node creation, connection source/target, and collision checks all use same format.
 *
 * Rules:
 * 1. If symbol is a built-in or external API → return null (should not emit)
 * 2. If symbol appears in multiple categories → use canonical priority ID
 * 3. If symbol collides with another name → namespace with sourceFile__symbolName
 * 4. Otherwise → return sanitized name
 */
function toNodeId(
  name: string,
  _filePath: string | undefined,
  _type: string,
  _options?: {
    ignoreBuiltin?: boolean;
    forceSimple?: boolean;
  }
): string | null {
  if (!_options?.ignoreBuiltin && isBuiltinOrGlobal(name)) return null;
  // For now, return sanitized name; collision/namespace logic handled in finalization phase
  return sanitizeNodeId(name);
}

// ==================== RELATION INTENT COLLECTION ====================

/**
 * Collect all raw relation intents during traversal.
 * These are temporary and not yet validated against registry.
 */
function collectRelationIntents(elements: Elements): RelationIntent[] {
  const intents: RelationIntent[] = [];

  // From component dependencies
  for (const dep of elements.componentDependencies ?? []) {
    if (!isBuiltinOrGlobal(dep.target)) {
      intents.push({
        sourceSymbol: dep.component,
        targetSymbol: dep.target,
        sourceContext: 'component',
        label: dep.label,
        type: 'uses',
      });
    }
  }

  // From raw call sites
  for (const site of elements.rawCallSites ?? []) {
    if (!isBuiltinOrGlobal(site.calleeName)) {
      intents.push({
        sourceSymbol: site.caller,
        targetSymbol: site.calleeName,
        label: site.method ? `calls ${site.method}` : `calls ${site.calleeName}`,
        type: 'call',
      });
    }
  }

  // From function call relationships
  for (const [caller, calls] of elements.functionCallRelationships ?? new Map()) {
    for (const callInfo of calls) {
      if (!isBuiltinOrGlobal(callInfo.target)) {
        intents.push({
          sourceSymbol: caller,
          targetSymbol: callInfo.target,
          label: callInfo.label,
          type: 'call',
        });
      }
    }
  }

  // From component relationships
  for (const rel of elements.componentRelationships ?? []) {
    intents.push({
      sourceSymbol: rel.parent,
      targetSymbol: rel.child,
      sourceContext: 'component',
      targetContext: 'component',
      label: 'renders',
      type: 'render',
    });
  }

  // From store usage
  for (const [comp, storeMap] of elements.storeUsageRelationships ?? new Map()) {
    for (const [store] of storeMap) {
      intents.push({
        sourceSymbol: comp,
        targetSymbol: store,
        sourceContext: 'component',
        label: `uses ${store}`,
        type: 'uses',
      });
    }
  }

  return intents;
}

// ==================== PHASE 1: COLLECT NODE CANDIDATES ====================

/**
 * Phase 1: Collect all node candidates before deduplication.
 * Builds raw registry from elements without resolving collisions.
 */
function collectNodeCandidates(
  elements: Elements,
  _repoName: string,
  _filesNeedingSuffix: Set<string>
): RegistryNode[] {
  const candidates: RegistryNode[] = [];

  // Components
  for (const comp of elements.components ?? []) {
    candidates.push({
      id: comp,
      label: comp,
      type: 'Component',
      category: 'component',
      sourceFile: elements.componentRelationships?.find(r => r.parent === comp)?.parent,
      origin: 'components',
    });
  }

  // Functions
  for (const fn of elements.functions ?? []) {
    const id = sanitizeNodeId(fn);
    candidates.push({
      id,
      label: fn,
      type: 'Function',
      category: 'function',
      origin: 'functions',
    });
  }

  // Hooks
  for (const hook of elements.hooks ?? []) {
    const id = sanitizeNodeId(hook);
    candidates.push({
      id,
      label: hook,
      type: 'Hook',
      category: 'hook',
      origin: 'hooks',
    });
  }

  // Services
  for (const svc of elements.services ?? []) {
    const id = sanitizeNodeId(svc);
    candidates.push({
      id,
      label: svc,
      type: 'Service',
      category: 'service',
      origin: 'services',
    });
  }

  // Stores
  for (const store of elements.stores ?? []) {
    const id = sanitizeNodeId(store);
    candidates.push({
      id,
      label: store,
      type: 'Store',
      category: 'store',
      origin: 'stores',
    });
  }

  // Utilities
  for (const util of elements.utilities ?? []) {
    const id = sanitizeNodeId(util);
    candidates.push({
      id,
      label: util,
      type: 'Function',
      category: 'utility',
      origin: 'utilities',
    });
  }

  // Libraries
  for (const lib of elements.imports?.libraries ?? []) {
    const id = sanitizeNodeId(lib);
    candidates.push({
      id,
      label: lib,
      type: 'Library',
      category: 'library',
      origin: 'libraries',
    });
  }

  // Classes
  for (const cls of elements.classes ?? []) {
    const id = sanitizeNodeId(cls);
    candidates.push({
      id,
      label: cls,
      type: 'Class',
      category: 'class',
      origin: 'classes',
    });
  }

  // Constants
  for (const cnst of elements.constants ?? []) {
    const id = sanitizeNodeId(cnst);
    candidates.push({
      id,
      label: cnst,
      type: 'Constant',
      category: 'constant',
      origin: 'constants',
    });
  }

  // Variables
  for (const v of elements.variables ?? []) {
    const id = sanitizeNodeId(v);
    candidates.push({
      id,
      label: v,
      type: 'Variable',
      category: 'variable',
      origin: 'variables',
    });
  }

  // Interfaces
  for (const iface of elements.interfaces ?? []) {
    const id = sanitizeNodeId(iface);
    candidates.push({
      id,
      label: iface,
      type: 'Interface',
      category: 'interface',
      origin: 'interfaces',
    });
  }

  // Component internal functions
  for (const fn of elements.componentInternalFunctions ?? []) {
    const id = sanitizeNodeId(fn.functionName);
    candidates.push({
      id,
      label: fn.functionName,
      type: 'Function',
      category: 'function',
      sourceFile: undefined,
      origin: 'componentInternalFunctions',
      isChildNode: true,
      parentId: fn.componentName,
    });
  }

  // File containers
  const fileContainers = elements.fileContainers ?? new Map<string, FileContainerInfo>();
  for (const [filePath, info] of fileContainers) {
    const id = sanitizeNodeId(info.displayName);
    candidates.push({
      id,
      label: info.displayName,
      type: info.type,
      category: info.type.toLowerCase() as any,
      sourceFile: filePath,
      origin: 'fileContainers',
      metadata: { isFileContainer: true, displayName: info.displayName },
    });
  }

  // Error/Suspense boundaries
  for (const boundary of elements.errorBoundaries ?? new Set()) {
    candidates.push({
      id: boundary,
      label: boundary,
      type: 'Error Boundary',
      category: 'other',
      origin: 'errorBoundaries',
    });
  }

  for (const boundary of elements.suspenseBoundaries ?? new Set()) {
    candidates.push({
      id: boundary,
      label: boundary,
      type: 'Suspense',
      category: 'other',
      origin: 'suspenseBoundaries',
    });
  }

  // Shaders
  for (const shader of elements.shaders ?? []) {
    const id = sanitizeNodeId(shader);
    candidates.push({
      id,
      label: shader,
      type: 'Shader',
      category: 'other',
      origin: 'shaders',
    });
  }

  // Web Workers
  for (const worker of elements.workers ?? []) {
    const id = sanitizeNodeId(worker);
    candidates.push({
      id,
      label: worker,
      type: 'Worker',
      category: 'other',
      origin: 'workers',
    });
  }

  // Events (event names)
  const allEventNames = new Set<string>();
  for (const [, events] of elements.eventEmitters ?? new Map()) {
    for (const evt of events) allEventNames.add(evt);
  }
  for (const [, events] of elements.eventListeners ?? new Map()) {
    for (const evt of events) allEventNames.add(evt);
  }
  for (const evtName of allEventNames) {
    const id = `${sanitizeNodeId(evtName)}_event`;
    candidates.push({
      id,
      label: evtName,
      type: 'Event',
      category: 'other',
      origin: 'eventEmitters',
    });
  }

  // Event emitter/listener objects
  const allEmitterObjectNames = new Set([...( elements.eventEmitters ?? new Map()).keys(), ...(elements.eventListeners ?? new Map()).keys()]);
  for (const name of allEmitterObjectNames) {
    if ((elements.eventEmitters?.get(name)?.size ?? 0) === 0 && (elements.eventListeners?.get(name)?.size ?? 0) === 0) {
      const id = sanitizeNodeId(name);
      candidates.push({
        id,
        label: name,
        type: 'Emitter',
        category: 'other',
        origin: 'eventEmitters',
      });
    }
  }

  // Next.js Routes
  const nextjsRouteMap = elements.nextjsRouteMap ?? new Map();
  for (const [, info] of nextjsRouteMap) {
    const id = sanitizeNodeId(info.routePath === '/' ? 'route_root' : `route_${info.routePath.replace(/\//g, '_')}`);
    candidates.push({
      id,
      label: info.routePath || '/',
      type: info.isLayout ? 'Layout' : info.isPage ? 'Page' : info.isApi ? 'API Route' : 'Route',
      category: 'other',
      origin: 'nextjsRouteMap',
    });
  }

  // API Endpoints
  const apiEndpoints = elements.apiEndpoints ?? new Map();
  for (const [, info] of apiEndpoints) {
    const id = sanitizeNodeId(`api_${info.method}_${info.path.replace(/\//g, '_')}`);
    candidates.push({
      id,
      label: `${info.method} ${info.path}`,
      type: 'API',
      category: 'other',
      origin: 'apiEndpoints',
    });
  }

  //Database Models
  const dbModels = elements.dbModels ?? new Map();
  for (const [name] of dbModels) {
    const id = sanitizeNodeId(name);
    candidates.push({
      id,
      label: name,
      type: 'Model',
      category: 'other',
      origin: 'dbModels',
    });
  }

  // Auth Guards
  const authGuards = elements.authGuards ?? new Set();
  for (const guard of authGuards) {
    const id = sanitizeNodeId(guard);
    candidates.push({
      id,
      label: guard,
      type: 'Auth Guard',
      category: 'other',
      origin: 'authGuards',
    });
  }

  // Shared Interfaces
  const sharedInterfaces = elements.sharedInterfaces ?? new Map();
  for (const [name] of sharedInterfaces) {
    const id = sanitizeNodeId(name);
    candidates.push({
      id,
      label: name,
      type: 'Interface',
      category: 'interface',
      origin: 'sharedInterfaces',
    });
  }

  return candidates;
}

// ==================== PHASE 2: FINALIZE NODES ====================

/**
 * Category precedence for type resolution when symbol appears in multiple categories.
 * Higher number = higher precedence.
 */
const CATEGORY_PRECEDENCE: Record<string, number> = {
  component: 100,
  store: 90,
  service: 80,
  hook: 70,
  utility: 60,
  function: 50,
  class: 40,
  interface: 30,
  constant: 20,
  variable: 10,
  library: 5,
  other: 0,
};

/**
 * Phase 2: Finalize node registry by:
 * 1. Deduplicating by ID
 * 2. Applying category precedence (higher precedence keeps its type)
 * 3. Detecting and resolving collisions with suffixes
 * 4. Building final canonical registry
 */
function finalizeNodeRegistry(candidates: RegistryNode[], allSymbolNames?: Set<string>): NodeRegistry {
  const registry: NodeRegistry = new Map<string, RegistryNode>();
  const idConflicts = new Map<string, RegistryNode[]>();

  // First pass: collect by ID, track conflicts
  for (const candidate of candidates) {
    if (!candidate.id) continue; // skip invalid
    
    // Check if this is a file container that needs a suffix
    // (its name collides with an existing symbol)
    let id = candidate.id;
    if (candidate.metadata?.isFileContainer && allSymbolNames) {
      // Check if this name collides with any symbol
      if (allSymbolNames.has(candidate.label) || allSymbolNames.has(id)) {
        id = `${id}_file`;
        candidate.id = id; // update the candidate's ID
      }
    }

    const existing = registry.get(id);
    if (existing) {
      // Conflict! Add to conflict tracking
      if (!idConflicts.has(id)) {
        idConflicts.set(id, [existing]);
      }
      idConflicts.get(id)!.push(candidate);
    } else {
      registry.set(id, candidate);
    }
  }

  // Resolve conflicts using category precedence
  for (const [id, conflicting] of idConflicts) {
    // Sort by precedence (highest first)
    conflicting.sort((a, b) => {
      const precA = CATEGORY_PRECEDENCE[a.category] ?? 0;
      const precB = CATEGORY_PRECEDENCE[b.category] ?? 0;
      return precB - precA;
    });
    // Keep the highest precedence node; others are aliases to it
    const winner = conflicting[0];
    registry.set(id, winner);
  }

  return registry;
}

// ==================== PHASE 3: EMIT NODES & VALIDATED EDGES ====================

/**
 * Resolve a symbol to its canonical node ID from registry.
 * Returns null if symbol is unresolvable or built-in.
 */
function resolveSymbolToNodeId(
  symbol: string,
  registry: NodeRegistry,
  _filesNeedingSuffix: Set<string>
): string | null {
  if (isBuiltinOrGlobal(symbol)) return null;
  const id = sanitizeNodeId(symbol);
  if (registry.has(id)) return id;
  // Check with _file suffix
  const withSuffix = `${id}_file`;
  if (registry.has(withSuffix)) return withSuffix;
  // Not found
  return null;
}

/**
 * Validate and resolve all relation intents against the final registry.
 * Only emits connections where both endpoints exist.
 */
function resolveRelations(
  intents: RelationIntent[],
  registry: NodeRegistry,
  _filesNeedingSuffix: Set<string>
): ResolvedConnection[] {
  const resolved: ResolvedConnection[] = [];
  const seenConnections = new Set<string>();

  for (const intent of intents) {
    const srcId = resolveSymbolToNodeId(intent.sourceSymbol, registry, _filesNeedingSuffix);
    const tgtId = resolveSymbolToNodeId(intent.targetSymbol, registry, _filesNeedingSuffix);

    if (!srcId || !tgtId) {
      // Skip unresolvable connections
      continue;
    }

    const key = `${srcId}|${tgtId}|${intent.label}`;
    if (seenConnections.has(key)) continue; // avoid duplicates
    seenConnections.add(key);

    resolved.push({
      sourceId: srcId,
      targetId: tgtId,
      label: intent.label,
    });
  }

  return resolved;
}

// ==================== LEGACY HELPER FUNCTIONS ====================

/** Compute the final nodeId for a file container, resolving name collisions. */
function computeContainerNodeId(
  info: FileContainerInfo,
  allNames: Set<string>,
  filesNeedingSuffix: Set<string>
): string {
  const stem = info.displayName;
  if (info.isBackend) return `backend_${stem}`;
  if (filesNeedingSuffix.has(stem) || allNames.has(stem)) return `${stem}_file`;
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

// ==================== MAIN EXPORT ====================

export function generateMerfolkMarkdown(
  elements: Elements,
  repoName: string,
  repoType: RepoType
): string {
  // ========== THREE-PHASE PIPELINE ==========
  
  // PHASE 1: Collect all node candidates (no deduplication yet)
  const filesNeedingSuffix = new Set<string>(elements.filesNeedingSuffix ?? []);
  const candidates = collectNodeCandidates(elements, repoName, filesNeedingSuffix);
  
  // PHASE 2: Finalize registry (dedupe, type priority, collisions)
  const nodeRegistry = finalizeNodeRegistry(candidates);
  
  // PHASE 3a: Collect all relation intents (before validation)
  const relationIntents = collectRelationIntents(elements);
  
  // PHASE 3b: Resolve relations against registry (only emit validated edges)
  const resolvedConnections = resolveRelations(relationIntents, nodeRegistry, filesNeedingSuffix);
  
  // ========== GENERATE MARKDOWN OUTPUT ==========
  
  // Build nodeIds set for legacy compatibility and validation
  const nodeIds = new Set<string>(nodeRegistry.keys());
  
  const lines: string[] = [];
  
  // Header
  lines.push('```merfolk');
  lines.push(`%% ${repoName} Repository Analysis`);
  lines.push('');

  // Emit nodes by category for clean organization
  const categories = {
    components: [] as RegistryNode[],
    functions: [] as RegistryNode[],
    hooks: [] as RegistryNode[],
    services: [] as RegistryNode[],
    stores: [] as RegistryNode[],
    utilities: [] as RegistryNode[],
    classes: [] as RegistryNode[],
    interfaces: [] as RegistryNode[],
    constants: [] as RegistryNode[],
    variables: [] as RegistryNode[],
    libraries: [] as RegistryNode[],
    fileContainers: [] as RegistryNode[],
    childNodes: [] as RegistryNode[],
    boundaries: [] as RegistryNode[],
    other: [] as RegistryNode[],
  };
  
  for (const [, node] of nodeRegistry) {
    if (node.isChildNode) {
      categories.childNodes.push(node);
    } else if (node.category === 'component') {
      categories.components.push(node);
    } else if (node.category === 'function') {
      if (node.origin === 'utilities') categories.utilities.push(node);
      else categories.functions.push(node);
    } else if (node.category === 'hook') {
      categories.hooks.push(node);
    } else if (node.category === 'service') {
      categories.services.push(node);
    } else if (node.category === 'store') {
      categories.stores.push(node);
    } else if (node.category === 'class') {
      categories.classes.push(node);
    } else if (node.category === 'interface') {
      categories.interfaces.push(node);
    } else if (node.category === 'constant') {
      categories.constants.push(node);
    } else if (node.category === 'variable') {
      categories.variables.push(node);
    } else if (node.category === 'library') {
      categories.libraries.push(node);
    } else if (node.metadata?.isFileContainer) {
      categories.fileContainers.push(node);
    } else if (node.origin === 'errorBoundaries' || node.origin === 'suspenseBoundaries') {
      categories.boundaries.push(node);
    } else {
      categories.other.push(node);
    }
  }
  
  // %% Components
  if (categories.components.length > 0) {
    lines.push('%% Components');
    for (const comp of categories.components) {
      lines.push(`${comp.id}{Component: ${comp.id}}`);
    }
    lines.push('');
  }
  
  // %% Functions
  if (categories.functions.length > 0) {
    lines.push('%% Functions');
    for (const fn of categories.functions) {
      lines.push(`${fn.id}[Function: ${fn.id}]`);
    }
    lines.push('');
  }
  
  // %% Hooks
  if (categories.hooks.length > 0) {
    lines.push('%% Hooks');
    for (const hook of categories.hooks) {
      lines.push(`${hook.id}[Hook: ${hook.id}]`);
    }
    lines.push('');
  }
  
  // %% Services
  if (categories.services.length > 0) {
    lines.push('%% Services');
    for (const svc of categories.services) {
      lines.push(`${svc.id}((Service: ${svc.id}))`);
    }
    lines.push('');
  }
  
  // %% Stores
  if (categories.stores.length > 0) {
    lines.push('%% Stores');
    for (const store of categories.stores) {
      lines.push(`${store.id}[[Store: ${store.id}]]`);
    }
    lines.push('');
  }
  
  // %% Utilities
  if (categories.utilities.length > 0) {
    lines.push('%% Utilities');
    for (const util of categories.utilities) {
      lines.push(`${util.id}[Function: ${util.id}]`);
    }
    lines.push('');
  }
  
  // %% Libraries
  if (categories.libraries.length > 0) {
    lines.push('%% External Libraries');
    for (const lib of categories.libraries) {
      lines.push(`${lib.id}<Library: ${lib.id}>`);
    }
    lines.push('');
  }
  
  // %% Classes
  if (categories.classes.length > 0) {
    lines.push('%% Classes');
    for (const cls of categories.classes) {
      lines.push(`${cls.id}[[Class: ${cls.id}]]`);
    }
    lines.push('');
  }
  
  // %% Interfaces
  if (categories.interfaces.length > 0) {
    lines.push('%% Interfaces');
    for (const iface of categories.interfaces) {
      lines.push(`${iface.id}[[Interface: ${iface.id}]]`);
    }
    lines.push('');
  }
  
  // %% Constants
  if (categories.constants.length > 0) {
    lines.push('%% Constants');
    for (const cnst of categories.constants) {
      lines.push(`${cnst.id}[Constant: ${cnst.id}]`);
    }
    lines.push('');
  }
  
  // %% Variables
  if (categories.variables.length > 0) {
    lines.push('%% Variables');
    for (const v of categories.variables) {
      lines.push(`${v.id}[Variable: ${v.id}]`);
    }
    lines.push('');
  }
  
  // %% File Containers
  if (categories.fileContainers.length > 0) {
    lines.push('%% File Container Nodes');
    for (const container of categories.fileContainers) {
      switch (container.type) {
        case 'Hook':
          lines.push(`${container.id}[Hook: ${container.label}]`);
          break;
        case 'Service':
          lines.push(`${container.id}((Service: ${container.label}))`);
          break;
        case 'Store':
          lines.push(`${container.id}[[Store: ${container.label}]]`);
          break;
        default:
          lines.push(`${container.id}[Function: ${container.label}]`);
      }
    }
    lines.push('');
  }
  
  // %% Child Nodes (component internal functions)
  if (categories.childNodes.length > 0) {
    lines.push('%% Child Nodes (Component Internal Functions)');
    const seenChildIds = new Set<string>();
    for (const child of categories.childNodes) {
      if (!seenChildIds.has(child.id)) {
        seenChildIds.add(child.id);
        lines.push(`${child.id}[Function: ${child.id}]`);
      }
    }
    lines.push('');
  }
  
  // %% Boundaries
  if (categories.boundaries.length > 0) {
    lines.push('%% Boundaries');
    for (const boundary of categories.boundaries) {
      lines.push(`${boundary.id}[/Boundary: ${boundary.label}/]`);
    }
    lines.push('');
  }

  // %% Shaders
  const shaders = [...new Set(elements.shaders ?? [])];
  if (shaders.length > 0) {
    lines.push('%% Shaders');
    for (const shader of shaders) {
      const id = sanitizeNodeId(shader);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        lines.push(`${id}[Shader: ${shader}]`);
      }
    }
    lines.push('');
  }

  // %% Web Workers
  const workers = [...new Set(elements.workers ?? [])];
  if (workers.length > 0) {
    lines.push('%% Web Workers');
    for (const worker of workers) {
      const id = sanitizeNodeId(worker);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        lines.push(`${id}[Worker: ${worker}]`);
      }
    }
    lines.push('');
  }

  // %% Events
  const eventEmitters = elements.eventEmitters ?? new Map();
  const eventListeners = elements.eventListeners ?? new Map();
  
  const allEventNames = new Set<string>();
  for (const [, events] of eventEmitters) {
    for (const evt of events) allEventNames.add(evt);
  }
  for (const [, events] of eventListeners) {
    for (const evt of events) allEventNames.add(evt);
  }

  const allEmitterObjectNames = new Set([...eventEmitters.keys(), ...eventListeners.keys()]);
  const emitterObjectsWithNoEvents = [...allEmitterObjectNames].filter(
    name => (eventEmitters.get(name)?.size ?? 0) === 0 && (eventListeners.get(name)?.size ?? 0) === 0
  );

  if (allEventNames.size > 0 || emitterObjectsWithNoEvents.length > 0) {
    lines.push('%% Events');
    // Emit event nodes
    for (const evtName of allEventNames) {
      const nodeId = `${sanitizeNodeId(evtName)}_event`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        lines.push(`${nodeId}((Service: ${evtName}))`);
      }
    }
    // Emit standalone emitter objects with no events
    for (const name of emitterObjectsWithNoEvents) {
      const nodeId = sanitizeNodeId(name);
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        lines.push(`${nodeId}[Emitter: ${name}]`);
      }
    }
    lines.push('');

    // Emit event flows
    const eventFlowLines: string[] = [];
    for (const [objName, events] of eventEmitters) {
      for (const evtName of events) {
        const evtNodeId = `${sanitizeNodeId(evtName)}_event`;
        const srcId = sanitizeNodeId(objName);
        eventFlowLines.push(`${srcId} --> ${evtNodeId} : "emits"`);
      }
    }
    for (const [objName, events] of eventListeners) {
      for (const evtName of events) {
        const evtNodeId = `${sanitizeNodeId(evtName)}_event`;
        const listenerId = sanitizeNodeId(objName);
        eventFlowLines.push(`${evtNodeId} --> ${listenerId} : "listened by"`);
      }
    }
    if (eventFlowLines.length > 0) {
      lines.push('%% Event Flows');
      lines.push(...eventFlowLines);
      lines.push('');
    }
  }

  // %% Next.js Routes
  const nextjsRouteMap = elements.nextjsRouteMap ?? new Map();
  if (nextjsRouteMap.size > 0) {
    lines.push('%% Next.js Route Hierarchy');
    const routeNodes: Map<string, string> = new Map();
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
    // Parent-child nesting
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
    for (const [, info] of apiEndpoints) {
      const nodeId = sanitizeNodeId(`api_${info.method}_${info.path.replace(/\//g, '_')}`);
      lines.push(`${nodeId}((API: ${info.method} ${info.path}))`);
      for (const handler of info.handlers) {
        if (nodeRegistry.has(handler)) {
          lines.push(`${nodeId} --> ${handler} : "handled by"`);
        }
      }
    }
    lines.push('');
  }

  // %% Database Models
  const dbModels = elements.dbModels ?? new Map();
  if (dbModels.size > 0) {
    lines.push('%% Database Models');
    for (const [name] of dbModels) {
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
        if (nodeRegistry.has(user)) {
          lines.push(`${user} --> ${ifaceId} : "uses type"`);
        }
      }
    }
    lines.push('');
  }

  // %% RESOLVED CONNECTIONS (only validated edges)
  if (resolvedConnections.length > 0) {
    lines.push('%% Relationships');
    const seenEdges = new Set<string>();
    for (const conn of resolvedConnections) {
      const edgeKey = `${conn.sourceId}|${conn.targetId}|${conn.label}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        lines.push(`${conn.sourceId} --> ${conn.targetId} : "${conn.label}"`);
      }
    }
    lines.push('');
  }
  
  // %% Legacy support: Special relationships from original elements
  // These bypass the validation pipeline for backward compatibility
  
  // Component-internal function relationships from elements
  const internalFunctions = elements.componentInternalFunctions ?? [];
  const internalFunctionRelLines: string[] = [];
  if (internalFunctions.length > 0) {
    const seenInternalRels = new Set<string>();
    for (const fn of internalFunctions) {
      if (nodeRegistry.has(fn.componentName) && nodeRegistry.has(fn.functionName)) {
        const key = `${fn.componentName}|${fn.functionName}`;
        if (!seenInternalRels.has(key)) {
          seenInternalRels.add(key);
          internalFunctionRelLines.push(`${fn.componentName} -.-> ${fn.functionName} : "${fn.label}"`);
        }
      }
    }
  }
  if (internalFunctionRelLines.length > 0) {
    lines.push('%% Component-Function Relationships');
    lines.push(...internalFunctionRelLines);
    lines.push('');
  }
  
  // Internal helper components
  const helperComps = elements.internalHelperComponents ?? [];
  if (helperComps.length > 0) {
    lines.push('%% Internal Helper Components');
    const seenHelpers = new Set<string>();
    for (const h of helperComps) {
      if (nodeRegistry.has(h.parent) && nodeRegistry.has(h.child)) {
        const key = `${h.parent}|${h.child}`;
        if (!seenHelpers.has(key)) {
          seenHelpers.add(key);
          lines.push(`${h.parent} -.-> ${h.child} : "${h.label}"`);
        }
      }
    }
    lines.push('');
  }
  
  // File-function containment relationships
  const fileContainers = elements.fileContainers ?? new Map<string, FileContainerInfo>();
  if (fileContainers.size > 0) {
    const fileFuncLines: string[] = [];
    for (const [, info] of fileContainers) {
      if (nodeRegistry.has(info.nodeId)) {
        for (const fn of info.functions) {
          if (nodeRegistry.has(fn)) {
            fileFuncLines.push(`${info.nodeId} -.-> ${fn} : "contains"`);
          }
        }
      }
    }
    if (fileFuncLines.length > 0) {
      lines.push('%% File-Function Relationships');
      lines.push(...fileFuncLines);
      lines.push('');
    }
  }
  
  // Close code fence
  lines.push('```');
  
  return lines.join('\n');
}
