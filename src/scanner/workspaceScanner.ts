import type { WorkspaceFile, FileType } from '../types';
import fs from 'fs/promises';
import path from 'path';

const EXCLUDED_DIRS = /\b(node_modules|\.git|dist|build|coverage|examples?|demos?|tests?|__tests__|e2e|fixtures?|vendor|\.cache)\b/i;

function getFileType(filePath: string): FileType | null {
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.vue')) return 'vue';
  if (/\.(glsl|wgsl|hlsl|vert|frag|comp)$/.test(filePath)) return 'shader';
  if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath)) return 'file';
  return null;
}

export async function scanWorkspace(rootPath: string): Promise<WorkspaceFile[]> {
  const results: WorkspaceFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.test(entry.name)) {
          await walk(fullPath);
        }
      } else {
        const type = getFileType(fullPath);
        if (type !== null) {
          results.push({ path: fullPath, name: entry.name, type });
        }
      }
    }
  }

  await walk(rootPath);
  return results;
}
