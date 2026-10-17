import type { SectionKit, SectionKitSlot } from './types';

/*
  Test-only (not exported from the barrel): a deterministic model of CSS
  layout at ONE phone width, so every kit can be rendered at 320, 360 and
  390px in a node test and asked "does anything stick out sideways?".

  Why a model and not a browser: the kit suite runs in node on every change;
  a real layout needs Chromium plus the compiled vocabulary CSS. The model
  answers the question the final test asked of the published page (the
  English SaaS page was 404px wide at 390, 2026-10-06: two large numbers side
  by side) and is pinned against that very markup in kits.fit.test.ts.

  What it models — only what decides a sideways overflow:
  - base utilities only: every `sm:` and up starts at 640px, above any phone;
  - padding, borders, fixed widths (`w-28`, `size-12`, `w-4/5`), `max-w-*`;
  - block flow (a box takes its container's width), grids (`grid-cols-N` is
    `minmax(0,1fr)` tracks; a grid without base columns has ONE auto track
    that grows to its items' min-content), flex rows (nowrap: the items'
    minimums add up; wrap: each must fit alone), flex columns (stretch, or
    shrink-to-fit under `items-*`), inline-flex/inline-block shrink-to-fit;
  - text: the widest unbreakable run at the element's font size, in per-
    character em widths (Latin, digits, Arabic letters and digits), bolder
    for semibold and up. `whitespace-nowrap` makes the whole line one run;
    `break-words` lets a run break in a box of definite width but — as in
    CSS — does NOT lower an item's min-content, so inside a flex row or an
    auto grid track only `min-w-0` (or a non-visible overflow) lets it;
  - scroll containers (`overflow-x-auto`) and `truncate` contain their own
    content; `popover` sheets are laid against the viewport.
  - the page kit's classes at phone width (skeleton-from-plan PHONE_KIT):
    `ck-btn` is an inline-flex with 1.5rem side padding whose label WRAPS
    below 40rem, and `ck-card` has a 1px border.
*/

export interface FitProblem {
  /** Where: `section>div>dl>div>dd`. */
  readonly at: string;
  /** What needs the room (`text "1,250,000+"`, `fixed width`, `flex row`). */
  readonly what: string;
  readonly need: number;
  readonly room: number;
}

export interface FitOptions {
  /** The viewport width in CSS px. */
  readonly width: number;
  /** `en` uppercases the English eyebrow and spaces it 0.08em (the page kit's rule). */
  readonly lang?: string;
}

type TreeNode = Readonly<Record<string, unknown>>;

interface TextStyle {
  readonly font: number;
  readonly bold: boolean;
  /** The page's display face (`ck-display`, region h1/h2): faces run wider than system sans. */
  readonly display: boolean;
  readonly upper: boolean;
  readonly spacing: number;
  readonly wrap: 'normal' | 'break' | 'anywhere' | 'nowrap';
}

const FONT: Readonly<Record<string, number>> = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36,
  '5xl': 48, '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128,
};

const MAX_W: Readonly<Record<string, number>> = {
  xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, '3xl': 768, '4xl': 896,
  '5xl': 1024, '6xl': 1152, '7xl': 1280, prose: 65 * 9,
};

const INLINE_TAGS = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'small', 'label', 'abbr', 'code', 'time', 'img', 'mark', 'sup', 'sub']);

/** One character's advance in em, by class of glyph (system sans, roughly Inter/Arial/Noto). */
function charEm(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if ((code >= 0x64b && code <= 0x65f) || code === 0x670) return 0; // harakat
  if ((code >= 0x660 && code <= 0x669) || (code >= 0x6f0 && code <= 0x6f9)) return 0.55;
  if ((code >= 0x600 && code <= 0x6ff) || (code >= 0x750 && code <= 0x77f) || (code >= 0xfb50 && code <= 0xfeff)) return 0.5;
  if (/[0-9]/u.test(ch)) return 0.66;
  if ('mw'.includes(ch)) return 0.85;
  if ('MW@%'.includes(ch)) return 0.95;
  if ('ijltfrI'.includes(ch)) return 0.32;
  if (".,:;'!|()[]".includes(ch)) return 0.3;
  if (ch === '-') return 0.38;
  if (ch === ' ') return 0.28;
  if (/[A-Z]/u.test(ch)) return 0.7;
  if (/[a-z]/u.test(ch)) return 0.56;
  return 0.62;
}

