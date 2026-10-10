import { z } from 'zod';

import { isLucideIconName } from './lucide-icon-names';
import {
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_DELAYS,
  CUSTOM_CODE_MOTION_DISTANCES,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_MOTION_ONCE,
  CUSTOM_CODE_MOTION_PARAMS,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_MOTION_STAGGERS,
  CUSTOM_CODE_MOTION_TRIGGERS,
  isMotionPreset,
  motionTriggerProblem,
} from './motion-vocabulary';
import { isTablerIconName } from './tabler-icon-names';
// media-motion (2026-10-06): the media behaviours, engine markers and their params.
import {
  CAROUSEL_INDICATORS,
  CUSTOM_CODE_ENGINE_MARKERS,
  CUSTOM_CODE_ENGINE_PARAMS,
  CUSTOM_CODE_ENGINE_PARAM_OWNERS,
  CUSTOM_CODE_MEDIA_ATTRIBUTES,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS,
  CUSTOM_CODE_MEDIA_BEHAVIORS,
  CUSTOM_CODE_MEDIA_PART_ATTRIBUTES,
  CUSTOM_CODE_SCENES,
  CUSTOM_CODE_TIMELINE_RECIPES,
  MEDIA_SWITCH_VALUES,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  TIMELINE_DEPTHS,
  TIMELINE_REUSED_MOTION_PARAMS,
  TOGGLE_OPTIONS,
  HOSTED_SCENES,
  isHostedScene,
  SCENE_HOST_TAGS,
} from './media-vocabulary';
// pixi-studio:sound-engine additions (2026-10-10)
import { soundAttributeProblem } from '../sound/attribute';
// end pixi-studio:sound-engine additions

/**
 * The custom-code tree: what the assistant writes when no registered
 * block says the shape it needs.
 *
 * ## Why a tree and not a string of HTML
 *
 * The obvious design is a `html: string` prop rendered with
 * `dangerouslySetInnerHTML` and a sanitizer in front of it. That trade was
 * refused for the same reason `RichText` refused it: a sanitizer is a
 * blacklist maintained against an adversary, and every one of them has had a
 * bypass. A tree cannot express a `<script>` because the vocabulary has no
 * such node — there is nothing to bypass. The stored form is plain JSON
 * (Law J), validated strictly on WRITE, and rendered tolerantly on READ.
 *
 * The model loses nothing it can use. It still chooses any tag in the
 * vocabulary, any Tailwind utility, any nesting — and, crucially, it can
 * reference REGISTERED components by name, which raw HTML could never do.
 *
 * ## Two node kinds, and why the second one is the point
 *
 * An `element` is markup the model authors outright. A `component` is a
 * reference to something already in the registry — a shadcn card, an
 * aceternity backdrop, a Radix-backed accordion. Without the second kind the
 * "free" mode would be a downgrade: unlimited divs and no access to the
 * vendored component library the product is built on. With it, the model
 * composes freely AND reaches every registered block, while the component's
 * own props schema still validates what it is handed.
 */

/**
 * The svg shape family: decoration drawn in place — a wave divider, a blob, a
 * mark — and nothing that can reach outside the drawing. Case-sensitive, as
 * SVG is: a reader that lower-cases markup respells `lineargradient` back
 * (`customCodeTagSpelling`).
 */
export const CUSTOM_CODE_SVG_TAGS = [
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  /*
    Admitted 2026-10-05 (style-manager DESIGN §D.1): drawn text, clipping,
    masks, patterns and the filter primitives a grain, a glow or a duotone is
    made of. Still closed over paint and geometry: no `use`, `image`,
    `foreignObject`, `script` or `animate*`, and no href that leaves the drawing.
  */
  'text',
  'tspan',
  'textPath',
  'clipPath',
  'mask',
  'pattern',
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feBlend',
  'feColorMatrix',
  'feTurbulence',
  'feDisplacementMap',
  'feMerge',
  'feMergeNode',
  'feFlood',
  'feComposite',
] as const;

/** The svg tags that hold TEXT (every other svg shape holds none). */
export const CUSTOM_CODE_SVG_TEXT_TAGS = ['text', 'tspan', 'textPath'] as const;

/** Form controls: inert on the canvas, sent only through the `whatsapp-form` behaviour. */
export const CUSTOM_CODE_FORM_TAGS = [
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'fieldset',
  'legend',
] as const;

/**
 * Tags the vocabulary admits: structure, text, media, lists, tables,
 * disclosure, links, buttons, forms, dialogs, allowlisted embeds, and the svg
 * shape family — no more.
 */
export const CUSTOM_CODE_TAGS = [
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'button',
  'caption',
  'cite',
  'code',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'picture',
  'pre',
  'q',
  's',
  'section',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'ul',
  'video',
  // Admitted 2026-10-05 (style-manager DESIGN §D.1), each with its guard below.
  ...CUSTOM_CODE_FORM_TAGS,
  'dialog',
  'iframe',
  'audio',
  'track',
  ...CUSTOM_CODE_SVG_TAGS,
] as const;

export type CustomCodeTag = (typeof CUSTOM_CODE_TAGS)[number];

/*
  Embedding and form tags are ABSENT on purpose, and each absence is a
  decision rather than an oversight:

    script, style, iframe, object, embed — code and frame injection.
    form, input, select, textarea — a control the document cannot wire to a
        handler is a control that lies to the reader; registered blocks own
        real interactivity, and a `component` reference reaches them.
    audio, canvas — sound nobody asked to hear, and a surface only script
        can draw on.
    svg use, image, foreignObject, script, a, text — the svg elements that
        reach outside the drawing (an href, a nested document, a handler).
        The shape family above is closed over paint and geometry only.

  Admitted 2026-09-28, each with a policy enforced here on write and again by
  the renderer on read (the owner: "let the agent write code when the design
  needs it, within the scope of design"). A FAQ could only be a list, a price
  comparison only cards, and a mobile nav only a scrolling row, because the
  markup had no disclosure, no table and no popover:

    details, summary — a FAQ or "more" that opens without script (`name`
        makes a group where one opens at a time).
    table and its parts — prices, hours, a comparison.
    dl/dt/dd, address, mark, cite, q, abbr, b, i, s — the phrasing and
        definition markup the section recipes already named and the
        normalizer was flattening into divs and spans.
    picture + source, video — media whose every address passes the same
        policy as `src`; a video that plays by itself is always muted.
    the svg shape family — see CUSTOM_CODE_SVG_TAGS.

  Two were absent in the first version and are present now, each with a policy
  the renderer enforces rather than a hope:

    a — `href` passes `safeHref` (https, mailto, tel, relative; never
        javascript:), an external link gets `rel="noopener noreferrer"`, and
        on the editing canvas a click is swallowed so the editor is not
        navigated away from. A CV page without a link to anything was the
        argument for admitting it.
    button — always `type="button"`, never a submit, never a handler. It is
        a styled affordance the assistant can place; a registered block or a
        host wires behaviour to it later.

  Admitted 2026-10-05 (style-manager DESIGN §D.1 — "build and edit anything",
  safely). Each absence above that is now lifted carries its guard:

    form and its controls — a form has no `action`, `method` or
        `formaction`; it sends only through the `whatsapp-form` behaviour (a
        button inside such a form may be `type="submit"`). Controls are inert
        on the editing canvas (tabindex -1, readOnly).
    dialog — opened by a `popovertarget` button, never by script.
    iframe — `src` must match one of four allowlisted embed hosts
        (CUSTOM_CODE_IFRAME_SOURCES), `title` is required, and the renderer
        forces the sandbox, lazy loading, the referrer policy and `allow`.
    audio, track — https or relative addresses only; audio never autoplays.

  Still refused, deliberately: script, style (element and attribute), on*
  handlers, object, embed, canvas, external @import and arbitrary data-*.
*/

/**
 * Paint and geometry: the only attributes an svg shape carries. Case-sensitive
 * like the tags (`viewBox`, `preserveAspectRatio`, `gradientUnits`).
 */
export const CUSTOM_CODE_SVG_ATTRIBUTES = [
  'viewBox',
  'xmlns',
  'preserveAspectRatio',
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'transform',
  'd',
  'points',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  // Admitted 2026-10-05 with the text, clip, mask, pattern and filter family.
  'clip-path',
  'mask',
  'filter',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'gradientTransform',
  'filterUnits',
  'primitiveUnits',
  'spreadMethod',
  'fx',
  'fy',
  'dx',
  'dy',
  'text-anchor',
  'dominant-baseline',
  'font-size',
  'font-weight',
  'font-family',
  'letter-spacing',
  'startOffset',
  'textLength',
  'lengthAdjust',
  'stdDeviation',
  'in',
  'in2',
  'result',
  'mode',
  'values',
  'baseFrequency',
  'numOctaves',
  'seed',
  'stitchTiles',
  'scale',
  'xChannelSelector',
  'yChannelSelector',
  'flood-color',
  'flood-opacity',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
] as const;

/**
 * Attributes an element may carry: presentation, accessibility, link
 * targets, media, disclosure, popovers, and svg paint and geometry. WHICH tag
 * may carry each one, and what its value may be, is `customCodeAttributeProblem`.
 */
export const CUSTOM_CODE_ATTRIBUTES = [
  'alt',
  'aria-hidden',
  'aria-label',
  'datetime',
  'href',
  'id',
  'role',
  'src',
  'target',
  'title',
  // Admitted 2026-09-28 (design code): accessibility and language.
  'aria-labelledby',
  'aria-describedby',
  'aria-current',
  'lang',
  'dir',
  // Declarative menus: a button opens a popover, no script.
  'popover',
  'popovertarget',
  'popovertargetaction',
  // Media: loading hints, intrinsic size (no layout shift), responsive sources.
  'loading',
  'decoding',
  'width',
  'height',
  'srcset',
  'sizes',
  'media',
  'type',
  'poster',
  'autoplay',
  'muted',
  'loop',
  'playsinline',
  'controls',
  'preload',
  // Disclosure and tables.
  'open',
  'name',
  'colspan',
  'rowspan',
  'scope',
  /*
    Site behaviours (2026-09-30): one closed enum names a curated, audited
    script the renderer and the exported page run (`mountBehaviors`); the
    params below tune it. No other `data-*` and never an `on*` handler — a
    tree still cannot carry code, only the NAME of a behaviour.
  */
  'data-ck-behavior',
  'data-ck-to',
  'data-ck-until',
  'data-ck-speed',
  'data-ck-phone',
  'data-ck-text',
  // Loading priority for the one image that paints first (LCP).
  'fetchpriority',
  // Admitted 2026-10-05 (style-manager DESIGN §D.1): form controls.
  'placeholder',
  'required',
  'autocomplete',
  'inputmode',
  'min',
  'max',
  'step',
  'minlength',
  'maxlength',
  'rows',
  'for',
  'value',
  'checked',
  'disabled',
  'multiple',
  // Media tracks.
  'kind',
  'srclang',
  // Accessibility.
  'tabindex',
  'aria-expanded',
  'aria-controls',
  'aria-haspopup',
  'aria-pressed',
  'aria-selected',
  'aria-live',
  'aria-modal',
  // Links: closed relationship tokens.
  'rel',
  // Motion (DESIGN §B.2): a preset NAME plus its params, never a timing literal.
  'data-ck-motion',
  'data-ck-hover',
  ...CUSTOM_CODE_MOTION_PARAMS,
  ...CUSTOM_CODE_SVG_ATTRIBUTES,
  // media-motion (2026-10-06): engine markers + media params (media-vocabulary.ts),
  // and `hidden`, which a toggle group's second option carries without script.
  ...CUSTOM_CODE_MEDIA_ATTRIBUTES,
  'hidden',
  // pixi-studio:sound-engine additions (2026-10-10): sound as DATA, `trigger:ref[@vol]` tokens
  // (sound/attribute.ts); muted by default, played only by ck-sound.js after a gesture.
  'data-ck-sound',
  // end pixi-studio:sound-engine additions
] as const;

