import { z } from 'zod';

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
] as const;

/**
 * Tags the vocabulary admits: structure, text, media, lists, tables,
 * disclosure, links, buttons, and the svg shape family — no more.
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
  ...CUSTOM_CODE_SVG_ATTRIBUTES,
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
}

export interface CustomCodeComponent {
  kind: 'component';
  /** A registered block type. Resolved at render; unknown ⇒ UnknownBlock. */
  component: string;
  /** Handed to that block's own schema for validation before it renders. */
  props?: Record<string, unknown> | undefined;
  /** Rendered into the referenced block's default slot. */
  children?: CustomCodeNode[] | undefined;
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
  /** Kebab-case Lucide name. Validated for shape here; for existence at the door. */
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
   */
  label?: string | undefined;
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
  readonly value?: (value: string, name: string) => string | undefined;
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
  safeCustomCodeUrl(value) === undefined ? `${name} must be an https or relative address` : undefined;

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
  lang: { on: 'html', value: matching(/^(?:[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*)?$/u, 'a language tag') },
  dir: { on: 'html', value: oneOf('ltr', 'rtl', 'auto') },
  popover: { on: 'html', value: oneOf('', 'auto', 'manual') },
  popovertarget: { on: ['button'], value: matching(/^[^\s'"<>]{1,120}$/u, "the popover's id") },
  popovertargetaction: { on: ['button'], value: oneOf('toggle', 'show', 'hide') },
  loading: { on: ['img'], value: oneOf('lazy', 'eager') },
  decoding: { on: ['img'], value: oneOf('async', 'sync', 'auto') },
  srcset: { on: ['img', 'source'], value: safeSrcset },
  sizes: {
    on: ['img', 'source'],
    value: matching(/^[\w\s().,:%+*/-]{1,500}$/u, 'a sizes list such as (min-width:768px) 50vw, 100vw'),
  },
  media: {
    on: ['source'],
    value: matching(/^[\w\s().,:%/-]{1,500}$/u, 'a media query such as (min-width:768px)'),
  },
  type: {
    on: ['source'],
    value: matching(
      /^[a-z]+\/[\w.+-]+(?:\s*;\s*codecs=["']?[\w., +-]+["']?)?$/u,
      'a media type such as video/mp4',
    ),
  },
  poster: { on: ['video'], value: safeAddress },
  autoplay: { on: ['video'], value: bare },
  muted: { on: ['video'], value: bare },
  loop: { on: ['video'], value: bare },
  playsinline: { on: ['video'], value: bare },
  controls: { on: ['video'], value: bare },
  preload: { on: ['video'], value: oneOf('none', 'metadata', 'auto') },
  open: { on: ['details'], value: bare },
  name: { on: ['details'], value: matching(/^[\w-]{1,64}$/u, 'a group name of letters, digits and -') },
  colspan: { on: ['td', 'th'], value: matching(/^[1-9]\d{0,2}$/u, 'a whole number from 1') },
  rowspan: { on: ['td', 'th'], value: matching(/^\d{1,3}$/u, 'a whole number') },
  scope: { on: ['th'], value: oneOf('row', 'col', 'rowgroup', 'colgroup') },
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
    ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2'].map((name) => [
      name,
      { on: 'svg', value: svgLength } satisfies AttributeRule,
    ]),
  ),
};

/** Tags an html `width`/`height` sizes: its intrinsic box, so the layout does not shift. */
const HTML_SIZED = new Set(['img', 'video', 'source']);

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
    if (!HTML_SIZED.has(tag)) return `${name} belongs on <img>, <video>, <source> or an svg shape, not <${tag}>`;
    return /^\d{1,5}$/u.test(value) ? undefined : `${name} on <${tag}> is a whole number of pixels`;
  }
  const rule = Object.hasOwn(ATTRIBUTE_RULES, name) ? ATTRIBUTE_RULES[name] : undefined;
  if (rule === undefined) return `${name} is not an attribute the vocabulary admits`;
  if (!fits(rule.on, tag)) return `${name} belongs on ${placeName(rule.on)}, not <${tag}>`;
  if (name === 'src' && (tag === 'video' || tag === 'source')) return safeAddress(value, name);
  const problem = rule.value?.(value, name);
  return problem === undefined ? undefined : `<${tag}> ${problem}`;
}

/** The parents a `source` means something in; anywhere else it is inert. */
const SOURCE_PARENTS = new Set(['picture', 'video']);

