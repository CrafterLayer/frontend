import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPathOf,
  blockPartsOf,
  getAtPropPath,
  hasPartInstance,
  isCustomCodeTimelineRecipe, // gsap-pixi additions (2026-10-08)
  partStyleKey,
  partStylesKeyOf,
  planPartStyle,
  planPartValue,
  readPartStyles,
  readStyle,
  type BlockPartDecl,
  type BlockPartKind,
  type CustomCodeNode,
  type JsonValue,
  type Node,
  type PartPlan,
  type PartRef,
  type PartValueSlot,
  type ResolvedStyle,
  type StyleBoxSide,
  type StyleCorner,
  type StylePropertyId,
} from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_EN, type ElementNameWords } from '../../custom-code/element-target';
import { blockDisplayName } from '../../naming/block-display-name';
import { partInstanceName, type PartTarget } from '../../overlay/part-target';
import type { ValueOrigin } from '../../style-manager/controls/ValueSourceDot';
import type {
  ElementBarModel,
  ElementBarModelOptions,
  QuickElementKind,
  QuickValue,
  QuickWriteResult,
} from './element-bar-model';

/*
  ── The quick bar over a registered block's PART (block-parts DESIGN §2.14) ──

  The same `ElementBarModel` the bar already renders for an authored element,
  so every group, popover and control is reused as it is. What differs is the
  door: a part's style is the block's own `partStyles` prop, written by the
  style engine in TOKENS mode through `planPartStyle` (the law a block's
  `className` already keeps), and its values (link address, alt text) are
  bound props written through `planPartValue`. Every write is ONE
  `dispatchGroup` with the planner's label, so it is one Undo.
*/

/** Why a part refuses free attributes: a part's attributes belong to the block. */
export const PART_NO_ATTRIBUTES =
  'Parts have no free attributes · use Link or Alt text, or Convert to editable for free attributes';
/** Why a part refuses an icon edit. */
export const PART_NO_ICON = 'Parts have no icon of their own · replace the image or edit the text';

// gsap-pixi additions (2026-10-08)
/** The attributes a part's Cinematic motion is written as (stored in `partStyles`). */
export const PART_MOTION_ATTRIBUTES: readonly string[] = ['data-ck-timeline', 'data-ck-scrub'];
/** Why a part refuses a CSS animation preset or a hover effect. */
export const PART_NO_CSS_MOTION =
  'Parts take Cinematic motion only · choose a Cinematic motion recipe, or Convert to editable for CSS animation presets and hover effects';

/** A part's Cinematic motion at a scope, as the renderer resolves it (`this` wins over `all`). */
export function partMotion(
  props: Readonly<Record<string, unknown>>,
  stylesKey: string,
  ref: PartRef,
  scope: 'all' | 'this',
): { readonly timeline?: string; readonly scrub?: boolean } {
  const styles = readPartStyles(props, stylesKey);
  const all = styles[partStyleKey(ref, 'all')];
  const one = scope === 'this' && ref.index.length > 0 ? styles[partStyleKey(ref, 'this')] : undefined;
  const timeline = one?.timeline ?? all?.timeline;
  const scrub = one?.timeline !== undefined ? one.scrub : all?.scrub;
  return {
    ...(timeline === undefined ? {} : { timeline }),
    ...(timeline === undefined || scrub === undefined ? {} : { scrub }),
  };
}
// ── end gsap-pixi additions ──

export interface PartBarModelOptions extends Omit<ElementBarModelOptions, 'writeOptions'> {
  /** `this` styles one instance of a repeated part; `all` (default) styles every one. */
  readonly scope?: 'all' | 'this' | undefined;
  /** The language of the part's own label. Default `en`. */
  readonly locale?: 'en' | 'ar' | undefined;
  /** The part's element tag on the canvas (`h1`, `a`, `img`); a default by kind when absent. */
  readonly tag?: PartElementTag | undefined;
}

/** A part kind → the bar it gets (§2.14). */
export function partQuickKind(kind: BlockPartKind): QuickElementKind {
  switch (kind) {
    case 'text':
    case 'rich':
      return 'text';
    case 'link':
      return 'link';
    case 'image':
      return 'media';
    default:
      return 'container';
  }
}

/** An authored element tag (the synthesized node the panels read). */
export type PartElementTag = Extract<CustomCodeNode, { kind: 'element' }>['tag'];

const DEFAULT_TAGS: Readonly<Record<BlockPartKind, PartElementTag>> = {
  text: 'p',
  rich: 'div',
  link: 'a',
  image: 'img',
  list: 'ul',
  item: 'li',
  box: 'div',
};

function originOf(resolved: ResolvedStyle | undefined): ValueOrigin {
  return resolved === undefined ? 'unset' : resolved.source;
}