/**
 * The site behaviours a tree may name with `data-ck-behavior` — a closed
 * enum. Each is a few lines of vanilla script in the renderer's
 * `mountBehaviors`, progressive enhancement over native HTML and CSS: the
 * content reads without it, and `prefers-reduced-motion` stills the motion.
 */
export const CUSTOM_CODE_BEHAVIORS = [
  'reveal',
  'stagger',
  'count-up',
  'countdown',
  'marquee',
  'carousel',
  'tabs',
  'sticky-header',
  'lightbox',
  'whatsapp-form',
  'copy-text',
  // Added 2026-10-05 (style-manager DESIGN §B.1): rolling digits, FLIP layout.
  'ticker',
  'layout',
  // media-motion (2026-10-06): gallery, video, embed facade and widgets (DESIGN §A, §B, §E).
  ...CUSTOM_CODE_MEDIA_BEHAVIORS,
] as const;

export type CustomCodeBehavior = (typeof CUSTOM_CODE_BEHAVIORS)[number];

/** The behaviour params: each means something only beside a `data-ck-behavior`. */
export const CUSTOM_CODE_BEHAVIOR_PARAMS = [
  'data-ck-to',
  'data-ck-until',
  'data-ck-speed',
  'data-ck-phone',
  'data-ck-text',
  // media-motion (2026-10-06): carousel indicator/autoplay, mailto address.
  ...CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
] as const;

export type CustomCodeAttribute = (typeof CUSTOM_CODE_ATTRIBUTES)[number];

export interface CustomCodeElement {
  kind: 'element';
  tag: CustomCodeTag;
  /** Utility classes; validated against the run's vocabulary by the AI door. */
  className?: string | undefined;
  /** Literal text content. Rendered as text, never parsed. */
  text?: string | undefined;
  /*
    `Record<…, string | undefined>` rather than `Partial<Record<…, string>>`:
    this workspace compiles with `exactOptionalPropertyTypes`, under which those
    two are different types and zod's inferred output is the former.
  */
  attributes?: Partial<Record<CustomCodeAttribute, string | undefined>> | undefined;
  children?: CustomCodeNode[] | undefined;
  /**
   * Editor metadata: the element's name in Layers (≤ 60 characters). Never
   * rendered — not to the canvas DOM, not to the published page.
   */
  label?: string | undefined;
  /**
   * Editor metadata: a locked element is not selectable on the canvas (a
   * click passes to its parent) and Layers shows a lock. Only `true` is
   * stored; unlocking removes the field. Never rendered.
   */
  locked?: true | undefined;
}

export interface CustomCodeComponent {
  kind: 'component';
  /** A registered block type. Resolved at render; unknown ⇒ UnknownBlock. */
  component: string;
  /** Handed to that block's own schema for validation before it renders. */
  props?: Record<string, unknown> | undefined;
  /** Rendered into the referenced block's default slot. */
  children?: CustomCodeNode[] | undefined;
  /** Editor metadata: the Layers name (≤ 60). Never rendered. */
  label?: string | undefined;
  /** Editor metadata: locked on the canvas. Never rendered. */
  locked?: true | undefined;
}

/**
 * An icon from the Lucide set, by its kebab-case name (`mail`, `arrow-right`,
 * `github`). A LEAF: it has no children and no text.
 *
 * Icons are a node kind rather than an `svg` tag in the element vocabulary
 * for one reason: an authored `<svg>` is a drawing surface, and a drawing
 * surface accepts `<script>`, `<foreignObject>`, `xlink:href` and everything
 * else the tree exists to make unrepresentable. A NAME is not a surface. The
 * renderer looks it up in a fixed set and draws the paths itself; an unknown
 * name draws a visible placeholder, and the AI door refuses it before that.
 */
export interface CustomCodeIcon {
  kind: 'icon';
  /**
   * Kebab-case Lucide name (`mail`), or a Tabler one prefixed with its style
   * (`tabler:brand-whatsapp`, `tabler-filled:heart`). Validated for shape here;
   * for existence by `isCustomCodeIconName` at the door.
   */
  name: string;
  className?: string | undefined;
  /** Rendered size in CSS pixels; 24 when absent, the set's native grid. */
  size?: number | undefined;
  /** Stroke width in the 24-unit grid; 2 when absent. */
  strokeWidth?: number | undefined;
  /**
   * Accessible name. Present ⇒ `role="img"` with this label; absent ⇒ the
   * icon is decorative and hidden from assistive technology. There is no
   * third state: an unlabelled icon that is not hidden is announced as
   * "image", which is worse than either.
   *
   * (Unlike an element's `label`, an icon's is its ACCESSIBLE name; Layers
   * shows it too.)
   */
  label?: string | undefined;
  /** Editor metadata: locked on the canvas. Never rendered. */
  locked?: true | undefined;
}

export type CustomCodeNode = CustomCodeElement | CustomCodeComponent | CustomCodeIcon;

/*
  ── Where each attribute may sit, and what it may say ──────────────────────

  One policy, three readers: the tree schema refuses on WRITE, the plan
  normalizer drops what could never render before the door sees it (a refusal
  is a 25-40 s repair round, measured 2026-09-27), and the renderer drops it
  again on READ. So it lives here, beside the vocabulary, as data plus one
  function — never re-stated in the readers.
*/

const SVG_TAG_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_SVG_TAGS);

/** Whether a tag is in the svg shape family (the renderer draws it in the SVG namespace). */
export function isCustomCodeSvgTag(tag: string): boolean {
  return SVG_TAG_SET.has(tag);
}

/**
 * The one address policy every URL attribute passes (`src`, `poster`, each
 * `srcset` candidate): a relative path, an https URL, or an inline data
 * image. `javascript:` never renders, and neither does a scheme this list
 * has not considered. The renderer applies the same function on read.
 */
