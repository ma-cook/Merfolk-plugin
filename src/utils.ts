export function sanitizeNodeId(name: string): string {
  let safe = name.replace(/[-. ]+/g, '_');
  if (/^\d/.test(safe)) safe = `_${safe}`;
  return safe;
}
