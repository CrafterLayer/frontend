import {
  bindPatternOf,
  planPartDir,
  planPartListOp,
  planPartStyle,
  planPartValue,
  propSchemaAt,
  type BlockPartDecl,
  type JsonValue,
  type Node,
  type PartListOp,
  type PartPlan,
  type PartRef,
  type PartStep,
} from '@craftkit/builder-schema';

import { isArtSpec, resolveArtImage } from '../art-catalog/runtime';
import { isRecord } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import { no, ok, strictRecord, type Parsed } from './address';
import {
  parsePartAddress,
  parsePartIndex,
  partBlockOf,
  resolvePartAddress,
  resolvePartName,
  type PartAddressInput,
  type PartBlock,
  type ResolvedPart,
} from './part-address';
import { parseStyleEntries, type ParsedStyles } from './style-value';
import { richTextFromPlain, safeImageSrc, safePartHref, stringField } from './part-values';

export { richTextFromPlain, safePartHref } from './part-values';

/**
 * part.* — the agent's tools for the named inner elements of a REGISTERED
 * block (block-parts DESIGN §2.12): «غيّر لون العنوان في الهيرو» is
 * `part.style {id:'hero-1', part:'العنوان', style:{textColor:'accent'}}`.
 *
 * Each tool resolves its address (part-address.ts), then expands to the pure
 * planners' steps from @craftkit/builder-schema (planPartValue,
 * planPartListOp, planPartStyle in tokens mode, planPartDir): ONE setProp per
 * top-level prop it touches, the first one titled with the planner's label
 * ("Edit text · Hero heading"), so the plan lands as one labelled Undo
 * through the same door as every other step. Part styles keep the theming
 * law of a block's className (DESIGN §6.1): theme tokens and scale steps
 * only; a free colour is "Convert to editable" (block.convert).
 */

// ── Shared ────────────────────────────────────────────────────────────────────

const MAX_TEXT = 4_000;
const MAX_ALT = 300;
const MAX_URL = 2_000;

/** The planners' plan as a tool run: its steps, the first one titled with its label. */
function toRun(plan: PartPlan): AgentToolRun {
  if (!plan.ok) return no(plan.message);
  const [first, ...rest] = plan.steps;
  if (first === undefined) return no('nothing to change · the part already looks like that.');
  const step = (entry: PartStep) => ({ command: entry.command, args: { ...entry.args } as Record<string, unknown> });
  return { ok: true, steps: [{ ...step(first), title: plan.label }, ...rest.map(step)] };
}

/**
 * Run planners one after another over the node as each leaves it, so two
 * values of one top-level prop (an image's src and alt inside `items`) land
 * as ONE setProp. The label is the first planner's.
 */
export function chainPartPlans(node: Node, planners: readonly ((node: Node) => PartPlan)[]): PartPlan {
  let current = node;
  let label: string | undefined;
  const byKey = new Map<string, PartStep>();
  for (const planner of planners) {
    const plan = planner(current);
    if (!plan.ok) return plan;
    label ??= plan.label;
    for (const step of plan.steps) {
      byKey.set(step.args.key, step);
      current = { ...current, props: { ...current.props, [step.args.key]: step.args.value } };
    }
  }
  if (label === undefined || byKey.size === 0) return { ok: false, message: 'nothing to change · send a value.' };
  return { ok: true, steps: [...byKey.values()], label };
}

/** Undefined when unchanged: a step whose value equals the stored one is dropped. */
function unchanged(plan: PartPlan, node: Node): boolean {
  return plan.ok && plan.steps.every((step) => JSON.stringify(node.props[step.args.key]) === JSON.stringify(step.args.value));
}

function resolve(input: PartAddressInput, context: AgentToolContext): Parsed<ResolvedPart> {
  return resolvePartAddress(context.kernel, input, context.readProp);
}

function textPartsOf(target: ResolvedPart): string {
  const names = Object.entries(target.parts)
    .filter(([, decl]) => decl.kind === 'text' || decl.kind === 'rich' || decl.kind === 'link')
    .map(([name]) => name);
  return names.length === 0 ? '(none)' : names.join(', ');
}

function addressOf(record: Record<string, unknown>, requirePart = false): Parsed<PartAddressInput> {
  return parsePartAddress(record, requirePart);
}

// ── part.text ─────────────────────────────────────────────────────────────────