export function safeCustomCodeUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return trimmed;
  if (/^https:\/\//iu.test(trimmed)) return trimmed;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/iu.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/*
  The characters an embed address may carry after its fixed prefix: no
  whitespace, quote, angle bracket, backslash or backtick — nothing that could
  end the attribute or start markup. Google Maps embeds use `!` and `%`.
*/
const EMBED_REST = String.raw`[^\s"'<>\\` + '`' + String.raw`]*`;

/**
 * The only addresses an `<iframe>` may show (DESIGN §D.1): four embed
 * players, each pinned to its https origin and path. Anything else is a
 * frame the page never vetted, so it never renders.
 */
export const CUSTOM_CODE_IFRAME_SOURCES = [
  {
    host: 'YouTube (privacy-enhanced)',
    example: 'https://www.youtube-nocookie.com/embed/VIDEO_ID',
    pattern: new RegExp(
      `^https://www\\.youtube-nocookie\\.com/embed/[\\w-]+(?:[?]${EMBED_REST})?$`,
      'u',
    ),
  },
  {
    host: 'Vimeo',
    example: 'https://player.vimeo.com/video/123456789',
    pattern: new RegExp(`^https://player\\.vimeo\\.com/video/\\d+(?:[?]${EMBED_REST})?$`, 'u'),
  },
  {
    host: 'Google Maps',
    example: 'https://www.google.com/maps/embed?pb=…',
    pattern: new RegExp(`^https://www\\.google\\.com/maps/embed[?]${EMBED_REST}$`, 'u'),
  },
  {
    host: 'Spotify',
    example: 'https://open.spotify.com/embed/track/TRACK_ID',
    pattern: new RegExp(
      `^https://open\\.spotify\\.com/embed/(?:track|album|playlist|episode|show|artist)/\\w+(?:[?]${EMBED_REST})?$`,
      'u',
    ),
  },
  /*
    media-motion (2026-10-06, DESIGN §E): the keyless Maps embed the map facade
    swaps in on click. One query and the embed flag, nothing else: `&` cannot
    appear inside the query, so no further parameter rides along.
  */
  {
    host: 'Google Maps (keyless)',
    example: 'https://www.google.com/maps?q=Amman%20Citadel&output=embed',
    pattern: /^https:\/\/www\.google\.com\/maps[?]q=[^\s"'<>&]+&output=embed$/u,
  },
] as const;

/** Whether an address is one an `<iframe>` may show. */
export function isAllowedIframeSrc(value: string): boolean {
  return CUSTOM_CODE_IFRAME_SOURCES.some(({ pattern }) => pattern.test(value));
}

/**
 * The sandbox, permissions and referrer policy the renderer FORCES on every
 * iframe, whatever the stored tree says (none of them is an attribute the
 * vocabulary admits, so a tree cannot weaken them).
 */
export const CUSTOM_CODE_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups';
export const CUSTOM_CODE_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
export const CUSTOM_CODE_IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * The address candidates of a `srcset`, or undefined when it cannot be read.
 * The HTML rule, simplified: an address is a run without whitespace (a data
 * URL keeps its inner comma), a trailing comma ends a candidate, and a
 * descriptor is one `640w` or `2x`.
 */
export function customCodeSrcsetUrls(value: string): readonly string[] | undefined {
  const urls: string[] = [];
  let rest = value;
  for (;;) {
    rest = rest.replace(/^[\s,]+/u, '');
    if (rest === '') break;
    const run = /^\S+/u.exec(rest)?.[0] ?? '';
    rest = rest.slice(run.length);
    const url = run.replace(/,+$/u, '');
    urls.push(url);
    if (url !== run) continue;
    const descriptor = /^\s*([^,]*)(?:,|$)/u.exec(rest);
    const written = descriptor?.[1]?.trim() ?? '';
    if (written !== '' && !/^(?:\d+w|\d+(?:\.\d+)?x)$/u.test(written)) return undefined;
    rest = rest.slice(descriptor?.[0].length ?? rest.length);
  }
  return urls.length === 0 ? undefined : urls;
}

type AttributePlace = 'html' | 'svg' | 'any' | readonly string[];

interface AttributeRule {
  /** `html`: any tag outside the svg family; `svg`: only inside it; or these tags. */
  readonly on: AttributePlace;
  /** What is wrong with the value, or undefined when it is fine. */
  readonly value?: (value: string, name: string, tag: string) => string | undefined;
}

const oneOf =
  (...allowed: readonly string[]) =>
  (value: string, name: string): string | undefined =>
    allowed.includes(value)
      ? undefined
      : `${name} is one of ${allowed.map((option) => (option === '' ? '(bare)' : option)).join(', ')}`;

const matching =
  (pattern: RegExp, expected: string) =>
  (value: string, name: string): string | undefined =>
    pattern.test(value) ? undefined : `${name} must be ${expected}`;

/** A boolean attribute is written bare: `muted`, or `muted='muted'`, or `muted='true'`. */
const bare = (value: string, name: string): string | undefined =>
  value === '' || value.toLowerCase() === name || value.toLowerCase() === 'true'
    ? undefined
    : `${name} is written bare (${name}), never ${name}='${value}'`;

const safeAddress = (value: string, name: string): string | undefined =>
  safeCustomCodeUrl(value) === undefined
    ? `${name} must be an https or relative address`
    : undefined;

const safeSrcset = (value: string, name: string): string | undefined => {
  const urls = customCodeSrcsetUrls(value);
  if (urls === undefined) return `${name} must be "address 640w, address 1280w"`;
  return urls.every((url) => safeCustomCodeUrl(url) !== undefined)
    ? undefined
    : `every ${name} address must be https or relative`;
};

const NUMBER = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e-?\\d+)?';
const LENGTH = new RegExp(`^${NUMBER}(?:%|px|em|rem)?$`, 'u');
const ID_TOKENS = /^[^\s'"<>]+(?:\s+[^\s'"<>]+)*$/u;
/*
  Every svg value is inert text — geometry, a colour, a transform — so the
  guard is a character set that cannot open a string, a tag or a rule, and no
  `url()` except a same-drawing gradient: `fill='url(#ck-hero-fade)'`. An
  external paint server would be a fetch the page never showed.
*/
const SVG_TEXT = /^[^<>"'`;{}\\]*$/u;
const LOCAL_PAINT = /^url\(\s*#[A-Za-z][\w-]*\s*\)(?:\s+[^\s()]+)?$/u;

const svgValue = (value: string, name: string): string | undefined => {
  if (!SVG_TEXT.test(value) || /javascript:|expression\s*\(/iu.test(value)) {
    return `${name} holds geometry or a colour only`;
  }
  if (/url\s*\(/iu.test(value) && !LOCAL_PAINT.test(value.trim())) {
    return `${name} may reference only a gradient in the same svg: url(#id)`;
  }
  return undefined;
};

const svgLength = matching(LENGTH, 'a number or a length');

/** An ISO 8601 date-time: a date, a time to the minute or finer, and an optional zone. */
const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/u;

const BEHAVIOR_SET: ReadonlySet<string> = new Set<string>(CUSTOM_CODE_BEHAVIORS);

/** Whether a value names a behaviour in the closed enum. */
export function isCustomCodeBehavior(value: string): value is CustomCodeBehavior {
  return BEHAVIOR_SET.has(value);
}

const behaviorValue = (value: string, name: string): string | undefined =>
  BEHAVIOR_SET.has(value) ? undefined : `${name} is one of ${CUSTOM_CODE_BEHAVIORS.join(', ')}`;

/** Behaviours bound to a tag: the WhatsApp form sends from a form or its button. */
const BEHAVIOR_TAGS: Readonly<Partial<Record<CustomCodeBehavior, readonly string[]>>> = {
  'whatsapp-form': ['form', 'button'],
  // media-motion (2026-10-06): the video player, facade and mailto form are tag-bound too.
  ...CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS,
};

/** An id another attribute points at (`for`, `data-ck-target`). */
const ID_TOKEN = /^[^\s'"<>]{1,120}$/u;
const NUMBER_PATTERN = new RegExp(`^${NUMBER}$`, 'u');
const plainText =
  (max: number) =>
  (value: string, name: string): string | undefined =>
    value.length > max
      ? `${name} holds at most ${String(max)} characters`
      : /[<>]/u.test(value)
        ? `${name} is plain text, without < or >`
        : undefined;

/** The input types a form may carry. No password, file, submit, image or reset. */
export const CUSTOM_CODE_INPUT_TYPES = [
  'text',
  'email',
  'tel',
  'number',
  'url',
  'search',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'checkbox',
  'radio',
  'range',
  'color',
  'hidden',
] as const;

/** The autocomplete tokens a control may name: contact and address facts only. */
export const CUSTOM_CODE_AUTOCOMPLETE_TOKENS = [
  'on',
  'off',
  'name',
  'honorific-prefix',
  'given-name',
  'additional-name',
  'family-name',
  'nickname',
  'email',
  'organization',
  'organization-title',
  'street-address',
  'address-line1',
  'address-line2',
  'address-level1',
  'address-level2',
  'country',
  'country-name',
  'postal-code',
  'tel',
  'tel-national',
  'bday',
  'sex',
  'url',
  'language',
] as const;

/** The link relationships `rel` may name (space-separated). */
export const CUSTOM_CODE_REL_TOKENS = [
  'noopener',
  'noreferrer',
  'nofollow',
  'ugc',
  'sponsored',
  'me',
] as const;

const relValue = (value: string, name: string): string | undefined => {
  const tokens = value.trim().split(/\s+/u);
  return value.trim() !== '' &&
    tokens.every((token) => (CUSTOM_CODE_REL_TOKENS as readonly string[]).includes(token))
    ? undefined
    : `${name} is one or more of ${CUSTOM_CODE_REL_TOKENS.join(', ')}`;
};

/** `type` means a different thing on each tag that carries it. */
const typeValue = (value: string, name: string, tag: string): string | undefined => {
  if (tag === 'source') {
    return matching(
      /^[a-z]+\/[\w.+-]+(?:\s*;\s*codecs=["']?[\w., +-]+["']?)?$/u,
      'a media type such as video/mp4',
    )(value, name);
  }
  if (tag === 'input') return oneOf(...CUSTOM_CODE_INPUT_TYPES)(value, name);
  if (tag === 'button') return oneOf('button', 'submit')(value, name);
  if (tag === 'feColorMatrix') {
    return oneOf('matrix', 'saturate', 'hueRotate', 'luminanceToAlpha')(value, name);
  }
  return oneOf('fractalNoise', 'turbulence')(value, name);
};

const motionPresetValue = oneOf(...CUSTOM_CODE_MOTION_PRESETS);
const hoverPresetValue = oneOf(...CUSTOM_CODE_HOVER_PRESETS);

// media-motion (2026-10-06): the two media params that are patterns, not names.
/** A Lottie animation: an https address whose path ends in `.json`, nothing that ends the attribute. */
const LOTTIE_SRC = /^https:\/\/[^\s"'<>\\`?#]+\.json$/iu;
/** The address a mailto form sends to: one plain mailbox, no list, no header injection. */
const MAILTO_EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/u;

const HTML_TAG_RULES: Readonly<Record<string, AttributeRule>> = {
  alt: { on: 'html' },
  'aria-hidden': { on: 'any' },
  'aria-label': { on: 'any' },
  'aria-labelledby': { on: 'any', value: matching(ID_TOKENS, 'ids separated by spaces') },
  'aria-describedby': { on: 'any', value: matching(ID_TOKENS, 'ids separated by spaces') },
  'aria-current': {
    on: 'html',
    value: oneOf('page', 'step', 'location', 'date', 'time', 'true', 'false'),
  },
  datetime: { on: 'html' },
  href: { on: 'html' },
  id: { on: 'any' },
  role: { on: 'any' },
  src: {
    on: 'html',
    // An img keeps its read-time policy (the renderer drops what fails); a new media tag is checked on write.
  },
  target: { on: 'html' },
  title: { on: 'html' },
  lang: {
    on: 'html',
    value: matching(/^(?:[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*)?$/u, 'a language tag'),
  },
  dir: { on: 'html', value: oneOf('ltr', 'rtl', 'auto') },
  popover: { on: 'html', value: oneOf('', 'auto', 'manual') },
  popovertarget: { on: ['button'], value: matching(/^[^\s'"<>]{1,120}$/u, "the popover's id") },
  popovertargetaction: { on: ['button'], value: oneOf('toggle', 'show', 'hide') },
  loading: { on: ['img', 'iframe'], value: oneOf('lazy', 'eager') },
  decoding: { on: ['img'], value: oneOf('async', 'sync', 'auto') },
  srcset: { on: ['img', 'source'], value: safeSrcset },
  sizes: {
    on: ['img', 'source'],
    value: matching(
      /^[\w\s().,:%+*/-]{1,500}$/u,
      'a sizes list such as (min-width:768px) 50vw, 100vw',
    ),
  },
  media: {
    on: ['source'],
    value: matching(/^[\w\s().,:%/-]{1,500}$/u, 'a media query such as (min-width:768px)'),
  },
  type: {
    on: ['source', 'input', 'button', 'feColorMatrix', 'feTurbulence'],
    value: typeValue,
  },
  poster: { on: ['video'], value: safeAddress },
  // Sound nobody asked to hear: audio never plays by itself.
  autoplay: { on: ['video'], value: bare },
  muted: { on: ['video', 'audio'], value: bare },
  loop: { on: ['video', 'audio'], value: bare },
  playsinline: { on: ['video'], value: bare },
  controls: { on: ['video', 'audio'], value: bare },
  preload: { on: ['video', 'audio'], value: oneOf('none', 'metadata', 'auto') },
  open: { on: ['details', 'dialog'], value: bare },
  name: {
    on: ['details', 'form', 'input', 'textarea', 'select', 'fieldset', 'button'],
    value: matching(/^[\w-]{1,64}$/u, 'a name of letters, digits and -'),
  },
  // Form controls (2026-10-05).
  placeholder: { on: ['input', 'textarea'], value: plainText(200) },
  required: { on: ['input', 'textarea', 'select'], value: bare },
  autocomplete: {
    on: ['form', 'input', 'textarea', 'select'],
    value: oneOf(...CUSTOM_CODE_AUTOCOMPLETE_TOKENS),
  },
  inputmode: {
    on: ['input', 'textarea'],
    value: oneOf('none', 'text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url'),
  },
  min: { on: ['input'], value: matching(/^-?[\d.:T-]{1,32}$/u, 'a number, a date or a time') },
  max: { on: ['input'], value: matching(/^-?[\d.:T-]{1,32}$/u, 'a number, a date or a time') },
  step: {
    on: ['input'],
    value: (value, name) =>
      value === 'any' || (NUMBER_PATTERN.test(value) && Number(value) > 0)
        ? undefined
        : `${name} is a positive number or any`,
  },
  minlength: { on: ['input', 'textarea'], value: matching(/^\d{1,6}$/u, 'a whole number') },
  maxlength: { on: ['input', 'textarea'], value: matching(/^\d{1,6}$/u, 'a whole number') },
  rows: { on: ['textarea'], value: matching(/^[1-9]\d?$/u, 'a whole number from 1 to 99') },
  for: { on: ['label'], value: matching(ID_TOKEN, "the control's id") },
  value: { on: ['input', 'option', 'button'], value: plainText(500) },
  checked: { on: ['input'], value: bare },
  disabled: { on: ['input', 'textarea', 'select', 'option', 'fieldset', 'button'], value: bare },
  multiple: { on: ['select', 'input'], value: bare },
  // Media tracks.
  kind: {
    on: ['track'],
    value: oneOf('subtitles', 'captions', 'descriptions', 'chapters', 'metadata'),
  },
  srclang: {
    on: ['track'],
    value: matching(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u, 'a language tag'),
  },
  // Accessibility.
  tabindex: { on: 'html', value: oneOf('0', '-1') },
  'aria-expanded': { on: 'html', value: oneOf('true', 'false') },
  'aria-controls': { on: 'html', value: matching(ID_TOKENS, 'ids separated by spaces') },
  'aria-haspopup': {
    on: 'html',
    value: oneOf('true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'),
  },
  'aria-pressed': { on: 'html', value: oneOf('true', 'false', 'mixed') },
  'aria-selected': { on: 'html', value: oneOf('true', 'false') },
  'aria-live': { on: 'html', value: oneOf('off', 'polite', 'assertive') },
  'aria-modal': { on: 'html', value: oneOf('true', 'false') },
  rel: { on: ['a'], value: relValue },
  // Motion (DESIGN §B.2): closed enums, checked again in pairs by elementProblems.
  'data-ck-motion': { on: 'html', value: motionPresetValue },
  'data-ck-hover': { on: 'html', value: hoverPresetValue },
  'data-ck-trigger': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_TRIGGERS) },
  'data-ck-delay': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_DELAYS) },
  'data-ck-ease': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_EASES) },
  'data-ck-once': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_ONCE) },
  'data-ck-distance': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_DISTANCES) },
  'data-ck-stagger': { on: 'html', value: oneOf(...CUSTOM_CODE_MOTION_STAGGERS) },
  'data-ck-target': {
    on: 'html',
    value: matching(/^[A-Za-z][\w-]{0,63}$/u, 'the id of an element in this region'),
  },
  colspan: { on: ['td', 'th'], value: matching(/^[1-9]\d{0,2}$/u, 'a whole number from 1') },
  rowspan: { on: ['td', 'th'], value: matching(/^\d{1,3}$/u, 'a whole number') },
  scope: { on: ['th'], value: oneOf('row', 'col', 'rowgroup', 'colgroup') },
  'data-ck-behavior': { on: 'html', value: behaviorValue },
  'data-ck-to': {
    on: 'html',
    value: (value, name) =>
      value.length <= 12 && value.trim() === value && value !== '' && Number.isFinite(Number(value))
        ? undefined
        : `${name} is a number of at most 12 characters, such as 1500 or 4.8`,
  },
  'data-ck-until': {
    on: 'html',
    value: (value, name) =>
      ISO_DATETIME.test(value) && !Number.isNaN(Date.parse(value))
        ? undefined
        : `${name} is an ISO 8601 date and time, such as 2026-12-31T23:59:00+03:00`,
  },
  'data-ck-speed': { on: 'html', value: oneOf('slow', 'normal', 'fast') },
  'data-ck-phone': {
    on: 'html',
    value: matching(/^\+?[0-9]{7,15}$/u, 'a phone number of 7 to 15 digits, such as +962790000000'),
  },
  'data-ck-text': {
    on: 'html',
    value: (value, name) =>
      value.length <= 200 ? undefined : `${name} holds at most 200 characters`,
  },
  fetchpriority: { on: ['img'], value: oneOf('high', 'low', 'auto') },
  // media-motion (2026-10-06): engine markers and media params (DESIGN §C.2, §D.2, §E).
  'data-ck-timeline': { on: 'html', value: oneOf(...CUSTOM_CODE_TIMELINE_RECIPES) },
  // gsap-pixi additions (2026-10-08): a hosted scene (particles, mesh-gradient) may sit on a sectioning element.
  'data-ck-scene': { on: ['div', ...SCENE_HOST_TAGS], value: oneOf(...CUSTOM_CODE_SCENES) },
  'data-ck-lottie': { on: ['div'], value: oneOf('') },
  'data-ck-src': {
    on: ['div'],
    value: (value, name) =>
      value.length <= 2_048 && LOTTIE_SRC.test(value)
        ? undefined
        : `${name} is an https address of a .json animation (at most 2048 characters), such as https://assets.example.com/hero.json`,
  },
  'data-ck-email': {
    on: ['form'],
    value: matching(MAILTO_EMAIL, 'an email address such as hello@example.com'),
  },
  'data-ck-option': { on: 'html', value: oneOf(...TOGGLE_OPTIONS) },
  'data-ck-indicator': { on: 'html', value: oneOf(...CAROUSEL_INDICATORS) },
  'data-ck-autoplay': { on: 'html', value: oneOf(...MEDIA_SWITCH_VALUES) },
  'data-ck-scrub': { on: 'html', value: oneOf(...MEDIA_SWITCH_VALUES) },
  'data-ck-depth': { on: 'html', value: oneOf(...TIMELINE_DEPTHS) },
  'data-ck-density': { on: ['div', ...SCENE_HOST_TAGS], value: oneOf(...SCENE_DENSITIES) }, // gsap-pixi additions (2026-10-08)
  'data-ck-palette': { on: ['div', ...SCENE_HOST_TAGS], value: oneOf(...SCENE_PALETTES) }, // gsap-pixi additions (2026-10-08)
  hidden: { on: 'html', value: bare },
  // pixi-studio:sound-engine additions (2026-10-10)
  'data-ck-sound': { on: 'html', value: (value) => soundAttributeProblem(value) },
  // end pixi-studio:sound-engine additions
};

const SVG_ATTRIBUTE_RULES: Readonly<Record<string, AttributeRule>> = {
  viewBox: {
    on: ['svg'],
    value: matching(new RegExp(`^\\s*${NUMBER}(?:[\\s,]+${NUMBER}){3}\\s*$`, 'u'), 'four numbers'),
  },
  xmlns: { on: ['svg'], value: oneOf('http://www.w3.org/2000/svg') },
  preserveAspectRatio: {
    on: ['svg'],
    value: matching(
      /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(?:meet|slice))?$/u,
      'none or xMidYMid meet/slice',
    ),
  },
  fill: { on: 'svg', value: svgValue },
  stroke: { on: 'svg', value: svgValue },
  'stop-color': { on: 'svg', value: svgValue },
  'fill-rule': { on: 'svg', value: oneOf('nonzero', 'evenodd') },
  'clip-rule': { on: 'svg', value: oneOf('nonzero', 'evenodd') },
  'stroke-width': { on: 'svg', value: svgLength },
  'stroke-linecap': { on: 'svg', value: oneOf('butt', 'round', 'square') },
  'stroke-linejoin': { on: 'svg', value: oneOf('miter', 'round', 'bevel', 'arcs', 'miter-clip') },
  opacity: { on: 'svg', value: svgLength },
  'stop-opacity': { on: 'svg', value: svgLength },
  offset: { on: 'svg', value: svgLength },
  transform: { on: 'svg', value: matching(/^[\w(),.\s+-]*$/u, 'a transform list') },
  d: { on: 'svg', value: matching(/^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]*$/u, 'path data') },
  points: { on: 'svg', value: matching(/^[\d\s.,eE+-]*$/u, 'a list of numbers') },
  gradientUnits: { on: 'svg', value: oneOf('userSpaceOnUse', 'objectBoundingBox') },
  ...Object.fromEntries(
    [
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'x',
      'y',
      'x1',
      'y1',
      'x2',
      'y2',
      // 2026-10-05: text, gradient focus and filter geometry.
      'fx',
      'fy',
      'dx',
      'dy',
      'startOffset',
      'textLength',
      'font-size',
      'letter-spacing',
      'flood-opacity',
      'seed',
      'scale',
      'k1',
      'k2',
      'k3',
      'k4',
    ].map((name) => [name, { on: 'svg', value: svgLength } satisfies AttributeRule]),
  ),
  ...Object.fromEntries(
    [
      'clipPathUnits',
      'maskUnits',
      'maskContentUnits',
      'patternUnits',
      'patternContentUnits',
      'filterUnits',
      'primitiveUnits',
    ].map((name) => [
      name,
      { on: 'svg', value: oneOf('userSpaceOnUse', 'objectBoundingBox') } satisfies AttributeRule,
    ]),
  ),
  // A clip, mask or filter is referenced inside the same drawing only: url(#id).
  'clip-path': { on: 'svg', value: svgValue },
  mask: { on: 'svg', value: svgValue },
  filter: { on: 'svg', value: svgValue },
  'flood-color': { on: 'svg', value: svgValue },
  'font-family': {
    on: 'svg',
    value: (value, name) =>
      value.length > 120 ? `${name} is at most 120 characters` : svgValue(value, name),
  },
  patternTransform: { on: 'svg', value: matching(/^[\w(),.\s+-]*$/u, 'a transform list') },
  gradientTransform: { on: 'svg', value: matching(/^[\w(),.\s+-]*$/u, 'a transform list') },
  spreadMethod: { on: 'svg', value: oneOf('pad', 'reflect', 'repeat') },
  'text-anchor': { on: 'svg', value: oneOf('start', 'middle', 'end') },
  'dominant-baseline': {
    on: 'svg',
    value: oneOf(
      'auto',
      'middle',
      'central',
      'hanging',
      'alphabetic',
      'ideographic',
      'mathematical',
      'text-top',
      'text-bottom',
    ),
  },
  'font-weight': {
    on: 'svg',
    value: oneOf(
      'normal',
      'bold',
      'bolder',
      'lighter',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
    ),
  },
  lengthAdjust: { on: 'svg', value: oneOf('spacing', 'spacingAndGlyphs') },
  stdDeviation: {
    on: 'svg',
    value: matching(new RegExp(`^${NUMBER}(?:[\\s,]+${NUMBER})?$`, 'u'), 'one or two numbers'),
  },
  baseFrequency: {
    on: 'svg',
    value: matching(new RegExp(`^${NUMBER}(?:[\\s,]+${NUMBER})?$`, 'u'), 'one or two numbers'),
  },
  numOctaves: { on: 'svg', value: matching(/^\d{1,2}$/u, 'a whole number') },
  in: {
    on: 'svg',
    value: matching(/^[A-Za-z][\w-]{0,31}$/u, 'SourceGraphic, SourceAlpha or a result name'),
  },
  in2: {
    on: 'svg',
    value: matching(/^[A-Za-z][\w-]{0,31}$/u, 'SourceGraphic, SourceAlpha or a result name'),
  },
  result: { on: 'svg', value: matching(/^[A-Za-z][\w-]{0,31}$/u, 'a result name') },
  mode: {
    on: 'svg',
    value: oneOf(
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'color-dodge',
      'color-burn',
      'hard-light',
      'soft-light',
      'difference',
      'exclusion',
      'hue',
      'saturation',
      'color',
      'luminosity',
    ),
  },
  values: { on: 'svg', value: matching(/^[\d\s.,eE+-]*$/u, 'a list of numbers') },
  stitchTiles: { on: 'svg', value: oneOf('stitch', 'noStitch') },
  xChannelSelector: { on: 'svg', value: oneOf('R', 'G', 'B', 'A') },
  yChannelSelector: { on: 'svg', value: oneOf('R', 'G', 'B', 'A') },
  operator: {
    on: 'svg',
    value: oneOf('over', 'in', 'out', 'atop', 'xor', 'lighter', 'arithmetic'),
  },
};

/** Tags an html `width`/`height` sizes: its intrinsic box, so the layout does not shift. */
const HTML_SIZED = new Set(['img', 'video', 'source', 'iframe']);

/** Tags whose `src` is checked on WRITE as an https or relative address. */
const MEDIA_SRC_TAGS = new Set(['video', 'source', 'audio', 'track']);

/** Form attributes a tree never carries: a form sends only through its behaviour. */
const FORM_SUBMISSION_ATTRIBUTES = new Set(['action', 'method', 'formaction', 'enctype', 'target']);

const ATTRIBUTE_RULES: Readonly<Record<string, AttributeRule>> = {
  ...HTML_TAG_RULES,
  ...SVG_ATTRIBUTE_RULES,
};

function placeName(on: AttributePlace): string {
  if (on === 'html') return 'an html element';
  if (on === 'svg') return 'an svg shape';
  if (on === 'any') return 'any element';
  return on.map((tag) => `<${tag}>`).join(' or ');
}

function fits(on: AttributePlace, tag: string): boolean {
  if (on === 'any') return true;
  if (on === 'html') return !SVG_TAG_SET.has(tag);
  if (on === 'svg') return SVG_TAG_SET.has(tag);
  return on.includes(tag);
}

/**
 * What is wrong with `name='value'` on `<tag>`, or undefined when it may
 * stand. The sentence names the tag and the fix, because the door's refusal
 * is the repair round's only instruction.
 */
export function customCodeAttributeProblem(
  tag: string,
  name: string,
  value: string,
): string | undefined {
  if (name === 'width' || name === 'height') {
    if (SVG_TAG_SET.has(tag)) return svgLength(value, name);
    if (!HTML_SIZED.has(tag)) {
      return `${name} belongs on <img>, <video>, <source>, <iframe> or an svg shape, not <${tag}>`;
    }
    return /^\d{1,5}$/u.test(value) ? undefined : `${name} on <${tag}> is a whole number of pixels`;
  }
  if (tag === 'form' && FORM_SUBMISSION_ATTRIBUTES.has(name)) {
    return `<form> never carries ${name}: a form sends only through data-ck-behavior='whatsapp-form' with data-ck-phone`;
  }
  if (name === 'formaction' || name === 'formmethod') {
    return `${name} is not an attribute the vocabulary admits: a form sends only through data-ck-behavior='whatsapp-form'`;
  }
  const rule = Object.hasOwn(ATTRIBUTE_RULES, name) ? ATTRIBUTE_RULES[name] : undefined;
  if (rule === undefined) {
    if (/^on/iu.test(name)) {
      return `${name} is not an attribute the vocabulary admits: a tree never carries a script handler; name a behaviour with data-ck-behavior (${CUSTOM_CODE_BEHAVIORS.join(', ')}) or an animation with data-ck-motion / data-ck-hover`;
    }
    if (/^data-/iu.test(name)) {
      // media-motion (2026-10-06): the list names the engine markers and media params too.
      return `${name} is not an attribute the vocabulary admits: the only data attributes are data-ck-behavior and its params (${CUSTOM_CODE_BEHAVIOR_PARAMS.join(', ')}), data-ck-motion / data-ck-hover with their params (${CUSTOM_CODE_MOTION_PARAMS.join(', ')}, data-ck-speed), the engine markers ${CUSTOM_CODE_ENGINE_MARKERS.join(', ')} with their params (${CUSTOM_CODE_ENGINE_PARAMS.join(', ')}), and the part markers ${CUSTOM_CODE_MEDIA_PART_ATTRIBUTES.join(', ')}`;
    }
    if (name === 'style') {
      return 'style is not an attribute the vocabulary admits: write utility classes in className';
    }
    return `${name} is not an attribute the vocabulary admits`;
  }
  // A text path follows a path in the same drawing, and nothing outside it.
  if (name === 'href' && tag === 'textPath') {
    return /^#[A-Za-z][\w-]{0,63}$/u.test(value)
      ? undefined
      : "<textPath> href points at a path in the same svg: href='#id'";
  }
  if (name === 'src' && tag === 'iframe') {
    return isAllowedIframeSrc(value.trim())
      ? undefined
      : `<iframe> src must be an embed from ${CUSTOM_CODE_IFRAME_SOURCES.map((source) => `${source.host} (${source.example})`).join(', ')}`;
  }
  if (name === 'data-ck-behavior') {
    const bound = isCustomCodeBehavior(value) ? BEHAVIOR_TAGS[value] : undefined;
    if (bound !== undefined && !bound.includes(tag)) {
      return `data-ck-behavior='${value}' belongs on ${placeName(bound)}, not <${tag}>`;
    }
  }
  if (!fits(rule.on, tag)) return `${name} belongs on ${placeName(rule.on)}, not <${tag}>`;
  if (name === 'src' && MEDIA_SRC_TAGS.has(tag)) return safeAddress(value, name);
  const problem = rule.value?.(value, name, tag);
  return problem === undefined ? undefined : `<${tag}> ${problem}`;
}

/** The parents a `source` means something in; anywhere else it is inert. */
const SOURCE_PARENTS = new Set(['picture', 'video', 'audio']);

/** The parents a `track` means something in. */
const TRACK_PARENTS = new Set(['video', 'audio']);

const SVG_TEXT_TAG_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_SVG_TEXT_TAGS);

interface Problem {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** Where an element stands: its parent's tag, and whether a form encloses it. */
interface Place {
  readonly parentTag: string | undefined;
  readonly inForm: boolean;
  /** The nearest enclosing element whose content model is phrasing only, if any. */
  readonly phrasingParent?: string | undefined;
  /** The nearest enclosing link or button (interactive content nests in neither). */
  readonly interactiveParent?: string | undefined;
}

/**
 * Void tags: the HTML parser gives them no content, so they hold no text and
 * no children (2026-10-05: a stored `<track>` held the text "a").
 */
export const CUSTOM_CODE_VOID_TAGS = ['br', 'hr', 'img', 'input', 'source', 'track'] as const;
const VOID_TAG_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_VOID_TAGS);

/** Tags whose content is raw text: words, never child elements. */
const TEXT_ONLY_TAG_SET: ReadonlySet<string> = new Set(['textarea', 'option']);

/**
 * Tags whose content model is phrasing only: a heading, a paragraph or a block
 * dropped inside one breaks the page (the parser closes a <p> before an <h2>,
 * and React reports a hydration error).
 */
const PHRASING_ONLY_TAGS: ReadonlySet<string> = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'button',
  'label',
  'legend',
  'b',
  'i',
  'em',
  'strong',
  'small',
  'mark',
  'cite',
  'q',
  'abbr',
  's',
  'sub',
  'sup',
  'code',
  'time',
  'pre',
]);

