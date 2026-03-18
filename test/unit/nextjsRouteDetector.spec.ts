import { describe, it, expect } from 'vitest';
import { detectNextjsRoute, routePathToNodeId } from '../../src/scanner/nextjsRouteDetector';
import type { Elements } from '../../src/types';

function makeElements(): Elements {
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
  };
}

describe('routePathToNodeId', () => {
  it('converts root path to app_root', () => {
    expect(routePathToNodeId('/')).toBe('app_root');
  });

  it('converts single-segment path', () => {
    expect(routePathToNodeId('/dashboard')).toBe('dashboard');
  });

  it('converts nested path with slashes', () => {
    expect(routePathToNodeId('/dashboard/settings')).toBe('dashboard_settings');
  });

  it('replaces special characters with underscores', () => {
    expect(routePathToNodeId('/user-profile')).toBe('user_profile');
  });
});

describe('detectNextjsRoute', () => {
  it('does nothing when isNextRoute is false', () => {
    const elements = makeElements();
    detectNextjsRoute('/project/app/dashboard/page.tsx', { isNextRoute: false, isLayout: false, isPage: false }, elements);
    expect(elements.nextjsRouteMap.size).toBe(0);
  });

  it('does nothing for files not in app/ directory', () => {
    const elements = makeElements();
    detectNextjsRoute('/project/pages/index.tsx', { isNextRoute: true, isLayout: false, isPage: true }, elements);
    expect(elements.nextjsRouteMap.size).toBe(0);
  });

  it('detects page.tsx in app/ directory', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/dashboard/page.tsx',
      { isNextRoute: true, isLayout: false, isPage: true },
      elements
    );
    expect(elements.nextjsRouteMap.size).toBe(1);
    const info = elements.nextjsRouteMap.get('/project/app/dashboard/page.tsx');
    expect(info).toBeDefined();
    expect(info?.isPage).toBe(true);
    expect(info?.isLayout).toBe(false);
    expect(info?.routePath).toBe('/dashboard');
    expect(info?.segment).toBe('dashboard');
    expect(info?.parentRoutePath).toBe('/');
  });

  it('detects layout.tsx in app/ directory', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/dashboard/layout.tsx',
      { isNextRoute: true, isLayout: true, isPage: false },
      elements
    );
    const info = elements.nextjsRouteMap.get('/project/app/dashboard/layout.tsx');
    expect(info?.isLayout).toBe(true);
    expect(info?.isPage).toBe(false);
  });

  it('detects root layout.tsx (app/layout.tsx)', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/layout.tsx',
      { isNextRoute: true, isLayout: true, isPage: false },
      elements
    );
    const info = [...elements.nextjsRouteMap.values()][0];
    expect(info?.isLayout).toBe(true);
    expect(info?.routePath).toBe('/');
    expect(info?.segment).toBe('');
  });

  it('detects loading.tsx', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/blog/loading.tsx',
      { isNextRoute: true, isLayout: false, isPage: false },
      elements
    );
    const info = [...elements.nextjsRouteMap.values()][0];
    expect(info?.isLoading).toBe(true);
  });

  it('detects error.tsx', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/blog/error.tsx',
      { isNextRoute: true, isLayout: false, isPage: false },
      elements
    );
    const info = [...elements.nextjsRouteMap.values()][0];
    expect(info?.isError).toBe(true);
  });

  it('detects API route.ts in api/ directory', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/api/users/route.ts',
      { isNextRoute: true, isLayout: false, isPage: false },
      elements
    );
    const info = [...elements.nextjsRouteMap.values()][0];
    expect(info?.isApi).toBe(true);
  });

  it('does NOT treat route.ts outside api/ directory as an API route', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/dashboard/route.ts',
      { isNextRoute: true, isLayout: false, isPage: false },
      elements
    );
    // route.ts outside api/ is not recognised as an API route (or any known type)
    expect(elements.nextjsRouteMap.size).toBe(0);
  });

  it('builds correct parent route path for nested routes', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/dashboard/settings/page.tsx',
      { isNextRoute: true, isLayout: false, isPage: true },
      elements
    );
    const info = [...elements.nextjsRouteMap.values()][0];
    expect(info?.routePath).toBe('/dashboard/settings');
    expect(info?.parentRoutePath).toBe('/dashboard');
    expect(info?.segment).toBe('settings');
  });

  it('ignores unknown file names in app/ directory', () => {
    const elements = makeElements();
    detectNextjsRoute(
      '/project/app/dashboard/utils.ts',
      { isNextRoute: true, isLayout: false, isPage: false },
      elements
    );
    // utils.ts is not a recognised route file name
    expect(elements.nextjsRouteMap.size).toBe(0);
  });

  it('stores the original filePath in the route info', () => {
    const elements = makeElements();
    const path = '/project/app/about/page.tsx';
    detectNextjsRoute(
      path,
      { isNextRoute: true, isLayout: false, isPage: true },
      elements
    );
    const info = elements.nextjsRouteMap.get(path);
    expect(info?.filePath).toBe(path);
  });
});
