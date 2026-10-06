import type { KeyboardEvent } from 'react';

import type { PartLayerRow } from './layers-part-rows';
import type { LayersPartLabels } from './LayersPartRow.labels';

/** What an item row's buttons ask for; the tree runs it through `planPartListOp`. */
export type LayersPartAction = 'duplicate' | 'moveUp' | 'moveDown' | 'remove';

export interface LayersPartRowProps {
  readonly row: PartLayerRow;
  /** "Title 3": the part's label in the editor's language. */
  readonly name: string;
  /** The part's own content, shown isolated (`<bdi>`) so its direction never reorders the row. */
  readonly preview: string | undefined;
  /** "Heading · Hero". */
  readonly description: string;
  readonly glyph: string;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly collapsed: boolean;
  readonly labels: LayersPartLabels;
  readonly registerRow: (key: string, element: HTMLLIElement | null) => void;
  readonly onSelect: (row: PartLayerRow) => void;
  readonly onToggleExpanded: (row: PartLayerRow) => void;
  readonly onRowKeyDown: (event: KeyboardEvent<HTMLLIElement>, row: PartLayerRow) => void;
  readonly onRowFocus: (row: PartLayerRow) => void;
  /** Item rows only: Duplicate, Move up / down, Remove. */
  readonly onAction?: ((row: PartLayerRow, action: LayersPartAction) => void) | undefined;
}

function rowPaddingForDepth(depth: number): string {
  const layers = Array.from({ length: depth }, () => 'var(--bldr-space-2xl)');
  return `calc(${['var(--bldr-space-md)', ...layers].join(' + ')})`;
}

const ACTION_GLYPHS: Readonly<Record<LayersPartAction, string>> = {
  duplicate: '⧉',
  moveUp: '↑',
  moveDown: '↓',
  remove: '×',
};

/**
 * One PART row of a registered block in Layers (block-parts DESIGN §2.13): a
 * treeitem with no drag grip (a part's place is the block's to decide), the
 * expand toggle, a kind glyph, the localized part name and an isolated text
 * preview. Item rows carry Duplicate, Move up / down and Remove; each is one
 * labelled transaction through the part planners.
 */
export function LayersPartRow({
  row,
  name,
  preview,
  description,
  glyph,
  selected,
  tabbable,
  collapsed,
  labels,
  registerRow,
  onSelect,
  onToggleExpanded,
  onRowKeyDown,
  onRowFocus,
  onAction,
}: LayersPartRowProps) {
  const classes = ['bldr-layers__row', 'bldr-layers__row--part', selected ? 'bldr-layers__row--selected' : '']
    .filter((value) => value !== '')
    .join(' ');
  const actions: readonly LayersPartAction[] =
    row.decl.kind === 'item' && onAction !== undefined ? ['duplicate', 'moveUp', 'moveDown', 'remove'] : [];

  return (
    <li
      ref={(element) => {
        registerRow(row.key, element);
      }}
      role="treeitem"
      aria-selected={selected}
      {...(row.expandable ? { 'aria-expanded': !collapsed } : {})}
      aria-level={row.depth + 1}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      tabIndex={tabbable ? 0 : -1}
      title={description}
      className={classes}
      style={{ paddingInlineStart: rowPaddingForDepth(row.depth) }}
      data-layer-key={row.key}
      data-part-kind={row.decl.kind}
      onClick={() => {
        onSelect(row);
      }}
      onKeyDown={(event) => {
        onRowKeyDown(event, row);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onRowFocus(row);
      }}
      onContextMenu={(event) => {
        // A part has no copy / wrap / delete of its own: the tree's element menu stays shut.
        event.preventDefault();
      }}
    >
      <span className="bldr-layers__grip bldr-layers__grip--none" aria-hidden="true" />
      {row.expandable ? (
        <span
          className="bldr-layers__toggle"
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded(row);
          }}
        >
          {collapsed ? '▸' : '▾'}
        </span>
      ) : (
        <span className="bldr-layers__toggle" aria-hidden="true" />
      )}
      <span className="bldr-layers__glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="bldr-layers__label">
        <span className="bldr-layers__name">{name}</span>
        {/* block-parts (2026-10-06): an explicit dir="auto" gives the box its TEXT's
            direction, so an English preview in the Arabic panel truncates at its own end
            instead of overflowing past the panel's left edge. */}
        {preview === undefined ? null : (
          <bdi className="bldr-layers__preview" dir="auto">
            {preview}
          </bdi>
        )}
      </span>
      {actions.map((action) => {
        const disabled = (action === 'moveUp' && row.first) || (action === 'moveDown' && row.last);
        return (
          <button
            key={action}
            type="button"
            className="bldr-layers__switch bldr-layers__part-action"
            aria-label={labels.actionOn(labels.actions[action], name)}
            title={labels.actions[action]}
            tabIndex={-1}
            disabled={disabled}
            data-action={action}
            onClick={(event) => {
              event.stopPropagation();
              onAction?.(row, action);
            }}
          >
            <span aria-hidden="true">{ACTION_GLYPHS[action]}</span>
          </button>
        );
      })}
    </li>
  );
}