/** Phrasing content: what a phrasing-only parent may hold (svg drawings included). */
const PHRASING_CONTENT_TAGS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'audio',
  'b',
  'br',
  'button',
  'cite',
  'code',
  'em',
  'i',
  'iframe',
  'img',
  'input',
  'label',
  'mark',
  'picture',
  'q',
  's',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'sup',
  'svg',
  'textarea',
  'time',
  'track',
  'video',
]);

/** Interactive content: never inside a link or a button. */
const INTERACTIVE_TAGS: ReadonlySet<string> = new Set([
  'a',
  'button',
  'details',
  'iframe',
  'input',
  'label',
  'select',
  'textarea',
]);

/**
 * Whether an element with this tag may stand inside one with `parentTag` by
 * the HTML content model the door enforces: no children in void tags, only
 * phrasing content in phrasing-only tags, no interactive content in a link
 * or a button. A tree drop target asks this before it offers itself.
 */
export function customCodeTagAccepts(parentTag: string, childTag: string): boolean {
  if (VOID_TAG_SET.has(parentTag) || TEXT_ONLY_TAG_SET.has(parentTag) || parentTag === 'iframe') {
    return false;
  }
  // A drawing holds only shapes, and a shape stands only in a drawing.
  if (SVG_TAG_SET.has(parentTag)) return SVG_TAG_SET.has(childTag);
  if (SVG_TAG_SET.has(childTag) && childTag !== 'svg') return false;
  if (PHRASING_ONLY_TAGS.has(parentTag) && !PHRASING_CONTENT_TAGS.has(childTag)) return false;
  if ((parentTag === 'a' || parentTag === 'button') && INTERACTIVE_TAGS.has(childTag)) return false;
  return true;
}

