import type { BuilderKernel } from '@craftkit/builder-core';
import { applyStyleIntents, type StyleIntent } from '@craftkit/builder-schema';

import {
  elementTargetKey,
  treeNodeDisplayName,
  type ElementNameWords,
} from '../custom-code/element-target';
import { styleTransactionLabel, type StyleApplyResult, type StyleSource } from './style-source';
import {
  classNameOfNode,
  ELEMENT_GONE,
  patchTreeTargets,
  readTreeTarget,
  type TreeEdit,
  type TreeTarget,
  type TreeWriteOptions,
} from './tree-writes';

export interface TreeElementSourceOptions extends TreeWriteOptions {
  readonly words?: ElementNameWords | undefined;
  /** "3 elements" — the label of a multi-target source. */
  readonly manyLabel?: ((count: number) => string) | undefined;
}

/**
 * The StyleSource of elements inside custom-code trees (free mode: agent
 * trees may use any value the live compiler can style). One target or many:
 * every apply runs the engine on each target's own classes and writes all of
 * them through `patchTreeNode` in ONE labelled group — one Undo.
 */
export function treeElementSource(
  kernel: BuilderKernel,
  targets: readonly TreeTarget[],
  options: TreeElementSourceOptions = {},
): StyleSource {
  const first = targets[0];
  const firstNode = first === undefined ? undefined : readTreeTarget(kernel, first, options);
  const label =
    targets.length === 1 && firstNode !== undefined
      ? treeNodeDisplayName(firstNode, options.words)
      : (options.manyLabel ?? ((count: number) => `${String(count)} elements`))(targets.length);

  return {
    id: targets.map(elementTargetKey).join('|'),
    label,
    mode: 'free',
    targetCount: targets.length,
    read: () => targets.map((target) => classNameOfNode(readTreeTarget(kernel, target, options))),
    apply: (intents: readonly StyleIntent[], property: string): StyleApplyResult => {
      const edits: TreeEdit[] = [];
      for (const target of targets) {
        const node = readTreeTarget(kernel, target, options);
        if (node === undefined) return { ok: false, message: ELEMENT_GONE };
        // A component reference has no classes of its own to style.
        if (node.kind === 'component') continue;
        const current = node.className ?? '';
        const result = applyStyleIntents(current, intents, { mode: 'free' });
        if (!result.ok) return result;
        if (result.className === current) continue;
        edits.push({
          target,
          patch: { set: { className: result.className === '' ? null : result.className } },
        });
      }
      return patchTreeTargets(kernel, edits, styleTransactionLabel(property, label), options);
    },
    subscribe: (onChange) => {
      const ids = [...new Set(targets.map((target) => target.nodeId))];
      const stops = ids.map((id) => kernel.context.store.subscribeNode(id, onChange));
      return () => {
        for (const stop of stops) stop();
      };
    },
  };
}