function runWidth(run: string, style: TextStyle): number {
  const text = style.upper ? run.toUpperCase() : run;
  let em = 0;
  for (const ch of text) em += charEm(ch) + (ch === ' ' ? 0 : style.spacing);
  return em * style.font * (style.bold ? 1.08 : 1) * (style.display ? 1.06 : 1);
}

/** Break opportunities: spaces, and after a hyphen. */
function runs(text: string): string[] {
  return text.split(/\s+|(?<=-)/u).filter((run) => run !== '');
}

/** The narrowest a text can be laid in a box of definite width. */
function textHardMin(text: string, style: TextStyle): number {
  if (text.trim() === '') return 0;
  if (style.wrap === 'nowrap') return runWidth(text.trim().replace(/\s+/gu, ' '), style);
  if (style.wrap !== 'normal') return style.font * 0.7;
  return Math.max(0, ...runs(text).map((run) => runWidth(run, style)));
}

/** CSS min-content of a text: `break-words` does not lower it, `anywhere` does. */
function textIntrinsicMin(text: string, style: TextStyle): number {
  return textHardMin(text, style.wrap === 'break' ? { ...style, wrap: 'normal' } : style);
}

function textMax(text: string, style: TextStyle): number {
  return text.trim() === '' ? 0 : runWidth(text.trim().replace(/\s+/gu, ' '), style);
}

// ── Classes ───────────────────────────────────────────────────────────────────

function baseClasses(node: TreeNode): string[] {
  const value = node['className'];
  return typeof value === 'string' ? value.split(/\s+/u).filter((name) => name !== '' && !name.includes(':')) : [];
}

function spacing(value: string): number | undefined {
  if (value === 'px') return 1;
  return /^\d+(?:\.\d+)?$/u.test(value) ? Number(value) * 4 : undefined;
}

function fraction(value: string): number | undefined {
  const match = /^(\d+)\/(\d+)$/u.exec(value);
  return match === null ? undefined : Number(match[1]) / Number(match[2]);
}

interface Box {
  readonly display: 'none' | 'block' | 'inline' | 'inline-box' | 'flex' | 'grid' | 'table';
  readonly column: boolean;
  readonly wrap: boolean;
  readonly align: 'stretch' | 'other';
  readonly padStart: number;
  readonly padEnd: number;
  readonly border: number;
  readonly gapX: number;
  readonly cols: number | undefined;
  readonly span: number | 'full' | undefined;
  readonly fixed: ((room: number, viewport: number) => number) | undefined;
  readonly maxW: ((room: number) => number) | undefined;
  readonly minW: number;
  readonly minZero: boolean;
  readonly shrink0: boolean;
  readonly scroll: boolean;
  readonly clip: boolean;
  readonly truncate: boolean;
  readonly outOfFlow: boolean;
  readonly srOnly: boolean;
}