/** Whether an element with this tag may hold text or children at all. */
export function customCodeTagHoldsContent(tag: string): boolean {
  return !VOID_TAG_SET.has(tag);
}

/** The content-model half of an element's problems: void tags, phrasing, interactive nesting. */
function contentModelProblems(node: Record<string, unknown>, tag: string, place: Place): Problem[] {
  const found: Problem[] = [];
  if (VOID_TAG_SET.has(tag)) {
    if (typeof node['text'] === 'string' && node['text'] !== '') {
      found.push({ path: ['text'], message: `<${tag}> is a void element and holds no text` });
    }
    if (Array.isArray(node['children']) && node['children'].length > 0) {
      found.push({ path: ['children'], message: `<${tag}> is a void element and holds no children` });
    }
  }
  // Raw-text content: a textarea and an option hold words only; an iframe shows none.
  if (TEXT_ONLY_TAG_SET.has(tag) && Array.isArray(node['children']) && node['children'].length > 0) {
    found.push({ path: ['children'], message: `<${tag}> holds text only, no child elements` });
  }
  if (tag === 'iframe') {
    if (typeof node['text'] === 'string' && node['text'] !== '') {
      found.push({ path: ['text'], message: '<iframe> shows its src, never text: drop the text' });
    }
    if (Array.isArray(node['children']) && node['children'].length > 0) {
      found.push({ path: ['children'], message: '<iframe> shows its src, never children' });
    }
  }
  if (SVG_TAG_SET.has(tag)) return found;
  const phrasing = place.phrasingParent;
  if (phrasing !== undefined && !PHRASING_CONTENT_TAGS.has(tag)) {
    found.push({
      path: ['tag'],
      message: `<${tag}> cannot stand inside <${phrasing}>, which holds only phrasing content (text, span, a, strong, img…): move it beside the <${phrasing}>, or make the <${phrasing}> a <div>`,
    });
  }
  const interactive = place.interactiveParent;
  if (interactive !== undefined && INTERACTIVE_TAGS.has(tag)) {
    found.push({
      path: ['tag'],
      message: `<${tag}> is interactive and cannot sit inside <${interactive}>`,
    });
  }
  return found;
}

