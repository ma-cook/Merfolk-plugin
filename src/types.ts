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
  type: string;
  functions: Set<string>;
  nodeId?: string;
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