function boxOf(node: TreeNode, classes: readonly string[]): Box {
  const tag = typeof node['tag'] === 'string' ? node['tag'] : 'div';
  let display: Box['display'] = tag === 'table' ? 'table' : INLINE_TAGS.has(tag) ? 'inline' : 'block';
  let column = false;
  let wrap = false;
  let align: Box['align'] = 'stretch';
  let padStart = 0;
  let padEnd = 0;
  let border = 0;
  let gapX = 0;
  let cols: number | undefined;
  let span: Box['span'];
  let fixed: Box['fixed'];
  let maxW: Box['maxW'];
  let minW = 0;
  let minZero = false;
  let shrink0 = false;
  let scroll = false;
  let clip = false;
  let truncate = false;
  let outOfFlow = false;
  let srOnly = false;
  let padAll: number | undefined;
  let padX: number | undefined;
  let padS: number | undefined;
  let padE: number | undefined;
  for (const name of classes) {
    if (name === 'ck-btn') {
      display = 'inline-box';
      padX ??= 24;
    } else if (name === 'ck-card') border = 2;
    else if (name === 'hidden') display = 'none';
    else if (name === 'block' || name === 'inline-block') display = name === 'block' ? 'block' : 'inline-box';
    else if (name === 'inline') display = 'inline';
    else if (name === 'flex' || name === 'inline-flex') display = 'flex';
    else if (name === 'grid' || name === 'inline-grid') display = 'grid';
    else if (name === 'contents') display = 'inline';
    else if (name === 'flex-col' || name === 'flex-col-reverse') column = true;
    else if (name === 'flex-row' || name === 'flex-row-reverse') column = false;
    else if (name === 'flex-wrap' || name === 'flex-wrap-reverse') wrap = true;
    else if (name === 'flex-nowrap') wrap = false;
    else if (/^items-(?:start|center|end|baseline)$/u.test(name)) align = 'other';
    else if (name === 'items-stretch') align = 'stretch';
    else if (name === 'absolute' || name === 'fixed') outOfFlow = true;
    else if (name === 'sr-only') srOnly = true;
    else if (name === 'truncate') truncate = true;
    else if (/^overflow(?:-x)?-(?:auto|scroll)$/u.test(name)) scroll = true;
    else if (/^overflow(?:-x)?-(?:hidden|clip)$/u.test(name)) clip = true;
    else if (name === 'min-w-0') minZero = true;
    else if (name === 'shrink-0') shrink0 = true;
    else if (name === 'grid-cols-none') cols = undefined;
    else if (name === 'col-span-full') span = 'full';
    else if (name === 'border' || name === 'border-x') border = 2;
    else if (/^border-(?:x-)?(\d)$/u.test(name)) border = 2 * Number(/(\d)$/u.exec(name)?.[1] ?? 0);
    else if (/^border-[se](?:-\d)?$/u.test(name)) border += Number(/-(\d)$/u.exec(name)?.[1] ?? 1);
    else {
      const match = /^(gap-x|gap|grid-cols|col-span|min-w|max-w|px|ps|pe|p|w|size)-(.+)$/u.exec(name);
      if (match === null) continue;
      const [, prop = '', raw = ''] = match;
      const step = spacing(raw);
      if (prop === 'p') padAll = step;
      else if (prop === 'px') padX = step;
      else if (prop === 'ps') padS = step;
      else if (prop === 'pe') padE = step;
      else if ((prop === 'gap' || prop === 'gap-x') && step !== undefined) gapX = step;
      else if (prop === 'grid-cols' && /^\d+$/u.test(raw)) cols = Number(raw);
      else if (prop === 'col-span' && /^\d+$/u.test(raw)) span = Number(raw);
      else if (prop === 'min-w' && step !== undefined) minW = step;
      else if (prop === 'w' || prop === 'size') {
        const part = fraction(raw);
        if (step !== undefined) fixed = () => step;
        else if (part !== undefined) fixed = (room) => room * part;
        else if (raw === 'full') fixed = (room) => room;
        else if (raw === 'screen' || raw === 'dvw' || raw === 'svw') fixed = (_room, viewport) => viewport;
      } else if (prop === 'max-w') {
        if (raw === 'full' || raw === 'screen') maxW = (room) => room;
        else if (raw === 'none') maxW = undefined;
        else {
          const width = MAX_W[raw] ?? spacing(raw);
          if (width !== undefined) maxW = () => width;
        }
      }
    }
  }
  const sides = padAll ?? 0;
  padStart = padS ?? padX ?? sides;
  padEnd = padE ?? padX ?? sides;
  return {
    display, column, wrap, align, padStart, padEnd, border, gapX, cols, span, fixed, maxW, minW,
    minZero, shrink0, scroll, clip, truncate, outOfFlow, srOnly,
  };
}

