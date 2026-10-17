import { readTree, setProp, type TreeNode } from '../shared';
import type { AgentToolContext, AgentToolRun } from '../types';

/*
  A section's vertical rhythm one step roomier or tighter (2026-10-13, ready
  scripts). «زوّد المسافات بين الأقسام» / "more space between the sections"
  was a model call that quoted every band's padding classes, one editTree per
  region. One step per band does it now: the band's vertical padding —
  `py-`, `pt-`, `pb-` at every breakpoint, on its outer element or, when that
  carries none, on its one wrapper — moves one step along the spacing scale
  the utility vocabulary generates, so each band keeps its proportion to the
  others and every class still renders. Vertical padding has no side to
  mirror, so a right-to-left page takes the same edit.
*/

/** The spacing steps a band's padding moves along (all generated at sm:/md:/lg:/xl: and bare). */
const SCALE = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64] as const;
const PADDING = /^((?:(?:sm|md|lg|xl):)?)(py|pt|pb)-(\d+)$/u;

function classes(node: TreeNode): readonly string[] {
  const className = (node as { className?: unknown }).className;
  return typeof className === 'string' ? className.split(/\s+/u).filter((name) => name !== '') : [];
}

/** One step along the scale from `value` (a value between steps moves to the next one). */
function stepped(value: number, step: 1 | -1): number {
  if (step === 1) return SCALE.find((entry) => entry > value) ?? value;
  return [...SCALE].reverse().find((entry) => entry < value) ?? value;
}

function respaced(node: TreeNode, step: 1 | -1): TreeNode | undefined {
  const list = classes(node);
  if (!list.some((name) => PADDING.test(name))) return undefined;
  const next = list.map((name) => {
    const match = PADDING.exec(name);
    return match === null
      ? name
      : `${match[1] ?? ''}${match[2] ?? ''}-${String(stepped(Number(match[3]), step))}`;
  });
  return next.every((name, index) => name === list[index])
    ? node
    : { ...node, className: next.join(' ') };
}

function elementChildren(node: TreeNode): readonly TreeNode[] {
  const children = (node as { children?: unknown }).children;
  return Array.isArray(children)
    ? (children as TreeNode[]).filter((child) => (child as { kind?: unknown }).kind === 'element')
    : [];
}

/** The region `id` one step roomier (`step` 1) or tighter (-1); no steps for a band with no vertical padding. */
export function spaceSection(id: string, step: 1 | -1, context: AgentToolContext): AgentToolRun {
  const tree = readTree(context, id);
  if (tree === undefined)
    return {
      ok: false,
      error: `"${id}" is not a composed region (customCode); space works on those.`,
    };
  const children = tree.children.map((child) => {
    if ((child as { kind?: unknown }).kind !== 'element') return child;
    const own = respaced(child, step);
    if (own !== undefined) {
      return own;
    }
    const wrappers = elementChildren(child);
    const wrapper = wrappers.length === 1 ? wrappers[0] : undefined;
    const inner = wrapper === undefined ? undefined : respaced(wrapper, step);
    if (wrapper === undefined || inner === undefined || inner === wrapper) return child;
    const kids = (child as { children: readonly TreeNode[] }).children.map((kid) =>
      kid === wrapper ? inner : kid,
    );
    return { ...child, children: kids };
  });
  if (children.every((child, index) => child === tree.children[index]))
    return { ok: true, steps: [], note: 'the section has no vertical padding to step' };
  return { ok: true, steps: [setProp(id, 'tree', { ...tree, children })] };
}
