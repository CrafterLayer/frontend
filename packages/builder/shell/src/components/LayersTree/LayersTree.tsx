import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import { useKernelSelector } from '@craftkit/builder-renderer';
import type { NodeId } from '@craftkit/builder-schema';

import { orderedChildren, parentOf, type SlotOrderLookup } from '../../keyboard/traversal';
import { blockDisplayName } from '../../naming/block-display-name';
import './LayersTree.css';

export interface LayersTreeProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
}

interface Row {
  id: NodeId;
  depth: number;
  expandable: boolean;
  /** 1-based position among LOGICAL siblings + sibling-set size — the flat DOM
   *  cannot convey these, so ARIA requires them explicitly with aria-level. */
  posInSet: number;
  setSize: number;
}

interface RowPresentation {
  name: string;
  description: string | undefined;
}

function rowPaddingForDepth(depth: number): string {
  const layers = Array.from({ length: depth }, () => 'var(--bldr-space-2xl)');
  return `calc(${['var(--bldr-space-md)', ...layers].join(' + ')})`;
}

/**
 * The document as a structural tree (006 contract §5): rows derive from the
 * SAME ordering model the canvas traverses (l1), selection is kernel state both
 * ways with ancestor reveal (l2), expand/collapse is pure view state (l3), and
 * the whole thing is a keyboard-navigable ARIA tree with roving tabindex (l4).
 */
