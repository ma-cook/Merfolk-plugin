import type { RepoType } from '../types';
import fs from 'fs/promises';
import path from 'path';

const nonSourceDirPattern = /\b(node_modules|\.git|dist|build|coverage|examples?|demos?|tests?|__tests__|e2e|fixtures?|vendor|\.cache)\b/i;

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!nonSourceDirPattern.test(entry.name)) {
        const sub = await walkDir(fullPath);
        results.push(...sub);
      }
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getDeps(pkg: Record<string, unknown>): string[] {
  const deps: string[] = [];
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const section = pkg[key];
    if (section && typeof section === 'object') {
      deps.push(...Object.keys(section as Record<string, unknown>));
    }
  }
  return deps;
}

function getProdDeps(pkg: Record<string, unknown>): string[] {
  const deps: string[] = [];
  for (const key of ['dependencies', 'peerDependencies']) {
    const section = pkg[key];
    if (section && typeof section === 'object') {
      deps.push(...Object.keys(section as Record<string, unknown>));
    }
  }
  return deps;
}

const pythonSignalFiles = ['requirements.txt', 'setup.py', 'setup.cfg', 'pyproject.toml', 'Pipfile'];

export async function detectRepoType(rootPath: string): Promise<RepoType> {
  // 1. Check for Python project signals
  const hasPythonSignal = (
    await Promise.all(pythonSignalFiles.map(f => fileExists(path.join(rootPath, f))))
  ).some(Boolean);

  const allFiles = await walkDir(rootPath);
  const pyFiles = allFiles.filter(f => f.endsWith('.py'));
  const jsFiles = allFiles.filter(f => /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f));
  const vueFiles = allFiles.filter(f => f.endsWith('.vue'));
  const jsxFiles = allFiles.filter(f => f.endsWith('.jsx'));

  // Python detection: has .py files + project signals, and JS is not dominant
  if (hasPythonSignal && pyFiles.length > 0 && jsFiles.length === 0) {
    return 'python';
  }

  // 2. Check for .vue files in source directories
  if (vueFiles.length > 0) {
    return 'vue';
  }

  // 3. Read package.json for framework detection
  const pkg = await readPackageJson(rootPath);
  if (pkg) {
    const allDeps = getDeps(pkg);
    const prodDeps = getProdDeps(pkg);

    // Check for vue/nuxt in deps
    if (allDeps.some(d => d === 'vue' || d === 'nuxt')) {
      return 'vue';
    }

    // 4. Check for next in deps
    if (allDeps.some(d => d === 'next')) {
      return 'nextjs';
    }

    // 5. Check for next.config.* or app/pages dirs with react dep
    const hasNextConfig =
      (await fileExists(path.join(rootPath, 'next.config.js'))) ||
      (await fileExists(path.join(rootPath, 'next.config.ts'))) ||
      (await fileExists(path.join(rootPath, 'next.config.mjs')));
    const hasAppDir = await fileExists(path.join(rootPath, 'app'));
    const hasPagesDir = await fileExists(path.join(rootPath, 'pages'));
    const hasReactProdDep = prodDeps.includes('react');

    if ((hasNextConfig || (hasAppDir && hasReactProdDep) || (hasPagesDir && hasReactProdDep))) {
      return 'nextjs';
    }

    // 6. Check for .jsx files in source dirs
    if (jsxFiles.length > 0) {
      return 'react';
    }

    // 7. Check for react in prod/peer deps
    if (hasReactProdDep) {
      return 'react';
    }

    // 8. .tsx without react prod dep → vanilla
    const tsxFiles = allFiles.filter(f => f.endsWith('.tsx'));
    if (tsxFiles.length > 0 && !hasReactProdDep) {
      return 'vanilla';
    }
  }

  // 9. Only Python files with no JS → python
  if (pyFiles.length > 0 && jsFiles.length === 0) {
    return 'python';
  }

  // 10. Default → vanilla
  return 'vanilla';
}
