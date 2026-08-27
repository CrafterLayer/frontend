const FALLBACK_JSON = 'null';

/**
 * Stored rich text is rejected above depth 30 at the door. This deliberately
 * larger ceiling keeps every valid stored document byte-identical while a
 * hostile read can recurse only a small, fixed number of frames.
 */
const MAX_CANONICAL_DEPTH = 64;

function primitiveJson(value: unknown): string {
  try {
    // JSON.stringify returns undefined for functions/symbols and throws for
    // BigInt. All values outside JSON degrade to the same explicit fallback.
    const serialized: unknown = JSON.stringify(value ?? null);
    return typeof serialized === 'string' ? serialized : FALLBACK_JSON;
  } catch {
    return FALLBACK_JSON;
  }
}

function canonicalJsonAt(value: unknown, depth: number, ancestors: Set<object>): string {
  if (depth > MAX_CANONICAL_DEPTH) {
    return FALLBACK_JSON;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return FALLBACK_JSON;
    }
    ancestors.add(value);
    try {
      const items: string[] = [];
      for (const item of value) {
        items.push(canonicalJsonAt(item, depth + 1, ancestors));
      }
      return `[${items.join(',')}]`;
    } catch {
      return FALLBACK_JSON;
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === 'object' && value !== null) {
    if (ancestors.has(value)) {
      return FALLBACK_JSON;
    }
    ancestors.add(value);
    try {
      const record = value as Record<string, unknown>;
      const entries = Object.keys(record)
        .sort()
        .map(
          (key) => `${JSON.stringify(key)}:${canonicalJsonAt(record[key], depth + 1, ancestors)}`,
        );
      return `{${entries.join(',')}}`;
    } catch {
      // Revoked proxies and throwing property getters are malformed stored
      // values too; they must not take the editor down during reconciliation.
      return FALLBACK_JSON;
    } finally {
      ancestors.delete(value);
    }
  }
  return primitiveJson(value);
}

/**
 * Key-order-independent JSON identity (008 §10 review fix). The editor compares
 * an incoming stored value against its own last emission to decide "external
 * write or my own echo?". Plain `JSON.stringify` makes that comparison depend
 * on key ORDER, so any normalizer, persistence round trip, or AI-authored value
 * that spells the same document with different key order would read as an
 * external write and yank the caret mid-typing.
 *
 * This function is TOTAL for unknown stored input: unsupported primitives,
 * cycles, inaccessible objects, and shapes beyond the depth ceiling degrade to
 * JSON null instead of throwing. Representable values within the door's valid
 * depth retain the exact historical canonical bytes.
 */
export function canonicalJson(value: unknown): string {
  try {
    return canonicalJsonAt(value, 0, new Set());
  } catch {
    // Array.isArray itself can throw for a revoked Proxy, before the recursive
    // worker reaches its local guards.
    return FALLBACK_JSON;
  }
}
