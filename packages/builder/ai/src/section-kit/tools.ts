import { isElement, readTree, rootChildren, rootIdOf, setProp, type TreeNode } from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from '../tools/agent/types';
import {
  instantiateKit,
  kitIdOfTree,
  readKitSlots,
  treeHasH1,
  type InstantiateKitResult,
} from './instantiate';
import { sectionKit } from './kit-index';
import { SECTION_KITS } from './kits';
import type { SectionKit } from './types';

/**
 * The section kit's agent tools (DESIGN §A.2 rows 1–3): `kit.section`,
 * `kit.swap` and `kit.insert`. Each expands to ordinary kernel steps —
 * `setProp tree` (+`css`) or `insertNode customCode` — which the door then
 * judges like any step the model writes. A refusal says how to fix the call.
 */

interface KitSectionInput {
  readonly id: string;
  readonly kit: string;
  readonly slots: Record<string, unknown>;
  readonly heading?: 'h1' | 'h2';
}

interface KitSwapInput {
  readonly id: string;
  readonly kit: string;
}

interface KitInsertInput {
  readonly after?: string;
  readonly kit: string;
  readonly slots: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKit(id: unknown): string {
  const ids = SECTION_KITS.map((kit) => kit.id);
  return `unknown kit ${JSON.stringify(id)}; use one of: ${ids.join(', ')}.`;
}

function readKit(input: Record<string, unknown>): SectionKit | string {
  const id = input['kit'];
  if (typeof id !== 'string') return '"kit" must be a kit id from the kit index.';
  return sectionKit(id) ?? unknownKit(id);
}

function extraKeys(input: Record<string, unknown>, known: readonly string[]): string | undefined {
  const extra = Object.keys(input).filter((key) => !known.includes(key));
  return extra.length === 0 ? undefined : `unknown input ${extra.map((key) => `"${key}"`).join(', ')}; the tool takes ${known.join(', ')}.`;
}

/** The page has the kit's colour classes only when its pageCss defines them (the skeleton or theme.apply writes it). */
function kitStylesMissing(context: AgentToolContext): string | undefined {
  const css = context.readProp(rootIdOf(context.kernel), 'pageCss');
  return typeof css === 'string' && css.includes('.ck-btn')
    ? undefined
    : 'page has no kit styles; run theme.apply first';
}

function regionMissing(context: AgentToolContext, id: string): string | undefined {
  const node = context.kernel.getDocument().nodes[id];
  if (node !== undefined && readTree(context, id) !== undefined) return undefined;
  const regions = rootChildren(context.kernel).filter((child) => readTree(context, child) !== undefined);
  return `no section region "${id}"; use a region id from the page: ${regions.slice(0, 12).join(', ') || '(none — use kit.insert)'}.`;
}

/** The region's anchor: the id its outer element already carries, else one made from the node id. */
function anchorOf(context: AgentToolContext, id: string): string {
  const outer = readTree(context, id)?.children[0];
  const attributes = isRecord(outer) && isRecord(outer['attributes']) ? outer['attributes'] : {};
  const current = attributes['id'];
  if (typeof current === 'string' && /^[A-Za-z؀-ۿ][\w؀-ۿ-]{0,79}$/u.test(current)) {
    return current;
  }
  return `section-${id.replace(/[^\w-]/gu, '').slice(0, 60) || 'kit'}`;
}

function treeSteps(id: string, result: Extract<InstantiateKitResult, { ok: true }>, kit: SectionKit, currentCss: unknown, previousKitCss?: string): AgentToolStep[] {
  const steps: AgentToolStep[] = [setProp(id, 'tree', result.tree, `Kit ${kit.id}`)];
  const current = typeof currentCss === 'string' ? currentCss : '';
  // The region's own css is kept unless it is empty or the previous kit's: a person's rules are never dropped.
  if (current.trim() === '' || current === previousKitCss) {
    if (result.css !== current) steps.push(setProp(id, 'css', result.css));
  }
  return steps;
}

function parseSection(input: unknown): AgentToolParse<KitSectionInput> {
  if (!isRecord(input)) return { ok: false, error: 'input must be {id, kit, slots}.' };
  const extra = extraKeys(input, ['id', 'kit', 'slots', 'heading']);
  if (extra !== undefined) return { ok: false, error: extra };
  if (typeof input['id'] !== 'string' || input['id'] === '') {
    return { ok: false, error: '"id" must be the section region\'s node id.' };
  }
  if (typeof input['kit'] !== 'string') return { ok: false, error: '"kit" must be a kit id from the kit index.' };
  if (!isRecord(input['slots'])) return { ok: false, error: '"slots" must be an object of slot values.' };
  const heading = input['heading'];
  if (heading !== undefined && heading !== 'h1' && heading !== 'h2') {
    return { ok: false, error: '"heading" is "h1" (the page\'s one h1, in the hero) or "h2".' };
  }
  return {
    ok: true,
    value: {
      id: input['id'],
      kit: input['kit'],
      slots: input['slots'],
      ...(heading === undefined ? {} : { heading }),
    },
  };
}

const HEADING_TAG = /^h[1-3]$/u;

/** The text of the region's first h1–h3 — the plan section's title, as the skeleton placeholder carries it. */
function regionHeading(nodes: readonly TreeNode[]): string | undefined {
  for (const node of nodes) {
    if (isElement(node)) {
      if (HEADING_TAG.test(node.tag)) {
        const text = [node.text ?? '', ...(node.children ?? []).map((child) => (isElement(child) ? (child.text ?? '') : ''))]
          .join(' ')
          .replace(/\s+/gu, ' ')
          .trim();
        if (text !== '') return text;
      }
    }
    const inner = regionHeading((node as { readonly children?: readonly TreeNode[] }).children ?? []);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

/**
 * A writer that leaves out the kit's `title` gets the section's own title —
 * the heading the plan already gave it (the skeleton placeholder's h1/h2),
 * else the region's label. Live runs 2026-09-30: 4 of 5 band writers omitted
 * it (the shared-slot shorthand in the kit index), each costing a ~10 s
 * repair round for a value the build already had.
 */
function withSectionTitle(
  kit: SectionKit,
  slots: Record<string, unknown>,
  context: AgentToolContext,
  id: string,
): Record<string, unknown> {
  if (kit.slots['title'] === undefined) return slots;
  const given = slots['title'];
  if (typeof given === 'string' && given.trim() !== '') return slots;
  if (given !== undefined && typeof given !== 'string') return slots;
  const label = context.readProp(id, 'label');
  const title =
    regionHeading(readTree(context, id)?.children ?? []) ?? (typeof label === 'string' && label.trim() !== '' ? label.trim() : undefined);
  return title === undefined ? slots : { ...slots, title };
}

function runSection(input: KitSectionInput, context: AgentToolContext): AgentToolRun {
  const kit = readKit(input as unknown as Record<string, unknown>);
  if (typeof kit === 'string') return { ok: false, error: kit };
  const missing = kitStylesMissing(context) ?? regionMissing(context, input.id);
  if (missing !== undefined) return { ok: false, error: missing };
  const result = instantiateKit(kit, withSectionTitle(kit, input.slots, context, input.id), {
    id: anchorOf(context, input.id),
    heading: input.heading ?? (kit.role === 'hero' ? 'h1' : 'h2'),
    locale: context.locale,
  });
  if (!result.ok) return { ok: false, error: result.error };
  const previous = sectionKit(kitIdOfTree(readTree(context, input.id)) ?? '');
  return {
    ok: true,
    steps: treeSteps(input.id, result, kit, context.readProp(input.id, 'css'), previous?.css),
    note: `kit ${kit.id}`,
  };
}

function parseSwap(input: unknown): AgentToolParse<KitSwapInput> {
  if (!isRecord(input)) return { ok: false, error: 'input must be {id, kit}.' };
  const extra = extraKeys(input, ['id', 'kit']);
  if (extra !== undefined) return { ok: false, error: extra };
  if (typeof input['id'] !== 'string' || typeof input['kit'] !== 'string') {
    return { ok: false, error: '"id" is the region\'s node id and "kit" the new kit id.' };
  }
  return { ok: true, value: { id: input['id'], kit: input['kit'] } };
}

function runSwap(input: KitSwapInput, context: AgentToolContext): AgentToolRun {
  const next = sectionKit(input.kit);
  if (next === undefined) return { ok: false, error: unknownKit(input.kit) };
  const missing = regionMissing(context, input.id);
  if (missing !== undefined) return { ok: false, error: missing };
  const tree = readTree(context, input.id);
  const current = sectionKit(kitIdOfTree(tree) ?? '');
  if (current === undefined) {
    return {
      ok: false,
      error: `region "${input.id}" was not built from a kit; use kit.section with {id, kit, slots} instead.`,
    };
  }
  if (current.role !== next.role) {
    const same = SECTION_KITS.filter((kit) => kit.role === current.role && kit.id !== current.id).map((kit) => kit.id);
    return {
      ok: false,
      error: `kit.swap keeps the role: "${current.id}" is ${current.role}, "${next.id}" is ${next.role}; swap to one of ${same.join(', ')}, or use kit.section with new slots.`,
    };
  }
  const slots = readKitSlots(current, tree);
  if (slots === undefined) {
    return {
      ok: false,
      error: `region "${input.id}" was edited since kit "${current.id}" built it; use kit.section with {id, kit:"${next.id}", slots}.`,
    };
  }
  const result = instantiateKit(next, slots, {
    id: anchorOf(context, input.id),
    heading: treeHasH1(tree) ? 'h1' : 'h2',
    locale: context.locale,
  });
  if (!result.ok) {
    return { ok: false, error: `${result.error} (kit.swap carries the slots of "${current.id}"; use kit.section to give the missing ones).` };
  }
  return {
    ok: true,
    steps: treeSteps(input.id, result, next, context.readProp(input.id, 'css'), current.css),
    note: `kit ${current.id} → ${next.id}`,
  };
}

function parseInsert(input: unknown): AgentToolParse<KitInsertInput> {
  if (!isRecord(input)) return { ok: false, error: 'input must be {kit, slots, after?}.' };
  const extra = extraKeys(input, ['after', 'kit', 'slots']);
  if (extra !== undefined) return { ok: false, error: extra };
  if (typeof input['kit'] !== 'string') return { ok: false, error: '"kit" must be a kit id from the kit index.' };
  if (!isRecord(input['slots'])) return { ok: false, error: '"slots" must be an object of slot values.' };
  const after = input['after'];
  if (after !== undefined && typeof after !== 'string') {
    return { ok: false, error: '"after" is the node id of the region the new one follows.' };
  }
  return {
    ok: true,
    value: { kit: input['kit'], slots: input['slots'], ...(after === undefined ? {} : { after }) },
  };
}

/** A fresh anchor id for an inserted section: the kit id, numbered past any id the page already uses. */
function freshAnchor(context: AgentToolContext, kit: SectionKit): string {
  const text = JSON.stringify(context.kernel.getDocument().nodes);
  const used = (id: string) => text.includes(`"id":"${id}"`);
  let candidate = kit.id;
  for (let n = 2; used(candidate); n += 1) candidate = `${kit.id}-${String(n)}`;
  return candidate;
}

function isFooterRegion(context: AgentToolContext, id: string): boolean {
  const outer = readTree(context, id)?.children[0];
  return isRecord(outer) && outer['tag'] === 'footer';
}

function runInsert(input: KitInsertInput, context: AgentToolContext): AgentToolRun {
  const kit = sectionKit(input.kit);
  if (kit === undefined) return { ok: false, error: unknownKit(input.kit) };
  const styles = kitStylesMissing(context);
  if (styles !== undefined) return { ok: false, error: styles };
  const children = rootChildren(context.kernel);
  let index: number | undefined;
  if (input.after !== undefined) {
    const at = children.indexOf(input.after);
    if (at < 0) {
      return { ok: false, error: `"after": no section "${input.after}" on the page; use one of ${children.slice(0, 12).join(', ')}.` };
    }
    index = at + 1;
  } else {
    // At the end, but never under the footer.
    const footer = children.findIndex((id) => isFooterRegion(context, id));
    if (footer >= 0 && kit.role !== 'footer') index = footer;
  }
  const result = instantiateKit(kit, input.slots, {
    id: freshAnchor(context, kit),
    heading: kit.role === 'hero' ? 'h1' : 'h2',
    locale: context.locale,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    steps: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: rootIdOf(context.kernel),
          ...(index === undefined ? {} : { index }),
          props: { label: result.label, tree: result.tree, ...(result.css === '' ? {} : { css: result.css }) },
        },
        title: `Kit ${kit.id}`,
      },
    ],
    note: `kit ${kit.id}`,
  };
}

const KIT_SECTION = defineAgentTool<KitSectionInput>({
  name: 'kit.section',
  lanes: ['section', 'build', 'edit'],
  summary: 'Fill a section region from a kit',
  signature: "{id,kit,slots,heading?:'h1'|'h2'}",
  parse: parseSection,
  run: runSection,
});

const KIT_SWAP = defineAgentTool<KitSwapInput>({
  name: 'kit.swap',
  lanes: ['edit'],
  summary: 'Relayout a kit section, keeping its content',
  signature: '{id,kit}',
  parse: parseSwap,
  run: runSwap,
});

const KIT_INSERT = defineAgentTool<KitInsertInput>({
  name: 'kit.insert',
  lanes: ['edit', 'build'],
  summary: 'Add a new section from a kit',
  signature: '{kit,slots,after?:id}',
  parse: parseInsert,
  run: runInsert,
});

/** The section kit's tools, typed for the registry (each keeps its own input type inside). */
export const SECTION_KIT_TOOLS: readonly AgentTool[] = Object.freeze([
  KIT_SECTION as unknown as AgentTool,
  KIT_SWAP as unknown as AgentTool,
  KIT_INSERT as unknown as AgentTool,
]);
