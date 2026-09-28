import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { t } from '../../copy';
import { PLAN_MIN_SECTIONS } from '../../model/page-plan-draft';
import type { Locale, PlanOp, PlanSectionView } from '../../model/view-types';
import { PlanSectionRow, type PlanRowControl, type PlanRowDrag } from '../PlanSectionRow';

import './PlanSectionList.css';

export interface PlanSectionListProps {
  readonly locale: Locale;
  readonly sections: readonly PlanSectionView[];
  /** False draws the read-only list of the SPEC §7.6 E6 fallback: nodes, numbers, titles. */
  readonly editable: boolean;
  /** Keys of rows whose name another row shares (PlanProblem `duplicateTitle`). */
  readonly duplicates?: ReadonlySet<string> | undefined;
  /**
   * Whether the plan would take an op (the model's `applyPlanOp` does not hand the same draft
   * back). Without it the list asks only what it can see: a move stays inside the list and a
   * removal leaves at least two sections. With it, a move the engine refuses for its shape
   * (a header moved below the hero) is offered as unavailable instead of silently ignored.
   */
  readonly accepts?: ((op: PlanOp) => boolean) | undefined;
  /** Every edit leaves as one `PlanOp` (`AgentController.editPlan`). */
  readonly onEdit: (op: PlanOp) => void;
  /**
   * Name each row `ck-plan-row-{key}` for the plan-to-build view transition (SPEC §5 moment
   * 4). Only the plan awaiting a decision sets it: two elements may never share a name.
   */
  readonly morph?: boolean | undefined;
  readonly id?: string | undefined;
}

/** SPEC §5 moment 6: rows arrive 24ms apart, and no later than the eighth. */
const ARRIVAL_STAGGER_MS = 24;
const ARRIVAL_CAP = 8;

/** A pointer must travel this far before a press on the handle becomes a drag. */
const DRAG_SLOP_PX = 4;

/**
 * jsdom (and a row not yet laid out) measures 0: the fine-pointer row height stands in, so a
 * drag still maps a distance to a number of rows.
 */
const FALLBACK_ROW_PX = 32;

/** How long a keyboard or menu move waits for the plan to answer before focus lets go. */
const MOVE_FOCUS_WAIT_MS = 600;

/** A CSS `view-transition-name` for a row: an identifier, whatever the section's key holds. */
export function planRowTransitionName(key: string): string {
  return `ck-plan-row-${key.replace(/[^A-Za-z0-9_-]/gu, '-')}`;
}

interface DragState {
  readonly key: string;
  readonly from: number;
  readonly pointerId: number;
  readonly startY: number;
  readonly rowHeight: number;
  readonly offset: number;
  readonly lifted: boolean;
}