/** The motion half of an element's problems: params need a name, triggers fit the preset. */
function motionProblems(tag: string, record: Record<string, unknown>): Problem[] {
  const found: Problem[] = [];
  const motion =
    typeof record['data-ck-motion'] === 'string' ? record['data-ck-motion'] : undefined;
  const hover = typeof record['data-ck-hover'] === 'string' ? record['data-ck-hover'] : undefined;
  const behavior = typeof record['data-ck-behavior'] === 'string';
  // media-motion (2026-10-06): a timeline recipe reuses ease, delay, stagger and speed.
  const timeline = typeof record['data-ck-timeline'] === 'string';
  if (motion === undefined && hover === undefined) {
    for (const param of CUSTOM_CODE_MOTION_PARAMS) {
      if (typeof record[param] !== 'string') continue;
      if (timeline && (TIMELINE_REUSED_MOTION_PARAMS as readonly string[]).includes(param)) continue;
      found.push({
        path: ['attributes', param],
        message: `<${tag}> ${param} tunes an animation: write data-ck-motion or data-ck-hover on the same element, or drop ${param}`,
      });
    }
  }
  const trigger =
    typeof record['data-ck-trigger'] === 'string' ? record['data-ck-trigger'] : undefined;
  if (trigger !== undefined && motion === undefined && hover !== undefined) {
    found.push({
      path: ['attributes', 'data-ck-trigger'],
      message: `<${tag}> data-ck-trigger chooses when data-ck-motion plays; a data-ck-hover preset always plays on hover — drop data-ck-trigger or add data-ck-motion`,
    });
  }
  if (trigger !== undefined && motion !== undefined && isMotionPreset(motion)) {
    const problem = motionTriggerProblem(motion, trigger);
    if (problem !== undefined) {
      found.push({ path: ['attributes', 'data-ck-trigger'], message: `<${tag}> ${problem}` });
    }
  }
  if (typeof record['data-ck-target'] === 'string' && motion !== undefined && trigger !== 'click') {
    found.push({
      path: ['attributes', 'data-ck-target'],
      message: `<${tag}> data-ck-target names what a click plays: write data-ck-trigger='click' beside it, or drop data-ck-target`,
    });
  }
  if (
    !behavior &&
    !timeline &&
    typeof record['data-ck-speed'] === 'string' &&
    motion === undefined &&
    hover === undefined
  ) {
    found.push({
      path: ['attributes', 'data-ck-speed'],
      message: `<${tag}> data-ck-speed tunes a behaviour or an animation: write data-ck-behavior, data-ck-motion or data-ck-hover on the same element, or drop data-ck-speed`,
    });
  }
  return found;
}

/*
  media-motion (2026-10-06, DESIGN §C.2, §D.2, §E): the pairs the media
  vocabulary needs. An engine param means something only beside its marker, a
  carousel or mailto param only beside its behaviour, and a CSS motion preset
  and a scroll timeline never drive the same element (both would write its
  transform and fight every frame).
*/
function mediaProblems(tag: string, record: Record<string, unknown>): Problem[] {
  const found: Problem[] = [];
  if (typeof record['data-ck-motion'] === 'string' && typeof record['data-ck-timeline'] === 'string') {
    found.push({
      path: ['attributes', 'data-ck-timeline'],
      message: `<${tag}> carries both data-ck-motion (a CSS animation preset) and data-ck-timeline (a scroll timeline), which fight over the same element: choose one — drop data-ck-motion to keep the timeline, or drop data-ck-timeline to keep the preset`,
    });
  }
  for (const param of CUSTOM_CODE_ENGINE_PARAMS) {
    if (typeof record[param] !== 'string') continue;
    const marker = CUSTOM_CODE_ENGINE_PARAM_OWNERS[param];
    if (typeof record[marker] === 'string') continue;
    found.push({
      path: ['attributes', param],
      message: `<${tag}> ${param} tunes ${marker}: write ${marker} on the same element, or drop ${param}`,
    });
  }
  // gsap-pixi additions (2026-10-08): an image scene needs its own div layer with img children.
  const scene = record['data-ck-scene'];
  if (typeof scene === 'string' && tag !== 'div' && !isHostedScene(scene)) {
    found.push({
      path: ['attributes', 'data-ck-scene'],
      message: `<${tag}> data-ck-scene='${scene}' draws from images: put it on a div layer with img children (first child of the section), or use ${HOSTED_SCENES.join(' or ')} on the section itself`,
    });
  }
  if (typeof record['data-ck-lottie'] === 'string' && typeof record['data-ck-src'] !== 'string') {
    found.push({
      path: ['attributes', 'data-ck-lottie'],
      message: `<${tag}> data-ck-lottie plays the animation at data-ck-src: write data-ck-src='https://….json' beside it`,
    });
  }
  const behavior =
    typeof record['data-ck-behavior'] === 'string' ? record['data-ck-behavior'] : undefined;
  if (behavior !== undefined) {
    for (const param of CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS) {
      if (typeof record[param] !== 'string') continue;
      const owners = CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS[param];
      if (owners.includes(behavior)) continue;
      found.push({
        path: ['attributes', param],
        message: `<${tag}> ${param} tunes data-ck-behavior='${owners.join("' or '")}', not '${behavior}': drop ${param}`,
      });
    }
  }
  if (behavior === 'mailto-form' && typeof record['data-ck-email'] !== 'string') {
    found.push({
      path: ['attributes', 'data-ck-email'],
      message: `<${tag}> data-ck-behavior='mailto-form' sends to data-ck-email: write data-ck-email='hello@example.com' beside it`,
    });
  }
  return found;
}

/**
 * What is wrong with an element where it stands — its attributes, and its
 * place among its parent's children — as `{ path, message }` pairs, the path
 * relative to the element. Tolerant: it reads unvalidated input and reports
 * only what it can name.
 */
function elementProblems(node: Record<string, unknown>, place: Place): readonly Problem[] {
  const tag = node['tag'];
  if (typeof tag !== 'string') return [];
  const parentTag = place.parentTag;
  const found: Problem[] = [];
  const attributes = node['attributes'];
  const record =
    typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>)
      : {};
  for (const [name, value] of Object.entries(record)) {
    if (typeof value !== 'string') continue;
    const problem = customCodeAttributeProblem(tag, name, value);
    if (problem !== undefined) found.push({ path: ['attributes', name], message: problem });
  }
  const svg = SVG_TAG_SET.has(tag);
  const inSvg = parentTag !== undefined && SVG_TAG_SET.has(parentTag);
  if (svg && tag !== 'svg' && !inSvg) {
    found.push({ path: ['tag'], message: `<${tag}> is drawn only inside an <svg>` });
  }
  if (!svg && inSvg) {
    found.push({
      path: ['tag'],
      message: `An svg holds only shapes (${CUSTOM_CODE_SVG_TAGS.join(', ')}), not <${tag}>`,
    });
  }
  if (
    svg &&
    !SVG_TEXT_TAG_SET.has(tag) &&
    typeof node['text'] === 'string' &&
    node['text'].trim() !== ''
  ) {
    found.push({
      path: ['text'],
      message: `<${tag}> is a shape and holds no text; drawn text goes in <text> or <tspan>`,
    });
  }
  if (tag === 'source' && (parentTag === undefined || !SOURCE_PARENTS.has(parentTag))) {
    found.push({
      path: ['tag'],
      message: '<source> belongs inside a <picture>, a <video> or an <audio>',
    });
  }
  if (tag === 'track' && (parentTag === undefined || !TRACK_PARENTS.has(parentTag))) {
    found.push({ path: ['tag'], message: '<track> belongs inside a <video> or an <audio>' });
  }
  if (tag === 'option' && parentTag !== 'select') {
    found.push({ path: ['tag'], message: '<option> belongs inside a <select>' });
  }
  if (tag === 'legend' && parentTag !== 'fieldset') {
    found.push({ path: ['tag'], message: '<legend> belongs inside a <fieldset>' });
  }
  found.push(...contentModelProblems(node, tag, place));
  if (tag === 'form' && place.inForm) {
    found.push({ path: ['tag'], message: 'A <form> never sits inside another <form>' });
  }
  if (tag === 'iframe') {
    const title = record['title'];
    if (typeof title !== 'string' || title.trim() === '') {
      found.push({
        path: ['attributes', 'title'],
        message: "<iframe> needs a title naming what it shows, such as title='Map to our office'",
      });
    }
    if (typeof record['src'] !== 'string') {
      found.push({
        path: ['attributes', 'src'],
        message: `<iframe> needs a src from ${CUSTOM_CODE_IFRAME_SOURCES.map((source) => source.host).join(', ')}`,
      });
    }
  }
  if (typeof record['data-ck-behavior'] !== 'string') {
    for (const param of CUSTOM_CODE_BEHAVIOR_PARAMS) {
      // data-ck-speed may also tune an animation; motionProblems judges it.
      if (param === 'data-ck-speed' || typeof record[param] !== 'string') continue;
      found.push({
        path: ['attributes', param],
        message: `<${tag}> ${param} tunes a behaviour: write data-ck-behavior on the same element, or drop ${param}`,
      });
    }
  }
  found.push(...motionProblems(tag, record));
  found.push(...mediaProblems(tag, record)); // media-motion (2026-10-06)
  if (
    tag === 'video' &&
    typeof record['autoplay'] === 'string' &&
    typeof record['muted'] !== 'string'
  ) {
    found.push({
      path: ['attributes', 'autoplay'],
      message: '<video> that plays by itself is muted: write autoplay muted loop playsinline',
    });
  }
  return found;
}

/*
  ── Component props, validated against the referenced block ───────────────

  This package is layer 0 and cannot see the block registry, so a host that
  can (the renderer's registry context, the kernel) installs a resolver here.
  With one installed, a component's props are validated on WRITE against the
  block's own props schema and refused with the block's own issue text —
  instead of rendering a silent UnknownBlock three screens later. Without one
  the door keeps today's rule (any JSON). An unknown type is not refused here:
  the AI door names unknown components, and a registry may be partial while an
  extension is disposed.
*/

