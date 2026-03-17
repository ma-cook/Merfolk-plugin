import type { Elements, RepoType } from '../types';
import { sanitizeNodeId } from '../utils';

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

  // 3. Detect name collisions (components take priority; functions get _file suffix)
  const componentSet = new Set(components);

  const lines: string[] = [];

  // 5. Header comment with repo name
  lines.push(`%% ${repoName} %%`);

  // 6. Open merfolk code fence
  lines.push('```merfolk');

  // 7–8. Repo-type specific: component hierarchy arrows
  if (repoType === 'react' || repoType === 'nextjs') {
    if (components.length >= 2) {
      for (let i = 0; i < components.length - 1; i++) {
        const a = sanitizeNodeId(components[i]);
        const b = sanitizeNodeId(components[i + 1]);
        lines.push(`{Component: ${a}} --> {Component: ${b}}`);
      }
    }
  }

  // 9. Node declarations for each category
  for (const comp of components) {
    lines.push(`{Component: ${sanitizeNodeId(comp)}}`);
  }

  for (const fn of functions_) {
    const label = componentSet.has(fn) ? `${sanitizeNodeId(fn)}_file` : sanitizeNodeId(fn);
    lines.push(`[Function: ${label}]`);
  }

  for (const util of utilities) {
    const label = componentSet.has(util) ? `${sanitizeNodeId(util)}_file` : sanitizeNodeId(util);
    lines.push(`[Function: ${label}]`);
  }

  for (const store of stores) {
    lines.push(`[[Store: ${sanitizeNodeId(store)}]]`);
  }

  for (const service of services) {
    lines.push(`((Service: ${sanitizeNodeId(service)}))`);
  }

  for (const lib of libraries) {
    lines.push(`<Library: ${sanitizeNodeId(lib)}>`);
  }

  for (const hook of hooks) {
    lines.push(`[Hook: ${sanitizeNodeId(hook)}]`);
  }

  // 10. Containment arrows (-.->): component → hook
  if (components.length > 0 && hooks.length > 0) {
    for (const comp of components) {
      for (const hook of hooks) {
        lines.push(`{Component: ${sanitizeNodeId(comp)}} -.-> [Hook: ${sanitizeNodeId(hook)}]`);
      }
    }
  }

  // 12. Close code fence
  lines.push('```');

  return lines.join('\n');
}
