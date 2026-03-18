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

  // Fix #6: MemberExpression service method call two-line chains
  it('Fix #6: emits two-line chain for service method calls via MemberExpression', () => {
    const containers = new Map();
    containers.set('/src/services/apiService.ts', {
      type: 'Service',
      functions: new Set(['fetchData']),
      nodeId: 'apiService',
      displayName: 'apiService',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        rawCallSites: [
          { caller: 'App', calleeName: 'apiService', method: '.fetchData()' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('%% Function Call Relationships');
    expect(result).toContain('App --> apiService : "calls fetchData"');
    expect(result).toContain('apiService --> fetchData : "receives"');
  });

  it('Fix #6: emits two-line chain with _file container nodeId when name collides', () => {
    const containers = new Map();
    containers.set('/src/services/helper.ts', {
      type: 'Service',
      functions: new Set(['process']),
      nodeId: 'helper_file',
      displayName: 'helper',
      isBackend: false,
    });
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        functions: ['helper'], // causes collision → container gets _file suffix
        rawCallSites: [
          { caller: 'App', calleeName: 'helper', method: '.process()' },
        ],
        fileContainers: containers,
      }),
      'repo',
      'react'
    );
    expect(result).toContain('App --> helper_file : "calls process"');
    expect(result).toContain('helper_file --> process : "receives"');
  });

  it('Fix #6: store .getState() method calls remain as single-line (unchanged)', () => {
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
    const idx = lines.findIndex(l => l.includes('.getState()'));
    expect(lines[idx + 1]).not.toContain('receives');
  });

  it('Fix #6: skips service method calls where no matching container is found', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        rawCallSites: [
          { caller: 'App', calleeName: 'unknownService', method: '.doSomething()' },
        ],
      }),
      'repo',
      'react'
    );
    expect(result).not.toContain('unknownService');
  });

  // Fix #8: Next.js Route Hierarchy
  it('Fix #8: emits %% Next.js Route Hierarchy section for nextjs repoType', () => {
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
    expect(result).toContain('root{Route: /}');
    expect(result).toContain('dashboard{Route: /dashboard}');
    expect(result).toContain('root --> dashboard : "contains"');
  });

  it('Fix #8: does NOT emit Next.js section for non-nextjs repos', () => {
    const routeMap = new Map();
    routeMap.set('/app/page.tsx', {
      segment: '',
      routePath: '/',
      parentRoutePath: '/',
      isLayout: false, isPage: true, isLoading: false, isError: false,
      isNotFound: false, isAppShell: false, isDocument: false,
      isMiddleware: false, isApi: false, filePath: '/app/page.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: routeMap }),
      'my-react-app',
      'react'
    );
    expect(result).not.toContain('%% Next.js Route Hierarchy');
  });

  it('Fix #8: emits nested route connections for multi-level routes', () => {
    const routeMap = new Map();
    routeMap.set('/app/dashboard/settings/page.tsx', {
      segment: 'settings',
      routePath: '/dashboard/settings',
      parentRoutePath: '/dashboard',
      isLayout: false, isPage: true, isLoading: false, isError: false,
      isNotFound: false, isAppShell: false, isDocument: false,
      isMiddleware: false, isApi: false,
      filePath: '/app/dashboard/settings/page.tsx',
    });
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: routeMap }),
      'app',
      'nextjs'
    );
    expect(result).toContain('dashboard_settings{Route: /dashboard/settings}');
    expect(result).toContain('dashboard --> dashboard_settings : "contains"');
  });

  it('Fix #8: does not emit Next.js section when nextjsRouteMap is empty', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ nextjsRouteMap: new Map() }),
      'app',
      'nextjs'
    );
    expect(result).not.toContain('%% Next.js Route Hierarchy');
  });

  // Fix #9: filesNeedingSuffix for hook nodes
  it('Fix #9: appends _file suffix to hook node IDs in filesNeedingSuffix', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useTheme'],
        filesNeedingSuffix: new Set(['useTheme']),
      }),
      'repo',
      'react'
    );
    // The node ID gets _file suffix but the display label keeps the original name
    expect(result).toContain('useTheme_file[Function: useTheme]');
    expect(result).not.toContain('useTheme[Function: useTheme]');
  });

  it('Fix #9: hooks NOT in filesNeedingSuffix use their original name', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        hooks: ['useAuth'],
        filesNeedingSuffix: new Set(),
      }),
      'repo',
      'react'
    );
    expect(result).toContain('useAuth[Function: useAuth]');
  });
});