/** The classes stored for a part at a scope: the `all` entry, then (for `this`) the instance's. */
export function partClassName(
  props: Readonly<Record<string, unknown>>,
  stylesKey: string,
  ref: PartRef,
  scope: 'all' | 'this',
): string {
  const styles = readPartStyles(props, stylesKey);
  const all = styles[partStyleKey(ref, 'all')]?.className ?? '';
  if (scope === 'all' || ref.index.length === 0) return all;
  const one = styles[partStyleKey(ref, 'this')]?.className ?? '';
  return [all, one].filter((value) => value !== '').join(' ');
}

/** A bound string value of the part (`href`, `alt`, `src`, `text`), when it is one. */
export function partStringValue(
  node: Node,
  decl: BlockPartDecl,
  ref: PartRef,
  which: 'text' | 'href' | 'src' | 'alt',
): string | undefined {
  const path = bindPathOf(decl, ref.index, which);
  if (path === undefined) return undefined;
  const value = getAtPropPath(node.props, path);
  return typeof value === 'string' ? value : undefined;
}

/** Dispatch a planner result as ONE labelled transaction; refusals come back as sentences. */
export function dispatchPartPlan(kernel: BuilderKernel, plan: PartPlan, label?: string): QuickWriteResult {
  if (!plan.ok) return { ok: false, message: plan.message };
  if (plan.steps.length === 0) return { ok: true };
  try {
    kernel.dispatchGroup(plan.steps, {
      author: 'user',
      label: label ?? plan.label,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** The node with one plan's steps applied, so a second plan can build on the first. */
export function nodeAfterPlan(node: Node, plan: PartPlan): Node {
  if (!plan.ok) return node;
  let props = node.props;
  for (const step of plan.steps) props = { ...props, [step.args.key]: step.args.value };
  return { ...node, props };
}

/**
 * Several planner results as ONE plan (one transaction, one Undo): later
 * steps on the same top-level key replace earlier ones, which is right
 * because each later plan was built on the node the earlier ones produced.
 */
export function mergePartPlans(plans: readonly PartPlan[], label: string): PartPlan {
  const byKey = new Map<string, Extract<PartPlan, { ok: true }>['steps'][number]>();
  for (const plan of plans) {
    if (!plan.ok) return plan;
    for (const step of plan.steps) {
      byKey.delete(step.args.key);
      byKey.set(step.args.key, step);
    }
  }
  return { ok: true, steps: [...byKey.values()], label };
}

/**
 * Build the bar model for one focused part. `undefined` when the node, its
 * block, the declaration or the instance is gone (an undo removed the item).
 */
export function createPartBarModel(
  kernel: BuilderKernel,
  target: PartTarget,
  options: PartBarModelOptions,
): ElementBarModel | undefined {
  const node = kernel.getDocument().nodes[target.nodeId];
  if (node === undefined) return undefined;
  const schema = kernel.context.registry.block(node.type)?.schema;
  if (schema === undefined) return undefined;
  const parts = blockPartsOf(schema);
  const decl = Object.hasOwn(parts, target.part) ? parts[target.part] : undefined;
  if (decl === undefined || !hasPartInstance(parts, node.props, target)) return undefined;

  const words: ElementNameWords = options.words ?? ELEMENT_NAME_WORDS_EN;
  const locale = options.locale ?? 'en';
  const scope = target.index.length === 0 ? 'all' : (options.scope ?? 'all');
  const stylesKey = partStylesKeyOf(schema.props) ?? 'partStyles';
  const ref: PartRef = { part: target.part, index: [...target.index] };
  const blockName = blockDisplayName(kernel, node.id, words);
  // History labels stay English (the planners' law); the bar's own name is localized.
  const historyBlockName = blockDisplayName(kernel, node.id);
  const name = `${partInstanceName(kernel, node.id, ref, locale)} · ${blockName}`;
  const className = partClassName(node.props, stylesKey, ref, scope);
  const synthesized: CustomCodeNode = {
    kind: 'element',
    tag: options.tag ?? DEFAULT_TAGS[decl.kind],
    ...(className === '' ? {} : { className }),
  };
  const reading = readStyle(className, { bucket: options.bucket, state: options.state }, options.namedStyles === undefined ? undefined : { namedStyles: options.namedStyles });

  const quick = (resolved: ResolvedStyle | undefined): QuickValue => ({
    value: resolved?.value,
    origin: originOf(resolved),
    mixed: false,
  });
  const sideOf = (resolved: ResolvedStyle | undefined, side: StyleBoxSide | StyleCorner) =>
    resolved?.sides === undefined ? resolved : resolved.sides[side];

  const value = (which: 'text' | 'href' | 'src' | 'alt') => partStringValue(node, decl, ref, which);

  // gsap-pixi additions (2026-10-08)
  /*
    The part's recipe and how it plays, on its own partStyles entry at the
    bar's scope (every other field of the entry kept): ONE setProp, one Undo,
    labelled "Cinematic motion · Hero heading" (history labels stay English).
    `undefined` leaves a field as it is, `null` removes it; a scrub without a
    recipe means nothing and goes with it. Nothing changed ⇒ no transaction.
  */
  const writePartMotion = (
    timeline: string | null | undefined,
    scrub: string | null | undefined,
  ): QuickWriteResult => {
    if (typeof timeline === 'string' && !isCustomCodeTimelineRecipe(timeline)) {
      return { ok: false, message: `"${timeline}" is not a Cinematic motion recipe · choose one from the list` };
    }
    if (typeof scrub === 'string' && scrub !== 'true' && scrub !== 'false') {
      return { ok: false, message: 'How a recipe plays is true or false · choose with scroll or once' };
    }
    const isRecord = (raw: unknown): raw is Record<string, JsonValue> =>
      typeof raw === 'object' && raw !== null && !Array.isArray(raw);
    const raw = Object.hasOwn(node.props, stylesKey) ? node.props[stylesKey] : undefined;
    const stored: Record<string, JsonValue> = isRecord(raw) ? { ...raw } : {};
    const key = partStyleKey(ref, scope);
    const before = stored[key];
    const previous: Record<string, JsonValue> = isRecord(before) ? before : {};
    const entry: Record<string, JsonValue> = { ...previous };
    if (timeline === null) delete entry['timeline'];
    else if (timeline !== undefined) entry['timeline'] = timeline;
    if (scrub === null) delete entry['scrub'];
    else if (scrub !== undefined) entry['scrub'] = scrub === 'true';
    if (entry['timeline'] === undefined) delete entry['scrub'];
    if (JSON.stringify(entry) === JSON.stringify(previous)) return { ok: true };
    const nextStyles: Record<string, JsonValue> = {};
    for (const [styleKey, style] of Object.entries(stored)) {
      if (styleKey !== key) nextStyles[styleKey] = style;
    }
    if (Object.keys(entry).length > 0) nextStyles[key] = entry;
    return dispatchPartPlan(kernel, {
      ok: true,
      steps: [{ command: 'setProp', args: { id: node.id, key: stylesKey, value: nextStyles } }],
      label: `Cinematic motion · ${historyBlockName} ${decl.label.en.toLowerCase()}`,
    });
  };
  // ── end gsap-pixi additions ──

  return {
    kind: partQuickKind(decl.kind),
    name,
    targetCount: 1,
    pageDir: options.pageDir,
    bucket: options.bucket,
    state: options.state,
    node: synthesized,
    motionScope: 'part', // gsap-pixi additions (2026-10-08)
    read: (property: StylePropertyId) => quick(reading.get(property)),
    readSide: (property, side) => quick(sideOf(reading.get(property), side)),
    attribute: (attribute) => {
      if (attribute === 'href' && decl.kind === 'link') return value('href');
      if ((attribute === 'alt' || attribute === 'src') && decl.kind === 'image') return value(attribute);
      // gsap-pixi additions (2026-10-08): the part's Cinematic motion, read from partStyles at the bar's scope.
      if (attribute === 'data-ck-timeline') return partMotion(node.props, stylesKey, ref, scope).timeline;
      if (attribute === 'data-ck-scrub') {
        const scrub = partMotion(node.props, stylesKey, ref, scope).scrub;
        return scrub === undefined ? undefined : String(scrub);
      }
      // ── end gsap-pixi additions ──
      return undefined;
    },
    apply: (intents) =>
      dispatchPartPlan(
        kernel,
        planPartStyle(
          node,
          schema.props,
          ref,
          scope,
          intents.map((intent) => ({ ...intent, bucket: options.bucket, state: options.state })),
          historyBlockName,
        ),
      ),
    setAttributes: (attributes, propertyLabel) => {
      // gsap-pixi additions (2026-10-08): Cinematic motion is the one engine
      // marker a part takes, stored in its own partStyles entry. A CSS preset
      // or hover effect is refused; removing one a part never has is nothing.
      const entries = Object.entries(attributes);
      const cssMotion = (name: string) => name === 'data-ck-motion' || name === 'data-ck-hover';
      if (entries.some(([name, next]) => cssMotion(name) && next !== null)) {
        return { ok: false, message: PART_NO_CSS_MOTION };
      }
      if (entries.some(([name]) => PART_MOTION_ATTRIBUTES.includes(name))) {
        if (entries.some(([name]) => !PART_MOTION_ATTRIBUTES.includes(name) && !cssMotion(name))) {
          return { ok: false, message: PART_NO_ATTRIBUTES };
        }
        return writePartMotion(attributes['data-ck-timeline'], attributes['data-ck-scrub']);
      }
      // ── end gsap-pixi additions ──
      // Only the attributes a part BINDS can be written, and only through its
      // own planner; a cleared target/rel (the link editor's new-tab pair) is
      // nothing to write. Everything else is refused, never half-applied.
      const plans: PartPlan[] = [];
      let current = node;
      for (const [attribute, next] of Object.entries(attributes)) {
        const slot: PartValueSlot | undefined =
          attribute === 'href' && decl.kind === 'link'
            ? 'href'
            : (attribute === 'alt' || attribute === 'src') && decl.kind === 'image'
              ? attribute
              : undefined;
        if (slot === undefined) {
          if (next === null && (attribute === 'target' || attribute === 'rel')) continue;
          if (next === null && cssMotion(attribute)) continue; // gsap-pixi additions (2026-10-08)
          return { ok: false, message: PART_NO_ATTRIBUTES };
        }
        const plan = planPartValue(current, parts, ref, slot, next ?? '', historyBlockName);
        if (!plan.ok) return { ok: false, message: plan.message };
        plans.push(plan);
        current = nodeAfterPlan(current, plan);
      }
      if (plans.length === 0) return { ok: true };
      const first = plans[0];
      const label = plans.length === 1 && first?.ok === true ? first.label : `${propertyLabel} · ${name}`;
      return dispatchPartPlan(kernel, mergePartPlans(plans, label));
    },
    editClasses: (transform, propertyLabel) => {
      // A class edit the engine does not model, on the part's own entry at the
      // bar's scope; the prop's schema (the tokens door) still judges it.
      const styles = readPartStyles(node.props, stylesKey);
      const key = partStyleKey(ref, scope);
      const before = styles[key]?.className ?? '';
      const after = transform(before).replace(/\s+/gu, ' ').trim();
      if (after === before) return { ok: true };
      const entry: Record<string, JsonValue> = {};
      const stored = styles[key];
      if (stored?.dir !== undefined) entry['dir'] = stored.dir;
      // gsap-pixi additions (2026-10-08): a class edit keeps the part's Cinematic motion.
      if (stored?.timeline !== undefined) entry['timeline'] = stored.timeline;
      if (stored?.scrub !== undefined) entry['scrub'] = stored.scrub;
      // ── end gsap-pixi additions ──
      if (after !== '') entry['className'] = after;
      const nextStyles: Record<string, JsonValue> = {};
      for (const [styleKey, style] of Object.entries(styles)) {
        if (styleKey !== key) nextStyles[styleKey] = { ...style } as JsonValue;
      }
      if (Object.keys(entry).length > 0) nextStyles[key] = entry;
      return dispatchPartPlan(kernel, {
        ok: true,
        steps: [{ command: 'setProp', args: { id: node.id, key: stylesKey, value: nextStyles } }],
        label: `${propertyLabel} · ${historyBlockName} ${decl.label.en.toLowerCase()}`,
      });
    },
    setIcon: () => ({ ok: false, message: PART_NO_ICON }),
  };
}

/**
 * A link part's text and address as ONE plan (one Undo): each changed value
 * through `planPartValue`, the second built on the node the first produced.
 * Nothing changed ⇒ an empty plan (no transaction at all).
 */
export function planPartLinkValue(
  kernel: BuilderKernel,
  target: PartTarget,
  value: { readonly text: string; readonly href: string },
): PartPlan {
  const node = kernel.getDocument().nodes[target.nodeId];
  const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  if (node === undefined || schema === undefined) {
    return { ok: false, message: 'This block no longer exists · select another block' };
  }
  const parts = blockPartsOf(schema);
  const decl = Object.hasOwn(parts, target.part) ? parts[target.part] : undefined;
  if (decl?.kind !== 'link') {
    return { ok: false, message: `"${target.part}" is not a link · select a link or button` };
  }
  const ref: PartRef = { part: target.part, index: [...target.index] };
  const blockName = blockDisplayName(kernel, node.id);
  const plans: PartPlan[] = [];
  let current = node;
  for (const which of ['text', 'href'] as const) {
    if (partStringValue(current, decl, ref, which) === value[which]) continue;
    const plan = planPartValue(current, parts, ref, which, value[which], blockName);
    if (!plan.ok) return plan;
    plans.push(plan);
    current = nodeAfterPlan(current, plan);
  }
  const last = plans[plans.length - 1];
  return mergePartPlans(plans, last?.ok === true ? last.label : `Edit link · ${blockName}`);
}