/**
 * What is wrong with an element where it stands — its attributes, and its
 * place among its parent's children — as `{ path, message }` pairs, the path
 * relative to the element. Tolerant: it reads unvalidated input and reports
 * only what it can name.
 */
function elementProblems(
  node: Record<string, unknown>,
  parentTag: string | undefined,
): readonly { readonly path: readonly (string | number)[]; readonly message: string }[] {
  const tag = node['tag'];
  if (typeof tag !== 'string') return [];
  const found: { path: (string | number)[]; message: string }[] = [];
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
  if (svg && typeof node['text'] === 'string' && node['text'].trim() !== '') {
    found.push({ path: ['text'], message: `<${tag}> is a shape and holds no text` });
  }
  if (tag === 'source' && (parentTag === undefined || !SOURCE_PARENTS.has(parentTag))) {
    found.push({ path: ['tag'], message: '<source> belongs inside a <picture> or a <video>' });
  }
  if (tag === 'video' && typeof record['autoplay'] === 'string' && typeof record['muted'] !== 'string') {
    found.push({
      path: ['attributes', 'autoplay'],
      message: '<video> that plays by itself is muted: write autoplay muted loop playsinline',
    });
  }
  return found;
}

/**
 * Every problem in a tree, in document order, each with its path from the
 * root — the per-tag half of the door, after the shape half (tags, keys,
 * ceilings) has passed. Iterative, like every walk in this file.
 */
export function customCodeTreeProblems(
  value: unknown,
): readonly { readonly path: readonly (string | number)[]; readonly message: string }[] {
  const found: { path: readonly (string | number)[]; message: string }[] = [];
  const stack: {
    node: unknown;
    path: readonly (string | number)[];
    parentTag: string | undefined;
  }[] = [{ node: value, path: [], parentTag: undefined }];
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next -- pop() on a non-empty stack always yields an entry. */
    if (entry === undefined) continue;
    const node = entry.node;
    if (typeof node !== 'object' || node === null || Array.isArray(node)) continue;
    const record = node as Record<string, unknown>;
    if (record['kind'] === 'element') {
      for (const problem of elementProblems(record, entry.parentTag)) {
        found.push({ path: [...entry.path, ...problem.path], message: problem.message });
      }
    } else if (
      (record['kind'] === 'icon' || record['kind'] === 'component') &&
      entry.parentTag !== undefined &&
      SVG_TAG_SET.has(entry.parentTag)
    ) {
      found.push({
        path: [...entry.path, 'kind'],
        message: `An svg holds only shapes, not ${record['kind'] === 'icon' ? 'an icon' : 'a component'}`,
      });
    }
    const children = record['children'];
    if (!Array.isArray(children)) continue;
    const tag = typeof record['tag'] === 'string' ? record['tag'] : undefined;
    for (let at = children.length - 1; at >= 0; at -= 1) {
      stack.push({
        node: children[at],
        path: [...entry.path, 'children', at],
        parentTag: record['kind'] === 'element' ? tag : undefined,
      });
    }
  }
  return found;
}

/** The shape of a Lucide name: lowercase words joined by single hyphens, digits allowed. */
export const CUSTOM_CODE_ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

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
    }),
    z.strictObject({
      kind: z.literal('component'),
      /*
        A block type, not a path or a URL. The bound is generous for a
        namespaced type name and firmly short of anything that could carry a
        payload — the renderer only ever uses this to key a registry lookup.
      */
      component: z.string().min(1).max(120),
      props: z.record(z.string(), z.json()).optional(),
      children: z.array(nodeSchema).optional(),
    }),
    z.strictObject({
      kind: z.literal('icon'),
      name: z.string().min(1).max(64).regex(CUSTOM_CODE_ICON_NAME),
      className: z.string().max(1_000).optional(),
      size: z.number().int().min(8).max(256).optional(),
      strokeWidth: z.number().min(0.5).max(4).optional(),
      label: z.string().max(120).optional(),
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
const ATTRIBUTE_SPELLING: ReadonlyMap<string, CustomCodeAttribute> = new Map(
  CUSTOM_CODE_ATTRIBUTES.flatMap((name): [string, CustomCodeAttribute][] => [
    [name.toLowerCase(), name],
    [name.replace(/-/gu, '').toLowerCase(), name],
  ]),
);

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
  return ATTRIBUTE_SPELLING.get(name.toLowerCase()) ?? ATTRIBUTE_SPELLING.get(name.replace(/-/gu, '').toLowerCase());
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
/** Declare a scoped-CSS prop: a string, marked as a stylesheet. */
export function customCss(max = 8_000): z.ZodType<string> {
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
