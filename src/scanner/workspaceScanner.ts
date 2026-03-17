import fs from 'fs/promises';
import path from 'path';
import type { FileType, WorkspaceFile } from '../types';

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.vue',
  '.glsl', '.wgsl', '.hlsl', '.vert', '.frag', '.comp',
]);

const SHADER_EXTENSIONS = new Set(['.glsl', '.wgsl', '.hlsl', '.vert', '.frag', '.comp']);

const EXCLUDED_DIRS = /^(node_modules|\.git|dist|build|coverage|examples?|demos?|tests?|__tests__|e2e|fixtures?|vendor|\.cache)$/i;

function classifyFile(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.py') return 'python';
  if (ext === '.vue') return 'vue';
  if (SHADER_EXTENSIONS.has(ext)) return 'shader';
  return 'file';
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.test(entry.name)) {
        const sub = await walkDir(fullPath);
        results.push(...sub);
      }
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function scanWorkspace(rootPath: string): Promise<WorkspaceFile[]> {
  const filePaths = await walkDir(rootPath);
  return filePaths.map(filePath => ({
    path: filePath,
    name: path.basename(filePath),
    type: classifyFile(filePath),
  }));
}
