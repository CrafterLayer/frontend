import type { BuilderKernel, SiteGroupStep } from '@craftkit/builder-core';
import {
  extractStyleClasses,
  namedStyleIdOf,
  namedStyleMarker,
  namedStyleUsageCounts,
  similarSiblings,
  type BuilderSite,
  type CustomCodeNode,
  type NamedStyle,
  type PageId,
} from '@craftkit/builder-schema';

import { paletteSlug } from '../PaletteRampEditor/ramp';
import {
  resolveElementTarget,
  type ElementNameWords,
  type ElementTarget,
  type ResolvedTreeTarget,
} from '../../custom-code/element-target';

/*
  ── Named-style operations (style-manager DESIGN.md §G "Class / style manager")

  Pure step builders: each returns the site and page steps ONE person-visible
  action needs, or the sentence explaining why it cannot be done. The panel
  sends them as one labelled `dispatchGroup`, so "create a style from this
  element" — the style written to the library AND the element's classes
  replaced by its marker — is one transaction and one Undo.
*/

export interface StyleRow {
  readonly style: NamedStyle;
  readonly uses: number;
}

/** The library's named styles by name, each with how many holders use it. */
export function namedStyleRows(site: Readonly<BuilderSite>): readonly StyleRow[] {
  const styles = site.library?.styles ?? {};
  const counts = namedStyleUsageCounts(site);
  return Object.values(styles)
    .map((style) => ({ style, uses: counts[style.id] ?? 0 }))
    .sort((left, right) => left.style.name.localeCompare(right.style.name));
}

export type StepsOrRefusal =
  | { readonly ok: true; readonly steps: readonly SiteGroupStep[] }
  | { readonly ok: false; readonly message: string };

function tokens(className: string): string[] {
  return className.split(/\s+/u).filter((token) => token !== '');
}

function classNameOf(node: CustomCodeNode): string | undefined {
  return node.kind === 'component' ? undefined : (node.className ?? '');
}

/** The named-style ids an element carries, in marker (combo) order. */
export function markersOf(className: string): string[] {
  return tokens(className)
    .map(namedStyleIdOf)
    .filter((id): id is string => id !== undefined);
}

/** A free style id for `name` among `taken`. */
export function freshStyleId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug = paletteSlug(name).replace(/^c-/u, 's-');
  if (!used.has(slug)) return slug;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${slug.slice(0, 42)}-${String(n)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug.slice(0, 30)}-${String(used.size)}`;
}

/** A tree target resolved on the page, or the reason it cannot carry a named style. */
export function resolveStyledTarget(
  page: BuilderKernel,
  target: ElementTarget,
  words?: ElementNameWords,
): ResolvedTreeTarget | string {
  const resolved = resolveElementTarget(page, target, words);
  if (resolved === undefined) return 'The selected element no longer exists.';
  if (resolved.kind === 'block') {
    return 'Named styles apply to elements inside a composed region. Convert the block to editable first.';
  }
  if (resolved.node.kind === 'component') {
    return 'A component is styled through its own props; wrap it in an element to give it a named style.';
  }
  return resolved;
}

function patchClass(
  resolved: ResolvedTreeTarget,
  className: string,
  pageId: PageId,
): SiteGroupStep {
  return {
    command: 'patchTreeNode',
    args: { id: resolved.target.nodeId, path: [...resolved.target.path], set: { className } },
    pageId,
  };
}

/**
 * "Create style from element": the element's style classes become a new
 * library style, and the element keeps its structural classes, its existing
 * markers (in order) and the new marker last — so the look is unchanged.
 */
export function createStyleFromElement(
  site: Readonly<BuilderSite>,
  resolved: ResolvedTreeTarget,
  name: string,
  pageId: PageId,
): StepsOrRefusal & { readonly id?: string } {
  const className = classNameOf(resolved.node) ?? '';
  const style = tokens(extractStyleClasses(className)).filter((token) => namedStyleIdOf(token) === undefined);
  if (style.length === 0) {
    return { ok: false, message: 'This element has no style classes to make a style from.' };
  }
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, message: 'Name the style first.' };
  const id = freshStyleId(trimmed, Object.keys(site.library?.styles ?? {}));
  const moved = new Set(style);
  const kept = tokens(className).filter((token) => !moved.has(token));
  const structural = kept.filter((token) => namedStyleIdOf(token) === undefined);
  const markers = kept.filter((token) => namedStyleIdOf(token) !== undefined);
  const next = [...structural, ...markers, namedStyleMarker(id)].join(' ');
  return {
    ok: true,
    id,
    steps: [
      {
        command: 'setNamedStyle',
        args: { style: { id, name: trimmed.slice(0, 80), className: style.join(' ') } },
      },
      patchClass(resolved, next, pageId),
    ],
  };
}

/** Add the style's marker (last, so it wins over earlier combo styles) to every target. */
export function applyStyleSteps(
  targets: readonly ResolvedTreeTarget[],
  id: string,
  pageId: PageId,
): StepsOrRefusal {
  const marker = namedStyleMarker(id);
  const steps = targets.flatMap((resolved) => {
    const className = classNameOf(resolved.node);
    if (className === undefined || tokens(className).includes(marker)) return [];
    return [patchClass(resolved, [...tokens(className), marker].join(' '), pageId)];
  });
  if (steps.length === 0) return { ok: false, message: 'Every selected element already has this style.' };
  return { ok: true, steps };
}

/** Remove the style's marker from one element (its own classes stay). */
export function removeMarkerSteps(
  resolved: ResolvedTreeTarget,
  id: string,
  pageId: PageId,
): StepsOrRefusal {
  const className = classNameOf(resolved.node) ?? '';
  const marker = namedStyleMarker(id);
  if (!tokens(className).includes(marker)) return { ok: false, message: 'The element does not carry that style.' };
  const next = tokens(className).filter((token) => token !== marker).join(' ');
  return { ok: true, steps: [patchClass(resolved, next, pageId)] };
}

/**
 * Move one marker earlier (-1) or later (+1) in the element's combo order.
 * Later markers win a conflict, so order is meaningful.
 */
export function reorderMarkerSteps(
  resolved: ResolvedTreeTarget,
  id: string,
  delta: -1 | 1,
  pageId: PageId,
): StepsOrRefusal {
  const all = tokens(classNameOf(resolved.node) ?? '');
  const marker = namedStyleMarker(id);
  const positions = all
    .map((token, at) => (namedStyleIdOf(token) === undefined ? -1 : at))
    .filter((at) => at !== -1);
  const here = positions.findIndex((at) => all[at] === marker);
  const there = here + delta;
  if (here === -1 || there < 0 || there >= positions.length) {
    return { ok: false, message: 'That style cannot move further.' };
  }
  const next = [...all];
  const from = positions[here] ?? 0;
  const to = positions[there] ?? 0;
  next[from] = all[to] ?? marker;
  next[to] = marker;
  return { ok: true, steps: [patchClass(resolved, next.join(' '), pageId)] };
}

/**
 * The target plus every sibling that looks like it (same kind, tag and class
 * set): "apply to all similar".
 */
export function similarTargets(resolved: ResolvedTreeTarget): readonly ElementTarget[] {
  return similarSiblings(resolved.tree, resolved.target.path).map((path) => ({
    kind: 'tree' as const,
    nodeId: resolved.target.nodeId,
    path,
  }));
}
