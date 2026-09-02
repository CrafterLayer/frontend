export function normalizedKey(propKey: string): string {
  return propKey.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

export function displayPropertyLabel(propKey: string): string {
  const words = propKey
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? propKey : `${words[0]?.toUpperCase() ?? ''}${words.slice(1)}`;
}

export function unitFor(propKey: string): string {
  const key = normalizedKey(propKey);
  if (key.includes('duration') || key.includes('delay')) {
    return 'ms';
  }
  if (key.includes('angle') || key.includes('rotation')) {
    return 'deg';
  }
  if (
    key.includes('width') ||
    key.includes('height') ||
    key.includes('size') ||
    key.includes('spacing') ||
    key.includes('padding') ||
    key.includes('margin') ||
    key.includes('inset') ||
    key.includes('gap')
  ) {
    return 'px';
  }
  return '—';
}
