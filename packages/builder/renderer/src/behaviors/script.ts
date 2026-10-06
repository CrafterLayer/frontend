import {
  BEHAVIOR_PACKS,
  mountBgVideo,
  mountCarousel,
  mountCompare,
  mountEmbedFacade,
  mountEngines,
  mountGallery,
  mountMailtoForm,
  mountToggleGroup,
  mountVideoPlayer,
  type BehaviorPack,
} from './packs';
import { mountBehaviors } from './runtime';

/*
  media-motion fix pass (2026-10-06): ck-behaviors.js carried every pack to
  every page that used any behaviour — a restaurant page with one stagger
  loaded 91 KB (21.3 KB gzip) against ~12.6 KB before. A pack now ships only
  when the site's markup carries its marker.
*/
const behavior = (...names: readonly string[]): RegExp =>
  new RegExp(`data-ck-behavior=["']?(?:${names.join('|')})["'\\s>/]`, 'u');

/** What each pack mounts on, as it appears in rendered markup. */
const PACK_MARKERS: ReadonlyMap<BehaviorPack, RegExp> = new Map<BehaviorPack, RegExp>([
  [mountGallery, behavior('gallery', 'lightbox')],
  [mountCarousel, behavior('carousel')],
  [mountVideoPlayer, behavior('video-player')],
  [mountBgVideo, behavior('bg-video')],
  [mountEmbedFacade, behavior('embed-facade')],
  [mountCompare, behavior('compare')],
  [mountToggleGroup, behavior('toggle-group')],
  [mountMailtoForm, behavior('mailto-form')],
  [mountEngines, /\sdata-ck-(?:scene|timeline|lottie)(?=[\s=>/])/u],
]);

/** The packs rendered markup uses, in `BEHAVIOR_PACKS` order. */
export function pageBehaviorPacks(markup: string | readonly string[]): readonly BehaviorPack[] {
  const text = typeof markup === 'string' ? markup : markup.join('\n');
  return BEHAVIOR_PACKS.filter((pack) => PACK_MARKERS.get(pack)?.test(text) ?? true);
}

/**
 * The behaviour runtime as one inline script for an exported page:
 * `mountBehaviors` and the behaviour packs (media-motion DESIGN §2.1) —
 * every pack, or only those `markup` (the site's rendered pages) uses —
 * each serialised by `Function.prototype.toString` and called on the
 * document. It must run after the markup is parsed, so an exporter places
 * it at the end of <body> (or in a `defer`/module script).
 */
export function behaviorRuntimeScript(markup?: string | readonly string[]): string {
  // media-motion (2026-10-06): the packs follow the core runtime, in order.
  const packs = markup === undefined ? BEHAVIOR_PACKS : pageBehaviorPacks(markup);
  return [mountBehaviors, ...packs].map((mount) => `(${mount.toString()})(document);`).join('\n');
}

/**
 * What makes a page need the runtime: a behaviour, a motion or hover preset
 * (child indexes, triggers, split text, pointer effects), the spotlight
 * effect's pointer variables, or an engine marker (scene, timeline, Lottie).
 * Kept equal to the selector inside `mountBehaviors` (which cannot import it).
 */
export const BEHAVIOR_RUNTIME_SELECTOR =
  '[data-ck-behavior], [data-ck-motion], [data-ck-hover], .ck-fx-spotlight, [data-ck-scene], [data-ck-timeline], [data-ck-lottie]';

const RUNTIME_MARKERS = [
  'data-ck-behavior',
  'data-ck-motion',
  'data-ck-hover',
  'ck-fx-spotlight',
  // media-motion (2026-10-06): the engine markers.
  'data-ck-scene',
  'data-ck-timeline',
  'data-ck-lottie',
] as const;

/**
 * Whether a page needs the runtime at all — a cheap check an exporter runs
 * before embedding the script, and the canvas runs before mounting. Reads
 * rendered markup (a string), a DOM node, or any JSON value (a stored
 * document or tree).
 */
export function hasBehaviors(markupOrDocument: unknown): boolean {
  if (typeof markupOrDocument === 'string')
    return RUNTIME_MARKERS.some((marker) => markupOrDocument.includes(marker));
  if (typeof markupOrDocument !== 'object' || markupOrDocument === null) return false;
  const node = markupOrDocument as { querySelector?: unknown };
  if (typeof node.querySelector === 'function') {
    return (markupOrDocument as ParentNode).querySelector(BEHAVIOR_RUNTIME_SELECTOR) !== null;
  }
  try {
    const json = JSON.stringify(markupOrDocument);
    return (
      json.includes('"data-ck-behavior"') ||
      json.includes('"data-ck-motion"') ||
      json.includes('"data-ck-hover"') ||
      /ck-fx-spotlight\b/u.test(json) ||
      // media-motion (2026-10-06): the engine markers.
      json.includes('"data-ck-scene"') ||
      json.includes('"data-ck-timeline"') ||
      json.includes('"data-ck-lottie"')
    );
  } catch {
    return false;
  }
}

// media-motion (2026-10-06)
export type PageEngine = 'scene' | 'timeline' | 'lottie';

const ENGINE_ATTRIBUTES: readonly (readonly [PageEngine, string])[] = [
  ['scene', 'data-ck-scene'],
  ['timeline', 'data-ck-timeline'],
  ['lottie', 'data-ck-lottie'],
];

/**
 * Which lazily loaded engines a page uses (media-motion DESIGN §2.2): read from
 * rendered markup (an attribute name followed by `=`, whitespace, `>` or `/`),
 * a DOM node (itself or a descendant), or a stored JSON value (an attribute key).
 */
export function pageEngines(markupOrNode: unknown): Set<PageEngine> {
  const used = new Set<PageEngine>();
  if (typeof markupOrNode === 'string') {
    for (const [kind, attribute] of ENGINE_ATTRIBUTES) {
      if (new RegExp(`\\s${attribute}(?=[\\s=>/])`, 'u').test(markupOrNode)) used.add(kind);
    }
    return used;
  }
  if (typeof markupOrNode !== 'object' || markupOrNode === null) return used;
  const node = markupOrNode as { querySelector?: unknown; nodeType?: unknown; matches?: unknown };
  if (typeof node.querySelector === 'function') {
    const parent = markupOrNode as ParentNode;
    for (const [kind, attribute] of ENGINE_ATTRIBUTES) {
      const selector = `[${attribute}]`;
      const self = node.nodeType === 1 && typeof node.matches === 'function' && (markupOrNode as Element).matches(selector);
      if (self || parent.querySelector(selector) !== null) used.add(kind);
    }
    return used;
  }
  let json = '';
  try {
    json = JSON.stringify(markupOrNode);
  } catch {
    return used;
  }
  for (const [kind, attribute] of ENGINE_ATTRIBUTES) if (json.includes(`"${attribute}"`)) used.add(kind);
  return used;
}
