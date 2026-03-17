import type { WorkspaceFile } from '../types';

export async function scanWorkspace(_rootPath: string): Promise<WorkspaceFile[]> {
  throw new Error('Not implemented');
}
