// Repo type detection
export type RepoType = 'react' | 'nextjs' | 'vue' | 'python' | 'vanilla';

// File type classification
export type FileType = 'file' | 'python' | 'vue' | 'shader';

// A discovered file in the workspace
export interface WorkspaceFile {
  path: string;
  name: string;
  type: FileType;
}

// File context flags from analyzeFile()
export interface FileContext {
  isComponent: boolean;
  isHook: boolean;
  isService: boolean;
  isStore: boolean;
  isUtil: boolean;
  isWorker: boolean;
  isShader: boolean;
  isBackend: boolean;
  isNextRoute: boolean;
  isModel: boolean;
  isView: boolean;
  isController: boolean;
  isMiddleware: boolean;
  isConfig: boolean;
  isMigration: boolean;
  isCommand: boolean;
  isSerializer: boolean;
  isTask: boolean;
  isComposable: boolean;
  isPlugin: boolean;
  isDirective: boolean;
  isMixin: boolean;
  isLayout: boolean;
  isPage: boolean;
  isRouter: boolean;
}

// Component internal function (defined inside a component body)
export interface ComponentInternalFunction {
  componentName: string;
  functionName: string; // prefixed: e.g. "customcameraMemoizedCameraPosition"
  label: string; // "internal function", "render helper", "update helper", "calculation helper", "boolean check", "getter function"
}

// Component rendering relationship (parent renders child with props)
export interface ComponentRelationship {
  parent: string;
  child: string;
  props: string[]; // prop names passed, or ["uses"] if no props
}

// Component dependency on a hook/store
export interface ComponentDependencyRelation {
  component: string;
  target: string; // hook/store function name
  targetNodeId: string; // resolved file container nodeId or direct name
  destructured: string[]; // values destructured, e.g. ["user", "isAuthenticated"]
  label: string; // "uses store", "uses hook", "{user}", etc.
}

// Internal helper component relationship (both components in same file)
export interface InternalHelperComponent {
  parent: string;
  child: string;
  label: string; // e.g. "internal"
}

// Collected elements across the entire scan
export interface Elements {
  components: string[];
  functions: string[];
  hooks: string[];
  services: string[];
  stores: string[];
  utilities: string[];
  workers: string[];
  shaders: string[];
  classes: string[];
  interfaces: string[];
  variables: string[];
  constants: string[];
  imports: {
    libraries: string[];
  };
  componentInternalFunctions: ComponentInternalFunction[];
  componentRelationships: ComponentRelationship[];
  componentDependencies: ComponentDependencyRelation[];
  fileContainers: Map<string, FileContainerInfo>; // key = filePath
  internalHelperComponents: InternalHelperComponent[];
  rawCallSites: RawCallSite[];                     // per-call-site (NOT deduplicated)
  storeUsageRelationships: Map<string, Map<string, StoreUsageInfo>>; // component -> store -> {properties, actions}
  hookReturnValueRelationships: Map<string, HookReturnValueInfo[]>;  // component -> hook return info
  moduleImportRelationships: Map<string, Set<string>>;               // sourceFile -> Set<importedFileBasename>
  nextjsRouteMap: Map<string, NextjsRouteInfo>;
  apiEndpoints: Map<string, ApiEndpointInfo>;
  dbModels: Map<string, DbModelInfo>;
  authGuards: Set<string>;
  authFlows: AuthFlow[];
  eventEmitters: Map<string, Set<string>>;
  eventListeners: Map<string, Set<string>>;
  errorBoundaries: Set<string>;
  suspenseBoundaries: Set<string>;
  errorContainment: Map<string, Set<string>>;
  sharedInterfaces: Map<string, SharedInterfaceInfo>;
  interfaceUsages: Map<string, Set<string>>;
  internalHooks: Map<string, { parent: string; parentType: string }>;
  filesNeedingSuffix: Set<string>;
}

// Track what's already found to avoid duplicates
export interface FoundItems {
  components: Set<string>;
  functions: Set<string>;
  hooks: Set<string>;
  services: Set<string>;
  stores: Set<string>;
  utilities: Set<string>;
}

// File container info
export interface FileContainerInfo {
  type: string; // 'Hook', 'Service', 'Store', 'Function'
  functions: Set<string>;
  nodeId: string; // provisional stem; resolved to final ID in generator
  displayName: string; // filename stem
  isBackend: boolean;
}

// Function call relationship
export interface FunctionCallRelationship {
  target: string;
  label: string;
  type: 'service' | 'utility' | 'hook' | 'store';
}

