import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPatternOf,
  blockPartsOf,
  getAtPropPath,
  MOTION_PROP,
  parsePropPath,
  partStylesKeyOf,
  readPartStyles,
  type BlockParts,
} from '@craftkit/builder-schema';

import { declaresProp, isRecord, rootChildren } from '../tools/agent/shared';
import type { AgentToolContext } from '../tools/agent/types';

/**
 * gsap-pixi (2026-10-08): the REGISTERED sections of a page — marketing
 * blocks like the playground's hero, features or pricing — as the motion and
 * scene readings see them (diagnosis blocker 11: the zero-token readings knew
 * customCode regions only, so a registered Features or Hero was never found).
 *
 * A section is a root child, or a block inside a root child that only paints
 * a background around it (the playground's hero sits in an aurora surface: a
 * block with no parts whose slot holds section blocks). Page chrome — header,
 * navigation, footer, announcement bar — is never a section to animate.
 */

export interface RegisteredSection {
  readonly id: string;
  readonly type: string;
  readonly parts: BlockParts;
  /** The prop holding the block's part styles, when it keeps them. */
  readonly stylesKey: string | undefined;
  /** Whether the block declares the `motion` prop (a MotionSpec). */
  readonly hasMotion: boolean;
  readonly props: Readonly<Record<string, unknown>>;
  /** The root child this section is, or sits in. */
  readonly rootChild: string;
}

/** A call the readings emit (the `MediaReading` call shape). */
export interface MotionCall {
  readonly name: 'motion.add';
  readonly input: Record<string, unknown>;
}

/** Header, navigation, footer, announcement bar: chrome, not content. */
const CHROME_TYPE = /(?:announce|header|footer|navlinks|navbar|topbar|breadcrumb|^nav$)/iu;
/** A hero block's type. */
const HERO_TYPE = /hero/iu;
/** Lists that move on their own (a slider, a marquee, tabs): their items never stagger in. */
const NO_STAGGER_TYPE = /^(?:carousel|marquee|tabs|accordion|slider)$/iu;
/** How many items make a list worth staggering (a 2-button row is not a grid). */
const STAGGER_MIN_ITEMS = 3;
const MAX_WRAPPER_DEPTH = 3;

export function isChromeBlockType(type: string): boolean {
  return CHROME_TYPE.test(type);
}

function propsOf(kernel: BuilderKernel, id: string, readProp?: AgentToolContext['readProp']): Readonly<Record<string, unknown>> {
  const node = kernel.getDocument().nodes[id];
  if (node === undefined) return {};
  if (readProp === undefined) return node.props;
  const props: Record<string, unknown> = { ...(node.props as Record<string, unknown>) };
  for (const key of [MOTION_PROP, 'partStyles']) {
    const value = readProp(id, key);
    if (value !== undefined) props[key] = value;
  }
  return props;
}

/** The registered block `id` as a section, or undefined (a customCode region, an unknown type). */
export function registeredSection(
  kernel: BuilderKernel,
  id: string,
  rootChild: string = id,
  readProp?: AgentToolContext['readProp'],
): RegisteredSection | undefined {
  const nodes = kernel.getDocument().nodes;
  if (!Object.hasOwn(nodes, id)) return undefined;
  const node = nodes[id];
  if (node === undefined || node.type === 'customCode') return undefined;
  const schema = kernel.context.registry.block(node.type)?.schema;
  if (schema === undefined) return undefined;
  const props = propsOf(kernel, id, readProp);
  // A block holding an element tree is a composed region, whatever its type is called.
  if (isRecord(props['tree']) || typeof props['tree'] === 'string') return undefined;
  return {
    id,
    type: node.type,
    parts: blockPartsOf(schema),
    stylesKey: partStylesKeyOf(schema.props),
    hasMotion: declaresProp(kernel, id, MOTION_PROP),
    props,
    rootChild,
  };
}

function animatable(section: RegisteredSection): boolean {
  return section.hasMotion || section.stylesKey !== undefined;
}

function slotChildren(kernel: BuilderKernel, id: string): readonly string[] {
  const slots = kernel.getDocument().nodes[id]?.slots as Record<string, readonly string[] | undefined> | undefined;
  return Object.values(slots ?? {}).flatMap((ids) => ids ?? []);
}