export type PartTextInput = PartAddressInput & { readonly text: string };

const TEXT_KEYS = ['id', 'part', 'index', 'find', 'text'] as const;

function parseText(input: unknown): Parsed<PartTextInput> {
  const record = strictRecord(input, TEXT_KEYS, '{"id","part"|"find","index"?,"text"}');
  if (!record.ok) return record;
  const address = addressOf(record.value);
  if (!address.ok) return address;
  const text = stringField(record.value, 'text', MAX_TEXT, true);
  if (!text.ok) return text;
  if (text.value === undefined) return no('"text" is required: the part\'s new words.');
  return ok({ ...address.value, text: text.value });
}

function textValue(decl: BlockPartDecl, text: string): JsonValue {
  if (decl.kind === 'rich') return richTextFromPlain(text) as unknown as JsonValue;
  return decl.multiline === true ? text : text.replace(/\s*\n\s*/gu, ' ');
}

function runText(input: PartTextInput, context: AgentToolContext): AgentToolRun {
  const target = resolve(input, context);
  if (!target.ok) return target;
  const { decl, ref, node, parts, blockName } = target.value;
  if (decl.kind === 'image') return no(`"${ref.part}" is an image · use part.image with src or alt.`);
  if (decl.kind !== 'text' && decl.kind !== 'rich' && decl.kind !== 'link') {
    return no(`"${ref.part}" is a ${decl.kind} part and holds no text · send one of its text parts: ${textPartsOf(target.value)}.`);
  }
  const plan = planPartValue(node, parts, ref, 'text', textValue(decl, input.text), blockName);
  if (unchanged(plan, node)) return no(`nothing to change · "${ref.part}" already says that.`);
  return toRun(plan);
}

export const partTextTool = defineAgentTool<PartTextInput>({
  name: 'part.text',
  lanes: ['edit'],
  summary: "Set a block part's text",
  signature: '{id,part,index?,text}',
  parse: parseText,
  run: runText,
});

// ── part.style ────────────────────────────────────────────────────────────────

export type PartStyleInput = PartAddressInput & {
  readonly scope?: 'all' | 'this' | undefined;
  readonly styles: ParsedStyles;
};

const STYLE_KEYS = ['id', 'part', 'index', 'find', 'scope', 'style'] as const;
const ENTRY_OPTION_KEYS = ['value', 'bucket', 'state', 'side'] as const;

/**
 * `style` as a person-sized object — `{"textColor":"accent","padding":"4"}`,
 * or `{"padding":{"value":"6","side":"inline","bucket":"mobile"}}` — turned
 * into the entries element.style already parses (style-value.ts), so both
 * tools read one vocabulary. The array form element.style takes is accepted too.
 */
function styleEntries(value: unknown): Parsed<readonly Record<string, unknown>[]> {
  if (Array.isArray(value)) return ok(value as Record<string, unknown>[]);
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return no('"style" must be an object of property → value, e.g. {"textColor":"accent","fontSize":"2xl"}.');
  }
  const entries: Record<string, unknown>[] = [];
  for (const [property, raw] of Object.entries(value)) {
    if (isRecord(raw) && Object.hasOwn(raw, 'value') && Object.keys(raw).every((key) => (ENTRY_OPTION_KEYS as readonly string[]).includes(key))) {
      entries.push({ property, ...raw });
    } else {
      entries.push({ property, value: raw });
    }
  }
  return ok(entries);
}

function parseStyle(input: unknown): Parsed<PartStyleInput> {
  const record = strictRecord(input, STYLE_KEYS, '{"id","part"|"find","index"?,"scope"?,"style":{property:value}}');
  if (!record.ok) return record;
  const address = addressOf(record.value);
  if (!address.ok) return address;
  const scope = record.value['scope'];
  if (scope !== undefined && scope !== 'all' && scope !== 'this') {
    return no('"scope" is "this" (one item) or "all" (every item of a repeated part).');
  }
  const entries = styleEntries(record.value['style']);
  if (!entries.ok) return entries;
  const styles = parseStyleEntries(entries.value);
  if (!styles.ok) return styles;
  return ok({ ...address.value, ...(scope === undefined ? {} : { scope }), styles: styles.value });
}

/** Whether a declaration repeats (its bind holds a `*`). */
function repeats(decl: BlockPartDecl): boolean {
  const bind = decl.bind;
  const pattern = bind === undefined ? '' : typeof bind === 'string' ? bind : 'href' in bind ? bind.text : bind.src;
  return pattern.split('.').includes('*');
}

