import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  extractStyleClasses,
  pasteStyleClasses,
  type CustomCodeNode,
  type CustomCodePath,
  type NodeId,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeTreeKey } from '../custom-code/element-at';
import {
  ELEMENT_PAYLOAD_CSS_MAX,
  elementPayload,
  elementPayloadFromValue,
  parseElementPayload,
  serializeElementPayload,
  type ElementPayload,
} from '../custom-code/element-drag-payload';
import {
  resolveElementTarget,
  treeNodeDisplayName,
  tryDispatchTreeEdits,
  type ElementTarget,
} from '../custom-code/element-target';
import { propsShapeOf } from '../fields/resolve-field';
import {
  deleteElements,
  liveTreeTargets,
  type ElementActionContext,
  type ElementActionOutcome,
} from './element-actions';
import { ELEMENT_ACTION_LABELS_EN, type ElementActionLabels } from './element-actions.labels';

/*
  ── Copy / cut / paste of elements and of styles (style-manager DESIGN.md §E) ─

  Elements travel as the P2 payload (`{"craftkit":"tree-node","v":1,node}`)
  through `navigator.clipboard`, so a copy survives a reload and reaches
  another tab; an in-memory copy is the fallback wherever the system
  clipboard is missing or refused (no permission, an insecure origin, jsdom).

  Paste is judged by the kernel door: it becomes `insertTreeNode` steps — after
  the focused element, or as the last child of a focused container, or at the
  end of a selected region — in ONE labelled transaction, so a refused node
  leaves nothing behind and the whole paste is one Undo.

  Styles copy as utility classes (`extractStyleClasses`) and paste with
  `pasteStyleClasses` → `patchTreeNode`, one group across the multi-selection.
*/

