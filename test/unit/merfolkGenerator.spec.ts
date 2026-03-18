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
    imports: { libraries: [] },
    componentInternalFunctions: [],
    componentRelationships: [],
    componentDependencies: [],
    fileContainers: new Map(),
    internalHelperComponents: [],
    rawCallSites: [],
    functionCallRelationships: new Map(),
    nextjsRouteMap: new Map(),
    internalHooks: new Map(),
    filesNeedingSuffix: new Set(),
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

  it('creates Service nodes with [Function: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ services: ['ApiService'] }),
      'repo',
      'react'
    );
    expect(result).toContain('ApiService[Function: ApiService]');
  });

  it('creates Library nodes with <Library: name> syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ imports: { libraries: ['lodash'] } }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('<Library: lodash>');
  });

  it('creates Hook nodes with [Function: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ hooks: ['useAuth'] }),
      'repo',
      'react'
    );
    expect(result).toContain('useAuth[Function: useAuth]');
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
    expect(result).toContain('apiUtil[Function: apiUtil]');
    const matches = result.match(/apiUtil\[Function: apiUtil\]/g) ?? [];
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
});

// ---------------------------------------------------------------------------
// Fix #6 — functionCallRelationships: service/utility method call two-line chains
// ---------------------------------------------------------------------------

describe('generateMerfolkMarkdown — functionCallRelationships', () => {
  it('emits two-line chain for service method calls via functionCallRelationships', () => {
    const funcCallRels = new Map();
    funcCallRels.set('App', new Set([
      { target: 'apiService', label: '.fetchData()', type: 'service' as const },
    ]));
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        services: ['apiService'],
        functionCallRelationships: funcCallRels,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Function Call Relationships');
    expect(result).toContain('App --> apiService : "calls .fetchData()"');
    expect(result).toContain('apiService --> fetchData : "receives"');
  });

  it('emits two-line chain for utility method calls via functionCallRelationships', () => {
    const funcCallRels = new Map();
    funcCallRels.set('Dashboard', new Set([
      { target: 'formatUtil', label: '.formatDate()', type: 'utility' as const },
    ]));
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Dashboard'],
        utilities: ['formatUtil'],
        functionCallRelationships: funcCallRels,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('Dashboard --> formatUtil : "calls .formatDate()"');
    expect(result).toContain('formatUtil --> formatDate : "receives"');
  });

  it('skips functionCallRelationships entries for unknown services/utilities', () => {
    const funcCallRels = new Map();
    funcCallRels.set('App', new Set([
      { target: 'unknownService', label: '.doSomething()', type: 'service' as const },
    ]));
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        functionCallRelationships: funcCallRels,
      }),
      'repo',
      'react'
    );
    expect(result).not.toContain('unknownService');
  });

  it('deduplicates identical entries in functionCallRelationships', () => {
    const rels = new Set([
      { target: 'apiService', label: '.fetchData()', type: 'service' as const },
      { target: 'apiService', label: '.fetchData()', type: 'service' as const },
    ]);
    const funcCallRels = new Map();
    funcCallRels.set('App', rels);
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        services: ['apiService'],
        functionCallRelationships: funcCallRels,
      }),
      'repo',
      'react'
    );
    const matches = result.match(/App --> apiService : "calls \.fetchData\(\)"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fix #8 — Next.js Route Hierarchy section
// ---------------------------------------------------------------------------

describe('generateMerfolkMarkdown — Next.js Route Hierarchy', () => {
  it('emits %% Next.js Route Hierarchy section for nextjs repos with routes', () => {
    const routeMap = new Map();
    routeMap.set('/app/dashboard/page.tsx', {
      segment: 'dashboard',
      routePath: '/dashboard',
      parentRoutePath: '/',
      isLayout: false,
      isPage: true,
      isLoading: false,
      isError: false,
      isNotFound: false,
      isAppShell: false,
      isDocument: false,
      isMiddleware: false,
      isApi: false,
      filePath: '/app/dashboard/page.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: routeMap }),
      'my-next-app',
      'nextjs'
    );
    expect(result).toContain('%% Next.js Route Hierarchy');
    expect(result).toContain('app_root');
    expect(result).toContain('dashboard');
    expect(result).toContain('"contains"');
  });

  it('does NOT emit %% Next.js Route Hierarchy for react repos', () => {
    const routeMap = new Map();
    routeMap.set('/app/page.tsx', {
      segment: '',
      routePath: '/',
      parentRoutePath: '/',
      isLayout: false,
      isPage: true,
      isLoading: false,
      isError: false,
      isNotFound: false,
      isAppShell: false,
      isDocument: false,
      isMiddleware: false,
      isApi: false,
      filePath: '/app/page.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: routeMap }),
      'my-react-app',
      'react'
    );
    expect(result).not.toContain('%% Next.js Route Hierarchy');
  });

  it('does NOT emit %% Next.js Route Hierarchy when map is empty', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: new Map() }),
      'my-next-app',
      'nextjs'
    );
    expect(result).not.toContain('%% Next.js Route Hierarchy');
  });

  it('emits layout node with Layout type when isLayout is true', () => {
    const routeMap = new Map();
    routeMap.set('/app/layout.tsx', {
      segment: '',
      routePath: '/',
      parentRoutePath: '/',
      isLayout: true,
      isPage: false,
      isLoading: false,
      isError: false,
      isNotFound: false,
      isAppShell: false,
      isDocument: false,
      isMiddleware: false,
      isApi: false,
      filePath: '/app/layout.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: routeMap }),
      'my-next-app',
      'nextjs'
    );
    expect(result).toContain('Layout:');
  });
});

// ---------------------------------------------------------------------------
// Fix #9 — Internal Hook Nesting section
// ---------------------------------------------------------------------------

describe('generateMerfolkMarkdown — Internal Hook Nesting', () => {
  it('emits %% Internal Hook Nesting section with containment arrow', () => {
    const containers = new Map();
    containers.set('/src/hooks/useAuth.ts', {
      type: 'Hook',
      functions: new Set(['useAuth']),
      nodeId: 'useAuth_file',
      displayName: 'useAuth',
      isBackend: false,
    });
    const internalHooks = new Map();
    internalHooks.set('useAuth', { parent: 'useAuth', parentType: 'hook' as const });
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useAuth'],
        fileContainers: containers,
        internalHooks,
        filesNeedingSuffix: new Set(['useAuth']),
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Internal Hook Nesting');
    expect(result).toContain('useAuth_file -.-> useAuth : "contains hook"');
  });

  it('does NOT emit %% Internal Hook Nesting when internalHooks is empty', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ internalHooks: new Map() }),
      'repo',
      'react'
    );
    expect(result).not.toContain('%% Internal Hook Nesting');
  });

  it('uses funcToContainerNodeId to resolve the container nodeId', () => {
    const containers = new Map();
    containers.set('/hooks/useTheme.ts', {
      type: 'Hook',
      functions: new Set(['useTheme']),
      nodeId: 'useTheme_file',
      displayName: 'useTheme',
      isBackend: false,
    });
    const internalHooks = new Map();
    internalHooks.set('useTheme', { parent: 'useTheme', parentType: 'hook' as const });
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useTheme'],
        fileContainers: containers,
        internalHooks,
        filesNeedingSuffix: new Set(['useTheme']),
      }),
      'repo',
      'react'
    );
    expect(result).toContain('useTheme_file -.-> useTheme : "contains hook"');
  });
});