/** The part a style targets: every instance (scope all) needs only the declaration. */
function styleTarget(
  input: PartStyleInput,
  context: AgentToolContext,
): Parsed<{ readonly block: PartBlock; readonly ref: PartRef; readonly scope: 'all' | 'this' }> {
  const wantsAll =
    input.scope === 'all' ||
    (input.scope === undefined && input.index === undefined && input.find === undefined);
  if (wantsAll && input.part !== undefined) {
    const block = partBlockOf(context.kernel, input.id, context.readProp);
    if (!block.ok) return block;
    const name = resolvePartName(block.value, input.part);
    if (!name.ok) return name;
    const decl = block.value.parts[name.value];
    if (decl !== undefined && (input.scope === 'all' || repeats(decl))) {
      return ok({ block: block.value, ref: { part: name.value, index: [] }, scope: 'all' });
    }
  }
  const target = resolve(input, context);
  if (!target.ok) return target;
  return ok({ block: target.value, ref: target.value.ref, scope: input.scope ?? 'this' });
}

function runStyle(input: PartStyleInput, context: AgentToolContext): AgentToolRun {
  const target = styleTarget(input, context);
  if (!target.ok) return target;
  const { block, ref, scope } = target.value;
  const { intents, dir } = input.styles;
  const planners: ((node: Node) => PartPlan)[] = [];
  if (intents.length > 0) {
    planners.push((node) => planPartStyle(node, block.schema.props, ref, scope, intents, block.blockName));
  }
  if (dir !== undefined) {
    const direction = dir === 'auto' || dir === 'ltr' || dir === 'rtl' ? dir : null;
    planners.push((node) => planPartDir(node, block.schema.props, ref, direction, block.blockName));
  }
  const plan = chainPartPlans(block.node, planners);
  if (unchanged(plan, block.node)) return no(`nothing to change · "${ref.part}" already has these styles.`);
  return toRun(plan);
}

export const partStyleTool = defineAgentTool<PartStyleInput>({
  name: 'part.style',
  lanes: ['edit'],
  summary: 'Style a block part by property',
  signature: '{id,part,index?,style}',
  parse: parseStyle,
  run: runStyle,
});

// ── part.link ─────────────────────────────────────────────────────────────────

export type PartLinkInput = PartAddressInput & { readonly text?: string | undefined; readonly href?: string | undefined };

const LINK_KEYS = ['id', 'part', 'index', 'find', 'text', 'href'] as const;

function parseLink(input: unknown): Parsed<PartLinkInput> {
  const record = strictRecord(input, LINK_KEYS, '{"id","part"|"find","index"?,"text"?,"href"?}');
  if (!record.ok) return record;
  const address = addressOf(record.value);
  if (!address.ok) return address;
  const text = stringField(record.value, 'text', MAX_TEXT, false);
  if (!text.ok) return text;
  const href = stringField(record.value, 'href', MAX_URL, false);
  if (!href.ok) return href;
  if (text.value === undefined && href.value === undefined) return no('send "text", "href" or both.');
  if (href.value !== undefined && safePartHref(href.value.trim()) === undefined) {
    return no(`"href" "${href.value.slice(0, 60)}" is not a safe link · send https://…, a /path, a #anchor, mailto: or tel:.`);
  }
  return ok({
    ...address.value,
    ...(text.value === undefined ? {} : { text: text.value.replace(/\s*\n\s*/gu, ' ') }),
    ...(href.value === undefined ? {} : { href: href.value.trim() }),
  });
}

function runLink(input: PartLinkInput, context: AgentToolContext): AgentToolRun {
  const target = resolve(input, context);
  if (!target.ok) return target;
  const { decl, ref, node, parts, blockName } = target.value;
  if (decl.kind !== 'link') {
    return no(
      decl.kind === 'text' || decl.kind === 'rich'
        ? `"${ref.part}" is ${decl.kind} without a link · use part.text for its words.`
        : `"${ref.part}" is a ${decl.kind} part, not a link · send a link part.`,
    );
  }
  const planners: ((node: Node) => PartPlan)[] = [];
  if (input.text !== undefined) {
    const text = input.text;
    planners.push((current) => planPartValue(current, parts, ref, 'text', text, blockName));
  }
  if (input.href !== undefined) {
    const href = input.href;
    planners.push((current) => planPartValue(current, parts, ref, 'href', href, blockName));
  }
  const plan = chainPartPlans(node, planners);
  if (unchanged(plan, node)) return no(`nothing to change · "${ref.part}" already has this link.`);
  return toRun(plan);
}

