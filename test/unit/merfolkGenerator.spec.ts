import { describe, it, expect } from 'vitest';
import { generateMerfolkMarkdown } from '../../src/scanner/merfolkGenerator';
import type { Elements } from '../../src/types';

function makeElements(overrides: Partial<Elements> = {}): Elements {
  return {
    components: [],
    functions: [],
    hooks: [],
    services: [],
    stores: [],
    utilities: [],
    workers: [],
    shaders: [],
    classes: [],
    interfaces: [],
    variables: [],
    constants: [],
    imports: { libraries: [] },
    componentInternalFunctions: [],
    componentRelationships: [],
    componentDependencies: [],
    fileContainers: new Map(),
    internalHelperComponents: [],
    rawCallSites: [],
    storeUsageRelationships: new Map(),
    hookReturnValueRelationships: new Map(),
    moduleImportRelationships: new Map(),
    componentPropsRelationships: new Map(),
    nextjsRouteMap: new Map(),
    apiEndpoints: new Map(),
    dbModels: new Map(),
    authGuards: new Set(),
    authFlows: [],
    eventEmitters: new Map(),
    eventListeners: new Map(),
    errorBoundaries: new Set(),
    suspenseBoundaries: new Set(),
    errorContainment: new Map(),
    sharedInterfaces: new Map(),
    interfaceUsages: new Map(),
    internalHooks: new Map(),
    filesNeedingSuffix: new Set(),
    functionCallRelationships: new Map(),
    ...overrides,
  };
}