/** Returns the props schema of a registered block type, or undefined when unknown. */
export type CustomCodeComponentSchemaResolver = (type: string) => z.ZodType | undefined;

let componentSchemaResolver: CustomCodeComponentSchemaResolver | undefined;

/** Install (or, with undefined, remove) the resolver component props are validated with. */
export function setCustomCodeComponentSchemaResolver(
  resolver: CustomCodeComponentSchemaResolver | undefined,
): void {
  componentSchemaResolver = resolver;
}

/** The resolver currently installed, if any. */
export function getCustomCodeComponentSchemaResolver():
  CustomCodeComponentSchemaResolver | undefined {
  return componentSchemaResolver;
}

function componentProblems(record: Record<string, unknown>): Problem[] {
  const resolver = componentSchemaResolver;
  const type = record['component'];
  if (resolver === undefined || typeof type !== 'string') return [];
  let schema: z.ZodType | undefined;
  try {
    schema = resolver(type);
  } catch {
    return [];
  }
  if (schema === undefined) return [];
  const props = record['props'];
  const parsed = schema.safeParse(
    typeof props === 'object' && props !== null && !Array.isArray(props) ? props : {},
  );
  if (parsed.success) return [];
  return parsed.error.issues.slice(0, 3).map((issue) => {
    const where = issue.path.map(String).join('.');
    return {
      path: [
        'props',
        ...issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
      ],
      message: `component '${type}' prop ${where === '' ? '(props)' : where}: ${issue.message}`,
    };
  });
}

/** Every `id` attribute in a tree — what `data-ck-target` may point at. */
function treeIds(value: unknown): ReadonlySet<string> {
  const ids = new Set<string>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as { attributes?: unknown; children?: unknown };
    const attributes = record.attributes;
    if (typeof attributes === 'object' && attributes !== null) {
      const id = (attributes as Record<string, unknown>)['id'];
      if (typeof id === 'string') ids.add(id);
    }
    if (Array.isArray(record.children)) stack.push(...(record.children as unknown[]));
  }
  return ids;
}

/**
 * Every problem in a tree, in document order, each with its path from the
 * root — the per-tag half of the door, after the shape half (tags, keys,
 * ceilings) has passed. Iterative, like every walk in this file.
 */
export function customCodeTreeProblems(value: unknown): readonly Problem[] {
  const found: Problem[] = [];
  let ids: ReadonlySet<string> | undefined;
  const stack: {
    node: unknown;
    path: readonly (string | number)[];
    place: Place;
  }[] = [{ node: value, path: [], place: { parentTag: undefined, inForm: false } }];
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next -- pop() on a non-empty stack always yields an entry. */
    if (entry === undefined) continue;
    const node = entry.node;
    if (typeof node !== 'object' || node === null || Array.isArray(node)) continue;
    const record = node as Record<string, unknown>;
    const parentTag = entry.place.parentTag;
    if (record['kind'] === 'element') {
      for (const problem of elementProblems(record, entry.place)) {
        found.push({ path: [...entry.path, ...problem.path], message: problem.message });
      }
      const attributes = record['attributes'];
      const target =
        typeof attributes === 'object' && attributes !== null
          ? (attributes as Record<string, unknown>)['data-ck-target']
          : undefined;
      if (typeof target === 'string') {
        ids ??= treeIds(value);
        if (!ids.has(target)) {
          found.push({
            path: [...entry.path, 'attributes', 'data-ck-target'],
            message: `data-ck-target='${target}' names no element in this region: give the element to play id='${target}', or point at an existing id`,
          });
        }
      }
    } else if (
      (record['kind'] === 'icon' || record['kind'] === 'component') &&
      parentTag !== undefined &&
      SVG_TAG_SET.has(parentTag)
    ) {
      found.push({
        path: [...entry.path, 'kind'],
        message: `An svg holds only shapes, not ${record['kind'] === 'icon' ? 'an icon' : 'a component'}`,
      });
    }
    if (record['kind'] === 'component') {
      for (const problem of componentProblems(record)) {
        found.push({ path: [...entry.path, ...problem.path], message: problem.message });
      }
    }
    const children = record['children'];
    if (!Array.isArray(children)) continue;
    const tag = typeof record['tag'] === 'string' ? record['tag'] : undefined;
    const element = record['kind'] === 'element' && tag !== undefined;
    const place: Place = {
      parentTag: record['kind'] === 'element' ? tag : undefined,
      inForm: entry.place.inForm || (record['kind'] === 'element' && tag === 'form'),
      /*
        A component renders a block of its own: its children start a fresh
        content model, as an svg does.
      */
      phrasingParent:
        record['kind'] === 'component' || (element && SVG_TAG_SET.has(tag))
          ? undefined
          : element && PHRASING_ONLY_TAGS.has(tag)
            ? tag
            : entry.place.phrasingParent,
      interactiveParent:
        record['kind'] === 'component'
          ? undefined
          : element && (tag === 'a' || tag === 'button')
            ? tag
            : entry.place.interactiveParent,
    };
    for (let at = children.length - 1; at >= 0; at -= 1) {
      stack.push({ node: children[at], path: [...entry.path, 'children', at], place });
    }
  }
  return found;
}

/**
 * The shape of an icon name: lowercase words joined by single hyphens, digits
 * allowed — a Lucide name (`mail`), or a Tabler one behind its set prefix
 * (`tabler:brand-whatsapp`, `tabler-filled:heart`).
 */
export const CUSTOM_CODE_ICON_NAME = /^(?:tabler(?:-filled)?:)?[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** The icon sets a name may come from; Lucide is the default (no prefix). */
export type CustomCodeIconSet = 'lucide' | 'tabler' | 'tabler-filled';

/** An icon name split into its set and its bare kebab-case name. */
export interface CustomCodeIconRef {
  readonly set: CustomCodeIconSet;
  readonly name: string;
}

/** `tabler-filled:heart` → `{ set: 'tabler-filled', name: 'heart' }`; `mail` → Lucide. */
export function parseCustomCodeIconName(value: string): CustomCodeIconRef {
  if (value.startsWith('tabler-filled:')) {
    return { set: 'tabler-filled', name: value.slice('tabler-filled:'.length) };
  }
  if (value.startsWith('tabler:')) return { set: 'tabler', name: value.slice('tabler:'.length) };
  return { set: 'lucide', name: value };
}

/**
 * Whether an icon name exists in its set — the door's existence check, against
 * the generated name lists (Lucide, Tabler outline, Tabler filled).
 */
export function isCustomCodeIconName(value: string): boolean {
  if (!CUSTOM_CODE_ICON_NAME.test(value)) return false;
  const ref = parseCustomCodeIconName(value);
  if (ref.set === 'lucide') return isLucideIconName(ref.name);
  return isTablerIconName(ref.name, ref.set === 'tabler-filled' ? 'filled' : 'outline');
}

/**
 * Structural nesting ceiling — the same argument as `RICH_TEXT_MAX_DEPTH`, and
 * deliberately the same number. Recursive zod schemas overflow the stack on
 * pathological input BEFORE any refinement runs, so the guard is an ITERATIVE
 * pre-check piped ahead of shape validation. It also matches the renderer's
 * ceiling, which is what keeps "storable ⇒ renderable" true.
 */
export const CUSTOM_CODE_MAX_DEPTH = 30;

/**
 * Total node ceiling. Depth alone does not bound size: a flat list of a
 * million spans is depth 1 and would still take the canvas down. The door
 * refuses what the renderer could not survive.
 */
export const CUSTOM_CODE_MAX_NODES = 2_000;

interface WalkLimits {
  readonly withinDepth: boolean;
  readonly withinCount: boolean;
}

/** One iterative pass answering both ceilings; a hostile tree never recurses it. */
function walkLimits(value: unknown): WalkLimits {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  let count = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next 3 -- pop() on a non-empty stack always yields an entry. */
    if (entry === undefined) {
      continue;
    }
    if (entry.depth > CUSTOM_CODE_MAX_DEPTH) {
      return { withinDepth: false, withinCount: count <= CUSTOM_CODE_MAX_NODES };
    }
    const node = entry.node;
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    count += 1;
    if (count > CUSTOM_CODE_MAX_NODES) {
      return { withinDepth: true, withinCount: false };
    }
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push({ node: child, depth: entry.depth + 1 });
      }
    }
  }
  return { withinDepth: true, withinCount: true };
}

/** The longest Layers name an element or component may carry (editor metadata). */
export const CUSTOM_CODE_LABEL_MAX = 60;

const attributesSchema = z.strictObject(
  Object.fromEntries(
    CUSTOM_CODE_ATTRIBUTES.map((name) => [name, z.string().max(2_000).optional()]),
  ) as Record<CustomCodeAttribute, z.ZodOptional<z.ZodString>>,
);

const nodeSchema: z.ZodType<CustomCodeNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('element'),
      tag: z.enum(CUSTOM_CODE_TAGS),
      className: z.string().max(1_000).optional(),
      text: z.string().max(20_000).optional(),
      attributes: attributesSchema.optional(),
      children: z.array(nodeSchema).optional(),
      label: z.string().max(CUSTOM_CODE_LABEL_MAX).optional(),
      locked: z.literal(true).optional(),
    }),
    z.strictObject({
      kind: z.literal('component'),
      /*
        A block type, not a path or a URL. The bound is generous for a
        namespaced type name and firmly short of anything that could carry a
        payload — the renderer only ever uses this to key a registry lookup.
      */
      component: z.string().min(1).max(120),
      /*
        Any JSON here; validated against the referenced block's own props
        schema by the tree pass when a resolver is installed
        (setCustomCodeComponentSchemaResolver).
      */
      props: z.record(z.string(), z.json()).optional(),
      children: z.array(nodeSchema).optional(),
      label: z.string().max(CUSTOM_CODE_LABEL_MAX).optional(),
      locked: z.literal(true).optional(),
    }),
    z.strictObject({
      kind: z.literal('icon'),
      name: z.string().min(1).max(80).regex(CUSTOM_CODE_ICON_NAME),
      className: z.string().max(1_000).optional(),
      size: z.number().int().min(8).max(256).optional(),
      strokeWidth: z.number().min(0.5).max(4).optional(),
      label: z.string().max(120).optional(),
      locked: z.literal(true).optional(),
    }),
  ]),
);

/*
  The per-tag rules run once over the whole tree, after the shape has passed:
  where an element stands (an svg shape outside an svg, a source outside a
  picture) is a fact about its parent, which a node schema never sees. Only
  the first few problems are reported — the kernel shows the first, and a
  repair round needs one sentence per mistake, not a wall of them.
*/
const TREE_PROBLEMS_REPORTED = 8;

const structureSchema = z
  .strictObject({
    kind: z.literal('root'),
    children: z.array(nodeSchema),
  })
  .superRefine((tree, context) => {
    for (const { path, message } of customCodeTreeProblems(tree).slice(0, TREE_PROBLEMS_REPORTED)) {
      context.addIssue({ code: 'custom', message, path: [...path] });
    }
  });

