const CHARACTERS_PER_TOKEN_ESTIMATE = 4;
/**
 * Arabic costs about twice what Latin text does: a tokenizer learned mostly on Latin text
 * splits an Arabic word into short pieces, about one token per two characters. Counted over
 * the Arabic block (U+0600–U+06FF), so an Arabic page is no longer estimated at half its size.
 */
const ARABIC_CHARACTERS_PER_TOKEN_ESTIMATE = 2;
const ARABIC_FIRST = 0x0600;
const ARABIC_LAST = 0x06ff;

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

/** How many characters of `text` are in the Arabic block. */
function arabicCharacters(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= ARABIC_FIRST && code <= ARABIC_LAST) count += 1;
  }
  return count;
}

/**
 * Conservative estimate over the exact canonical JSON characters: four characters per
 * token, two for an Arabic one.
 */
export function estimateCanonicalJsonTokens(value: unknown): number {
  const json = canonicalJsonStringify(value);
  const arabic = arabicCharacters(json);
  return Math.max(
    1,
    Math.ceil(
      (json.length - arabic) / CHARACTERS_PER_TOKEN_ESTIMATE +
        arabic / ARABIC_CHARACTERS_PER_TOKEN_ESTIMATE,
    ),
  );
}