describe('generateMerfolkMarkdown', () => {
  it('generates merfolk header with repo name as comment', () => {
    const result = generateMerfolkMarkdown(makeElements(), 'my-repo', 'vanilla');
    expect(result).toContain('my-repo');
  });

  it('wraps output in merfolk code fences', () => {
    const result = generateMerfolkMarkdown(makeElements(), 'repo', 'vanilla');
    expect(result).toContain('```merfolk');
    expect(result).toContain('```');
  });

  it('creates Component nodes with {Component: name} syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['Button'] }),
      'repo',
      'react'
    );
    expect(result).toContain('{Component: Button}');
  });

  it('creates Function nodes with [Function: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ functions: ['processData'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('[Function: processData]');
  });

  it('creates Store nodes with [[Store: name]] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ stores: ['userStore'] }),
      'repo',
      'react'
    );
    expect(result).toContain('[[Store: userStore]]');
  });

  it('creates Service nodes with ((Service: name)) syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ services: ['ApiService'] }),
      'repo',
      'react'
    );
    expect(result).toContain('ApiService((Service: ApiService))');
  });

  it('creates Library nodes with <Library: name> syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ imports: { libraries: ['lodash'] } }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('<Library: lodash>');
  });

  it('creates Hook nodes with [Hook: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ hooks: ['useAuth'] }),
      'repo',
      'react'
    );
    expect(result).toContain('useAuth[Hook: useAuth]');
  });

  it('creates dashed arrows for component-function relationships (-.->) ', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        componentInternalFunctions: [
          { componentName: 'App', functionName: 'appHandleClick', label: 'internal function' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('-.->')
  });

  it('creates solid arrows for component relationships (-->)', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App', 'Button'],
        componentRelationships: [{ parent: 'App', child: 'Button', props: ['uses'] }],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('-->');
  });

  it('uses prop names from componentPropsRelationships in component relationship labels', () => {
    const propsMap = new Map<string, Map<string, Set<string>>>();
    const childMap = new Map<string, Set<string>>();
    childMap.set('Button', new Set(['onClick', 'disabled', 'label']));
    propsMap.set('App', childMap);

    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App', 'Button'],
        componentRelationships: [{ parent: 'App', child: 'Button', props: ['uses'] }],
        componentPropsRelationships: propsMap,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Component Relationships');
    expect(result).toContain('onClick');
    expect(result).toContain('disabled');
    expect(result).toContain('label');
  });

  it('deduplicates elements across categories', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['MyComp', 'MyComp'],
        functions: ['fn', 'fn'],
      }),
      'repo',
      'react'
    );
    const matches = result.match(/\{Component: MyComp\}/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('removes services/utilities that are also in stores', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        stores: ['dataStore'],
        services: ['dataStore'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('[[Store: dataStore]]');
    const serviceMatches = result.match(/\(\(Service: dataStore\)\)/g) ?? [];
    expect(serviceMatches.length).toBe(0);
  });

  it('removes utilities that are also in services', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['apiUtil'],
        utilities: ['apiUtil'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('apiUtil((Service: apiUtil))');
    const matches = result.match(/apiUtil\(\(Service: apiUtil\)\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('filters component relationships to only known components', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'] }),
      'repo',
      'react'
    );
    expect(result).not.toContain('{Component: UnknownComp}');
  });

  it('filters component dependencies to only known elements', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'] }),
      'repo',
      'react'
    );
    expect(result).not.toContain('UnknownDep');
  });

  it('handles _file suffix for name collisions', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Button'],
        functions: ['Button'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('_file');
  });

  it('generates routed connections through parent containers', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App', 'Header'] }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('handles empty elements gracefully', () => {
    expect(() =>
      generateMerfolkMarkdown(makeElements(), 'empty-repo', 'vanilla')
    ).not.toThrow();
  });

  it('generates vanilla root entry-point for vanilla repos', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ functions: ['main', 'init'] }),
      'my-lib',
      'vanilla'
    );
    expect(result).toContain('my-lib');
  });

  it('generates Next.js route hierarchy for nextjs repos', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['RootLayout', 'HomePage'] }),
      'my-next-app',
      'nextjs'
    );
    expect(result).toContain('my-next-app');
  });

  it('generates component-function relationships with labels', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Button'],
        functions: ['handleClick'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates component dependency connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        hooks: ['useAuth'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates function call relationship connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['apiService'],
        functions: ['fetchData'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates store usage detail connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        stores: ['userStore'],
        components: ['UserProfile'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('emits %% Function Call Relationships section for rawCallSites resolved to a container', () => {
    const containers = new Map();
    containers.set('/src/utils/cache.ts', {
      type: 'Function',
      functions: new Set(['getCachedShader']),
      nodeId: 'cache',
      displayName: 'cache',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['SphereRenderer'],
        rawCallSites: [
          { caller: 'SphereRenderer', calleeName: 'getCachedShader' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Function Call Relationships');
    expect(result).toContain('SphereRenderer --> cache : "calls getCachedShader"');
    expect(result).toContain('cache --> getCachedShader : "receives"');
  });

  it('emits store .getState() as single-line in Function Call Relationships', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        stores: ['useStore'],
        components: ['PlaneMesh'],
        rawCallSites: [
          { caller: 'PlaneMesh', calleeName: 'useStore', method: '.getState()' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('PlaneMesh --> useStore : ".getState()"');
    // Store method call is single-line — no "receives" second line
    const lines = result.split('\n');
    const getStateIdx = lines.findIndex(l => l.includes('.getState()'));
    expect(lines[getStateIdx + 1]).not.toContain('receives');
  });

  it('does NOT deduplicate rawCallSites — each call site emits its own lines', () => {
    const containers = new Map();
    containers.set('/src/utils/cache.ts', {
      type: 'Function',
      functions: new Set(['getCachedShader']),
      nodeId: 'resourceCache',
      displayName: 'resourceCache',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['SphereRenderer'],
        rawCallSites: [
          { caller: 'SphereRenderer', calleeName: 'getCachedShader' },
          { caller: 'SphereRenderer', calleeName: 'getCachedShader' },
          { caller: 'SphereRenderer', calleeName: 'getCachedShader' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    const matches = result.match(/SphereRenderer --> resourceCache : "calls getCachedShader"/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('emits function-to-function call relationships from functionCallRelationships', () => {
    const containers = new Map();
    containers.set('/src/services/apiService.ts', {
      type: 'Service',
      functions: new Set(['fetchData']),
      nodeId: 'apiService',
      displayName: 'apiService',
      isBackend: false,
    });

    const funcCallRels = new Map();
    funcCallRels.set('processData', new Set([
      { target: 'fetchData', label: 'calls fetchData', type: 'function' },
    ]));

    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['processData', 'fetchData'],
        fileContainers: containers,
        functionCallRelationships: funcCallRels,
      }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Function Call Relationships');
    expect(result).toContain('processData --> apiService');
    expect(result).toContain('fetchData');
  });

  it('emits two-line chain for component dependencies (non-store)', () => {
    const containers = new Map();
    containers.set('/src/hooks/useAuth.ts', {
      type: 'Hook',
      functions: new Set(['useAuth']),
      nodeId: 'useAuth_file',
      displayName: 'useAuth',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Scene'],
        hooks: ['useAuth'],
        componentDependencies: [
          { component: 'Scene', target: 'useAuth', targetNodeId: 'useAuth', destructured: ['user'], label: '{user}' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('Scene --> useAuth_file : "{user}"');
    expect(result).toContain('useAuth_file --> useAuth : "receives"');
  });

  it('does NOT emit second line for store component dependencies', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['CustomCamera'],
        stores: ['useStore'],
        componentDependencies: [
          { component: 'CustomCamera', target: 'useStore', targetNodeId: 'useStore', destructured: [], label: 'uses store' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('CustomCamera --> useStore : "uses store"');
    // No second "receives" line for stores
    expect(result).not.toContain('useStore --> useStore : "receives"');
  });

  it('does NOT deduplicate component dependencies', () => {
    const containers = new Map();
    containers.set('/src/hooks/useAuth.ts', {
      type: 'Hook',
      functions: new Set(['useAuth']),
      nodeId: 'useAuth_file',
      displayName: 'useAuth',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Scene'],
        hooks: ['useAuth'],
        componentDependencies: [
          { component: 'Scene', target: 'useAuth', targetNodeId: 'useAuth', destructured: ['user'], label: '{user}' },
          { component: 'Scene', target: 'useAuth', targetNodeId: 'useAuth', destructured: ['user'], label: '{user}' },
          { component: 'Scene', target: 'useAuth', targetNodeId: 'useAuth', destructured: ['user'], label: '{user}' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    const matches = result.match(/Scene --> useAuth_file : "\{user\}"/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('skips rawCallSites that do not resolve to a known file container', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        rawCallSites: [
          { caller: 'App', calleeName: 'unknownFunction' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).not.toContain('unknownFunction');
  });

  it('emits %% Classes section with [[Class: name]] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ classes: ['DataManager', 'ApiClient'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Classes');
    expect(result).toContain('DataManager[[Class: DataManager]]');
    expect(result).toContain('ApiClient[[Class: ApiClient]]');
  });

  it('emits %% Shared Interfaces section with {{Interface: name}} syntax', () => {
    const sharedInterfaces = new Map();
    sharedInterfaces.set('UserProfile', { name: 'UserProfile', filePath: 'src/types.ts', kind: 'interface' as const });
    const result = generateMerfolkMarkdown(
      makeElements({ sharedInterfaces }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Shared Interfaces');
    expect(result).toContain('{{Interface: UserProfile}}');
  });

  it('emits %% Interface Usages section', () => {
    const sharedInterfaces = new Map();
    sharedInterfaces.set('UserProfile', { name: 'UserProfile', filePath: 'src/types.ts', kind: 'interface' as const });
    const interfaceUsages = new Map();
    interfaceUsages.set('UserProfile', new Set(['UserCard', 'ProfilePage']));
    const result = generateMerfolkMarkdown(
      makeElements({ sharedInterfaces, interfaceUsages }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Interface Usages');
    expect(result).toContain('UserCard --> UserProfile : "uses type"');
    expect(result).toContain('ProfilePage --> UserProfile : "uses type"');
  });

  it('emits %% Next.js Route Hierarchy section', () => {
    const nextjsRouteMap = new Map();
    nextjsRouteMap.set('/app/page.tsx', {
      segment: '', routePath: '/', parentRoutePath: '/',
      isLayout: false, isPage: true, isLoading: false, isError: false,
      isNotFound: false, isAppShell: false, isDocument: false,
      isMiddleware: false, isApi: false, filePath: '/app/page.tsx',
    });
    nextjsRouteMap.set('/app/dashboard/page.tsx', {
      segment: 'dashboard', routePath: '/dashboard', parentRoutePath: '/',
      isLayout: false, isPage: true, isLoading: false, isError: false,
      isNotFound: false, isAppShell: false, isDocument: false,
      isMiddleware: false, isApi: false, filePath: '/app/dashboard/page.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap }),
      'my-app',
      'nextjs'
    );
    expect(result).toContain('%% Next.js Route Hierarchy');
    expect(result).toContain('Page: /');
    expect(result).toContain('Page: /dashboard');
    expect(result).toContain('"contains"');
  });

  it('emits %% API Endpoints section', () => {
    const apiEndpoints = new Map();
    apiEndpoints.set('GET /api/users', { method: 'GET', path: '/api/users', handlers: ['getUsers'] });
    const result = generateMerfolkMarkdown(
      makeElements({ apiEndpoints }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% API Endpoints');
    expect(result).toContain('API: GET /api/users');
    expect(result).toContain('"handled by"');
  });

  it('emits %% Database Models section', () => {
    const dbModels = new Map();
    dbModels.set('User', { fields: ['name', 'email'], type: 'mongoose' });
    const result = generateMerfolkMarkdown(
      makeElements({ dbModels }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Database Models');
    expect(result).toContain('[(Model: User)]');
  });

  it('emits %% Auth Guards section', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ authGuards: new Set(['requireJwt', 'isAdmin']) }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Auth Guards');
    expect(result).toContain('[/Auth Guard: requireJwt/]');
    expect(result).toContain('[/Auth Guard: isAdmin/]');
  });

  it('emits %% Auth Flows section', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        authFlows: [{ source: 'login', target: 'dashboard', type: 'redirect' }],
      }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Auth Flows');
    expect(result).toContain('login --> dashboard : "redirect"');
  });

  it('emits %% Event Emitters section', () => {
    const eventEmitters = new Map<string, Set<string>>();
    eventEmitters.set('bus', new Set(['userUpdated']));
    const eventListeners = new Map<string, Set<string>>();
    eventListeners.set('bus', new Set(['userUpdated']));
    const result = generateMerfolkMarkdown(
      makeElements({ eventEmitters, eventListeners }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Event Emitters');
    expect(result).toContain('[Emitter: bus]');
    expect(result).toContain('"emits"');
    expect(result).toContain('"listens"');
  });

  it('emits %% Error Boundaries section', () => {
    const errorContainment = new Map<string, Set<string>>();
    errorContainment.set('ErrorBoundary', new Set(['Dashboard']));
    const result = generateMerfolkMarkdown(
      makeElements({
        errorBoundaries: new Set(['ErrorBoundary']),
        errorContainment,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Error Boundaries');
    expect(result).toContain('[/Error Boundary: ErrorBoundary/]');
    expect(result).toContain('ErrorBoundary --> Dashboard : "catches errors from"');
  });

  it('emits %% Suspense Boundaries section', () => {
    const errorContainment = new Map<string, Set<string>>();
    errorContainment.set('App', new Set(['LazyComponent']));
    const result = generateMerfolkMarkdown(
      makeElements({
        suspenseBoundaries: new Set(['App']),
        errorContainment,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Suspense Boundaries');
    expect(result).toContain('[/Suspense: App/]');
    expect(result).toContain('App --> LazyComponent : "suspends"');
  });

  it('emits %% Worker Modules for worker file containers', () => {
    const containers = new Map();
    containers.set('/src/workers/dataWorker.ts', {
      type: 'Function',
      functions: new Set(['processData']),
      nodeId: 'dataWorker',
      displayName: 'dataWorker',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({ fileContainers: containers }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Worker Modules');
    expect(result).toContain('[Worker: dataWorker]');
  });

  it('emits %% Web Workers section for worker elements', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ workers: ['myWorker'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Web Workers');
    expect(result).toContain('[Worker: myWorker]');
  });

  it('does not emit empty new sections', () => {
    const result = generateMerfolkMarkdown(makeElements(), 'repo', 'vanilla');
    expect(result).not.toContain('%% Classes');
    expect(result).not.toContain('%% Shared Interfaces');
    expect(result).not.toContain('%% API Endpoints');
    expect(result).not.toContain('%% Database Models');
    expect(result).not.toContain('%% Auth Guards');
    expect(result).not.toContain('%% Event Emitters');
    expect(result).not.toContain('%% Error Boundaries');
    expect(result).not.toContain('%% Suspense Boundaries');
    expect(result).not.toContain('%% Worker Modules');
    expect(result).not.toContain('%% Web Workers');
  });

  // --- Store Usage Relationships ---

  it('emits %% Store Usage Details section for components with store property access', () => {
    const storeUsage = new Map<string, Map<string, { properties: Set<string>; actions: Set<string> }>>();
    const innerMap = new Map<string, { properties: Set<string>; actions: Set<string> }>();
    innerMap.set('useObjectsStore', { properties: new Set(['objects']), actions: new Set(['addObject']) });
    storeUsage.set('App', innerMap);
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        stores: ['useObjectsStore'],
        storeUsageRelationships: storeUsage,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Store Usage Details');
    expect(result).toContain('App --> useObjectsStore : "{objects, addObject}"');
  });

  it('skips store usage entries for unknown components', () => {
    const storeUsage = new Map<string, Map<string, { properties: Set<string>; actions: Set<string> }>>();
    const innerMap = new Map<string, { properties: Set<string>; actions: Set<string> }>();
    innerMap.set('useObjectsStore', { properties: new Set(['objects']), actions: new Set() });
    storeUsage.set('UnknownComp', innerMap);
    const result = generateMerfolkMarkdown(
      makeElements({ storeUsageRelationships: storeUsage }),
      'repo',
      'react'
    );
    expect(result).not.toContain('%% Store Usage Details');
  });

  it('omits store usage entry when properties and actions are both empty', () => {
    const storeUsage = new Map<string, Map<string, { properties: Set<string>; actions: Set<string> }>>();
    const innerMap = new Map<string, { properties: Set<string>; actions: Set<string> }>();
    innerMap.set('useObjectsStore', { properties: new Set(), actions: new Set() });
    storeUsage.set('App', innerMap);
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'], storeUsageRelationships: storeUsage }),
      'repo',
      'react'
    );
    expect(result).not.toContain('%% Store Usage Details');
  });

  it('emits store usage for non-component known nodes (utility functions)', () => {
    const storeUsage = new Map<string, Map<string, { properties: Set<string>; actions: Set<string> }>>();
    const innerMap = new Map<string, { properties: Set<string>; actions: Set<string> }>();
    innerMap.set('useSettingsStore', { properties: new Set(['theme']), actions: new Set(['setTheme']) });
    storeUsage.set('SomeUtil', innerMap);
    const result = generateMerfolkMarkdown(
      makeElements({
        utilities: ['SomeUtil'],
        stores: ['useSettingsStore'],
        storeUsageRelationships: storeUsage,
      }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Store Usage Details');
    expect(result).toContain('SomeUtil --> useSettingsStore : "{theme, setTheme}"');
  });

  // --- Hook Return Value Relationships ---

  it('enhances component dependency label via hookReturnValueRelationships when dep label is "uses hook"', () => {
    const hookReturnValueRels = new Map<string, { hook: string; returnValues: string[] }[]>();
    hookReturnValueRels.set('App', [{ hook: 'useFetchData', returnValues: ['data', 'loading', 'error'] }]);
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        hooks: ['useFetchData'],
        componentDependencies: [
          { component: 'App', target: 'useFetchData', targetNodeId: 'useFetchData', destructured: [], label: 'uses hook' },
        ],
        hookReturnValueRelationships: hookReturnValueRels,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('App --> useFetchData : "{data, loading, error}"');
  });

  it('does not override component dependency label when hookReturnValueRelationships has no match', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        hooks: ['useFetchData'],
        componentDependencies: [
          { component: 'App', target: 'useFetchData', targetNodeId: 'useFetchData', destructured: [], label: 'uses hook' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('App --> useFetchData : "uses hook"');
  });

  // --- Module Import Relationships ---

  it('emits %% Module Import Relationships for vanilla repos with relative imports', () => {
    const moduleImports = new Map<string, Set<string>>();
    moduleImports.set('/src/utils.ts', new Set(['helpers']));
    moduleImports.set('/src/apiClient.ts', new Set(['config']));
    const result = generateMerfolkMarkdown(
      makeElements({ moduleImportRelationships: moduleImports }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Module Import Relationships');
    expect(result).toContain('utils --> helpers : "imports"');
    expect(result).toContain('apiClient --> config : "imports"');
  });

  it('emits %% Module Import Relationships for react repos when data exists', () => {
    const moduleImports = new Map<string, Set<string>>();
    moduleImports.set('/src/utils.ts', new Set(['helpers']));
    const result = generateMerfolkMarkdown(
      makeElements({ moduleImportRelationships: moduleImports }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Module Import Relationships');
    expect(result).toContain('utils --> helpers : "imports"');
  });

  it('emits %% Module Import Relationships with multiple imports per file', () => {
    const moduleImports = new Map<string, Set<string>>();
    moduleImports.set('/src/app.ts', new Set(['utils', 'helpers', 'config']));
    const result = generateMerfolkMarkdown(
      makeElements({ moduleImportRelationships: moduleImports }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Module Import Relationships');
    expect(result).toContain('app --> utils : "imports"');
    expect(result).toContain('app --> helpers : "imports"');
    expect(result).toContain('app --> config : "imports"');
  });

  it('does not emit %% Module Import Relationships when moduleImportRelationships is empty', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ moduleImportRelationships: new Map() }),
      'repo',
      'react'
    );
    expect(result).not.toContain('%% Module Import Relationships');
  });

  it('skips module import entries with empty source stem', () => {
    const moduleImports = new Map<string, Set<string>>();
    moduleImports.set('', new Set(['helpers']));
    const result = generateMerfolkMarkdown(
      makeElements({ moduleImportRelationships: moduleImports }),
      'repo',
      'vanilla'
    );
    expect(result).not.toContain('%% Module Import Relationships');
  });

  // --- Routed Connections (childToParentMap / generateRoutedConnection) ---

  it('generates three-hop chain when source and target are in different containers', () => {
    const containers = new Map();
    containers.set('/src/services/auth.ts', {
      type: 'Service',
      functions: new Set(['login']),
      nodeId: 'auth',
      displayName: 'auth',
      isBackend: false,
    });
    containers.set('/src/services/api.ts', {
      type: 'Service',
      functions: new Set(['fetchUser']),
      nodeId: 'api',
      displayName: 'api',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        rawCallSites: [{ caller: 'login', calleeName: 'fetchUser' }],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('login --> auth : "calls out"');
    expect(result).toContain('auth --> api : "calls fetchUser"');
    expect(result).toContain('api --> fetchUser : "receives"');
  });

  it('generates direct connection when source and target are in the same container', () => {
    const containers = new Map();
    containers.set('/src/utils/helpers.ts', {
      type: 'Function',
      functions: new Set(['helperA', 'helperB']),
      nodeId: 'helpers',
      displayName: 'helpers',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        rawCallSites: [{ caller: 'helperA', calleeName: 'helperB' }],
        fileContainers: containers,
      }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('helperA --> helperB : "calls helperB"');
    expect(result).not.toContain('"calls out"');
  });

  it('generates two-hop chain for source-has-parent, target-is-standalone', () => {
    const containers = new Map();
    containers.set('/src/services/auth.ts', {
      type: 'Service',
      functions: new Set(['login']),
      nodeId: 'auth',
      displayName: 'auth',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['apiService'],
        rawCallSites: [{ caller: 'login', calleeName: 'apiService' }],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('login --> auth : "calls out"');
    expect(result).toContain('auth --> apiService : "calls apiService"');
  });

  it('does not generate connection when target node is unknown', () => {
    const containers = new Map();
    containers.set('/src/services/auth.ts', {
      type: 'Service',
      functions: new Set(['login']),
      nodeId: 'auth',
      displayName: 'auth',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        rawCallSites: [{ caller: 'login', calleeName: 'completelyUnknown' }],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).not.toContain('completelyUnknown');
  });

  it('emits %% Shaders section for shader elements', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ shaders: ['vertexShader', 'fragmentShader'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Shaders');
    expect(result).toContain('[Shader: vertexShader]');
    expect(result).toContain('[Shader: fragmentShader]');
  });

  it('uses _file suffix for containers when name collides with a symbol', () => {
    const containers = new Map();
    containers.set('/src/hooks/useAuth.ts', {
      type: 'Hook',
      functions: new Set(['useAuth']),
      nodeId: 'useAuth',
      displayName: 'useAuth',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useAuth'],
        fileContainers: containers,
        filesNeedingSuffix: new Set(['useAuth']),
      }),
      'repo',
      'react'
    );
    // The hook node itself keeps its plain name
    expect(result).toContain('useAuth[Hook: useAuth]');
    // The file container should get _file suffix to avoid collision with the hook node
    expect(result).toContain('useAuth_file');
  });

  it('internalHooks are added to funcToContainerNodeId mapping', () => {
    const containers = new Map();
    containers.set('/src/hooks/useAuth.ts', {
      type: 'Hook',
      functions: new Set(['useAuth']),
      nodeId: 'useAuth',
      displayName: 'useAuth',
      isBackend: false,
    });
    const internalHooks = new Map<string, { parent: string; parentType: string }>();
    internalHooks.set('useAuth', { parent: 'useAuth', parentType: 'hook' });
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useAuth'],
        fileContainers: containers,
        filesNeedingSuffix: new Set(['useAuth']),
        internalHooks,
      }),
      'repo',
      'react'
    );
    // File container emitted with _file suffix
    expect(result).toContain('useAuth_file');
    // Hook node emitted normally
    expect(result).toContain('useAuth[Hook: useAuth]');
  });

  it('emits %% Constants section with [Constant: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ constants: ['API_URL', 'MAX_RETRIES'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Constants');
    expect(result).toContain('API_URL[Constant: API_URL]');
    expect(result).toContain('MAX_RETRIES[Constant: MAX_RETRIES]');
  });

  it('does not emit %% Constants section when constants is empty', () => {
    const result = generateMerfolkMarkdown(makeElements({ constants: [] }), 'repo', 'vanilla');
    expect(result).not.toContain('%% Constants');
  });

  it('deduplicates constants', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ constants: ['BASE_URL', 'BASE_URL'] }),
      'repo',
      'vanilla'
    );
    const matches = result.match(/BASE_URL\[Constant: BASE_URL\]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('emits %% Variables section with [Variable: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ variables: ['counter', 'isLoading'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Variables');
    expect(result).toContain('counter[Variable: counter]');
    expect(result).toContain('isLoading[Variable: isLoading]');
  });

  it('does not emit %% Variables section when variables is empty', () => {
    const result = generateMerfolkMarkdown(makeElements({ variables: [] }), 'repo', 'vanilla');
    expect(result).not.toContain('%% Variables');
  });

  it('deduplicates variables', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ variables: ['count', 'count'] }),
      'repo',
      'vanilla'
    );
    const matches = result.match(/count\[Variable: count\]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('emits %% Interfaces section with [[Interface: name]] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ interfaces: ['IUser', 'IConfig'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('%% Interfaces');
    expect(result).toContain('IUser[[Interface: IUser]]');
    expect(result).toContain('IConfig[[Interface: IConfig]]');
  });

  it('does not emit %% Interfaces section when interfaces is empty', () => {
    const result = generateMerfolkMarkdown(makeElements({ interfaces: [] }), 'repo', 'vanilla');
    expect(result).not.toContain('%% Interfaces');
  });

  it('deduplicates interfaces', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ interfaces: ['IBase', 'IBase'] }),
      'repo',
      'vanilla'
    );
    const matches = result.match(/IBase\[\[Interface: IBase\]\]/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
