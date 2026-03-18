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
  imports: {
    libraries: string[];
  };
  componentInternalFunctions: ComponentInternalFunction[];
  componentRelationships: ComponentRelationship[];
  componentDependencies: ComponentDependencyRelation[];
  fileContainers: Map<string, FileContainerInfo>; // key = filePath
  internalHelperComponents: InternalHelperComponent[];
  rawCallSites: RawCallSite[];                     // per-call-site (NOT deduplicated)
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