/**
 * The content sections under one root child: the block itself, or — when it
 * is a background surface (no parts, slot children that are sections) — the
 * sections it wraps.
 */
function sectionsUnder(kernel: BuilderKernel, id: string, rootChild: string, depth: number): readonly RegisteredSection[] {
  const section = registeredSection(kernel, id, rootChild);
  if (section === undefined || isChromeBlockType(section.type)) return [];
  if (Object.keys(section.parts).length === 0 && depth < MAX_WRAPPER_DEPTH) {
    const inner = slotChildren(kernel, id).flatMap((child) => sectionsUnder(kernel, child, rootChild, depth + 1));
    if (inner.length > 0) return inner;
  }
  return animatable(section) ? [section] : [];
}

/** Every registered content section of the page, in page order. */
export function registeredSections(kernel: BuilderKernel): readonly RegisteredSection[] {
  return rootChildren(kernel).flatMap((id) => sectionsUnder(kernel, id, id, 0));
}

/** The page's registered hero block (the first `hero`-typed section, a hero inside a surface included). */
export function registeredHero(kernel: BuilderKernel): RegisteredSection | undefined {
  return registeredSections(kernel).find(({ type }) => HERO_TYPE.test(type));
}

// ── What a section's motion call is ───────────────────────────────────────────

function motionOf(section: RegisteredSection): Readonly<Record<string, unknown>> {
  const motion = section.props[MOTION_PROP];
  return isRecord(motion) ? motion : {};
}

/** Already moved by an engine or a scroll effect: a timeline on it or a part, or a CSS scroll effect. */
export function alreadyAnimated(section: RegisteredSection): boolean {
  const motion = motionOf(section);
  if (typeof motion['timeline'] === 'string') return true;
  if (typeof motion['scroll'] === 'string' && motion['scroll'] !== 'none') return true;
  if (section.stylesKey === undefined) return false;
  return Object.values(readPartStyles(section.props, section.stylesKey)).some((style) => style.timeline !== undefined);
}

/** A declared, non-repeated text part (its style entry applies whether or not the value is stored). */
function hasTextPart(section: RegisteredSection, part: string): boolean {
  const decl = Object.hasOwn(section.parts, part) ? section.parts[part] : undefined;
  if (decl === undefined || (decl.kind !== 'text' && decl.kind !== 'rich')) return false;
  return !(bindPatternOf(decl) ?? '').includes('*');
}

/** The block's first list part holding enough items to stagger, or undefined. */
export function staggerList(section: RegisteredSection): string | undefined {
  if (section.stylesKey === undefined || NO_STAGGER_TYPE.test(section.type)) return undefined;
  for (const [name, decl] of Object.entries(section.parts)) {
    if (decl.kind !== 'list') continue;
    const bind = bindPatternOf(decl);
    if (bind === undefined || bind.includes('*')) continue;
    const items = getAtPropPath(section.props, parsePropPath(bind));
    if (Array.isArray(items) && items.length >= STAGGER_MIN_ITEMS) return name;
  }
  return undefined;
}

/**
 * The ONE motion.add call that animates a registered section:
 * - `heading`: its heading part, word by word (split-reveal);
 * - `hero`: the heading (split-reveal), else the whole block fading in;
 * - `section`: its card list entering one by one (stagger-in), else the whole
 *   block fading in.
 * Undefined when the block cannot carry it.
 */
export function sectionMotionCall(
  section: RegisteredSection,
  intent: 'heading' | 'hero' | 'section',
): MotionCall | undefined {
  const heading = section.stylesKey !== undefined && hasTextPart(section, 'heading');
  if (intent === 'heading') {
    return heading ? { name: 'motion.add', input: { id: section.id, part: 'heading', recipe: 'split-reveal' } } : undefined;
  }
  if (intent === 'hero' && heading) {
    return { name: 'motion.add', input: { id: section.id, part: 'heading', recipe: 'split-reveal' } };
  }
  const list = intent === 'section' ? staggerList(section) : undefined;
  if (list !== undefined) return { name: 'motion.add', input: { id: section.id, part: list, recipe: 'stagger-in' } };
  return section.hasMotion ? { name: 'motion.add', input: { id: section.id, recipe: 'fade-in' } } : undefined;
}
