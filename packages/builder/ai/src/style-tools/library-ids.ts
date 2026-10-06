import { isLibraryId } from '@craftkit/builder-schema';

/*
  A site-library id (`/^[a-z][a-z0-9-]{0,47}$/`) derived from the name the
  agent gives, the SAME way in every tool: style.define names a style "Card
  featured" and a later style.apply that says "Card featured" or
  "card-featured" lands on the same `ck-s-card-featured` marker. The page
  kernel cannot read the site library, so the derivation is the contract.

  A name with no Latin letters (an Arabic «بطاقة مميزة») gets a stable
  hash id, `s-<base36>`, so it still round-trips between the two tools.
*/

/** A boolean, not a type guard: LibraryId is `string`, so a guard would narrow its else-branch to never. */
const validId = (value: string): boolean => isLibraryId(value);

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** The library id a name stands for; an id is returned as it is. */
export function libraryIdFor(name: string, prefix = 's'): string {
  const trimmed = name.trim();
  if (validId(trimmed)) return trimmed;
  const slug = trimmed
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^[^a-z]+/u, '')
    .replace(/-+$/u, '')
    .slice(0, 48)
    .replace(/-+$/u, '');
  if (slug !== '' && validId(slug)) return slug;
  return `${prefix}-${fnv1a(trimmed.normalize('NFC').toLowerCase())}`;
}
