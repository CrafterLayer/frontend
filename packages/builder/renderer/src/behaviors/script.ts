import {
  BEHAVIOR_PACKS,
  mountBackToTop,
  mountBgVideo,
  mountCarousel,
  mountCompare,
  mountCountdown,
  mountDismiss,
  mountEmbedFacade,
  mountEngines,
  mountFilter,
  mountGallery,
  mountMailtoForm,
  mountReadMore,
  mountScripts,
  mountScrollSpy,
  mountTableTools,
  mountToggleGroup,
  mountTypedWords,
  mountVideoPlayer,
  type BehaviorPack,
} from './packs';
import { mountBehaviors } from './runtime';
import { declaredLibs, type StudioLibKey } from '../studio/contract'; // pixi-studio:runtime-wiring (2026-10-10)

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
  [mountCountdown, behavior('countdown-clock')],
  [mountTableTools, behavior('table-tools')],
  // everyday site behaviours (2026-10-13).
  [mountBackToTop, behavior('back-to-top')],
  [mountReadMore, behavior('read-more')],
  [mountScrollSpy, behavior('scroll-spy')],
  [mountTypedWords, behavior('typed-words')],
  [mountFilter, behavior('filter')],
  [mountDismiss, behavior('dismiss')],
  [mountEngines, /\sdata-ck-(?:scene|timeline|lottie)(?=[\s=>/])/u],
  // free-code mode (2026-10-09): a region's `js` is rendered as `data-ck-js="…"`.
  [mountScripts, /\sdata-ck-js(?=[\s=>/])/u],
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

/**
 * A region script (free-code mode, 2026-10-09). Not part of `BEHAVIOR_RUNTIME_SELECTOR`: that one
 * is held equal to the core runtime's, which has nothing to do for a script — the `scripts`
 * pack owns this marker. `hasBehaviors` and the exporter still count it as needing the runtime.
 */
export const SCRIPT_SELECTOR = '[data-ck-js]';

const RUNTIME_MARKERS = [
  'data-ck-behavior',
  'data-ck-motion',
  'data-ck-hover',
  'ck-fx-spotlight',
  // media-motion (2026-10-06): the engine markers.
  'data-ck-scene',
  'data-ck-timeline',
  'data-ck-lottie',
  // free-code mode (2026-10-09): a region script.
  'data-ck-js',
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
    const parent = markupOrDocument as ParentNode;
    return (
      parent.querySelector(BEHAVIOR_RUNTIME_SELECTOR) !== null ||
      parent.querySelector(SCRIPT_SELECTOR) !== null
    );
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
      json.includes('"data-ck-lottie"') ||
      json.includes('"data-ck-js"')
    );
  } catch {
    return false;
  }
}

// media-motion (2026-10-06); free-code mode (2026-10-09): + 'pixi', the FULL pixi.js bundle for region scripts.
export type PageEngine =
  | 'scene'
  | 'timeline'
  | 'lottie'
  | 'pixi'
  | 'carousel'
  // pixi-studio:runtime-wiring additions (2026-10-10): the add-on libraries and the sound engine.
  | 'sound'
  | `lib-${StudioLibKey}`;
// end pixi-studio:runtime-wiring additions

const ENGINE_ATTRIBUTES: readonly (readonly [
  Exclude<PageEngine, 'pixi' | 'carousel' | 'sound' | `lib-${StudioLibKey}`>,
  string,
])[] = [
  ['scene', 'data-ck-scene'],
  ['timeline', 'data-ck-timeline'],
  ['lottie', 'data-ck-lottie'],
];

/**
 * Whether a region's code asks for the full pixi.js bundle: it names Pixi or calls `ck.stage`.
 * This is the contract the exporter and the canvas share — `ck.pixi()` and `ck.stage()` both
 * match, and so does an honest comment. Code that hides the call (`ck['pi'+'xi']()`) is not
 * detected, so its `ck.pixi()` rejects with a message saying so rather than hanging.
 */
export function codeUsesPixi(code: string): boolean {
  return /pixi|ck\.stage/iu.test(code);
}

/** Whether any `data-ck-js="…"` attribute in rendered markup (double or single quoted) uses Pixi. */
function markupScriptsUsePixi(markup: string): boolean {
  for (const match of markup.matchAll(/\sdata-ck-js=(?:"([^"]*)"|'([^']*)')/gu)) {
    if (codeUsesPixi(match[1] ?? match[2] ?? '')) return true;
  }
  return false;
}

// pixi-studio:runtime-wiring additions (2026-10-10)
/*
  Pixi Studio (DESIGN §B.1): a region's code may also ask for add-on libraries (`ck.use('filters')`,
  `ck.scene({ libs: ['physics'] })`) and for sound (`ck.sound`, `audio: true`); a customCode tree
  element may carry `data-ck-sound`. One reader, `declaredLibs` (the export uses the same one),
  turns each code string into engine kinds. `ck.scene(` always implies `pixi` and `lib-kit`.
*/
const SOUND_ATTRIBUTE = 'data-ck-sound';
const SOUND_MARKUP = /\sdata-ck-sound(?=[\s=>/])/u;

const MARKUP_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#x27': "'",
  '#X27': "'",
};

/** An attribute value as rendered markup escapes it, decoded back to the code it carries. */
export function decodeMarkupAttribute(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|#39|#x27|#X27);/gu,
    (_all, name: string) => MARKUP_ENTITIES[name] ?? '',
  );
}

