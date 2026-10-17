import { useCallback, useMemo, type KeyboardEvent } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  blockPartsOf,
  planPartListOp,
  propSchemaAt,
  type BuilderDocument,
  type PartListOp,
  type PartRef,
} from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_EN, type ElementNameWords } from '../../custom-code/element-target';
import { blockDisplayName } from '../../naming/block-display-name';
import type { LayerRow } from './layers-rows';
import {
  partGlyph,
  partRowKey,
  partRowName,
  partRowPreview,
  withPartRows,
  type PartLayerRow,
  type TreeRow,
} from './layers-part-rows';
import type { LayersPartAction } from './LayersPartRow';
import { LAYERS_PART_LABELS_EN, type LayersPartLabels } from './LayersPartRow.labels';

export interface LayersPartsOptions {
  readonly kernel: BuilderKernel;
  readonly doc: BuilderDocument;
  readonly rows: readonly LayerRow[];
  readonly collapsed: ReadonlySet<string>;
  readonly labels?: LayersPartLabels | undefined;
  readonly words?: ElementNameWords | undefined;
  readonly announce: (text: string) => void;
  /** Moves the roving tab stop to a row key (after an item action, to the item's new place). */
  readonly setActiveRow: (key: string) => void;
}

export interface LayersPartView {
  readonly name: string;
  readonly preview: string | undefined;
  readonly description: string;
  readonly glyph: string;
}

export interface LayersParts {
  /** Layers' rows with every part-declaring block's part rows in place. */
  readonly rows: readonly TreeRow[];
  readonly labels: LayersPartLabels;
  readonly viewOf: (row: PartLayerRow) => LayersPartView;
  /** Click / Enter: the kernel's ephemeral part focus (it also selects the block). */
  readonly select: (row: PartLayerRow) => void;
  readonly runAction: (row: PartLayerRow, action: LayersPartAction) => void;
  /** Item keys: Delete / Backspace remove, Alt+↑ / Alt+↓ move. True when handled. */
  readonly onItemKey: (event: KeyboardEvent<HTMLLIElement>, row: PartLayerRow) => boolean;
}

/**
 * Layers' side of block parts (block-parts DESIGN §2.13): the part rows, their
 * names and previews, selection through `focusPart`, and the item actions —
 * each one `planPartListOp` dispatched as ONE labelled `dispatchGroup`, so one
 * Undo puts the list back.
 */
export function useLayersParts({
  kernel,
  doc,
  rows,
  collapsed,
  labels = LAYERS_PART_LABELS_EN,
  words = ELEMENT_NAME_WORDS_EN,
  announce,
  setActiveRow,
}: LayersPartsOptions): LayersParts {
  const treeRows = useMemo(() => withPartRows(kernel, doc, rows, collapsed), [kernel, doc, rows, collapsed]);

  const viewOf = useCallback(
    (row: PartLayerRow): LayersPartView => {
      const name = partRowName(row, labels);
      return {
        name,
        preview: partRowPreview(row, doc.nodes[row.nodeId]?.props, labels),
        description: labels.description(name, blockDisplayName(kernel, row.nodeId, words)),
        glyph: partGlyph(row.decl),
      };
    },
    [doc, kernel, labels, words],
  );

  const select = useCallback(
    (row: PartLayerRow) => {
      kernel.focusPart(row.nodeId, row.ref);
      setActiveRow(row.key);
    },
    [kernel, setActiveRow],
  );

  const runAction = useCallback(
    (row: PartLayerRow, action: LayersPartAction) => {
      const at = row.ref.index.at(-1);
      const node = kernel.getDocument().nodes[row.nodeId];
      const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
      if (row.decl.kind !== 'item' || at === undefined || node === undefined || schema === undefined) return;
      const op: PartListOp =
        action === 'duplicate'
          ? { kind: 'duplicate', at }
          : action === 'remove'
            ? { kind: 'remove', at }
            : { kind: 'move', from: at, to: action === 'moveUp' ? at - 1 : at + 1 };
      const actionName = labels.actions[action];
      const name = partRowName(row, labels);
      if (op.kind === 'move' && (op.to < 0 || (action === 'moveDown' && row.last))) return;
      const bind = typeof row.decl.bind === 'string' ? row.decl.bind : undefined;
      const itemSchema = bind === undefined ? undefined : propSchemaAt(schema.props, bind);
      const blockName = blockDisplayName(kernel, row.nodeId);
      const plan = planPartListOp(node, blockPartsOf(schema), row.ref, op, blockName, itemSchema);
      if (!plan.ok) {
        announce(labels.announce.refused(actionName, plan.message));
        return;
      }
      try {
        kernel.dispatchGroup(plan.steps, { author: 'user', label: plan.label });
      } catch (error) {
        announce(labels.announce.refused(actionName, error instanceof Error ? error.message : String(error)));
        return;
      }
      announce(labels.announce.done(actionName, name));
      // Follow the item to where it is now; after a remove, to its neighbour (or the block).
      const outer = row.ref.index.slice(0, -1);
      const nextIndex =
        op.kind === 'duplicate' ? at + 1 : op.kind === 'move' ? op.to : Math.max(0, at - (row.last ? 1 : 0));
      const ref: PartRef = { part: row.ref.part, index: [...outer, nextIndex] };
      if (op.kind === 'remove' && row.first && row.last) {
        kernel.setSelection([row.nodeId]);
        return;
      }
      kernel.focusPart(row.nodeId, ref);
      setActiveRow(partRowKey(row.nodeId, ref));
    },
    [kernel, labels, announce, setActiveRow],
  );

  const onItemKey = useCallback(
    (event: KeyboardEvent<HTMLLIElement>, row: PartLayerRow): boolean => {
      if (row.decl.kind !== 'item') return false;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        runAction(row, 'remove');
        return true;
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        runAction(row, event.key === 'ArrowUp' ? 'moveUp' : 'moveDown');
        return true;
      }
      return false;
    },
    [runAction],
  );

  return { rows: treeRows, labels, viewOf, select, runAction, onItemKey };
}
