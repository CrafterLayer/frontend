import { Parser } from 'htmlparser2';

/** The slot shape of ./types.ts, restated so this file imports nothing but htmlparser2. */
export interface DraftSlot {
  readonly kind: 'text' | 'image' | 'link' | 'icon' | 'list';
  readonly max?: number;
  readonly required?: boolean;
}

/**
 * The section-kit converter's pure half: upstream HTML (HyperUI, Meraki UI)
 * → a DRAFT kit — tree-markup with `{{slots}}` and the slot list. Run once
 * per upstream update by scripts/section-kit/convert.mjs, never at request
 * time, and never trusted as-is: a person reviews each draft (lists are
 * wrapped in `{{#items}}` by hand, copy is renamed to the kit's slot names)
 * before it is committed as TS data under ./kits.
 *
 * What it converts (DESIGN §B):
 * - physical direction classes → logical ones, so an Arabic page mirrors;
 * - palette colours → the page kit's `ck-*` classes (never a hue);
 * - heroicons `<svg>` → `<icon name>` with the Lucide name;
 * - Alpine (`x-data`, `@click`, `x-show`) → `details`/`summary`;
 * - forms → a registered-block reference (the door forbids raw controls);
 * - text, images and links → `{{slot}}`.
 *
 * Node-runnable as TypeScript (Node 24 strips types): it imports only
 * htmlparser2 and types, each with its file extension, and uses no syntax
 * that type stripping cannot erase.
 */

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const NEUTRAL = /^(?:slate|gray|zinc|neutral|stone)$/u;

// ── Direction ────────────────────────────────────────────────────────────────

const LOGICAL: readonly (readonly [RegExp, string])[] = [
  [/^ml-/u, 'ms-'],
  [/^mr-/u, 'me-'],
  [/^pl-/u, 'ps-'],
  [/^pr-/u, 'pe-'],
  [/^left-/u, 'start-'],
  [/^right-/u, 'end-'],
  [/^text-left$/u, 'text-start'],
  [/^text-right$/u, 'text-end'],
  [/^float-left$/u, 'float-start'],
  [/^float-right$/u, 'float-end'],
  [/^rounded-tl(?=-|$)/u, 'rounded-ss'],
  [/^rounded-tr(?=-|$)/u, 'rounded-se'],
  [/^rounded-bl(?=-|$)/u, 'rounded-es'],
  [/^rounded-br(?=-|$)/u, 'rounded-ee'],
  [/^rounded-l(?=-|$)/u, 'rounded-s'],
  [/^rounded-r(?=-|$)/u, 'rounded-e'],
  [/^border-l(?=-|$)/u, 'border-s'],
  [/^border-r(?=-|$)/u, 'border-e'],
];

function splitVariant(token: string): { prefix: string; negative: boolean; base: string } {
  const cut = token.lastIndexOf(':');
  const prefix = cut < 0 ? '' : token.slice(0, cut + 1);
  let base = cut < 0 ? token : token.slice(cut + 1);
  const negative = base.startsWith('-');
  if (negative) base = base.slice(1);
  return { prefix, negative, base };
}

/**
 * Physical sides → logical ones (`ml-4`→`ms-4`, `text-left`→`text-start`,
 * `rounded-r-lg`→`rounded-e-lg`, `border-l-2`→`border-s-2`), keeping the
 * variant and the sign. Meraki's `rtl:-scale-x-100` becomes the kit's
 * `ck-flip`; every other `rtl:`/`ltr:` class goes (logical classes need none).
 */