export const partLinkTool = defineAgentTool<PartLinkInput>({
  name: 'part.link',
  lanes: ['edit'],
  summary: "Set a block part's link text or address",
  signature: '{id,part,index?,text?,href?}',
  parse: parseLink,
  run: runLink,
});

// ── part.image ────────────────────────────────────────────────────────────────

export type PartImageInput = PartAddressInput & { readonly src?: string | undefined; readonly alt?: string | undefined };

const IMAGE_KEYS = ['id', 'part', 'index', 'find', 'src', 'alt'] as const;

function parseImage(input: unknown): Parsed<PartImageInput> {
  const record = strictRecord(input, IMAGE_KEYS, '{"id","part"|"find","index"?,"src"?,"alt"?}');
  if (!record.ok) return record;
  const address = addressOf(record.value);
  if (!address.ok) return address;
  const src = stringField(record.value, 'src', MAX_URL, false);
  if (!src.ok) return src;
  const alt = stringField(record.value, 'alt', MAX_ALT, true);
  if (!alt.ok) return alt;
  if (src.value === undefined && alt.value === undefined) return no('send "src", "alt" or both.');
  // art catalog (2026-10-14): 'logo:visa', 'character:<style>:<seed>', 'illustration:<words>' resolve in run.
  if (
    src.value !== undefined &&
    !isArtSpec(src.value) &&
    safeImageSrc(src.value.trim()) === undefined
  ) {
    return no(`"src" "${src.value.slice(0, 60)}" is not an image address the page can load · send an https:// URL or a /path.`);
  }
  return ok({
    ...address.value,
    ...(src.value === undefined ? {} : { src: src.value.trim() }),
    ...(alt.value === undefined ? {} : { alt: alt.value.replace(/\s+/gu, ' ').trim() }),
  });
}

/**
 * art catalog (2026-10-14): an optional picture not set yet — a brand's logo,
 * a member's photo — has no instance, but its item does; the planner checks
 * the index lies inside the list.
 */
function resolveImage(input: PartImageInput, context: AgentToolContext): Parsed<ResolvedPart> {
  const target = resolve(input, context);
  if (target.ok || input.part === undefined || input.index === undefined || input.src === undefined)
    return target;
  const block = partBlockOf(context.kernel, input.id, context.readProp);
  const name = block.ok ? resolvePartName(block.value, input.part) : undefined;
  const decl = block.ok && name?.ok === true ? block.value.parts[name.value] : undefined;
  if (!block.ok || name?.ok !== true || decl?.kind !== 'image') return target;
  return ok({ ...block.value, ref: { part: name.value, index: input.index }, decl });
}

function runImage(input: PartImageInput, context: AgentToolContext): AgentToolRun {
  const target = resolveImage(input, context);
  if (!target.ok) return target;
  const { decl, ref, node, parts, blockName } = target.value;
  if (decl.kind !== 'image') return no(`"${ref.part}" is a ${decl.kind} part, not an image · send an image part.`);
  const planners: ((node: Node) => PartPlan)[] = [];
  const art =
    input.src !== undefined && isArtSpec(input.src)
      ? resolveArtImage(input.src, { locale: context.locale.lang, alt: input.alt })
      : undefined;
  if (art?.ok === false) return no(art.error);
  if (input.src !== undefined) {
    const src = art?.value.src ?? input.src;
    planners.push((current) => planPartValue(current, parts, ref, 'src', src, blockName));
  }
  // An art picture writes its own alt where the part keeps one (a logo cloud's logo shows its name beside it).
  const alt = art?.value.alt ?? input.alt;
  if (alt !== undefined && (art === undefined || bindPatternOf(decl, 'alt') !== undefined)) {
    planners.push((current) => planPartValue(current, parts, ref, 'alt', alt, blockName));
  }
  const plan = chainPartPlans(node, planners);
  if (unchanged(plan, node)) return no(`nothing to change · "${ref.part}" already shows this image.`);
  return toRun(plan);
}