/** The slice of `navigator.clipboard` this module uses. */
export interface SystemClipboard {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

/** Several elements on the wire (a multi-selection copy). */
interface ElementPayloadList {
  readonly craftkit: 'tree-nodes';
  readonly v: 1;
  readonly items: readonly ElementPayload[];
}

export interface PasteDestination {
  readonly regionId: NodeId;
  /** `[]` = the region's tree root. */
  readonly parent: CustomCodePath;
  readonly index: number;
}

export interface ElementClipboard {
  copy(context: ElementActionContext): Promise<ElementActionOutcome>;
  cut(context: ElementActionContext): Promise<ElementActionOutcome>;
  paste(context: ElementActionContext): Promise<ElementActionOutcome>;
  /** Paste payloads already in hand (a native `paste` event's text). */
  pasteText(context: ElementActionContext, text: string): ElementActionOutcome;
  copyStyle(context: ElementActionContext): ElementActionOutcome;
  pasteStyle(context: ElementActionContext): ElementActionOutcome;
  /** The in-memory copy (most recent first item = primary). */
  elements(): readonly ElementPayload[];
  /** The copied style classes, if any. */
  style(): string | undefined;
}

export interface CreateElementClipboardOptions {
  /** `null` = memory only. Defaults to `navigator.clipboard` when present. */
  readonly system?: SystemClipboard | null | undefined;
}

/** Container tags that take a pasted element as their last child. */
const CONTAINER_TAGS = new Set([
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'main',
  'nav',
  'ul',
  'ol',
  'form',
  'fieldset',
  'figure',
  'details',
  'dialog',
  'blockquote',
  'table',
  'tbody',
  'thead',
  'tr',
]);

/** A node that takes a pasted node INSIDE it rather than after it. */
function isPasteContainer(node: CustomCodeNode): boolean {
  if (node.kind !== 'element') return false;
  if (node.text !== undefined && node.text !== '') return false;
  return CONTAINER_TAGS.has(node.tag) || (node.children?.length ?? 0) > 0;
}

/**
 * Where a paste lands for a target: inside a focused container (last child),
 * after any other focused element, or at the end of a selected region.
 * `undefined` when the target is a block without an element tree.
 */
export function pasteDestination(kernel: BuilderKernel, target: ElementTarget | undefined): PasteDestination | undefined {
  if (target === undefined) return undefined;
  if (target.kind === 'block') {
    const node = kernel.getDocument().nodes[target.nodeId];
    if (node === undefined) return undefined;
    const key = customCodeTreeKey(kernel, node.type);
    if (key === undefined) return undefined;
    const tree = asCustomCodeRoot(node.props[key]);
    return { regionId: target.nodeId, parent: [], index: tree?.children.length ?? 0 };
  }
  const resolved = resolveElementTarget(kernel, target);
  if (resolved?.kind !== 'tree') return undefined;
  if (isPasteContainer(resolved.node)) {
    const children = resolved.node.kind === 'icon' ? [] : (resolved.node.children ?? []);
    return { regionId: target.nodeId, parent: [...target.path], index: children.length };
  }
  return {
    regionId: target.nodeId,
    parent: target.path.slice(0, -1),
    index: (target.path.at(-1) ?? 0) + 1,
  };
}

/** The declared region stylesheet prop (`css`), when the block has one. */
function regionCssKey(kernel: BuilderKernel, regionId: NodeId): string | undefined {
  const node = kernel.getDocument().nodes[regionId];
  const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  if (schema === undefined) return undefined;
  return 'css' in propsShapeOf(schema.props) ? 'css' : undefined;
}

/** A region's own `ck-` hook rules travel with a node that uses one. */
const REGION_HOOK = /(^|[\s"])ck-(?!s-|fx-)[a-z]/u;

function payloadFor(kernel: BuilderKernel, regionId: NodeId, node: CustomCodeNode): ElementPayload {
  const key = regionCssKey(kernel, regionId);
  const css = key === undefined ? undefined : kernel.getDocument().nodes[regionId]?.props[key];
  const usesHooks = REGION_HOOK.test(JSON.stringify(node));
  return elementPayload(node, usesHooks && typeof css === 'string' ? css : undefined);
}

function serialize(items: readonly ElementPayload[]): string {
  if (items.length === 1 && items[0] !== undefined) return serializeElementPayload(items[0]);
  const list: ElementPayloadList = { craftkit: 'tree-nodes', v: 1, items };
  return JSON.stringify(list);
}

/** Wire text → payloads, or `undefined` for anything that is not ours. */
export function parseElementPayloads(text: string): ElementPayload[] | undefined {
  const single = parseElementPayload(text);
  if (single !== undefined) return [single];
  if (!text.trimStart().startsWith('{')) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Partial<ElementPayloadList>;
  if (record.craftkit !== 'tree-nodes' || record.v !== 1 || !Array.isArray(record.items)) return undefined;
  const items = (record.items as unknown[]).map(elementPayloadFromValue);
  if (items.length === 0 || items.some((item) => item === undefined)) return undefined;
  return items as ElementPayload[];
}

function defaultSystemClipboard(): SystemClipboard | null {
  if (typeof navigator === 'undefined') return null;
  const clipboard = (navigator as { clipboard?: SystemClipboard }).clipboard;
  return clipboard ?? null;
}

function labelsOf(context: ElementActionContext): ElementActionLabels {
  return context.labels ?? ELEMENT_ACTION_LABELS_EN;
}

/**
 * Insert payloads at a destination as ONE transaction (plus the region CSS
 * the nodes need, merged into the destination region when it lacks it).
 */
export function insertPayloads(
  context: ElementActionContext,
  payloads: readonly ElementPayload[],
  destination: PasteDestination,
  verb: string,
): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const steps: GroupStep[] = payloads.map((payload, at) => ({
    command: 'insertTreeNode',
    args: {
      id: destination.regionId,
      parent: [...destination.parent],
      index: destination.index + at,
      node: payload.node as unknown as Record<string, unknown>,
    },
  }));
  const cssKey = regionCssKey(kernel, destination.regionId);
  if (cssKey !== undefined) {
    const stored = kernel.getDocument().nodes[destination.regionId]?.props[cssKey];
    let merged = typeof stored === 'string' ? stored : '';
    for (const payload of payloads) {
      if (payload.css === undefined || merged.includes(payload.css)) continue;
      merged = merged === '' ? payload.css : `${merged}\n${payload.css}`;
    }
    if (merged !== (typeof stored === 'string' ? stored : '') && merged.length <= ELEMENT_PAYLOAD_CSS_MAX) {
      steps.push({ command: 'setProp', args: { id: destination.regionId, key: cssKey, value: merged } });
    }
  }
  const first = payloads[0];
  const subject =
    payloads.length === 1 && first !== undefined
      ? treeNodeDisplayName(first.node, ...(context.words === undefined ? [] : [context.words]))
      : labels.count(payloads.length);
  const label = `${verb} · ${subject}`;
  const result = tryDispatchTreeEdits(kernel, steps, label, context.author ?? 'user');
  if (!result.ok) return { ok: false, message: labels.refused(verb, result.message) };
  kernel.focusElement(destination.regionId, [...destination.parent, destination.index]);
  return { ok: true, message: labels.done(label) };
}

export function createElementClipboard(options: CreateElementClipboardOptions = {}): ElementClipboard {
  const system = options.system === undefined ? defaultSystemClipboard() : options.system;
  let memory: readonly ElementPayload[] = [];
  /** The exact text our last copy wrote, and whether the system accepted it. */
  let lastWritten: string | undefined;
  let systemHoldsOurs = false;
  let copiedStyle: string | undefined;

  async function write(items: readonly ElementPayload[]): Promise<void> {
    memory = items;
    const text = serialize(items);
    lastWritten = text;
    systemHoldsOurs = false;
    if (system === null) return;
    try {
      await system.writeText(text);
      systemHoldsOurs = true;
    } catch {
      // Refused (permission, focus, insecure origin): the memory copy stands.
    }
  }

  async function read(): Promise<readonly ElementPayload[]> {
    if (system === null) return memory;
    let text: string;
    try {
      text = await system.readText();
    } catch {
      return memory;
    }
    const parsed = parseElementPayloads(text);
    if (parsed !== undefined) return parsed;
    // Foreign text: when our own write never reached the system clipboard,
    // the person's last element copy is still the memory one.
    if (!systemHoldsOurs || text === lastWritten) return memory;
    return [];
  }

  async function copy(context: ElementActionContext): Promise<ElementActionOutcome> {
    const labels = labelsOf(context);
    const trees = liveTreeTargets(context.kernel, context.targets, context.words);
    if (trees.length === 0) {
      return { ok: false, message: context.targets.length === 0 ? labels.nothingSelected : labels.notAnElement };
    }
    await write(trees.map((target) => payloadFor(context.kernel, target.target.nodeId, target.node)));
    return {
      ok: true,
      message: labels.copied(trees.length === 1 ? (trees[0]?.displayName ?? '') : labels.count(trees.length)),
    };
  }

  function pasteItems(context: ElementActionContext, items: readonly ElementPayload[]): ElementActionOutcome {
    const labels = labelsOf(context);
    if (items.length === 0) return { ok: false, message: labels.clipboardEmpty };
    const destination = pasteDestination(context.kernel, context.targets[0]);
    if (destination === undefined) return { ok: false, message: labels.noPasteTarget };
    return insertPayloads(context, items, destination, labels.paste);
  }

  return {
    copy,
    async cut(context) {
      const copied = await copy(context);
      if (!copied.ok) return copied;
      return deleteElements(context, labelsOf(context).cut);
    },
    async paste(context) {
      return pasteItems(context, await read());
    },
    pasteText(context, text) {
      return pasteItems(context, parseElementPayloads(text) ?? []);
    },
    copyStyle(context) {
      const labels = labelsOf(context);
      const primary = liveTreeTargets(context.kernel, context.targets.slice(0, 1), context.words)[0];
      if (primary === undefined || primary.node.kind === 'component') {
        return { ok: false, message: context.targets.length === 0 ? labels.nothingSelected : labels.notAnElement };
      }
      copiedStyle = extractStyleClasses(primary.node.className ?? '');
      return { ok: true, message: labels.styleCopied(primary.displayName) };
    },
    pasteStyle(context) {
      const labels = labelsOf(context);
      if (copiedStyle === undefined) return { ok: false, message: labels.styleClipboardEmpty };
      const trees = liveTreeTargets(context.kernel, context.targets, context.words).filter(
        (target) => target.node.kind !== 'component',
      );
      if (trees.length === 0) return { ok: false, message: labels.notAnElement };
      const steps: GroupStep[] = [];
      for (const target of trees) {
        if (target.node.kind === 'component') continue;
        const current = target.node.className ?? '';
        const next = pasteStyleClasses(current, copiedStyle);
        if (next === current) continue;
        steps.push({
          command: 'patchTreeNode',
          args: {
            id: target.target.nodeId,
            path: [...target.target.path],
            set: { className: next === '' ? null : next },
          },
        });
      }
      if (steps.length === 0) return { ok: true, message: '' };
      const subject = trees.length === 1 ? (trees[0]?.displayName ?? '') : labels.count(trees.length);
      const label = `${labels.pasteStyle} · ${subject}`;
      const result = tryDispatchTreeEdits(context.kernel, steps, label, context.author ?? 'user');
      if (!result.ok) return { ok: false, message: labels.refused(labels.pasteStyle, result.message) };
      return { ok: true, message: labels.done(label) };
    },
    elements: () => memory,
    style: () => copiedStyle,
  };
}
