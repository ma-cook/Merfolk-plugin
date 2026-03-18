export function sanitizeNodeId(name: string): string {
  const safe = name.replace(/[-. ]+/g, '_');
  return /^\d/.test(safe) ? `_${safe}` : safe;
}

/** Extract the filename stem (no extension) from a file path. */
export function filePathToStem(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
  return base.replace(/\.[^.]+$/, '');
}
