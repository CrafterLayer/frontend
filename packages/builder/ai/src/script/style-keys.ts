import { STYLE_PROPERTY_IDS, type StylePropertyId } from '@craftkit/builder-schema';

/**
 * A script's style keys, read the way a person writes CSS (agent-script
 * DESIGN §A.6). `ck.style(els, {...})` takes the element.style vocabulary
 * (`STYLE_PROPERTY_IDS`, camelCase), and models write CSS names half the
 * time, so the host folds kebab-case to camelCase and maps the common CSS
 * names onto the vocabulary before the style tools see them. A key the
 * vocabulary does not have is refused with the nearest ids, which is the
 * repair round's instruction.
 */

const IDS: ReadonlySet<string> = new Set(STYLE_PROPERTY_IDS);

/** CSS names and shorthands → vocabulary ids. Keys are lower-case, without dashes. */
const ALIASES: Readonly<Record<string, StylePropertyId>> = {
  borderradius: 'borderRadius',
  radius: 'borderRadius',
  rounded: 'borderRadius',
  color: 'textColor',
  textcolor: 'textColor',
  background: 'backgroundColor',
  backgroundcolor: 'backgroundColor',
  bg: 'backgroundColor',
  bgcolor: 'backgroundColor',
  width: 'inlineSize',
  height: 'blockSize',
  minwidth: 'minInlineSize',
  maxwidth: 'maxInlineSize',
  minheight: 'minBlockSize',
  maxheight: 'maxBlockSize',
  shadow: 'boxShadow',
  boxshadow: 'boxShadow',
  fontweight: 'fontWeight',
  weight: 'fontWeight',
  size: 'fontSize',
  dir: 'direction',
  align: 'textAlign',
  zindex: 'zIndex',
  objectfit: 'objectFit',
};

/** "font-size" → "fontSize", "border_radius" → "borderRadius". */
export function camelStyleKey(key: string): string {
  return key.trim().replace(/[-_\s]+([a-zA-Z0-9])/gu, (_, letter: string) => letter.toUpperCase());
}

function levenshtein(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** The vocabulary ids nearest a key: by edit distance, then by a shared word. */
export function nearestStyleKeys(key: string, count = 4): readonly string[] {
  const camel = camelStyleKey(key);
  const lower = camel.toLowerCase();
  return [...STYLE_PROPERTY_IDS]
    .map((id) => {
      const idLower = id.toLowerCase();
      const shared = lower.length >= 3 && (idLower.includes(lower) || lower.includes(idLower)) ? -2 : 0;
      return { id, score: levenshtein(camel, id) + shared };
    })
    .sort((left, right) => left.score - right.score || left.id.localeCompare(right.id))
    .slice(0, count)
    .map(({ id }) => id);
}

export type StyleKeyResult =
  | { readonly ok: true; readonly property: StylePropertyId }
  | { readonly ok: false; readonly error: string };

/** A script's style key as the vocabulary id, or a refusal naming the nearest ids. */
export function normalizeStyleKey(key: string): StyleKeyResult {
  const camel = camelStyleKey(key);
  if (IDS.has(camel)) return { ok: true, property: camel as StylePropertyId };
  const alias = ALIASES[camel.toLowerCase()];
  if (alias !== undefined) return { ok: true, property: alias };
  const folded = [...IDS].find((id) => id.toLowerCase() === camel.toLowerCase());
  if (folded !== undefined) return { ok: true, property: folded as StylePropertyId };
  return {
    ok: false,
    error: `unknown style "${key.slice(0, 40)}"; nearest: ${nearestStyleKeys(key).join(', ')}`,
  };
}
