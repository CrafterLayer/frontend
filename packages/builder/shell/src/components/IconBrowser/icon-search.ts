import type { BuilderKernel, SiteGroupStep } from '@craftkit/builder-core';
import {
  lucideIconNames,
  tablerFilledIconNames,
  tablerOutlineIconNames,
  type PageId,
} from '@craftkit/builder-schema';

import { resolveElementTarget, type ElementTarget } from '../../custom-code/element-target';

/*
  ── Icon search over Lucide + Tabler (style-manager DESIGN.md §C.3, §G) ─────
  Names come from the schema's generated lists (the same lists the door
  checks), spelled the way an icon node stores them: `mail` (Lucide),
  `tabler:mail`, `tabler-filled:heart`.
*/

export type IconSet = 'all' | 'lucide' | 'tabler' | 'tabler-filled';

const PREFIX: Readonly<Record<Exclude<IconSet, 'all'>, string>> = {
  lucide: '',
  tabler: 'tabler:',
  'tabler-filled': 'tabler-filled:',
};

function namesOf(set: Exclude<IconSet, 'all'>): ReadonlySet<string> {
  if (set === 'lucide') return lucideIconNames();
  return set === 'tabler' ? tablerOutlineIconNames() : tablerFilledIconNames();
}

/**
 * Up to `limit` icon names matching `query` (exact, then prefix, then
 * substring; Lucide first within a rank). An empty query lists the start of
 * each set.
 */
export function searchIcons(query: string, set: IconSet = 'all', limit = 120): readonly string[] {
  const needle = query.trim().toLowerCase().replace(/\s+/gu, '-');
  const sets: Exclude<IconSet, 'all'>[] = set === 'all' ? ['lucide', 'tabler', 'tabler-filled'] : [set];
  const ranked: { name: string; rank: number; order: number }[] = [];
  let order = 0;
  for (const each of sets) {
    for (const name of namesOf(each)) {
      order += 1;
      const rank = needle === '' ? 2 : name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : -1;
      if (rank !== -1) ranked.push({ name: `${PREFIX[each]}${name}`, rank, order });
    }
  }
  ranked.sort((left, right) => left.rank - right.rank || left.order - right.order);
  return ranked.slice(0, limit).map((entry) => entry.name);
}

export type IconStepsResult =
  | { readonly ok: true; readonly steps: readonly SiteGroupStep[] }
  | { readonly ok: false; readonly message: string };

/**
 * Put icon `name` on the selection: replace it when the selection IS an icon
 * (keeping its size, stroke, classes and label), otherwise append a new icon
 * inside the selected element.
 */
export function iconSteps(
  page: BuilderKernel,
  target: ElementTarget,
  name: string,
  pageId: PageId,
): IconStepsResult {
  const resolved = resolveElementTarget(page, target);
  if (resolved?.kind !== 'tree') {
    return { ok: false, message: 'Select an element inside a composed region to place an icon.' };
  }
  const path = [...resolved.target.path];
  const node = resolved.node;
  if (node.kind === 'icon') {
    return {
      ok: true,
      steps: [{ command: 'setTreeNode', args: { id: target.nodeId, path, node: { ...node, name } }, pageId }],
    };
  }
  if (node.kind !== 'element') return { ok: false, message: 'A component cannot hold an icon; select an element.' };
  return {
    ok: true,
    steps: [
      {
        command: 'insertTreeNode',
        args: { id: target.nodeId, parent: path, index: node.children?.length ?? 0, node: { kind: 'icon', name } },
        pageId,
      },
    ],
  };
}
