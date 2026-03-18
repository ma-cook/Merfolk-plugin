import type { Elements, NextjsRouteInfo } from '../types';

/**
 * Detect a Next.js App Router route file and populate elements.nextjsRouteMap.
 * Called for each file when repoType === 'nextjs' and fileContext.isNextRoute is true.
 *
 * Supported route files:
 *   page.(tsx|jsx|ts|js)      → page route
 *   layout.(tsx|jsx|ts|js)    → layout
 *   loading.(tsx|jsx|ts|js)   → loading UI
 *   error.(tsx|jsx|ts|js)     → error boundary
 *   route.(ts|js) in api/**   → API route
 */
export function detectNextjsRoute(
  filePath: string,
  fileContext: { isNextRoute: boolean; isLayout: boolean; isPage: boolean },
  elements: Elements
): void {
  if (!fileContext.isNextRoute) return;

  const normalized = filePath.replace(/\\/g, '/');

  // Find the app/ directory boundary
  const appMatch = /(?:^|\/)app\//.exec(normalized);
  if (!appMatch) return;

  const appStart = appMatch.index + appMatch[0].indexOf('/app/') + 1; // position of 'app/'
  const relPath = normalized.slice(appStart); // e.g. "app/dashboard/page.tsx"
  const parts = relPath.split('/'); // ["app", "dashboard", "page.tsx"]
  if (parts.length < 2) return;

  const fileName = parts[parts.length - 1]; // e.g. "page.tsx"
  const dirParts = parts.slice(1, -1); // directory segments under app/ e.g. ["dashboard"]

  const isPage = /^page\.(tsx|jsx|ts|js)$/.test(fileName);
  const isLayout = /^layout\.(tsx|jsx|ts|js)$/.test(fileName);
  const isLoading = /^loading\.(tsx|jsx|ts|js)$/.test(fileName);
  const isError = /^error\.(tsx|jsx|ts|js)$/.test(fileName);
  // An API route requires the file to be named route.ts/js AND reside under an api/ segment
  const isApi =
    /^route\.(tsx|ts|js)$/.test(fileName) && dirParts.includes('api');

  if (!isPage && !isLayout && !isLoading && !isError && !isApi) return;

  // Build the route path (relative to app root)
  const routePath = dirParts.length > 0 ? '/' + dirParts.join('/') : '/';
  // Parent route path is one level up
  const parentDirParts = dirParts.slice(0, -1);
  const parentRoutePath = parentDirParts.length > 0 ? '/' + parentDirParts.join('/') : '/';
  // Route segment is the deepest directory name (or '' for the root)
  const segment = dirParts[dirParts.length - 1] ?? '';

  const info: NextjsRouteInfo = {
    segment,
    routePath,
    parentRoutePath,
    isLayout,
    isPage,
    isLoading,
    isError,
    isNotFound: false,
    isAppShell: false,
    isDocument: false,
    isMiddleware: false,
    isApi,
    filePath,
  };

  elements.nextjsRouteMap.set(filePath, info);
}

/**
 * Build a Merfolk node ID for a Next.js route from its path segments.
 * e.g. "/dashboard/settings" → "dashboard_settings"
 *      "/"                   → "app_root"
 */
export function routePathToNodeId(routePath: string): string {
  if (routePath === '/') return 'app_root';
  return routePath
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');
}