function styleOf(classes: readonly string[], parent: TextStyle, options: FitOptions, tag: string): TextStyle {
  let { font, bold, display, upper, spacing: letter, wrap } = parent;
  if (/^h[1-6]$/u.test(tag) || tag === 'th' || tag === 'summary') bold = true;
  if (tag === 'h1' || tag === 'h2') display = true;
  for (const name of classes) {
    const size = /^text-(.+)$/u.exec(name)?.[1];
    if (size !== undefined && FONT[size] !== undefined) font = FONT[size];
    else if (/^font-(?:semibold|bold|extrabold|black)$/u.test(name) || name === 'ck-btn') bold = true;
    else if (/^font-(?:light|normal|medium)$/u.test(name)) bold = false;
    else if (name === 'ck-display') display = true;
    else if (name === 'ck-body') display = false;
    else if (name === 'uppercase') upper = true;
    else if (name === 'normal-case') upper = false;
    else if (name === 'whitespace-nowrap' || name === 'truncate') wrap = 'nowrap';
    else if (name === 'whitespace-normal') wrap = parent.wrap === 'nowrap' ? 'normal' : parent.wrap;
    else if (name === 'break-words') wrap = 'break';
    else if (name === 'break-all') wrap = 'anywhere';
    else if (name === 'ck-eyebrow') {
      font = (options.lang ?? 'en').startsWith('ar') ? 14 : 13;
      bold = true;
      if (!(options.lang ?? 'en').startsWith('ar')) {
        upper = true;
        letter = 0.08;
      }
    }
  }
  return { font, bold, display, upper, spacing: letter, wrap };
}

// ── The walk ──────────────────────────────────────────────────────────────────

function children(node: TreeNode): TreeNode[] {
  const value = node['children'];
  return Array.isArray(value) ? (value as TreeNode[]) : [];
}

function ownText(node: TreeNode): string {
  return typeof node['text'] === 'string' ? node['text'] : '';
}

function iconSize(node: TreeNode): number {
  return typeof node['size'] === 'number' ? node['size'] : 24;
}

function label(node: TreeNode): string {
  if (node['kind'] === 'icon') return 'icon';
  const tag = typeof node['tag'] === 'string' ? node['tag'] : node['kind'] === 'component' ? 'component' : '?';
  const first = baseClasses(node).find((name) => name.startsWith('ck-') && name !== 'ck-border');
  return first === undefined ? tag : `${tag}.${first}`;
}

function isPopover(node: TreeNode): boolean {
  const attributes = node['attributes'];
  return typeof attributes === 'object' && attributes !== null && 'popover' in attributes;
}

/** Whether a node takes room in its parent's flow (a popover sheet, an absolute layer, a hidden box do not). */
function inFlow(node: TreeNode): boolean {
  if (node['kind'] === 'icon') return true;
  if (node['kind'] !== 'element') return false;
  const box = boxOf(node, baseClasses(node));
  return box.display !== 'none' && !box.outOfFlow && !box.srOnly && !isPopover(node);
}

const ROOT_STYLE: TextStyle = { font: 16, bold: false, display: false, upper: false, spacing: 0, wrap: 'normal' };

interface Walk {
  readonly options: FitOptions;
  readonly problems: FitProblem[];
}

function report(walk: Walk, at: string, what: string, need: number, room: number): void {
  // Half a pixel of slack: sub-pixel rounding is not a sideways scroll.
  if (need > room + 0.5) walk.problems.push({ at, what, need: Math.round(need), room: Math.round(room) });
}

