/**
 * Named styles and style copy/paste (style-manager DESIGN.md D6, §E).
 *
 * A named style (a Webflow-style class) is a bundle of utilities stored once
 * in the site library; an element references it with the marker `ck-s-<id>`.
 * The renderer expands markers at render time, so editing the style once
 * moves every element that carries it, on the canvas and in the export.
 */
import { STYLE_PROPERTIES, type StylePropertyId } from './catalogue';
import { splitClassList } from './class-syntax';
import { readEntries, type Entry } from './entries';
import { ckTwMerge } from './tw-merge';

export const NAMED_STYLE_PREFIX = 'ck-s-';
const MARKER = /^ck-s-([a-z][a-z0-9-]{0,47})$/u;

/** The named-style ids an element references, in marker order. */
export function namedStyleIds(className: string): string[] {
  return splitClassList(className)
    .map((name) => MARKER.exec(name)?.[1])
    .filter((id): id is string => id !== undefined);
}

/**
 * Replace markers with their styles' utilities, merged so that the element's
 * own classes win and combo styles apply in marker order:
 * `ckTwMerge(...styleUtilities, ownUtilities)`. The markers are kept, so the
 * expanded element still says which styles it carries. An unknown id adds
 * nothing.
 */
export function expandNamedStyles(
  className: string,
  styles: Readonly<Record<string, string>>,
): string {
  const classes = splitClassList(className);
  const markers = classes.filter((name) => MARKER.test(name));
  if (markers.length === 0) return classes.join(' ');
  const own = classes.filter((name) => !MARKER.test(name)).join(' ');
  const bundles = namedStyleIds(className).map((id) =>
    /* A style may not reference another style: its markers are dropped, not chased. */
    splitClassList(styles[id] ?? '')
      .filter((name) => !MARKER.test(name))
      .join(' '),
  );
  return [...markers, ckTwMerge(...bundles, own)].filter((part) => part !== '').join(' ');
}

function isStyleEntry(entry: Entry, families: ReadonlySet<string> | undefined): boolean {
  if (entry.matches.length === 0) return false;
  if (families === undefined) return true;
  return entry.matches.some((match) => familyOf(match.property, families));
}

function familyOf(property: StylePropertyId, families: ReadonlySet<string>): boolean {
  return families.has(property) || families.has(STYLE_PROPERTIES[property].family);
}

/**
 * The style classes of an element, for "copy style": every class a catalogue
 * property reads (at any bucket, state or variant) and the named-style
 * markers. Structural classes (`group`, region `ck-` hooks, `container`) stay
 * behind. With `families`, only those families (property ids or family ids;
 * `named-styles` for the markers).
 */
export function extractStyleClasses(className: string, families?: readonly string[]): string {
  const wanted = families === undefined ? undefined : new Set(families);
  return readEntries(className)
    .filter((entry) =>
      MARKER.test(entry.raw)
        ? wanted === undefined || wanted.has('named-styles')
        : isStyleEntry(entry, wanted),
    )
    .map((entry) => entry.raw)
    .join(' ');
}

/**
 * "Paste style": the target's style classes are replaced by the copied ones;
 * its structural classes stay. With `families`, only those families are
 * replaced (the copied classes are filtered to them too).
 */
export function pasteStyleClasses(
  target: string,
  copied: string,
  options?: { readonly families?: readonly string[] },
): string {
  const families = options?.families;
  const removed = new Set(splitClassList(extractStyleClasses(target, families)));
  const kept = splitClassList(target).filter((name) => !removed.has(name));
  const pasted = splitClassList(
    families === undefined ? copied : extractStyleClasses(copied, families),
  );
  const merged = [...kept, ...pasted];
  return merged.filter((name, index) => merged.indexOf(name) === index).join(' ');
}
