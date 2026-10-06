import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import { useKernelSelector } from '@craftkit/builder-renderer';
import type { CustomCodeRoot, KernelState, NodeId, StyleBucket } from '@craftkit/builder-schema';

import {
  deleteElements,
  duplicateElements,
  hiddenStateAt,
  renameElement,
  toggleElementsHidden,
  toggleElementsLocked,
  unwrapElement,
  wrapElements,
  type ElementActionContext,
  type ElementActionOutcome,
} from '../../clipboard/element-actions';
import { ELEMENT_ACTION_LABELS_EN, type ElementActionLabels } from '../../clipboard/element-actions.labels';
import { createElementClipboard, type ElementClipboard } from '../../clipboard/element-clipboard';
import { asCustomCodeRoot } from '../../custom-code/element-at';
import {
  ELEMENT_NAME_WORDS_EN,
  elementTargetKey,
  treeNodeDisplayName,
  tryDispatchTreeEdits,
  type ElementNameWords,
  type ElementTarget,
} from '../../custom-code/element-target';
import { parentOf, type SlotOrderLookup } from '../../keyboard/traversal';
import { blockDisplayName } from '../../naming/block-display-name';
import type { ElementSelection } from '../../selection/element-selection';
import '../../styles/visually-hidden.css';
import { LayersRow, type LayersRowView } from './LayersRow';
import { LAYERS_TREE_LABELS_EN, type LayersTreeLabels } from './LayersTree.labels';
import {
  blockRowKey,
  buildLayerRows,
  dragRows,
  elementGlyph,
  elementTextPreview,
  planDrop,
  projectDrop,
  rowTarget,
  type LayerRow,
  type Projection,
} from './layers-rows';
import './LayersTree.css';

/** What "Save as template" hands the host (P5's `saveTemplate` command takes it from here). */
export interface LayersSaveTemplateRequest {
  readonly kind: 'element' | 'section';
  readonly target: ElementTarget;
  /** A suggested name: the row's name. */
  readonly name: string;
  readonly tree: CustomCodeRoot;
  readonly css?: string;
}

export interface LayersTreeProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** The multi-selection store (P2); Shift/Mod-click toggles members. Absent ⇒ single selection. */
  selection?: ElementSelection | undefined;
  /** Shared with the keyboard map so a copy here pastes there. Absent ⇒ a private one. */
  clipboard?: ElementClipboard | undefined;
  /** The style panel's bucket: the eye hides there. Defaults to `base`. */
  bucket?: StyleBucket | undefined;
  labels?: LayersTreeLabels | undefined;
  actionLabels?: ElementActionLabels | undefined;
  words?: ElementNameWords | undefined;
  /** "Save as template" — present ⇒ the menu item shows. */
  onSaveTemplate?: ((request: LayersSaveTemplateRequest) => void) | undefined;
  /** "Make a symbol" on a custom-code region row — present ⇒ the menu item shows. */
  onMakeSymbol?: ((regionId: NodeId) => void) | undefined;
}

/** Pixels of pointer travel per indentation level while dragging. */
const INDENT_PX = 20;
/** Notional row height the keyboard drag reports to dnd-kit. */
const ROW_PX = 28;

const NO_TARGETS: readonly ElementTarget[] = [];
const noopSubscribe = (): (() => void) => () => undefined;

function primaryKeyOf(state: Readonly<KernelState>): string | null {
  if (state.elementFocus !== null) {
    return elementTargetKey({ kind: 'tree', nodeId: state.elementFocus.id, path: state.elementFocus.path });
  }
  const first = state.selection[0];
  return first === undefined ? null : blockRowKey(first);
}

function bucketName(labels: LayersTreeLabels, bucket: StyleBucket): string {
  if (typeof bucket === 'object') return labels.buckets.custom(bucket.maxWidth);
  return labels.buckets[bucket];
}

function bucketBadge(bucket: StyleBucket): string {
  if (typeof bucket === 'object') return String(bucket.maxWidth);
  return bucket === 'base' ? '' : bucket === 'tablet' ? 'T' : 'M';
}

