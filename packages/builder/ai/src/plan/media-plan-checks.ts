import type { BuilderKernel } from '@craftkit/builder-core';

import type { AiPlan, AiPlanValidationIssue } from '../types';

/*
  media-motion fix pass (2026-10-06): two things a model wrote that the door
  took and the published page paid for.

  1. «أضف حركة GSAP عند التمرير لقسم المميزات» reached the model, which wrote
     pageCss `.ck-feature-item{opacity:0;transform:translateY(20px)}` and no
     reveal at all: the section was blank below its heading on the published
     page. CSS that hides content is refused unless something brings it back
     (an animation on the class, a state rule that shows it, or a
     data-ck-motion / data-ck-timeline element the class sits in).
  2. «حط فيديو تعريفي من يوتيوب» (no link) came back as a raw YouTube iframe
     with a made-up id. A NEW YouTube/Vimeo iframe is refused with the tool
     that draws the light facade; an iframe the page already has stays.
*/

interface TreeElement {
  readonly kind?: unknown;
  readonly tag?: unknown;
  readonly className?: unknown;
  readonly text?: unknown;
  readonly attributes?: unknown;
  readonly children?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every `{kind:'root'}` tree in a value, wherever it sits (bounded). */
function treesIn(value: unknown): readonly Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const stack: unknown[] = [value];
  for (let visited = 0; stack.length > 0 && visited < 10_000; visited += 1) {
    const next = stack.pop();
    if (Array.isArray(next)) {
      stack.push(...(next as unknown[]));
      continue;
    }
    if (!isRecord(next)) continue;
    if (next['kind'] === 'root' && Array.isArray(next['children'])) {
      found.push(next);
      continue;
    }
    stack.push(...Object.values(next));
  }
  return found;
}

function childrenOf(node: TreeElement): readonly TreeElement[] {
  return Array.isArray(node.children) ? (node.children as unknown[]).filter(isRecord) : [];
}

function attributesOf(node: TreeElement): Readonly<Record<string, unknown>> {
  return isRecord(node.attributes) ? node.attributes : {};
}

/** Every element of a tree with whether it or an ancestor carries a motion marker. */
function* elementsOf(
  tree: Record<string, unknown>,
): Generator<{ readonly node: TreeElement; readonly moving: boolean }> {
  const stack: { node: TreeElement; moving: boolean }[] = childrenOf(tree).map((node) => ({
    node,
    moving: false,
  }));
  for (let visited = 0; stack.length > 0 && visited < 20_000; visited += 1) {
    const next = stack.pop();
    if (next === undefined) break;
    const attributes = attributesOf(next.node);
    const moving =
      next.moving ||
      MOTION_MARKERS.some((name) => typeof attributes[name] === 'string');
    yield { node: next.node, moving };
    for (const child of childrenOf(next.node)) stack.push({ node: child, moving });
  }
}

/** Attributes that animate an element (or its children) into view. */
const MOTION_MARKERS = [
  'data-ck-motion',
  'data-ck-timeline',
  'data-ck-stagger',
  'data-ck-behavior',
] as const;

const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'svg', 'audio', 'iframe']);

/** Whether an element shows anything a reader would miss: text, an image, an icon. */
function carriesContent(node: TreeElement): boolean {
  const stack: TreeElement[] = [node];
  for (let visited = 0; stack.length > 0 && visited < 2_000; visited += 1) {
    const next = stack.pop();
    if (next === undefined) break;
    if (typeof next.text === 'string' && next.text.trim() !== '') return true;
    if (next.kind === 'icon' || next.kind === 'component') return true;
    if (typeof next.tag === 'string' && MEDIA_TAGS.has(next.tag)) return true;
    stack.push(...childrenOf(next));
  }
  return false;
}

function hasClass(node: TreeElement, name: string): boolean {
  return typeof node.className === 'string' && node.className.split(/\s+/u).includes(name);
}

// ── CSS ─────────────────────────────────────────────────────────────────────

interface CssRule {
  readonly selector: string;
  readonly body: string;
  /** The at-rule preludes around it, outermost first. */
  readonly within: readonly string[];
}