/** min-content of a node as a flex or grid ITEM: 0 when `min-w-0` or a non-visible overflow lets it shrink. */
function itemMin(node: TreeNode, style: TextStyle, walk: Walk): number {
  if (node['kind'] === 'icon') return iconSize(node);
  if (node['kind'] !== 'element') return 0;
  const classes = baseClasses(node);
  const box = boxOf(node, classes);
  if (!inFlow(node)) return 0;
  if (box.shrink0) return maxContent(node, style, walk);
  if (box.minZero || box.scroll || box.clip || box.truncate) return box.minW;
  return intrinsicMin(node, style, walk);
}

/** CSS min-content contribution of a node. */
function intrinsicMin(node: TreeNode, parent: TextStyle, walk: Walk): number {
  if (node['kind'] === 'icon') return iconSize(node);
  if (node['kind'] === 'component') return Math.max(0, ...children(node).map((child) => intrinsicMin(child, parent, walk)));
  if (node['kind'] !== 'element') return 0;
  const classes = baseClasses(node);
  const box = boxOf(node, classes);
  if (box.display === 'none' || box.outOfFlow || box.srOnly) return 0;
  const tag = typeof node['tag'] === 'string' ? node['tag'] : 'div';
  const style = styleOf(classes, parent, walk.options, tag);
  const fixed = box.fixed?.(Number.POSITIVE_INFINITY, walk.options.width);
  if (fixed !== undefined && Number.isFinite(fixed)) return Math.max(fixed, box.minW);
  if (tag === 'img') return box.minW;
  const kids = children(node);
  const text = textIntrinsicMin(ownText(node), style);
  let inner: number;
  if (box.display === 'flex' && !box.column) {
    const items = [...(ownText(node).trim() === '' ? [] : [text]), ...kids.map((child) => itemMin(child, style, walk))];
    const count = kids.filter(inFlow).length + (ownText(node).trim() === '' ? 0 : 1);
    inner = box.wrap
      ? Math.max(0, ...items)
      : items.reduce((sum, width) => sum + width, 0) + box.gapX * Math.max(0, count - 1);
  } else if (box.display === 'grid' && box.cols !== undefined) {
    inner = box.gapX * (box.cols - 1);
  } else if (box.display === 'grid') {
    inner = Math.max(text, ...kids.map((child) => itemMin(child, style, walk)));
  } else {
    inner = Math.max(text, ...kids.map((child) => intrinsicMin(child, style, walk)));
  }
  return Math.max(box.minW, inner + box.padStart + box.padEnd + box.border);
}

/** max-content of a node (a `shrink-0` item takes it). */
function maxContent(node: TreeNode, parent: TextStyle, walk: Walk): number {
  if (node['kind'] === 'icon') return iconSize(node);
  if (node['kind'] !== 'element') return 0;
  const classes = baseClasses(node);
  const box = boxOf(node, classes);
  if (box.display === 'none' || box.outOfFlow || box.srOnly) return 0;
  const fixed = box.fixed?.(Number.POSITIVE_INFINITY, walk.options.width);
  if (fixed !== undefined && Number.isFinite(fixed)) return fixed;
  const tag = typeof node['tag'] === 'string' ? node['tag'] : 'div';
  const style = styleOf(classes, parent, walk.options, tag);
  const kids = children(node).map((child) => maxContent(child, style, walk));
  const text = textMax(ownText(node), style);
  const inline = box.display === 'inline' || box.display === 'inline-box' || (box.display === 'flex' && !box.column);
  const inner = inline
    ? text + kids.reduce((sum, width) => sum + width, 0) + box.gapX * Math.max(0, kids.length - (text > 0 ? 0 : 1))
    : Math.max(text, ...kids);
  return inner + box.padStart + box.padEnd + box.border;
}

/**
 * Lay `node` in `room` px (the containing block's content width) and report
 * what sticks out. `item`: the node is a flex or grid item, which CSS
 * blockifies (an `<a>` in a flex row is a box, not a line of text).
 */