export const partImageTool = defineAgentTool<PartImageInput>({
  name: 'part.image',
  lanes: ['edit'],
  summary: "Set a block part's image or alt text",
  signature: '{id,part,index?,src?,alt?}',
  parse: parseImage,
  run: runImage,
});

// ── part.list ─────────────────────────────────────────────────────────────────

export const PART_LIST_OPS = ['add', 'duplicate', 'remove', 'move'] as const;
export type PartListOpName = (typeof PART_LIST_OPS)[number];

export interface PartListInput {
  readonly id: string;
  readonly part: string;
  readonly op: PartListOpName;
  /** The enclosing items' indices (nested lists), then the position. */
  readonly index: readonly number[];
  readonly to?: number | undefined;
  readonly item?: JsonValue | undefined;
}

const LIST_KEYS = ['id', 'part', 'op', 'index', 'to', 'item'] as const;

function parseList(input: unknown): Parsed<PartListInput> {
  const record = strictRecord(input, LIST_KEYS, '{"id","part","op","index","to"?,"item"?}');
  if (!record.ok) return record;
  const address = addressOf(record.value, true);
  if (!address.ok) return address;
  const op = record.value['op'];
  if (typeof op !== 'string' || !(PART_LIST_OPS as readonly string[]).includes(op)) {
    return no(`"op" is one of ${PART_LIST_OPS.join(', ')}.`);
  }
  const index = parsePartIndex(record.value['index']);
  if (!index.ok) return index;
  if (index.value === undefined || index.value.length === 0) {
    return no('"index" is required: the item\'s position (0 is the first); for "add", where the new item goes.');
  }
  const to = record.value['to'];
  if (op === 'move') {
    if (typeof to !== 'number' || !Number.isInteger(to) || to < 0) return no('"move" needs "to": the new position (0 is the first).');
  } else if (to !== undefined) {
    return no('"to" belongs to "move" only · drop it.');
  }
  const item = record.value['item'];
  if (item !== undefined && op !== 'add') return no('"item" belongs to "add" only · drop it.');
  if (item !== undefined && !isRecord(item) && typeof item !== 'string') {
    return no('"item" is the new entry, an object of its fields, e.g. {"title":"…","body":"…"}.');
  }
  return ok({
    id: address.value.id,
    part: address.value.part ?? '',
    op: op as PartListOpName,
    index: index.value,
    ...(typeof to === 'number' ? { to } : {}),
    ...(item === undefined ? {} : { item: item as JsonValue }),
  });
}

function runList(input: PartListInput, context: AgentToolContext): AgentToolRun {
  const block = partBlockOf(context.kernel, input.id, context.readProp);
  if (!block.ok) return block;
  const name = resolvePartName(block.value, input.part);
  if (!name.ok) return name;
  const decl = block.value.parts[name.value];
  if (decl === undefined || (decl.kind !== 'list' && decl.kind !== 'item') || typeof decl.bind !== 'string') {
    const lists = Object.entries(block.value.parts)
      .filter(([, entry]) => entry.kind === 'list' || entry.kind === 'item')
      .map(([entry]) => entry);
    return no(`"${name.value}" is not a list or an item · send one of: ${lists.length === 0 ? '(this block has no lists)' : lists.join(', ')}.`);
  }
  const outer = input.index.slice(0, -1);
  const at = input.index[input.index.length - 1] ?? 0;
  const op: PartListOp =
    input.op === 'add'
      ? { kind: 'add', at, ...(input.item === undefined ? {} : { item: input.item }) }
      : input.op === 'move'
        ? { kind: 'move', from: at, to: input.to ?? at }
        : { kind: input.op, at };
  const itemPattern = decl.kind === 'item' ? decl.bind : `${decl.bind}.*`;
  const itemSchema = propSchemaAt(block.value.schema.props, itemPattern);
  return toRun(
    planPartListOp(block.value.node, block.value.parts, { part: name.value, index: outer }, op, block.value.blockName, itemSchema),
  );
}

export const partListTool = defineAgentTool<PartListInput>({
  name: 'part.list',
  lanes: ['edit'],
  summary: 'Add, duplicate, remove or move list items',
  signature: '{id,part,op,index,to?,item?}',
  parse: parseList,
  run: runList,
});

/** The part tools, in catalog order. */
export const PART_AGENT_TOOLS = Object.freeze([
  partTextTool,
  partStyleTool,
  partLinkTool,
  partImageTool,
  partListTool,
]);