/** The engines one region's code asks for, beyond the `codeUsesPixi` rule. */
export function codeEngines(
  code: string,
  into: Set<PageEngine> = new Set<PageEngine>(),
): Set<PageEngine> {
  if (codeUsesPixi(code)) into.add('pixi');
  const declared = declaredLibs(code);
  if (declared.pixi || declared.scene) into.add('pixi');
  for (const key of declared.libs) into.add(`lib-${key}`);
  if (declared.scene) into.add('lib-kit');
  if (declared.sound) into.add('sound');
  return into;
}

/** Every `data-ck-js` code string in rendered markup, decoded. */
function markupScripts(markup: string): string[] {
  const codes: string[] = [];
  for (const match of markup.matchAll(/\sdata-ck-js=(?:"([^"]*)"|'([^']*)')/gu)) {
    codes.push(decodeMarkupAttribute(match[1] ?? match[2] ?? ''));
  }
  return codes;
}

/** Every `data-ck-js` code string in a stored JSON value (a document, a tree), decoded. */
function jsonScripts(json: string): string[] {
  const codes: string[] = [];
  for (const match of json.matchAll(/"data-ck-js":"((?:[^"\\]|\\.)*)"/gu)) {
    try {
      codes.push(JSON.parse(`"${match[1] ?? ''}"`) as string);
    } catch {
      codes.push(match[1] ?? '');
    }
  }
  return codes;
}
// end pixi-studio:runtime-wiring additions

/**
 * Which lazily loaded engines a page uses (media-motion DESIGN §2.2): read from
 * rendered markup (an attribute name followed by `=`, whitespace, `>` or `/`),
 * a DOM node (itself or a descendant), or a stored JSON value (an attribute key).
 * `pixi` is not a marker but a use: some `data-ck-js` code that matches `codeUsesPixi`.
 */
export function pageEngines(markupOrNode: unknown): Set<PageEngine> {
  const used = new Set<PageEngine>();
  if (typeof markupOrNode === 'string') {
    if (behavior('carousel').test(markupOrNode)) used.add('carousel');
    for (const [kind, attribute] of ENGINE_ATTRIBUTES) {
      if (new RegExp(`\\s${attribute}(?=[\\s=>/])`, 'u').test(markupOrNode)) used.add(kind);
    }
    if (markupScriptsUsePixi(markupOrNode)) used.add('pixi');
    // pixi-studio:runtime-wiring additions (2026-10-10)
    for (const code of markupScripts(markupOrNode)) codeEngines(code, used);
    if (SOUND_MARKUP.test(markupOrNode)) used.add('sound');
    // end pixi-studio:runtime-wiring additions
    return used;
  }
  if (typeof markupOrNode !== 'object' || markupOrNode === null) return used;
  const node = markupOrNode as { querySelector?: unknown; nodeType?: unknown; matches?: unknown };
  if (typeof node.querySelector === 'function') {
    const parent = markupOrNode as ParentNode;
    const carouselSelector = '[data-ck-behavior="carousel"]';
    if (
      (node.nodeType === 1 &&
        typeof node.matches === 'function' &&
        (markupOrNode as Element).matches(carouselSelector)) ||
      parent.querySelector(carouselSelector) !== null
    )
      used.add('carousel');
    for (const [kind, attribute] of ENGINE_ATTRIBUTES) {
      const selector = `[${attribute}]`;
      const self =
        node.nodeType === 1 &&
        typeof node.matches === 'function' &&
        (markupOrNode as Element).matches(selector);
      if (self || parent.querySelector(selector) !== null) used.add(kind);
    }
    const scripted: Element[] = Array.from(parent.querySelectorAll(SCRIPT_SELECTOR));
    if (
      node.nodeType === 1 &&
      typeof node.matches === 'function' &&
      (markupOrNode as Element).matches(SCRIPT_SELECTOR)
    ) {
      scripted.push(markupOrNode as Element);
    }
    if (scripted.some((el) => codeUsesPixi(el.getAttribute('data-ck-js') ?? ''))) used.add('pixi');
    // pixi-studio:runtime-wiring additions (2026-10-10)
    for (const el of scripted) codeEngines(el.getAttribute('data-ck-js') ?? '', used);
    const soundSelector = `[${SOUND_ATTRIBUTE}]`;
    const soundSelf =
      node.nodeType === 1 &&
      typeof node.matches === 'function' &&
      (markupOrNode as Element).matches(soundSelector);
    if (soundSelf || parent.querySelector(soundSelector) !== null) used.add('sound');
    // end pixi-studio:runtime-wiring additions
    return used;
  }
  let json = '';
  try {
    json = JSON.stringify(markupOrNode);
  } catch {
    return used;
  }
  for (const [kind, attribute] of ENGINE_ATTRIBUTES)
    if (json.includes(`"${attribute}"`)) used.add(kind);
  if (json.includes('"data-ck-behavior":"carousel"')) used.add('carousel');
  for (const match of json.matchAll(/"data-ck-js":"((?:[^"\\]|\\.)*)"/gu)) {
    if (codeUsesPixi(match[1] ?? '')) used.add('pixi');
  }
  // pixi-studio:runtime-wiring additions (2026-10-10)
  for (const code of jsonScripts(json)) codeEngines(code, used);
  if (json.includes(`"${SOUND_ATTRIBUTE}"`)) used.add('sound');
  // end pixi-studio:runtime-wiring additions
  return used;
}