function fit(node: TreeNode, room: number, parent: TextStyle, at: string, walk: Walk, item = false): void {
  const here = at === '' ? label(node) : `${at}>${label(node)}`;
  if (node['kind'] === 'icon') {
    report(walk, here, 'icon', iconSize(node), room);
    return;
  }
  if (node['kind'] === 'component') {
    for (const child of children(node)) fit(child, room, parent, here, walk);
    return;
  }
  if (node['kind'] !== 'element') return;
  const classes = baseClasses(node);
  const declared = boxOf(node, classes);
  const box: Box = item && declared.display === 'inline' ? { ...declared, display: 'block' } : declared;
  if (box.display === 'none' || box.srOnly) return;
  // A popover sheet sits in the top layer, laid against the viewport.
  const available = isPopover(node) ? walk.options.width : room;
  const tag = typeof node['tag'] === 'string' ? node['tag'] : 'div';
  const style = styleOf(classes, parent, walk.options, tag);
  const kids = children(node);

  if (box.display === 'inline') {
    if (tag === 'img') return;
    report(walk, here, `text ${JSON.stringify(ownText(node).slice(0, 40))}`, textHardMin(ownText(node), style), available);
    for (const child of kids) fit(child, available, style, here, walk);
    return;
  }

  let width = available;
  const fixed = box.fixed?.(available, walk.options.width);
  if (fixed !== undefined) width = fixed;
  if (box.maxW !== undefined) width = Math.min(width, box.maxW(available));
  width = Math.max(width, box.minW);
  if (fixed !== undefined || box.minW > 0) report(walk, here, 'fixed width', width, available);
  if (box.display === 'inline-box') {
    // Shrink-to-fit: never narrower than its min-content.
    report(walk, here, 'inline box', intrinsicMin(node, parent, walk), available);
  }
  if (tag === 'img' || box.scroll || box.display === 'table') return;
  const content = Math.max(0, width - box.padStart - box.padEnd - box.border);
  if (!box.truncate) {
    report(walk, here, `text ${JSON.stringify(ownText(node).slice(0, 40))}`, textHardMin(ownText(node), style), content);
  }

  if (box.display === 'grid' && box.cols !== undefined) {
    const cols = box.cols;
    const track = (content - box.gapX * (cols - 1)) / cols;
    kids.forEach((child, index) => {
      const childBox = child['kind'] === 'element' ? boxOf(child, baseClasses(child)) : undefined;
      const span = childBox?.span === 'full' ? cols : Math.min(cols, childBox?.span ?? 1);
      fit(child, track * span + box.gapX * (span - 1), style, `${here}[${String(index)}]`, walk, true);
    });
    return;
  }
  if (box.display === 'grid') {
    kids.forEach((child, index) => {
      report(walk, `${here}[${String(index)}]`, 'auto grid track (min-content)', itemMin(child, style, walk), content);
      fit(child, content, style, `${here}[${String(index)}]`, walk, true);
    });
    return;
  }
  if (box.display === 'flex' && box.column) {
    kids.forEach((child, index) => {
      if (box.align === 'other') report(walk, `${here}[${String(index)}]`, 'flex column item (fit-content)', intrinsicMin(child, style, walk), content);
      fit(child, content, style, `${here}[${String(index)}]`, walk, true);
    });
    return;
  }
  if (box.display === 'flex') {
    const textItem = ownText(node).trim() === '' ? [] : [textIntrinsicMin(ownText(node), style)];
    const mins = kids.map((child) => itemMin(child, style, walk));
    const all = [...textItem, ...mins];
    const count = kids.filter(inFlow).length + textItem.length;
    const gaps = box.gapX * Math.max(0, count - 1);
    if (box.wrap) {
      all.forEach((need, index) => {
        report(walk, `${here}[${String(index)}]`, 'flex item', need, content);
      });
    } else {
      report(walk, here, 'flex row', all.reduce((sum, need) => sum + need, 0) + gaps, content);
    }
    const total = all.reduce((sum, need) => sum + need, 0);
    kids.forEach((child, index) => {
      const own = mins[index] ?? 0;
      const share = box.wrap ? content : Math.max(own, content - (total - own) - gaps);
      fit(child, share, style, `${here}[${String(index)}]`, walk, true);
    });
    return;
  }
  // Block flow: inline boxes shrink to fit, blocks take the width.
  kids.forEach((child, index) => {
    fit(child, content, style, `${here}[${String(index)}]`, walk);
  });
}

