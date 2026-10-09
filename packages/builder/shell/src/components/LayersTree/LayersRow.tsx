import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

import type { LayerRow } from './layers-rows';

export interface LayersRowView {
  readonly name: string;
  /** Block rows: the node id; element rows: a text preview. */
  readonly detail: string | undefined;
  readonly description: string | undefined;
  /** Element rows only: 'H2', 'IMG', '◇'. */
  readonly glyph: string | undefined;
}

export interface LayersRowProps {
  readonly row: LayerRow;
  readonly view: LayersRowView;
  readonly selected: boolean;
  readonly primary: boolean;
  readonly tabbable: boolean;
  readonly collapsed: boolean;
  /** Depth to draw at; differs from `row.depth` while this row is being dragged. */
  readonly drawDepth: number;
  readonly draggable: boolean;
  readonly dragLabel: string;
  readonly hidden: { readonly hidden: boolean; readonly inherited: boolean; readonly label: string; readonly badge: string } | undefined;
  readonly locked: { readonly locked: boolean; readonly label: string } | undefined;
  readonly renaming: { readonly label: string } | undefined;
  readonly registerRow: (key: string, element: HTMLLIElement | null) => void;
  readonly onSelect: (row: LayerRow, event: MouseEvent) => void;
  readonly onToggleExpanded: (row: LayerRow) => void;
  readonly onRowKeyDown: (event: KeyboardEvent<HTMLLIElement>, row: LayerRow) => void;
  readonly onRowFocus: (row: LayerRow) => void;
  readonly onRowContextMenu: (row: LayerRow) => void;
  readonly onStartRename: (row: LayerRow) => void;
  readonly onCommitRename: (row: LayerRow, name: string | undefined) => void;
  readonly onToggleHidden: (row: LayerRow) => void;
  readonly onToggleLocked: (row: LayerRow) => void;
}

function rowPaddingForDepth(depth: number): string {
  const layers = Array.from({ length: depth }, () => 'var(--bldr-space-2xl)');
  return `calc(${['var(--bldr-space-md)', ...layers].join(' + ')})`;
}

/**
 * One Layers row: a sortable treeitem (dnd-kit) with its drag grip, the
 * expand toggle, the tag glyph, the name (or the inline rename field), and —
 * for elements — the hide and lock switches.
 */
export function LayersRow({
  row,
  view,
  selected,
  primary,
  tabbable,
  collapsed,
  drawDepth,
  draggable,
  dragLabel,
  hidden,
  locked,
  renaming,
  registerRow,
  onSelect,
  onToggleExpanded,
  onRowKeyDown,
  onRowFocus,
  onRowContextMenu,
  onStartRename,
  onCommitRename,
  onToggleHidden,
  onToggleLocked,
}: LayersRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
    disabled: !draggable,
  });

  const style: CSSProperties = {
    paddingInlineStart: rowPaddingForDepth(drawDepth),
    transform: CSS.Translate.toString(transform),
    ...(transition === undefined ? {} : { transition }),
  };

  const classes = [
    'bldr-layers__row',
    selected ? 'bldr-layers__row--selected' : '',
    primary ? 'bldr-layers__row--primary' : '',
    row.kind === 'element' ? 'bldr-layers__row--element' : '',
    hidden?.hidden === true ? 'bldr-layers__row--hidden' : '',
    isDragging ? 'bldr-layers__row--dragging' : '',
  ]
    .filter((name) => name !== '')
    .join(' ');

  return (
    <li
      ref={(element) => {
        setNodeRef(element);
        registerRow(row.key, element);
      }}
      role="treeitem"
      // The row's name alone: without it the name read the toggle glyph and
      // the node id with it ("▾Newannouncement").
      aria-label={view.name}
      aria-selected={selected}
      {...(row.expandable ? { 'aria-expanded': !collapsed } : {})}
      aria-level={row.depth + 1}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      tabIndex={tabbable ? 0 : -1}
      title={view.description}
      className={classes}
      style={style}
      data-layer-key={row.key}
      onClick={(event) => {
        onSelect(row, event);
      }}
      onDoubleClick={(event) => {
        if (row.kind !== 'element') return;
        event.stopPropagation();
        onStartRename(row);
      }}
      onKeyDown={(event) => {
        onRowKeyDown(event, row);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onRowFocus(row);
      }}
      onContextMenu={() => {
        onRowContextMenu(row);
      }}
    >
      {draggable ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="bldr-layers__grip"
          {...attributes}
          {...listeners}
          tabIndex={tabbable ? 0 : -1}
          aria-label={dragLabel}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="6" cy="4" r="1.2" />
            <circle cx="10" cy="4" r="1.2" />
            <circle cx="6" cy="8" r="1.2" />
            <circle cx="10" cy="8" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
            <circle cx="10" cy="12" r="1.2" />
          </svg>
        </button>
      ) : (
        <span className="bldr-layers__grip bldr-layers__grip--none" aria-hidden="true" />
      )}
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
      {view.glyph === undefined ? null : (
        <span className="bldr-layers__glyph" aria-hidden="true">
          {view.glyph}
        </span>
      )}
      <span className="bldr-layers__label">
        {renaming === undefined ? (
          <span className="bldr-layers__name">{view.name}</span>
        ) : (
          <input
            className="bldr-layers__rename"
            aria-label={renaming.label}
            defaultValue={row.kind === 'element' && row.node.kind !== 'icon' ? (row.node.label ?? '') : ''}
            placeholder={view.name}
            maxLength={60}
            autoFocus
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                onCommitRename(row, event.currentTarget.value);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onCommitRename(row, undefined);
              }
            }}
            onBlur={(event) => {
              onCommitRename(row, event.currentTarget.value);
            }}
          />
        )}
        {view.detail === undefined ? null : (
          <span className={row.kind === 'block' ? 'bldr-layers__identity' : 'bldr-layers__preview'}>
            {view.detail}
          </span>
        )}
      </span>
      {hidden === undefined ? null : (
        <button
          type="button"
          className="bldr-layers__switch"
          aria-label={hidden.label}
          aria-pressed={hidden.hidden}
          tabIndex={-1}
          data-inherited={hidden.inherited ? 'true' : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden(row);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
            <circle cx="8" cy="8" r="2" />
            {hidden.hidden ? <path d="M2.5 13.5 13.5 2.5" /> : null}
          </svg>
          {hidden.badge === '' ? null : <span className="bldr-layers__badge">{hidden.badge}</span>}
        </button>
      )}
      {locked === undefined ? null : (
        <button
          type="button"
          className="bldr-layers__switch"
          aria-label={locked.label}
          aria-pressed={locked.locked}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLocked(row);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
            <path d={locked.locked ? 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2' : 'M5.5 7V5a2.5 2.5 0 0 1 4.8-1'} />
          </svg>
        </button>
      )}
    </li>
  );
}