/** The leaf rules of a sheet, comments dropped. Tolerant: an unbalanced sheet yields what it can. */
function cssRules(css: string): readonly CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const rules: CssRule[] = [];
  const stack: { prelude: string; nested: boolean }[] = [];
  let buffer = '';
  for (const char of source) {
    if (char === '{') {
      const parent = stack.at(-1);
      if (parent !== undefined) parent.nested = true;
      stack.push({ prelude: (buffer.split(';').pop() ?? '').trim(), nested: false });
      buffer = '';
    } else if (char === '}') {
      const top = stack.pop();
      if (top !== undefined && !top.nested) {
        rules.push({ selector: top.prelude, body: buffer, within: stack.map(({ prelude }) => prelude) });
      }
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return rules;
}

const HIDES =
  /(?:^|[;\s])(?:opacity\s*:\s*(?:0+(?:\.0*)?|\.0+)%?\s*(?:!important\s*)?(?:;|$)|visibility\s*:\s*hidden)/iu;
const SHOWS =
  /(?:^|[;\s])(?:opacity\s*:\s*(?:0*\.?0*[1-9][\d.]*%?|1)|visibility\s*:\s*visible)/iu;
const ANIMATES = /(?:^|[;\s])animation(?:-name)?\s*:\s*(?!none\b)[^;]+/iu;

function inKeyframes(rule: CssRule): boolean {
  return rule.within.some((prelude) => /^@(?:-\w+-)?keyframes\b/iu.test(prelude));
}

function mentions(selector: string, name: string): boolean {
  return new RegExp(`\\.${name.replace(/[\\^$*+?.()|[\]{}]/gu, '\\$&')}(?![\\w-])`, 'u').test(selector);
}

/** The classes a selector part HIDES in its resting state: its last compound, with no state. */
function restingClasses(part: string): readonly string[] {
  const last = part.trim().split(/\s*[\s>+~]\s*/u).at(-1) ?? '';
  if (last === '' || /[:[]/u.test(last)) return [];
  return [...last.matchAll(/\.(-?[_a-zA-Z][\w-]*)/gu)].map((match) => match[1] ?? '');
}

export interface HiddenContentFinding {
  readonly selector: string;
  readonly className: string;
}

/**
 * The first rule of `css` that hides a content class nothing reveals, or
 * undefined. `trees` are every customCode tree the page will hold (the
 * document's and the plan's): a class only decorative elements carry, or one
 * that sits in a motion-marked element, is fine.
 */
export function hiddenContentRule(
  css: string,
  trees: readonly Record<string, unknown>[],
): HiddenContentFinding | undefined {
  const rules = cssRules(css).filter((rule) => !inKeyframes(rule));
  for (const rule of rules) {
    if (!HIDES.test(rule.body)) continue;
    for (const part of rule.selector.split(',')) {
      for (const name of restingClasses(part)) {
        const revealed = rules.some(
          (other) =>
            mentions(other.selector, name) &&
            (ANIMATES.test(other.body) || (/[:[]/u.test(other.selector) && SHOWS.test(other.body))),
        );
        if (revealed) continue;
        let seen = false;
        let content = false;
        let moving = false;
        for (const tree of trees) {
          for (const { node, moving: marked } of elementsOf(tree)) {
            if (!hasClass(node, name)) continue;
            seen = true;
            if (marked) moving = true;
            if (carriesContent(node)) content = true;
          }
        }
        if (moving || (seen && !content)) continue;
        return { selector: part.trim(), className: name };
      }
    }
  }
  return undefined;
}

// ── Embeds ──────────────────────────────────────────────────────────────────

const VIDEO_EMBED = /^https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/iu;

function videoIframeSources(tree: Record<string, unknown>): readonly string[] {
  const found: string[] = [];
  for (const { node } of elementsOf(tree)) {
    if (node.tag !== 'iframe') continue;
    const src = attributesOf(node)['src'];
    if (typeof src === 'string' && VIDEO_EMBED.test(src)) found.push(src);
  }
  return found;
}

/** Every customCode tree the document holds now. */
export function documentTrees(kernel: BuilderKernel): readonly Record<string, unknown>[] {
  return Object.values(kernel.getDocument().nodes).flatMap((node) => treesIn(node.props));
}

/**
 * Refuse what the published page would pay for: a new raw YouTube/Vimeo
 * iframe (the facade is `media.add`), and css that hides content no reveal
 * brings back. `sheets` are the plan's stylesheets per step (validate-plan's
 * own walk, which knows the registry's css prop names).
 */
export function mediaMotionIssues(
  plan: AiPlan,
  kernel: BuilderKernel,
  sheets: (step: number) => readonly string[],
): readonly AiPlanValidationIssue[] {
  const existing = documentTrees(kernel);
  const known = new Set(existing.flatMap(videoIframeSources));
  const planned = plan.commands.flatMap(({ args }) => treesIn(args));
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    const trees = treesIn(step.args);
    const fresh = trees.flatMap(videoIframeSources).find((src) => !known.has(src));
    if (fresh !== undefined) {
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} writes a raw <iframe> for ${fresh}. A YouTube or Vimeo video is ONE media.add step {"kind":"video","url":"<the person's own link>"}: it draws a light poster that loads the player only when pressed. Without the person's link, change nothing and ask for it in followUp — never invent a video id.`,
        step: index,
      });
      return;
    }
    for (const css of sheets(index)) {
      const hidden = hiddenContentRule(css, [...existing, ...planned]);
      if (hidden === undefined) continue;
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} writes css that hides content nothing reveals: "${hidden.selector}" sets opacity:0 or visibility:hidden on .${hidden.className}, and no animation, state rule or data-ck-motion / data-ck-timeline brings it back, so the published page shows a blank section. A GSAP or scroll reveal is ONE motion.add step {"id":"<region id>","recipe":"stagger-in"} (split-reveal for a heading); otherwise drop the hiding declarations.`,
        step: index,
      });
      return;
    }
  });
  return issues;
}
