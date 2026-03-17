export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