export function LayersTree({ kernel }: LayersTreeProps) {
  const doc = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc,
      [],
    ),
  );
  const selectedId = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) =>
        state.selection[0] ?? null,
      [],
    ),
  );

  // Collapsed-set model: empty = fully expanded (the default).
  const [collapsed, setCollapsed] = useState<ReadonlySet<NodeId>>(new Set());
  const [activeRow, setActiveRow] = useState<NodeId>(doc.rootId);

  const slotOrder = useCallback<SlotOrderLookup>(
    (type) => {
      const slots = kernel.context.registry.block(type)?.schema.slots;
      return slots === undefined ? undefined : Object.keys(slots);
    },
    [kernel],
  );

  /** Visible rows, document order — re-derived per document reference (l3). */
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (id: NodeId, depth: number, posInSet: number, setSize: number) => {
      const children = orderedChildren(doc, slotOrder, id);
      out.push({ id, depth, expandable: children.length > 0, posInSet, setSize });
      if (!collapsed.has(id)) {
        children.forEach((child, at) => {
          walk(child, depth + 1, at + 1, children.length);
        });
      }
    };
    walk(doc.rootId, 0, 1, 1);
    return out;
  }, [doc, slotOrder, collapsed]);

  // l2: an external selection reveals its row — expand every ancestor. The
  // adjust-during-render pattern (React's documented derived-state form): when
  // the selection input changes, state is corrected in the SAME render pass —
  // no effect, no cascading renders.
  const [prevSelected, setPrevSelected] = useState<NodeId | null>(selectedId);
  if (selectedId !== prevSelected) {
    setPrevSelected(selectedId);
    if (selectedId !== null && doc.nodes[selectedId] !== undefined) {
      let next: Set<NodeId> | null = null;
      let ancestor = parentOf(doc, selectedId);
      while (ancestor !== undefined) {
        if (collapsed.has(ancestor)) {
          next ??= new Set(collapsed);
          next.delete(ancestor);
        }
        ancestor = parentOf(doc, ancestor);
      }
      if (next !== null) {
        setCollapsed(next);
      }
      setActiveRow(selectedId);
    }
  }

  const presentationOf = useCallback(
    (id: NodeId): RowPresentation => {
      const type = doc.nodes[id]?.type;
      return {
        name: blockDisplayName(kernel, id),
        description:
          type === undefined ? undefined : kernel.context.registry.block(type)?.schema.description,
      };
    },
    [doc, kernel],
  );

  const toggle = useCallback((id: NodeId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const onRowKeyDown = useCallback(
    (event: React.KeyboardEvent, row: Row) => {
      const at = rows.findIndex((candidate) => candidate.id === row.id);
      const mirrored = (key: string) =>
        doc.dir === 'rtl' && (key === 'ArrowLeft' || key === 'ArrowRight')
          ? key === 'ArrowLeft'
            ? 'ArrowRight'
            : 'ArrowLeft'
          : key;
      switch (mirrored(event.key)) {
        case 'ArrowDown': {
          const next = rows[at + 1];
          if (next !== undefined) {
            setActiveRow(next.id);
          }
          break;
        }
        case 'ArrowUp': {
          const previous = rows[at - 1];
          if (previous !== undefined) {
            setActiveRow(previous.id);
          }
          break;
        }
        case 'ArrowRight': {
          if (row.expandable && collapsed.has(row.id)) {
            toggle(row.id); // expand first…
          } else {
            const next = rows[at + 1];
            if (next !== undefined && next.depth > row.depth) {
              setActiveRow(next.id); // …then step to the first child
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (row.expandable && !collapsed.has(row.id)) {
            toggle(row.id); // collapse first…
          } else {
            const parent = parentOf(doc, row.id);
            if (parent !== undefined) {
              setActiveRow(parent); // …then step to the parent
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          kernel.setSelection([row.id]);
          break;
        }
        default:
          return; // let everything else stay native
      }
      event.preventDefault();
    },
    [rows, collapsed, doc, kernel, toggle],
  );

  // Keep the roving focus target valid when rows change under it (state only —
  // the adjust-during-render pattern; refs stay untouched during render).
  const navRef = useRef<HTMLElement | null>(null);
  const rowRefs = useRef(new Map<NodeId, HTMLLIElement>());
  const focusInsideRef = useRef(false);
  if (!rows.some((row) => row.id === activeRow)) {
    setActiveRow(doc.rootId);
  }

  // Roving tabindex needs REAL focus to follow the active row. When the
  // FOCUSED row is removed (an undo pruning it), its <li> unmounts and the
  // browser drops focus to <body> during the commit — a LAYOUT effect runs
  // right after that commit and before paint, so it can both observe the loss
  // (focus was inside per the flag, activeElement fell to body) and repair it
  // before the user sees anything.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const target = rowRefs.current.get(activeRow);
    if (nav === null || target === undefined) {
      return;
    }
    const activeElement = nav.ownerDocument.activeElement;
    const lostToBody =
      focusInsideRef.current &&
      (activeElement === null || activeElement === nav.ownerDocument.body);
    if ((nav.contains(activeElement) || lostToBody) && activeElement !== target) {
      target.focus();
    }
  }, [activeRow, rows]);

  return (
    <nav
      ref={navRef}
      className="bldr-layers"
      aria-label="Layers"
      onBlur={(event) => {
        // relatedTarget === null covers BOTH "clicked something unfocusable"
        // and "the focused row was just removed" — keep the flag then, so the
        // removal path (restorePendingRef) can still restore. A real move to
        // an outside focusable clears it.
        const next = event.relatedTarget;
        if (next !== null && !event.currentTarget.contains(next)) {
          focusInsideRef.current = false;
        }
      }}
    >
      <h2 className="bldr-layers__title">Layers</h2>
      <ul role="tree" className="bldr-layers__tree" aria-label="Document structure">
        {rows.map((row) => {
          const presentation = presentationOf(row.id);
          return (
            <li
              key={row.id}
              ref={(element) => {
                if (element === null) {
                  rowRefs.current.delete(row.id);
                } else {
                  rowRefs.current.set(row.id, element);
                }
              }}
              role="treeitem"
              aria-selected={selectedId === row.id}
              {...(row.expandable ? { 'aria-expanded': !collapsed.has(row.id) } : {})}
              aria-level={row.depth + 1}
              aria-posinset={row.posInSet}
              aria-setsize={row.setSize}
              tabIndex={activeRow === row.id ? 0 : -1}
              title={presentation.description}
              className={`bldr-layers__row${selectedId === row.id ? ' bldr-layers__row--selected' : ''}`}
              style={{ paddingInlineStart: rowPaddingForDepth(row.depth) }}
              onClick={() => {
                setActiveRow(row.id);
                kernel.setSelection([row.id]);
              }}
              onKeyDown={(event) => {
                onRowKeyDown(event, row);
              }}
              onFocus={() => {
                focusInsideRef.current = true;
                setActiveRow(row.id);
              }}
            >
              {row.expandable ? (
                <span
                  className="bldr-layers__toggle"
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(row.id);
                  }}
                >
                  {collapsed.has(row.id) ? '▸' : '▾'}
                </span>
              ) : (
                <span className="bldr-layers__toggle" aria-hidden="true" />
              )}
              <span className="bldr-layers__label">
                <span className="bldr-layers__name">{presentation.name}</span>
                <span className="bldr-layers__identity">{row.id}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