export interface CustomCodeRoot {
  kind: 'root';
  children: CustomCodeNode[];
}

/** The full tree validator — importable wherever the shape is needed. */
export const customCodeTreeSchema: z.ZodType<CustomCodeRoot> = z
  .custom<unknown>((value) => walkLimits(value).withinDepth, {
    message: `Custom-code nesting exceeds the supported depth (${String(CUSTOM_CODE_MAX_DEPTH)}).`,
  })
  .pipe(
    z.custom<unknown>((value) => walkLimits(value).withinCount, {
      message: `Custom-code tree exceeds the supported node count (${String(CUSTOM_CODE_MAX_NODES)}).`,
    }),
  )
  .pipe(structureSchema);

/** The meta marker, matched by META rather than identity (the rich-text rule). */
export const CUSTOM_CODE_META_KEY = 'craftkit';
export const CUSTOM_CODE_META_VALUE = 'custom-code-tree';

/** Declare a custom-code-tree prop, tagged with the machine-readable marker. */
export function customCodeTree(): z.ZodType {
  return customCodeTreeSchema.meta({ [CUSTOM_CODE_META_KEY]: CUSTOM_CODE_META_VALUE });
}

/** True when a property schema is a custom-code declaration; unwraps wrappers. */
export function isCustomCodeTreeSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[CUSTOM_CODE_META_KEY] === CUSTOM_CODE_META_VALUE) {
      return true;
    }
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}

/** The canonical empty tree: a root with no children (never null). */
export function emptyCustomCodeTree(): CustomCodeRoot {
  return { kind: 'root', children: [] };
}

const TAG_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_TAGS);

/** Whether a tag name is in the render vocabulary — the renderer's read guard. */
export function isCustomCodeTag(tag: string): tag is CustomCodeTag {
  return TAG_SET.has(tag);
}

const TAG_SPELLING: ReadonlyMap<string, CustomCodeTag> = new Map(
  CUSTOM_CODE_TAGS.map((tag) => [tag.toLowerCase(), tag]),
);

/*
  React spells a few attributes in camel case (`srcSet`, `colSpan`,
  `strokeWidth`), and a model that writes a tree as JSON often borrows that
  spelling; an HTML reader lower-cases everything (`viewbox`). Both fold to
  the vocabulary's own name.
*/
const ATTRIBUTE_SPELLING: ReadonlyMap<string, CustomCodeAttribute> = new Map([
  ...CUSTOM_CODE_ATTRIBUTES.flatMap((name): [string, CustomCodeAttribute][] => [
    [name.toLowerCase(), name],
    [name.replace(/-/gu, '').toLowerCase(), name],
  ]),
  // React's spelling of the one attribute whose name is a reserved word.
  ['htmlfor', 'for'],
]);

/**
 * A tag as the vocabulary spells it, whatever its case (`lineargradient` →
 * `linearGradient`, `DIV` → `div`); undefined when the vocabulary has no such
 * tag. For readers that fold case — an HTML tokenizer, a model's JSON.
 */
export function customCodeTagSpelling(tag: string): CustomCodeTag | undefined {
  return TAG_SPELLING.get(tag.toLowerCase());
}

/**
 * An attribute as the vocabulary spells it, whatever its case or React's
 * camel case (`viewbox` → `viewBox`, `strokeWidth` → `stroke-width`,
 * `srcSet` → `srcset`); undefined when the vocabulary has no such attribute.
 */
export function customCodeAttributeSpelling(name: string): CustomCodeAttribute | undefined {
  return (
    ATTRIBUTE_SPELLING.get(name.toLowerCase()) ??
    ATTRIBUTE_SPELLING.get(name.replace(/-/gu, '').toLowerCase())
  );
}

/**
 * Every `className` in a tree, in document order.
 *
 * Lives here rather than in the AI package because the AI door and the
 * Inspector both need it and neither should own a second tree walk. Tolerant
 * by design: it reads whatever it is given, so the AI door can inspect a
 * proposal that has not been validated yet.
 */
export function customCodeClassNames(value: unknown): readonly string[] {
  const found: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const className = (node as { className?: unknown }).className;
    if (typeof className === 'string') {
      found.push(className);
    }
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return found;
}

/** Every icon name in a tree, deduplicated and sorted — for the door that checks existence. */
export function customCodeIconNames(value: unknown): readonly string[] {
  const found = new Set<string>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const record = node as { kind?: unknown; name?: unknown; children?: unknown };
    if (record.kind === 'icon' && typeof record.name === 'string') {
      found.add(record.name);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        stack.push(child);
      }
    }
  }
  return [...found].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** A row of look-alike items where some carry an icon and a few do not. */
export interface CustomCodeIconGap {
  readonly tag: string;
  readonly className: string;
  /** Items in the row. */
  readonly items: number;
  /** Items without an icon anywhere inside them. */
  readonly bare: number;
}

/** Table cells mix a check icon with text by design; they are not an icon list. */
const ICON_GAP_EXEMPT_TAGS = new Set(['td', 'th', 'tr']);

function containsIcon(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as { kind?: unknown; children?: unknown };
    if (record.kind === 'icon') return true;
    if (Array.isArray(record.children)) stack.push(...(record.children as unknown[]));
  }
  return false;
}

/**
 * Icon lists with a bare item: three or more sibling elements of the same tag
 * and classes (one row of cards, one list), at least two carrying an icon,
 * and fewer bare than iconned.
 *
 * Final test 2026-09-30: a services row drew icons on three cards and none on
 * the fourth. Siblings are grouped by tag AND classes so a heading div beside
 * a grid div is never read as one row.
 */
export function customCodeIconGaps(value: unknown): readonly CustomCodeIconGap[] {
  const gaps: CustomCodeIconGap[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const children = (node as { children?: unknown }).children;
    if (!Array.isArray(children)) continue;
    const rows = new Map<string, { tag: string; className: string; items: number; bare: number }>();
    for (const child of children as unknown[]) {
      stack.push(child);
      if (typeof child !== 'object' || child === null) continue;
      const element = child as { kind?: unknown; tag?: unknown; className?: unknown };
      if (element.kind !== 'element' || typeof element.tag !== 'string') continue;
      if (ICON_GAP_EXEMPT_TAGS.has(element.tag)) continue;
      const className =
        typeof element.className === 'string'
          ? element.className.trim().split(/\s+/u).filter(Boolean).sort().join(' ')
          : '';
      const key = `${element.tag}\u0000${className}`;
      const row = rows.get(key) ?? { tag: element.tag, className, items: 0, bare: 0 };
      row.items += 1;
      if (!containsIcon(child)) row.bare += 1;
      rows.set(key, row);
    }
    for (const row of rows.values()) {
      const iconned = row.items - row.bare;
      if (row.items >= 3 && iconned >= 2 && row.bare > 0 && row.bare < iconned) gaps.push(row);
    }
  }
  return gaps;
}

/** Every referenced component type in a tree, deduplicated and sorted. */
export function customCodeComponentTypes(value: unknown): readonly string[] {
  const found = new Set<string>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const record = node as { kind?: unknown; component?: unknown; children?: unknown };
    if (record.kind === 'component' && typeof record.component === 'string') {
      found.add(record.component);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        stack.push(child);
      }
    }
  }
  return [...found].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/*
  ── Custom CSS declaration ──────────────────────────────────────────────────

  A stylesheet prop is a `z.string()`, and so is a title, a slug, and a label.
  Nothing in the shape distinguishes them, so the Inspector would offer all
  four the same single-line box — and the one that needs a code surface and a
  refusal list would be the one least served by it.

  The marker is the same mechanism `richText()` uses, and for the same reason:
  a field type matches on a DECLARATION the block makes, never on a property
  name. Matching `key === 'css'` would silently capture any block that happened
  to name a prop `css`, and silently miss one that named it `styles`.
*/

/** The meta marker a CSS field type matches on. */
export const CUSTOM_CSS_META_VALUE = 'custom-css';

/*
  Returns a `ZodType<string>` rather than a bare `ZodType`: the marker is for
  the Inspector, and it must not cost the BLOCK its inferred prop type. Declared
  loosely, `props.css` infers as `unknown` and every renderer that touches it
  needs a cast — a type hole opened by a presentation concern.
*/
/**
 * The ceiling on a custom-code region's own stylesheet. Raised from 8 000 to
 * 24 000 on 2026-10-05 (style-manager DESIGN §D.1): the region `css` is the
 * escape hatch for what utilities cannot say (`@keyframes`, complex
 * selectors), and an animated, effect-rich section outgrew 8 000. The page
 * root's `pageCss` keeps its own explicit ceiling.
 */
export const CUSTOM_CODE_REGION_CSS_MAX = 24_000;

/** Declare a scoped-CSS prop: a string, marked as a stylesheet. */
export function customCss(max = CUSTOM_CODE_REGION_CSS_MAX): z.ZodType<string> {
  return z
    .string()
    .max(max)
    .default('')
    .meta({ [CUSTOM_CODE_META_KEY]: CUSTOM_CSS_META_VALUE });
}

/** True when a property schema is a scoped-CSS declaration; unwraps wrappers. */
export function isCustomCssSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[CUSTOM_CODE_META_KEY] === CUSTOM_CSS_META_VALUE) {
      return true;
    }
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}

/*
  ── Custom JS declaration ───────────────────────────────────────────────────

  The tree cannot express a `<script>` and must not learn to (see the header of
  this file): a script in the TREE would be reachable from every producer that
  writes a tree. A region's `js` is a SEPARATE prop for the same reason `css` is
  — a string that is code, marked so the Inspector offers a code surface and
  the style law leaves it alone, recognised by DECLARATION and never by name.

  This is the owner-approved free-code mode: once a block carries `js`, it runs
  — in the editor canvas and on the published site. What gates it is who may
  AUTHOR it (the composer toggle), not whether a saved script executes. The
  renderer never emits a literal `<script>`; it puts the source on the region as
  `data-ck-js` and a small runtime evaluates it.
*/

/** The meta marker a JS field type matches on. */
export const CUSTOM_JS_META_VALUE = 'custom-js';

/** The ceiling on a custom-code region's own script. */
export const CUSTOM_CODE_REGION_JS_MAX = 32_000;

/** Declare a region-script prop: a string, marked as code that runs. */
export function customJs(max = CUSTOM_CODE_REGION_JS_MAX): z.ZodType<string> {
  return z
    .string()
    .max(max)
    .default('')
    .meta({ [CUSTOM_CODE_META_KEY]: CUSTOM_JS_META_VALUE });
}

/** True when a property schema is a region-script declaration; unwraps wrappers. */
export function isCustomJsSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[CUSTOM_CODE_META_KEY] === CUSTOM_JS_META_VALUE) {
      return true;
    }
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}
