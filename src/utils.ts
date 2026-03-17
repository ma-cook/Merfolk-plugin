export function sanitizeNodeId(name: string): string {
  const safe = name.replace(/[-. ]+/g, '_');
  return /^\d/.test(safe) ? `_${safe}` : safe;
}
