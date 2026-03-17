import type { FileContext } from '../types';

export function analyzeFile(_filePath: string, _repoType?: string): FileContext {
  throw new Error('Not implemented');
}

export function containsJSX(_node: unknown): boolean {
  throw new Error('Not implemented');
}