interface PendingFocus {
  readonly key: string;
  readonly control: PlanRowControl;
  readonly sections: readonly PlanSectionView[];
  readonly until: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Where a drag would drop its row, in page order. */
function dropIndex(drag: DragState, count: number): number {
  return clamp(drag.from + Math.round(drag.offset / drag.rowHeight), 0, count - 1);
}

/** How far each row stands off its place while `drag` is under way. */
function dragOffsetOf(drag: DragState, index: number, count: number): PlanRowDrag | undefined {
  if (!drag.lifted) return undefined;
  if (index === drag.from) return { offset: drag.offset, lifted: true };
  const to = dropIndex(drag, count);
  if (drag.from < to && index > drag.from && index <= to) {
    return { offset: -drag.rowHeight, lifted: false };
  }
  if (to < drag.from && index >= to && index < drag.from) {
    return { offset: drag.rowHeight, lifted: false };
  }
  return undefined;
}

/**
 * The plan's sections (SPEC §4.11 PlanSectionList, frame §3.7): an `<ol>` named "Sections
 * (8)", one PlanSectionRow per section in page order, threaded on the pencil spine, a dashed
 * Track line down the glyph column from the first node to the last.
 *
 * The list owns the columns its rows share through subgrid (node 16, number 20, title, and
 * from 400px the purpose), exactly where the build's SpineList puts them, so when the plan
 * inks into the build the titles do not move.
 *
 * Reorder three ways (WCAG 2.5.7 asks for the two that are not a drag): drag a row's handle;
 * Alt+↑ / Alt+↓ on a focused row; `[⋯]` → Move up / Move down. Each is the same `move` op.
 * The list keeps focus on the moved row's control, the one the move started from, even when
 * the row's element is re-inserted; after a removal focus goes to the `[⋯]` of the row that
 * took its place. The controller announces moves and removals through LiveStatus
 * (`plan.moved`, `plan.removed`), the panel's one live region. A drag follows the pointer on the block axis
 * only, shifts the rows it passes by one row each, and drops on release; Esc cancels it.
 */
export function PlanSectionList({
  locale,
  sections,
  editable,
  duplicates,
  accepts,
  onEdit,
  morph = false,
  id,
}: PlanSectionListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pending = useRef<PendingFocus | null>(null);
  const [moveSeq, setMoveSeq] = useState(0);
  // The rows the plan arrived with arrive in page order; a row added later arrives at once.
  const [arrived] = useState(() => new Map(sections.map((section, index) => [section.key, index])));

  const count = sections.length;
  const allows = useCallback((op: PlanOp) => accepts?.(op) ?? true, [accepts]);

  const canMove = (index: number, delta: -1 | 1): boolean => {
    const section = sections[index];
    const to = index + delta;
    if (section === undefined || to < 0 || to >= count) return false;
    return allows({ kind: 'move', key: section.key, to });
  };

  const atFloor = count <= PLAN_MIN_SECTIONS;

  /* ── Focus follows the moved row ─────────────────────────────────────────── */

  const controlOf = (key: string, control: PlanRowControl): HTMLElement | null => {
    const list = listRef.current;
    if (list === null) return null;
    for (const row of list.children) {
      if (row instanceof HTMLElement && row.dataset['key'] === key) {
        return row.querySelector<HTMLElement>(`[data-control="${control}"]`);
      }
    }
    return null;
  };

  /** Asks for focus on `key`'s `control` once the plan has answered the op about to go out. */
  const focusAfter = (key: string, control: PlanRowControl) => {
    pending.current = { key, control, sections, until: Date.now() + MOVE_FOCUS_WAIT_MS };
    setMoveSeq((seq) => seq + 1);
  };

  const move = (key: string, to: number, control: PlanRowControl) => {
    focusAfter(key, control);
    onEdit({ kind: 'move', key, to });
  };

  /*
    Moving a row down re-inserts its element, and an element that leaves the document takes
    focus with it (to `body`). So after every render that follows a move, the control the
    move started from gets focus back; once the plan's order has changed, or the plan did
    not answer in time (it refused the move), the list stops asking.
  */
  useLayoutEffect(() => {
    const want = pending.current;
    if (want === null) return;
    if (Date.now() > want.until) {
      pending.current = null;
      return;
    }
    const target = controlOf(want.key, want.control);
    if (target !== null && document.activeElement !== target) target.focus();
    if (sections !== want.sections) pending.current = null;
  });

  useEffect(() => {
    if (moveSeq === 0) return undefined;
    const timer = setTimeout(() => {
      pending.current = null;
    }, MOVE_FOCUS_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [moveSeq]);

  /* ── Drag ────────────────────────────────────────────────────────────────── */

  const endDrag = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      endDrag.current?.();
    },
    [],
  );

  const startDrag = (key: string, from: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editable || count < 2 || event.button !== 0 || dragRef.current !== null) return;
    const row = event.currentTarget.closest('li');
    const measured = row?.getBoundingClientRect().height ?? 0;
    const start: DragState = {
      key,
      from,
      pointerId: event.pointerId,
      startY: event.clientY,
      rowHeight: measured > 0 ? measured : FALLBACK_ROW_PX,
      offset: 0,
      lifted: false,
    };
    dragRef.current = start;
    const handle = event.currentTarget;

    const update = (next: DragState | null) => {
      dragRef.current = next;
      setDrag(next);
    };
    const onMove = (moveEvent: PointerEvent) => {
      const current = dragRef.current;
      if (current?.pointerId !== moveEvent.pointerId) return;
      const offset = moveEvent.clientY - current.startY;
      if (!current.lifted && Math.abs(offset) < DRAG_SLOP_PX) return;
      moveEvent.preventDefault();
      update({ ...current, offset, lifted: true });
    };
    const finish = (drop: boolean) => {
      const current = dragRef.current;
      stop();
      update(null);
      if (!drop || current?.lifted !== true) return;
      const to = dropIndex(current, count);
      if (to === current.from) {
        handle.focus();
        return;
      }
      move(current.key, to, 'handle');
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === dragRef.current?.pointerId) finish(true);
    };
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === dragRef.current?.pointerId) finish(false);
    };
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      finish(false);
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      endDrag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    endDrag.current = stop;
  };

  return (
    <ol
      ref={listRef}
      id={id}
      // WebKit drops list semantics from a list styled without markers.
      role="list"
      aria-label={t(locale, 'plan.sections', { n: count })}
      className="ck-agent-plan-list"
      data-editable={editable ? '' : undefined}
      data-dragging={drag?.lifted === true ? '' : undefined}
    >
      {sections.map((section, index) => {
        const arrival = arrived.get(section.key);
        const removable = !atFloor && allows({ kind: 'remove', key: section.key });
        return (
          <PlanSectionRow
            key={section.key}
            locale={locale}
            section={section}
            position={index + 1}
            editable={editable}
            duplicate={duplicates?.has(section.key) === true}
            canMoveUp={editable && canMove(index, -1)}
            canMoveDown={editable && canMove(index, 1)}
            canRemove={editable && removable}
            removeReason={atFloor ? t(locale, 'plan.min') : undefined}
            onRename={(title) => {
              onEdit({ kind: 'rename', key: section.key, title });
            }}
            onMove={(delta, from) => {
              if (!canMove(index, delta)) return;
              move(section.key, index + delta, from);
            }}
            onRemove={() => {
              if (!removable) return;
              /*
                The removed row's [⋯] leaves with it; its menu would hand focus back to
                nothing (`body`). The row that takes its place gets it, or the one above
                when the last row went.
              */
              const heir = sections[index + 1] ?? sections[index - 1];
              if (heir !== undefined) focusAfter(heir.key, 'menu');
              onEdit({ kind: 'remove', key: section.key });
            }}
            onHandlePointerDown={(event) => {
              startDrag(section.key, index, event);
            }}
            drag={drag === null ? undefined : dragOffsetOf(drag, index, count)}
            transitionName={morph ? planRowTransitionName(section.key) : undefined}
            arrivalDelayMs={
              arrival === undefined
                ? undefined
                : Math.min(arrival, ARRIVAL_CAP) * ARRIVAL_STAGGER_MS
            }
          />
        );
      })}
    </ol>
  );
}