// Component dependency
export interface ComponentDependency {
  name: string;
  type: 'hook' | 'service' | 'store' | 'utility';
}

// Raw call site captured during deep body traversal (NOT deduplicated)
export interface RawCallSite {
  caller: string;          // component or function that contains the call
  calleeName: string;      // name of the function/store being called
  method?: string;         // ".getState()" | ".setState()" for store method calls
}

// Hook return value info
export interface HookReturnValueInfo {
  hook: string;
  returnValues: string[];
}

// Store usage info
export interface StoreUsageInfo {
  properties: Set<string>;
  actions: Set<string>;
}

// Next.js route info
export interface NextjsRouteInfo {
  segment: string;
  routePath: string;
  parentRoutePath: string;
  isLayout: boolean;
  isPage: boolean;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  isAppShell: boolean;
  isDocument: boolean;
  isMiddleware: boolean;
  isApi: boolean;
  filePath: string;
}

// API endpoint info
export interface ApiEndpointInfo {
  method: string;
  path: string;
  handlers: string[];
}

// Database model info
export interface DbModelInfo {
  fields: string[];
  type: string; // 'mongoose' | 'prisma' | 'sequelize' | 'sqlalchemy' | 'django'
}

// Auth flow connection
export interface AuthFlow {
  source: string;
  target: string;
  type: string; // 'redirect' | 'verify' | 'protect'
}

// Shared interface / type alias info
export interface SharedInterfaceInfo {
  name: string;
  filePath: string;
  kind: 'interface' | 'type';
}

/** Tracks store usage details: which state properties and actions a component uses */
export interface StoreUsageDetail {
  properties: Set<string>;
  actions: Set<string>;
}

/** Tracks hook return value destructuring */
export interface HookReturnValue {
  hook: string;
  returnValues: string[];
}

/** Tracks file container info for grouping functions inside file nodes */
export interface FileFunctionInfo {
  type: 'hook' | 'service' | 'utility' | 'store' | 'component';
  functions: Set<string>;
}

/** Container for all relationship maps — mirrors hoverchart's githubRepoService tracking */
export interface RelationshipMaps {
  /** componentName -> Set of child component names used in JSX */
  componentRelationships: Map<string, Set<string>>;
  /** componentName -> Set of ComponentDependency (hooks/services/stores used) */
  componentDependencies: Map<string, Set<ComponentDependency>>;
  /** componentName -> Map of functions defined within the component */
  componentFunctions: Map<string, Set<string>>;
  /** parentFileName -> { parent: mainComponentName, helpers: Set of internal component names } */
  internalComponents: Map<string, { parent: string; helpers: Set<string> }>;
  /** fileName -> exported component name */
  exportedComponents: Map<string, string>;
  /** fileName -> FileFunctionInfo (functions grouped by file for container nodes) */
  fileFunctions: Map<string, FileFunctionInfo>;
  /** hookFileName -> Set of internal hook names that share names with parent */
  internalHooks: Map<string, Set<string>>;
  /** Set of file names that need _file suffix to avoid name collisions */
  filesNeedingSuffix: Set<string>;
  /** componentName -> Set of FunctionCallRelationship */
  functionCallRelationships: Map<string, Set<FunctionCallRelationship>>;
  /** componentName -> Map of child component name -> Set of prop names */
  componentPropsRelationships: Map<string, Map<string, Set<string>>>;
  /** componentName -> Map of storeName -> StoreUsageDetail */
  storeUsageRelationships: Map<string, Map<string, StoreUsageDetail>>;
  /** componentName -> HookReturnValue[] */
  hookReturnValueRelationships: Map<string, HookReturnValue[]>;
  /** sourceFileName -> Set of imported file base names */
  moduleImportRelationships: Map<string, Set<string>>;
  /** sanitizedFileName -> NextjsRouteInfo */
  nextjsRouteMap: Map<string, NextjsRouteInfo>;
}

/** Creates an empty RelationshipMaps with all Maps/Sets initialized */
export function createEmptyRelationshipMaps(): RelationshipMaps {
  return {
    componentRelationships: new Map(),
    componentDependencies: new Map(),
    componentFunctions: new Map(),
    internalComponents: new Map(),
    exportedComponents: new Map(),
    fileFunctions: new Map(),
    internalHooks: new Map(),
    filesNeedingSuffix: new Set(),
    functionCallRelationships: new Map(),
    componentPropsRelationships: new Map(),
    storeUsageRelationships: new Map(),
    hookReturnValueRelationships: new Map(),
    moduleImportRelationships: new Map(),
    nextjsRouteMap: new Map(),
  };
}