export function toLogicalClasses(className: string): string {
  const out: string[] = [];
  for (const token of className.split(/\s+/u)) {
    if (token === '') continue;
    if (/(?:^|:)(?:rtl|ltr):/u.test(`:${token}`) || token.startsWith('rtl:') || token.startsWith('ltr:')) {
      if (token.endsWith("scale-x-100")) out.push('ck-flip');
      continue;
    }
    const { prefix, negative, base } = splitVariant(token);
    let next = base;
    for (const [pattern, replacement] of LOGICAL) {
      if (pattern.test(base)) {
        next = base.replace(pattern, replacement);
        break;
      }
    }
    out.push(`${prefix}${negative ? '-' : ''}${next}`);
  }
  return [...new Set(out)].join(' ');
}

// ── Colour ───────────────────────────────────────────────────────────────────

const COLOUR = new RegExp(`^(bg|text|border|ring|divide|from|via|to|outline|shadow|fill|stroke|decoration|placeholder|accent|caret)-(${PALETTE})-(\\d{2,3})(?:/\\d+)?$`, 'u');

/**
 * Palette colours → page-kit classes. Neutrals map by weight (dark text →
 * `ck-ink`, mid → `ck-muted`, pale fills → `ck-surface`, dark fills →
 * `ck-inverse`); a hue is the accent (`ck-accent-fill`, or `ck-btn` on a
 * link or button; `ck-accent-ink` as text); every border colour is
 * `ck-border`. Colour on a state variant, rings, gradients and `dark:` twins
 * are dropped: a re-theme moves the kit classes, a hue it would not.
 */
export function toKitColourClasses(className: string, tag = 'div'): string {
  const out: string[] = [];
  for (const token of className.split(/\s+/u)) {
    if (token === '') continue;
    if (token.includes('dark:')) continue;
    const { prefix, base } = splitVariant(token);
    const colour = COLOUR.exec(base);
    const white = /^(bg|text|border)-(white|black)(?:\/\d+)?$/u.exec(base);
    if (colour === null && white === null) {
      out.push(token);
      continue;
    }
    if (prefix !== '') continue;
    if (white !== null) {
      if (white[1] === 'bg') out.push(white[2] === 'white' ? 'ck-surface' : 'ck-inverse');
      else if (white[1] === 'border') out.push('ck-border');
      else out.push(token);
      continue;
    }
    const [, property = '', hue = '', weightText = '0'] = colour ?? [];
    const weight = Number(weightText);
    const neutral = NEUTRAL.test(hue);
    if (property === 'text') {
      if (neutral) out.push(weight >= 800 ? 'ck-ink' : 'ck-muted');
      else out.push('ck-accent-ink');
    } else if (property === 'bg') {
      if (neutral) out.push(weight <= 200 ? 'ck-surface' : weight >= 700 ? 'ck-inverse' : 'ck-surface');
      else if (weight <= 200) out.push('ck-surface');
      else out.push(tag === 'a' || tag === 'button' ? 'ck-btn' : 'ck-accent-fill');
    } else if (property === 'border' || property === 'divide') {
      out.push('ck-border');
    }
    // ring, from/via/to, outline, shadow, fill, stroke…: dropped.
  }
  return [...new Set(out)].join(' ');
}

// ── Icons ────────────────────────────────────────────────────────────────────

/*
  Heroicons carry no name in upstream markup, only path data, so they are
  recognised by the start of their first path (the forms HyperUI and Meraki
  ship at the pinned commits). Brand marks (GitHub, X, LinkedIn…) map to
  nothing on purpose: Lucide has no brand logos, and a lookalike is worse.
*/
const HEROICON_PATHS: readonly (readonly [string, string])[] = [
  ['M4.5 12.75l6 6 9-13.5', 'check'],
  ['m4.5 12.75 6 6 9-13.5', 'check'],
  ['M6 18L18 6M6 6l12 12', 'x'],
  ['M6 18 18 6M6 6l12 12', 'x'],
  ['M19 9l-7 7-7-7', 'chevron-down'],
  ['M19.5 8.25l-7.5 7.5-7.5-7.5', 'chevron-down'],
  ['m19.5 8.25-7.5 7.5-7.5-7.5', 'chevron-down'],
  ['M9 5l7 7-7 7', 'chevron-right'],
  ['M8.25 4.5l7.5 7.5-7.5 7.5', 'chevron-right'],
  ['M4 8h16M4 16h16', 'menu'],
  ['M4 6h16M4 12h16M4 18h16', 'menu'],
  ['M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4', 'map-pin'],
  ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'map-pin'],
  ['m3.75 13.5 10.5-11.25L12 10.5h8.25', 'zap'],
  ['M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75', 'lock'],
  ['M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.', 'sparkles'],
  ['M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5', 'calendar'],
  ['M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3', 'arrow-right'],
  ['M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3', 'arrow-right'],
  ['M12 4.5v15m7.5-7.5h-15', 'plus'],
];