/** Everything in a kit tree that would stick out of a `width`-px phone screen (empty when it all fits). */
export function phoneFitProblems(tree: unknown, options: FitOptions): FitProblem[] {
  const walk: Walk = { options, problems: [] };
  const root = (typeof tree === 'object' && tree !== null ? tree : {}) as TreeNode;
  for (const child of children(root)) fit(child, options.width, ROOT_STYLE, '', walk);
  return walk.problems;
}

// ── Worst-case slots ──────────────────────────────────────────────────────────

/*
  The longest content a slot may honestly hold: long words (a 14-letter word
  in English and Arabic), stats and prices at their full width, an email
  where a contact item links somewhere. Filled to each slot's own limit, so a
  kit that fits these fits what a writer can put in it.
*/
const LONG_WORD = { en: 'Infrastructure', ar: 'والاستراتيجيات' } as const;
const NAMED: Readonly<Record<string, { readonly en: string; readonly ar: string }>> = {
  value: { en: '1,250,000+', ar: '+١٬٢٥٠٬٠٠٠' },
  price: { en: '$12,999.99', ar: '١٢٬٩٩٩٫٩٩ د.أ' },
  period: { en: '/month', ar: '/شهرياً' },
  step: { en: 'Step 01', ar: 'الخطوة ٠١' },
  initials: { en: 'RK', ar: 'ر خ' },
  day: { en: 'Wednesday', ar: 'الأربعاء' },
  time: { en: '10:00 AM – 11:00 PM', ar: '١٠:٠٠ ص – ١١:٠٠ م' },
};
const EMAIL = 'reservations@yasmeen-restaurant.com';

function filled(word: string, max: number): string {
  if (max <= word.length) return word.slice(0, max);
  const words: string[] = [];
  while ((words.length + 1) * (word.length + 1) - 1 <= max) words.push(word);
  return words.join(' ');
}

function worstSlot(slot: SectionKitSlot, name: string, lang: 'ar' | 'en', siblings: readonly string[], seed: number): unknown {
  const max = slot.max ?? 200;
  switch (slot.kind) {
    case 'text': {
      if (name === 'href') return `#section-${String(seed)}`;
      const named = NAMED[name];
      if (named !== undefined) return named[lang].slice(0, max);
      if (name === 'text' && siblings.includes('href')) return EMAIL.slice(0, max);
      return filled(LONG_WORD[lang], max);
    }
    case 'icon':
      return 'star';
    case 'link':
      return { label: filled(LONG_WORD[lang], 60), href: `#s-${String(seed)}` };
    case 'image':
      return {
        src: `https://images.unsplash.com/photo-${String(1_500_000_000_000 + seed)}?w=1200`,
        alt: filled(LONG_WORD[lang], 60),
      };
    case 'list': {
      const count = Math.min(max, 4);
      return Array.from({ length: count }, (_unused, index) => worstSlotsOf(slot.item ?? {}, lang, seed * 10 + index + 1));
    }
  }
}

function worstSlotsOf(slots: Readonly<Record<string, SectionKitSlot>>, lang: 'ar' | 'en', seed: number): Record<string, unknown> {
  const names = Object.keys(slots);
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot], index) => [name, worstSlot(slot, name, lang, names, seed * 7 + index)]),
  );
}

/** Every slot of a kit (optional ones too) at its widest honest content. */
export function worstCaseSlots(kit: SectionKit, lang: 'ar' | 'en'): Record<string, unknown> {
  return worstSlotsOf(kit.slots, lang, 1);
}
