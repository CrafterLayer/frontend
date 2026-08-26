/**
 * Key-order-independent JSON identity (008 §10 review fix). The editor compares
 * an incoming stored value against its own last emission to decide "external
 * write or my own echo?". Plain `JSON.stringify` makes that comparison depend
 * on key ORDER, so any normalizer, persistence round trip, or AI-authored value
 * that spells the same document with different key order would read as an
 * external write and yank the caret mid-typing.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