/** The Lucide name for a heroicon, by its first path's data; undefined when unknown or a brand mark. */
export function heroiconToLucide(pathData: string): string | undefined {
  const d = pathData.trim();
  return HEROICON_PATHS.find(([prefix]) => d.startsWith(prefix))?.[1];
}

// ── HTML → draft kit ─────────────────────────────────────────────────────────

interface DraftElement {
  readonly tag: string;
  readonly attributes: Record<string, string>;
  readonly children: (DraftElement | string)[];
}

function parseHtml(html: string): DraftElement {
  const root: DraftElement = { tag: '#root', attributes: {}, children: [] };
  const stack: DraftElement[] = [root];
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const element: DraftElement = { tag: name, attributes: { ...attributes }, children: [] };
        stack[stack.length - 1]?.children.push(element);
        stack.push(element);
      },
      ontext(text) {
        stack[stack.length - 1]?.children.push(text);
      },
      onclosetag() {
        if (stack.length > 1) stack.pop();
      },
    },
    { lowerCaseAttributeNames: false, recognizeSelfClosing: true },
  );
  parser.write(html);
  parser.end();
  return root;
}

function findTag(node: DraftElement, tag: string): DraftElement | undefined {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findTag(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

const DROPPED = new Set(['script', 'style', 'head', 'meta', 'link', 'title', 'noscript']);
const FORM_PARTS = new Set(['form', 'input', 'textarea', 'select', 'option', 'label']);
const KEPT_ATTRIBUTES = new Set(['aria-label', 'aria-hidden', 'role', 'datetime', 'scope', 'colspan', 'rowspan']);
const ALPINE = /^(?:x-|@|:)/u;
const VOID = new Set(['img', 'br', 'hr', 'source']);

function escapeAttribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/'/gu, '&#39;').replace(/</gu, '&lt;');
}

export interface DraftKit {
  readonly markup: string;
  readonly slots: Record<string, DraftSlot>;
  readonly notes: readonly string[];
}

interface DraftState {
  readonly slots: Record<string, DraftSlot>;
  readonly notes: string[];
  readonly counts: Map<string, number>;
  hasTitle: boolean;
  hasLead: boolean;
}

function nextName(state: DraftState, base: string): string {
  const count = (state.counts.get(base) ?? 0) + 1;
  state.counts.set(base, count);
  return count === 1 ? base : `${base}${String(count)}`;
}

function textSlot(state: DraftState, tag: string): string {
  if (!state.hasTitle && /^h[1-3]$/u.test(tag)) {
    state.hasTitle = true;
    state.slots['title'] = { kind: 'text', max: 90, required: true };
    return 'title';
  }
  if (!state.hasLead && tag === 'p') {
    state.hasLead = true;
    state.slots['lead'] = { kind: 'text', max: 260 };
    return 'lead';
  }
  const name = nextName(state, 'text');
  state.slots[name] = { kind: 'text', max: 200 };
  return name;
}

function svgMarkup(state: DraftState, node: DraftElement): string {
  const path = findTag(node, 'path');
  const known = heroiconToLucide(path?.attributes['d'] ?? '');
  const size = /\bsize-(\d+)\b/u.exec(node.attributes['class'] ?? '');
  const sizeAttribute = size === null ? '' : ` size='${String(Number(size[1]) * 4)}'`;
  const flip = (node.attributes['class'] ?? '').includes('rtl:-scale-x-100') ? ` class='ck-flip'` : '';
  if (known !== undefined) return `<icon name='${known}'${flip}${sizeAttribute}/>`;
  const slot = nextName(state, 'icon');
  state.slots[slot] = { kind: 'icon' };
  state.notes.push(`${slot}: an svg with no Lucide match (a brand mark or an unknown heroicon) became an icon slot.`);
  return `<icon name='{{${slot}}}'${flip}${sizeAttribute}/>`;
}

function elementMarkup(state: DraftState, node: DraftElement, parentTag: string): string {
  if (DROPPED.has(node.tag)) return '';
  if (node.tag === 'form') {
    state.notes.push("form → <ck-component type='formSection'>: fill its props (fields, submitLabel) by hand.");
    return `<ck-component type='formSection' props='{}'/>`;
  }
  if (FORM_PARTS.has(node.tag)) return '';
  if (node.tag === 'svg') return svgMarkup(state, node);

  const alpine = Object.keys(node.attributes).filter((name) => ALPINE.test(name));
  let tag = node.tag;
  if (node.attributes['x-data'] !== undefined) {
    tag = 'details';
    state.notes.push('Alpine x-data → details: check the disclosure reads right.');
  } else if (
    parentTag === 'details' &&
    (tag === 'button' || alpine.some((name) => name === '@click' || name === 'x-on:click'))
  ) {
    tag = 'summary';
  }

  let attributes = '';
  const className = node.attributes['class'];
  if (className !== undefined) {
    const converted = toKitColourClasses(toLogicalClasses(className), tag);
    if (converted !== '') attributes += ` class='${escapeAttribute(converted)}'`;
  }
  for (const [name, value] of Object.entries(node.attributes)) {
    if (KEPT_ATTRIBUTES.has(name)) attributes += ` ${name}='${escapeAttribute(value)}'`;
  }
  if (tag === 'a') {
    const slot = nextName(state, 'link');
    state.slots[slot] = { kind: 'link' };
    const inner = node.children.filter((child): child is DraftElement => typeof child !== 'string');
    return `<a${attributes} href='{{${slot}.href}}'>{{${slot}.label}}${inner.map((child) => elementMarkup(state, child, 'a')).join('')}</a>`;
  }
  if (tag === 'img') {
    const slot = nextName(state, 'image');
    state.slots[slot] = { kind: 'image', required: true };
    return `<img${attributes} src='{{${slot}.src}}' alt='{{${slot}.alt}}'/>`;
  }
  if (VOID.has(tag)) return `<${tag}${attributes}/>`;
  let text = '';
  const parts: string[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') {
      if (child.trim() === '') continue;
      if (text === '' && parts.length === 0) text = `{{${textSlot(state, tag)}}}`;
      else parts.push(`<span>{{${textSlot(state, 'span')}}}</span>`);
      continue;
    }
    parts.push(elementMarkup(state, child, tag));
  }
  return `<${tag}${attributes}>${text}${parts.join('')}</${tag}>`;
}

/**
 * An upstream HTML example as a draft kit: its first body element (the
 * section) converted per the rules above, with every text, image and link a
 * slot. `notes` lists what needs a person's eye.
 */
export function convertUpstreamHtml(html: string): DraftKit {
  const document = parseHtml(html);
  const body = findTag(document, 'body') ?? document;
  const state: DraftState = { slots: {}, notes: [], counts: new Map(), hasTitle: false, hasLead: false };
  const markup = body.children
    .filter((child): child is DraftElement => typeof child !== 'string')
    .map((child) => elementMarkup(state, child, 'body'))
    .join('');
  return { markup, slots: state.slots, notes: state.notes };
}
