const CHARACTERS_PER_TOKEN_ESTIMATE = 4;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Deterministic JSON serialization shared by context sizing, wire sizing, and
 * cache identity. Object keys are ordered recursively; array order and native
 * JSON omission/error semantics are preserved.
 */
export function canonicalJsonStringify(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, candidate: unknown) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return candidate;
    }
    return Object.fromEntries(
      Object.entries(candidate).sort(([left], [right]) => compareText(left, right)),
    );
  }) as string | undefined;
  if (serialized === undefined) {
    throw new TypeError('Value cannot be represented as canonical JSON.');
  }
  return serialized;
}

/** Conservative estimate over the exact canonical JSON characters. */
export function estimateCanonicalJsonTokens(value: unknown): number {
  return Math.max(
    1,
    Math.ceil(canonicalJsonStringify(value).length / CHARACTERS_PER_TOKEN_ESTIMATE),
  );
}