interface DragState {
  readonly activeKey: string;
  readonly rows: readonly LayerRow[];
  readonly projection: Projection;
  readonly keyboard: boolean;
}

/**
 * The document as a structural tree (006 contract §5) — and, below every
 * custom-code region, its ELEMENT tree (style-manager DESIGN.md §E): rows
 * derive from the SAME ordering model the canvas traverses (l1), selection is
 * kernel state both ways with ancestor reveal (l2), expand/collapse is pure
 * view state (l3), and the whole thing is a keyboard-navigable ARIA tree with
 * roving tabindex (l4). Rows reorder and nest by dnd-kit (pointer and
 * keyboard), each drop ONE labelled `moveTreeNode` / `moveNode`; element rows
 * rename, hide at the current bucket, lock, and carry a context menu.
 */
export function LayersTree({
  kernel,
  selection,
  clipboard: clipboardProp,
  bucket = 'base',
  labels = LAYERS_TREE_LABELS_EN,
  actionLabels = ELEMENT_ACTION_LABELS_EN,
  words = ELEMENT_NAME_WORDS_EN,
  onSaveTemplate,
  onMakeSymbol,
}: LayersTreeProps) {
  const doc = useKernelSelector(
    kernel,
    useCallback((state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc, []),
  );
  const primaryKey = useKernelSelector(
    kernel,
    useCallback((state: ReturnType<BuilderKernel['context']['store']['getState']>) => primaryKeyOf(state), []),
  );
  const subscribeMembers = useCallback(
    (listener: () => void) => (selection === undefined ? noopSubscribe() : selection.subscribe(listener)),
    [selection],
  );
  const readMembers = useCallback(() => (selection === undefined ? NO_TARGETS : selection.targets()), [selection]);
  const members = useSyncExternalStore(subscribeMembers, readMembers, readMembers);
  const memberKeys = useMemo(() => new Set(members.map(elementTargetKey)), [members]);
  const [ownClipboard] = useState(() => createElementClipboard());
  const clipboard = clipboardProp ?? ownClipboard;

  // Collapsed-set model: empty = fully expanded (the default). Keys are row keys.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [activeRow, setActiveRow] = useState<string>(blockRowKey(doc.rootId));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menuRow, setMenuRow] = useState<LayerRow | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // {text, nonce}: a REPEATED outcome must still change the live region's text.
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const announce = useCallback((text: string) => {
    if (text === '') return;
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);

  const slotOrder = useCallback<SlotOrderLookup>(
    (type) => {
      const slots = kernel.context.registry.block(type)?.schema.slots;
      return slots === undefined ? undefined : Object.keys(slots);
    },
    [kernel],
  );

  /** Visible rows, document order — re-derived per document reference (l3). */
  const rows = useMemo(() => buildLayerRows(kernel, doc, slotOrder, collapsed), [kernel, doc, slotOrder, collapsed]);
  const shownRows = drag === null ? rows : drag.rows;

  // l2: an external selection reveals its row — expand every ancestor (blocks
  // AND elements). The adjust-during-render pattern: corrected in the SAME
  // render pass, no effect, no cascading renders.
  const [prevPrimary, setPrevPrimary] = useState<string | null>(primaryKey);
  if (primaryKey !== prevPrimary) {
    setPrevPrimary(primaryKey);
    if (primaryKey !== null) {
      const state = kernel.context.store.getState();
      const hostId = state.elementFocus?.id ?? state.selection[0];
      if (hostId !== undefined && doc.nodes[hostId] !== undefined) {
        const ancestors: string[] = [];
        if (state.elementFocus !== null) {
          ancestors.push(blockRowKey(hostId));
          const path = state.elementFocus.path;
          for (let length = 1; length < path.length; length += 1) {
            ancestors.push(elementTargetKey({ kind: 'tree', nodeId: hostId, path: path.slice(0, length) }));
          }
        }
        let ancestor = parentOf(doc, hostId);
        while (ancestor !== undefined) {
          ancestors.push(blockRowKey(ancestor));
          ancestor = parentOf(doc, ancestor);
        }
        if (ancestors.some((key) => collapsed.has(key))) {
          const next = new Set(collapsed);
          for (const key of ancestors) next.delete(key);
          setCollapsed(next);
        }
        setActiveRow(primaryKey);
      }
    }
  }

  const isSelected = useCallback(
    (row: LayerRow): boolean =>
      selection !== undefined && memberKeys.size > 0 ? memberKeys.has(row.key) : row.key === primaryKey,
    [selection, memberKeys, primaryKey],
  );

  const viewOf = useCallback(
    (row: LayerRow): LayersRowView => {
      if (row.kind === 'block') {
        const type = doc.nodes[row.id]?.type;
        return {
          name: blockDisplayName(kernel, row.id),
          detail: row.id,
          description: type === undefined ? undefined : kernel.context.registry.block(type)?.schema.description,
          glyph: undefined,
        };
      }
      const node = row.node;
      const own = node.kind === 'icon' ? undefined : node.label?.trim();
      const name =
        own !== undefined && own !== ''
          ? own
          : node.kind === 'icon'
            ? `${words.icon} ${node.name}`
            : node.kind === 'component'
              ? `${words.component} ${node.component}`
              : (words.tags[node.tag] ?? words.element);
      return {
        name,
        detail: node.kind === 'element' ? elementTextPreview(node) : undefined,
        description: treeNodeDisplayName(node, words),
        glyph: elementGlyph(node),
      };
    },
    [doc, kernel, words],
  );

  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Make a row the primary target through the kernel (and the multi-selection store). */
  const selectRow = useCallback(
    (row: LayerRow) => {
      const target = rowTarget(row);
      if (selection !== undefined) selection.set([target]);
      else if (target.kind === 'tree') kernel.focusElement(target.nodeId, target.path);
      else kernel.setSelection([target.nodeId]);
      setActiveRow(row.key);
    },
    [kernel, selection],
  );

  /** The rows an action applies to: the whole multi-selection when the row belongs to it. */
  const actionTargets = useCallback(
    (row: LayerRow): readonly ElementTarget[] =>
      memberKeys.has(row.key) && members.length > 1 ? members : [rowTarget(row)],
    [memberKeys, members],
  );

  const contextFor = useCallback(
    (row: LayerRow): ElementActionContext => ({ kernel, targets: actionTargets(row), labels: actionLabels, words }),
    [kernel, actionTargets, actionLabels, words],
  );

  const report = useCallback(
    (outcome: ElementActionOutcome) => {
      announce(outcome.message);
    },
    [announce],
  );

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLLIElement>, row: LayerRow) => {
      // Keys typed in the row's own controls (grip, rename field) stay theirs.
      if (event.target !== event.currentTarget) return;
      const at = rows.findIndex((candidate) => candidate.key === row.key);
      const mirrored = (key: string) =>
        doc.dir === 'rtl' && (key === 'ArrowLeft' || key === 'ArrowRight')
          ? key === 'ArrowLeft'
            ? 'ArrowRight'
            : 'ArrowLeft'
          : key;
      switch (mirrored(event.key)) {
        case 'ArrowDown': {
          const next = rows[at + 1];
          if (next !== undefined) setActiveRow(next.key);
          break;
        }
        case 'ArrowUp': {
          const previous = rows[at - 1];
          if (previous !== undefined) setActiveRow(previous.key);
          break;
        }
        case 'ArrowRight': {
          if (row.expandable && collapsed.has(row.key)) {
            toggle(row.key); // expand first…
          } else {
            const next = rows[at + 1];
            if (next !== undefined && next.depth > row.depth) setActiveRow(next.key); // …then step in
          }
          break;
        }
        case 'ArrowLeft': {
          if (row.expandable && !collapsed.has(row.key)) {
            toggle(row.key); // collapse first…
          } else if (row.parentKey !== undefined) {
            setActiveRow(row.parentKey); // …then step to the parent
          }
          break;
        }
        case 'Enter':
        case ' ': {
          selectRow(row);
          break;
        }
        case 'F2': {
          if (row.kind !== 'element' || row.node.kind === 'icon') return;
          setRenaming(row.key);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (row.parentKey === undefined) return;
          report(deleteElements(contextFor(row)));
          break;
        }
        default:
          return; // let everything else stay native
      }
      event.preventDefault();
    },
    [rows, collapsed, doc, toggle, selectRow, report, contextFor],
  );

  // Keep the roving focus target valid when rows change under it (state only).
  const navRef = useRef<HTMLElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const focusInsideRef = useRef(false);
  if (!rows.some((row) => row.key === activeRow)) {
    setActiveRow(blockRowKey(doc.rootId));
  }

  const registerRow = useCallback((key: string, element: HTMLLIElement | null) => {
    if (element === null) rowRefs.current.delete(key);
    else rowRefs.current.set(key, element);
  }, []);

  // Roving tabindex needs REAL focus to follow the active row. When the
  // FOCUSED row is removed (an undo pruning it), its <li> unmounts and the
  // browser drops focus to <body> during the commit — a LAYOUT effect repairs
  // it before paint.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const target = rowRefs.current.get(activeRow);
    if (nav === null || target === undefined || dragRef.current !== null) return;
    const activeElement = nav.ownerDocument.activeElement;
    const lostToBody =
      focusInsideRef.current && (activeElement === null || activeElement === nav.ownerDocument.body);
    const onRowControl = activeElement !== null && target.contains(activeElement) && activeElement !== target;
    if ((nav.contains(activeElement) || lostToBody) && activeElement !== target && !onRowControl) {
      target.focus();
    }
  }, [activeRow, rows]);

  // ── Drag and drop (dnd-kit) ───────────────────────────────────────────────

  const nameOf = useCallback(
    (key: UniqueIdentifier): string => {
      const row = rows.find((candidate) => candidate.key === String(key));
      return row === undefined ? String(key) : viewOf(row).name;
    },
    [rows, viewOf],
  );

  const updateDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const coordinateGetter = useCallback<KeyboardCoordinateGetter>(
    (event, { currentCoordinates }) => {
      const state = dragRef.current;
      if (state === null) return undefined;
      const rtl = kernel.context.dir === 'rtl';
      const code = event.code;
      let { overIndex, depth } = state.projection;
      if (code === 'ArrowDown') overIndex += 1;
      else if (code === 'ArrowUp') overIndex -= 1;
      else if (code === (rtl ? 'ArrowLeft' : 'ArrowRight')) depth += 1;
      else if (code === (rtl ? 'ArrowRight' : 'ArrowLeft')) depth -= 1;
      else return undefined;
      event.preventDefault();
      const next = projectDrop(state.rows, state.activeKey, overIndex, depth);
      if (next === undefined) return undefined;
      const previous = state.projection;
      if (next.overIndex === previous.overIndex && next.depth === previous.depth) return undefined;
      updateDrag({ ...state, projection: next });
      return {
        x: currentCoordinates.x + (next.depth - previous.depth) * INDENT_PX * (rtl ? -1 : 1),
        y: currentCoordinates.y + (next.overIndex - previous.overIndex) * ROW_PX,
      };
    },
    [kernel, updateDrag],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const onDragStart = useCallback(
    ({ active, activatorEvent }: DragStartEvent) => {
      const key = String(active.id);
      const list = dragRows(rows, key);
      const index = list.findIndex((row) => row.key === key);
      const row = list[index];
      if (row === undefined) return;
      const projection = projectDrop(list, key, index, row.depth);
      if (projection === undefined) return;
      setMenuRow(null);
      updateDrag({
        activeKey: key,
        rows: list,
        projection,
        keyboard: activatorEvent.type.startsWith('key'),
      });
    },
    [rows, updateDrag],
  );

  const onDragMove = useCallback(
    ({ delta, over }: DragMoveEvent) => {
      const state = dragRef.current;
      if (state === null || state.keyboard) return;
      const overIndex =
        over === null ? state.projection.overIndex : state.rows.findIndex((row) => row.key === String(over.id));
      const active = state.rows.find((row) => row.key === state.activeKey);
      if (active === undefined || overIndex < 0) return;
      const sign = kernel.context.dir === 'rtl' ? -1 : 1;
      const next = projectDrop(state.rows, state.activeKey, overIndex, active.depth + Math.round((sign * delta.x) / INDENT_PX));
      if (next === undefined) return;
      if (next.overIndex === state.projection.overIndex && next.depth === state.projection.depth) return;
      updateDrag({ ...state, projection: next });
    },
    [kernel, updateDrag],
  );

  const onDragEnd = useCallback(
    () => {
      const state = dragRef.current;
      updateDrag(null);
      if (state === null) return;
      const active = state.rows.find((row) => row.key === state.activeKey);
      if (active === undefined) return;
      const plan = planDrop(kernel, active, state.projection);
      const name = viewOf(active).name;
      if (!plan.ok) {
        if (!plan.unchanged) announce(labels.announce.cannotDrop(name));
        return;
      }
      const result = tryDispatchTreeEdits(kernel, [plan.step], `${actionLabels.move} · ${name}`);
      if (!result.ok) {
        announce(actionLabels.refused(actionLabels.move, result.message));
        return;
      }
      announce(actionLabels.done(`${actionLabels.move} · ${name}`));
      const focus = plan.focus;
      if (focus?.kind === 'tree') {
        kernel.focusElement(focus.nodeId, focus.path);
        setActiveRow(elementTargetKey(focus));
      } else if (focus !== undefined) {
        kernel.setSelection([focus.nodeId]);
        setActiveRow(blockRowKey(focus.nodeId));
      }
    },
    [kernel, updateDrag, viewOf, announce, labels, actionLabels],
  );

  const onDragCancel = useCallback(() => {
    updateDrag(null);
  }, [updateDrag]);

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => labels.announce.pickedUp(nameOf(active.id)),
      onDragMove: ({ active }) => {
        const state = dragRef.current;
        return state === null ? undefined : labels.announce.over(nameOf(active.id), state.projection.depth + 1);
      },
      onDragOver: ({ active }) => {
        const state = dragRef.current;
        return state === null ? undefined : labels.announce.over(nameOf(active.id), state.projection.depth + 1);
      },
      onDragEnd: () => undefined,
      onDragCancel: ({ active }) => labels.announce.cancelled(nameOf(active.id)),
    }),
    [labels, nameOf],
  );

  // ── Row handlers ──────────────────────────────────────────────────────────

  const onSelect = useCallback(
    (row: LayerRow, event: MouseEvent) => {
      if (selection !== undefined && (event.shiftKey || event.metaKey || event.ctrlKey)) {
        selection.toggle(rowTarget(row));
        setActiveRow(row.key);
        return;
      }
      selectRow(row);
    },
    [selection, selectRow],
  );

  const onCommitRename = useCallback(
    (row: LayerRow, name: string | undefined) => {
      setRenaming((current) => (current === row.key ? null : current));
      if (name === undefined || row.kind !== 'element') return;
      report(renameElement({ kernel, targets: [], labels: actionLabels, words }, rowTarget(row), name));
    },
    [kernel, actionLabels, words, report],
  );

  const onToggleHidden = useCallback(
    (row: LayerRow) => {
      report(toggleElementsHidden(contextFor(row), bucket));
    },
    [contextFor, bucket, report],
  );

  const onToggleLocked = useCallback(
    (row: LayerRow) => {
      report(toggleElementsLocked(contextFor(row)));
    },
    [contextFor, report],
  );

  const onRowContextMenu = useCallback(
    (row: LayerRow) => {
      if (!isSelected(row)) selectRow(row);
      setMenuRow(row);
    },
    [isSelected, selectRow],
  );

  // ── Context menu actions ────────────────────────────────────────────────

  const regionCss = useCallback(
    (regionId: NodeId): string | undefined => {
      const css = doc.nodes[regionId]?.props['css'];
      return typeof css === 'string' && css.trim() !== '' ? css : undefined;
    },
    [doc],
  );

  const saveTemplate = useCallback(
    (row: LayerRow) => {
      if (onSaveTemplate === undefined) return;
      const name = viewOf(row).name;
      if (row.kind === 'element') {
        const css = regionCss(row.nodeId);
        onSaveTemplate({
          kind: 'element',
          target: rowTarget(row),
          name,
          tree: { kind: 'root', children: [JSON.parse(JSON.stringify(row.node)) as typeof row.node] },
          ...(css === undefined ? {} : { css }),
        });
        return;
      }
      if (row.treeKey === undefined) return;
      const tree = asCustomCodeRoot(doc.nodes[row.id]?.props[row.treeKey]);
      if (tree === undefined) return;
      const css = regionCss(row.id);
      onSaveTemplate({
        kind: 'section',
        target: rowTarget(row),
        name,
        tree: JSON.parse(JSON.stringify(tree)) as CustomCodeRoot,
        ...(css === undefined ? {} : { css }),
      });
    },
    [onSaveTemplate, viewOf, regionCss, doc],
  );

  const menuIsElement = menuRow?.kind === 'element';
  const menuIsRegion = menuRow?.kind === 'block' && menuRow.treeKey !== undefined;
  const menuIsRoot = menuRow?.parentKey === undefined;

  const runMenu = (run: (row: LayerRow) => void) => () => {
    if (menuRow !== null) run(menuRow);
  };

  return (
    <nav
      ref={navRef}
      className="bldr-layers"
      aria-label={labels.title}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next !== null && !event.currentTarget.contains(next)) {
          focusInsideRef.current = false;
        }
      }}
    >
      <h2 className="bldr-layers__title">{labels.title}</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements, screenReaderInstructions: { draggable: labels.dragInstructions } }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={shownRows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
          <ContextMenu.Root
            onOpenChange={(open) => {
              if (!open) setMenuRow(null);
            }}
          >
            <ContextMenu.Trigger asChild>
              <ul role="tree" className="bldr-layers__tree" aria-label={labels.tree} aria-multiselectable={selection !== undefined}>
                {shownRows.map((row) => {
                  const view = viewOf(row);
                  const node = row.kind === 'element' ? row.node : undefined;
                  const className = node === undefined || node.kind === 'component' ? undefined : (node.className ?? '');
                  const hidden = className === undefined ? undefined : hiddenStateAt(className, bucket);
                  return (
                    <LayersRow
                      key={row.key}
                      row={row}
                      view={view}
                      selected={isSelected(row)}
                      primary={row.key === primaryKey}
                      tabbable={activeRow === row.key}
                      collapsed={collapsed.has(row.key)}
                      drawDepth={drag !== null && drag.activeKey === row.key ? drag.projection.depth : row.depth}
                      draggable={row.parentKey !== undefined && renaming !== row.key}
                      dragLabel={labels.dragHandle(view.name)}
                      hidden={
                        hidden === undefined
                          ? undefined
                          : {
                              hidden: hidden.hidden,
                              inherited: hidden.source === 'inherited',
                              label: hidden.source === 'inherited'
                                ? `${labels.hide(view.name, bucketName(labels, bucket))} · ${labels.hiddenElsewhere}`
                                : labels.hide(view.name, bucketName(labels, bucket)),
                              badge: bucketBadge(bucket),
                            }
                      }
                      locked={
                        node === undefined ? undefined : { locked: node.locked === true, label: labels.lock(view.name) }
                      }
                      renaming={renaming === row.key ? { label: labels.renameInput(view.name) } : undefined}
                      registerRow={registerRow}
                      onSelect={onSelect}
                      onToggleExpanded={(target) => {
                        toggle(target.key);
                      }}
                      onRowKeyDown={onRowKeyDown}
                      onRowFocus={(target) => {
                        focusInsideRef.current = true;
                        setActiveRow(target.key);
                      }}
                      onRowContextMenu={onRowContextMenu}
                      onStartRename={(target) => {
                        if (target.kind === 'element' && target.node.kind !== 'icon') setRenaming(target.key);
                      }}
                      onCommitRename={onCommitRename}
                      onToggleHidden={onToggleHidden}
                      onToggleLocked={onToggleLocked}
                    />
                  );
                })}
              </ul>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="bldr-layers__menu">
                {menuIsElement ? (
                  <>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        void clipboard.copy(contextFor(row)).then(report);
                      })}
                    >
                      {labels.menu.copy}
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        void clipboard.cut(contextFor(row)).then(report);
                      })}
                    >
                      {labels.menu.cut}
                    </ContextMenu.Item>
                  </>
                ) : null}
                {menuIsElement || menuIsRegion ? (
                  <ContextMenu.Item
                    className="bldr-layers__menu-item"
                    onSelect={runMenu((row) => {
                      void clipboard.paste({ ...contextFor(row), targets: [rowTarget(row)] }).then(report);
                    })}
                  >
                    {labels.menu.paste}
                  </ContextMenu.Item>
                ) : null}
                {menuIsElement ? (
                  <>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        report(clipboard.copyStyle(contextFor(row)));
                      })}
                    >
                      {labels.menu.copyStyle}
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      disabled={clipboard.style() === undefined}
                      onSelect={runMenu((row) => {
                        report(clipboard.pasteStyle(contextFor(row)));
                      })}
                    >
                      {labels.menu.pasteStyle}
                    </ContextMenu.Item>
                    <ContextMenu.Separator className="bldr-layers__menu-separator" />
                  </>
                ) : null}
                {menuIsRoot ? null : (
                  <ContextMenu.Item
                    className="bldr-layers__menu-item"
                    onSelect={runMenu((row) => {
                      report(duplicateElements(contextFor(row)));
                    })}
                  >
                    {labels.menu.duplicate}
                  </ContextMenu.Item>
                )}
                {menuIsElement ? (
                  <>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        report(wrapElements(contextFor(row)));
                      })}
                    >
                      {labels.menu.wrap}
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        report(unwrapElement(contextFor(row)));
                      })}
                    >
                      {labels.menu.unwrap}
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="bldr-layers__menu-item"
                      onSelect={runMenu((row) => {
                        setRenaming(row.key);
                      })}
                    >
                      {labels.menu.rename}
                    </ContextMenu.Item>
                    <ContextMenu.Item className="bldr-layers__menu-item" onSelect={runMenu(onToggleHidden)}>
                      {labels.menu.hide}
                    </ContextMenu.Item>
                    <ContextMenu.Item className="bldr-layers__menu-item" onSelect={runMenu(onToggleLocked)}>
                      {labels.menu.lock}
                    </ContextMenu.Item>
                  </>
                ) : null}
                {onSaveTemplate !== undefined && (menuIsElement || menuIsRegion) ? (
                  <ContextMenu.Item className="bldr-layers__menu-item" onSelect={runMenu(saveTemplate)}>
                    {labels.menu.saveTemplate}
                  </ContextMenu.Item>
                ) : null}
                {onMakeSymbol !== undefined && menuIsRegion ? (
                  <ContextMenu.Item
                    className="bldr-layers__menu-item"
                    onSelect={runMenu((row) => {
                      if (row.kind === 'block') onMakeSymbol(row.id);
                    })}
                  >
                    {labels.menu.makeSymbol}
                  </ContextMenu.Item>
                ) : null}
                {menuIsRoot ? null : (
                  <>
                    <ContextMenu.Separator className="bldr-layers__menu-separator" />
                    <ContextMenu.Item
                      className="bldr-layers__menu-item bldr-layers__menu-item--danger"
                      onSelect={runMenu((row) => {
                        report(deleteElements(contextFor(row)));
                      })}
                    >
                      {labels.menu.delete}
                    </ContextMenu.Item>
                  </>
                )}
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </SortableContext>
      </DndContext>
      <p className="bldr-visually-hidden" role="status" aria-live="polite">
        {message.nonce % 2 === 1 ? `${message.text}​` : message.text}
      </p>
    </nav>
  );
}
