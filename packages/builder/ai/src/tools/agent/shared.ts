import type { BuilderKernel } from '@craftkit/builder-core';

import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import type { AgentToolContext, AgentToolParse, AgentToolStep } from './types';

/*
  Helpers the P1 tools share: input reading, the region list, and a small
  immutable tree walker. Every error sentence is English and says how to fix
  the call — it is the repair round's only instruction.
*/

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fail<I>(error: string): AgentToolParse<I> {
  return { ok: false, error };
}

export function okParse<I>(value: I): AgentToolParse<I> {
  return { ok: true, value };
}

/** The input as a record, or undefined when it is not an object. */
export function inputRecord(input: unknown): JsonRecord | undefined {
  if (input === undefined || input === null) return {};
  return isRecord(input) ? input : undefined;
}

/** Keys the input carries that the tool does not know, for a precise refusal. */
export function unknownKeys(input: JsonRecord, known: readonly string[]): readonly string[] {
  return Object.keys(input).filter((key) => !known.includes(key));
}

export function optionalString(
  input: JsonRecord,
  key: string,
  max = 400,
): { readonly ok: true; readonly value: string | undefined } | { readonly ok: false; readonly error: string } {
  const value = input[key];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, error: `"${key}" must be a non-empty string.` };
  }
  if (value.length > max) return { ok: false, error: `"${key}" must be at most ${String(max)} characters.` };
  return { ok: true, value };
}

// ── Tree nodes ────────────────────────────────────────────────────────────────

export interface TreeElementNode {
  readonly kind: 'element';
  readonly tag: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly TreeNode[];
}

export interface TreeIconNode {
  readonly kind: 'icon';
  readonly name: string;
  readonly className?: string;
  readonly label?: string;
  readonly size?: number;
  readonly strokeWidth?: number;
}

export interface TreeOtherNode {
  readonly kind: string;
  readonly children?: readonly TreeNode[];
  readonly [key: string]: unknown;
}

export type TreeNode = TreeElementNode | TreeIconNode | TreeOtherNode;

export interface TreeRoot {
  readonly kind: 'root';
  readonly children: readonly TreeNode[];
}

export function isElement(node: unknown): node is TreeElementNode {
  return isRecord(node) && node['kind'] === 'element' && typeof node['tag'] === 'string';
}

export function isIcon(node: unknown): node is TreeIconNode {
  return isRecord(node) && node['kind'] === 'icon' && typeof node['name'] === 'string';
}

/** A region's tree read through the plan's earlier steps; markup is read the way the door reads it. */
export function readTree(context: AgentToolContext, id: string): TreeRoot | undefined {
  const value = context.readProp(id, 'tree');
  const tree = isTreeMarkup(value) ? parseTreeMarkup(value) : value;
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children'])) return undefined;
  return tree as unknown as TreeRoot;
}

/**
 * Rebuild a tree bottom-up: `visit` sees each node with its children already
 * rebuilt and returns the node to keep (the same reference when unchanged).
 * Unchanged subtrees keep their identity, so `changed` is a reference check.
 */
export function mapTree(tree: TreeRoot, visit: (node: TreeNode) => TreeNode): TreeRoot {
  const walk = (node: TreeNode): TreeNode => {
    const children = (node as { children?: readonly TreeNode[] }).children;
    let next = node;
    if (Array.isArray(children)) {
      const mapped = children.map(walk);
      if (mapped.some((child, index) => child !== children[index])) {
        next = { ...node, children: mapped };
      }
    }
    return visit(next);
  };
  const children = tree.children.map(walk);
  return children.some((child, index) => child !== tree.children[index]) ? { ...tree, children } : tree;
}

/** Every node of a tree, depth first, in document order. */
export function treeNodes(tree: TreeRoot): readonly TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: TreeNode): void => {
    out.push(node);
    const children: unknown = (node as { children?: unknown }).children;
    if (Array.isArray(children)) for (const child of children as readonly TreeNode[]) walk(child);
  };
  for (const child of tree.children) walk(child);
  return out;
}

/** The first element at the top of a region tree (its `section`, `header`, `footer`…). */
export function topElement(tree: TreeRoot): TreeElementNode | undefined {
  return tree.children.find(isElement);
}

// ── The page ──────────────────────────────────────────────────────────────────

export function rootIdOf(kernel: BuilderKernel): string {
  return kernel.getDocument().rootId;
}

/** The root's children, in page order (its default slot). */
export function rootChildren(kernel: BuilderKernel): readonly string[] {
  const document = kernel.getDocument();
  const root = document.nodes[document.rootId];
  const slots = root?.slots as Record<string, readonly string[] | undefined> | undefined;
  return slots?.['default'] ?? [];
}

/** Root children that hold a composed tree (customCode regions), in page order. */
export function regionIds(context: AgentToolContext): readonly string[] {
  return rootChildren(context.kernel).filter((id) => readTree(context, id) !== undefined);
}

/**
 * Whether a node's block declares `key`: the door refuses a setProp on an
 * undeclared prop, and the whole plan with it. Unknown shape ⇒ assume it does.
 */
export function declaresProp(kernel: BuilderKernel, nodeId: string, key: string): boolean {
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) return false;
  const block = kernel.context.registry.block(node.type);
  if (block === undefined) return false;
  const shape = (block.schema.props as unknown as { shape?: unknown }).shape;
  if (!isRecord(shape)) return true;
  return Object.hasOwn(shape, key);
}

export function setProp(id: string, key: string, value: unknown, title?: string): AgentToolStep {
  return { command: 'setProp', args: { id, key, value }, ...(title === undefined ? {} : { title }) };
}

/** Text compared the way a person means it: trimmed, whitespace runs as one space. */
export function sameText(left: string, right: string): boolean {
  const norm = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
  return norm(left) === norm(right);
}

/** A node's label for the page (`label` prop), when it has one. */
export function labelOf(context: AgentToolContext, id: string): string | undefined {
  const label = context.readProp(id, 'label');
  return typeof label === 'string' && label.trim() !== '' ? label : undefined;
}

export function isArabicLocale(context: AgentToolContext): boolean {
  return context.locale.lang.toLowerCase().startsWith('ar');
}
