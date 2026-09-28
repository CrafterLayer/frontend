import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import './AgentSheet.css';
import { useKeyboardInset } from './use-keyboard-inset';
import { useMirroredTheme } from './use-mirrored-theme';

/**
 * Where the phone sheet stands (SPEC §4.19): `full`, the chat, a modal dialog under the
 * editor's top bar; `mini`, one row over the live canvas; `closed`, the panel hidden. The
 * panel stays mounted when closed (SPEC §4.1: hidden keeps it mounted).
 */
export type SheetDetent = 'full' | 'mini' | 'closed';

/** What the sheet hands its two faces: the detent, the three moves, and two focus targets. */
export interface SheetControls {
  readonly detent: SheetDetent;
  /** `[⤓]` Show the page: drop to the mini detent. */
  readonly showPage: () => void;
  /** `[⤒]` Back to the chat: rise to the full detent. */
  readonly backToChat: () => void;
  /** `[×]` Close: the panel hides; focus returns to the rail's agent button. */
  readonly close: () => void;
  /** Attach to `[⤓]`: where focus lands when the sheet rises back to full. */
  readonly showPageRef: (element: HTMLElement | null) => void;
  /** Attach to `[⤒]`: where focus lands when the sheet drops to mini. */
  readonly backToChatRef: (element: HTMLElement | null) => void;
}

export interface AgentSheetProps {
  readonly locale: Locale;
  readonly detent: SheetDetent;
  /**
   * The sheet asks to move: `[⤓]` and a press above it ask for `mini`, `[⤒]` and a field
   * taking focus at mini ask for `full`, `[×]` and Esc ask for `closed`. The host decides;
   * the sheet never moves itself (SPEC §4.19: it never rises when a result arrives).
   */
  readonly onDetentChange: (detent: SheetDetent) => void;
  /** The rail's agent button: focus goes back to it when the sheet closes (SPEC §6.3). */
  readonly returnFocus?: (() => HTMLElement | null | undefined) | undefined;
  /** The full detent: the phone header, the thread and the dock, as one column. */
  readonly children: (sheet: SheetControls) => ReactNode;
  /** The mini detent's row: a SheetMiniBar. */
  readonly mini: (sheet: SheetControls) => ReactNode;
  /**
   * What must stay mounted and heard in every detent: the panel's one live region
   * (LiveStatus, SPEC §6.1). It sits inside the dialog at full and is never made inert.
   */
  readonly persistent?: ReactNode;
  /**
   * Mount the sheet here instead of in place. Its layers are `position: fixed`, so no
   * ancestor may make itself their containing block (`container-type`, `transform`,
   * `filter`, `contain`); pass a container when the place the sheet is rendered does.
   */
  readonly container?: Element | DocumentFragment | null | undefined;
}

/** Every element that can take focus from the keyboard, before the tabindex check. */
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

const GUARD = 'data-ck-agent-sheet-guard';

/**
 * Focus the first or last element of `face` that really takes focus. A candidate hidden
 * by its own component (a collapsed disclosure) refuses `focus()`, so each is tried until
 * one holds it; the face itself is the last resort.
 */
function focusEdge(face: HTMLElement, edge: 'first' | 'last'): void {
  const candidates = [...face.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 && !element.hasAttribute(GUARD) && element.closest('[inert]') === null,
  );
  if (edge === 'last') candidates.reverse();
  for (const candidate of candidates) {
    candidate.focus({ preventScroll: false });
    if (candidate.ownerDocument.activeElement === candidate) return;
  }
  face.focus({ preventScroll: true });
}

/**
 * A field that takes typing, and so owns its own Esc (the composer closes its list, then
 * lets go of focus; an inline rename restores the old name) and opens the keyboard.
 */
function isTextEntry(target: Element): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'color'].includes(
      target.type,
    );
  }
  return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * The agent panel on a phone (SPEC §4.19, §3.16): below a 600px viewport the panel is a
 * sheet with two detents.
 *
 * - **Full**: the chat, from under the editor's top bar to the keyboard (e3). A modal
 *   dialog: `role="dialog"`, `aria-modal`, Tab and Shift+Tab loop inside it, a press on
 *   the top bar above it drops it to mini, and Esc closes it. Focus arrives on the dialog
 *   (or on `[⤓]` when it rises from mini).
 * - **Mini**: one row over the live canvas, a non-modal region: the canvas stays
 *   interactive and keeps its own Esc. Focus that was in the sheet lands on `[⤒]`.
 * - **Closed**: both faces leave, and focus returns to the rail's agent button.
 *
 * Detent changes move the faces on the block axis over `enter` (closing: `exit`), at once
 * under reduced motion. The full face is never unmounted by a detent change, so the
 * thread keeps its scroll and its open disclosures when the sheet drops to mini and
 * rises again, and the one live region (`persistent`) is never remounted or hidden.
 *
 * Why not a Radix Dialog, as SPEC §4.19 first drew it: a Radix modal hides everything
 * outside its content (`aria-hidden`) while it is mounted, and unmounts its content when
 * it closes. The mini detent needs the canvas outside to stay reachable while the thread
 * and the live region survive; a closed Radix Dialog loses both, and a force-mounted one
 * keeps its dismissable layer claiming every Esc on the page, which the canvas reads to
 * let go of a block. This sheet keeps Radix's contract (dialog role, focus kept inside,
 * focus returned, Esc) and drops only what fights the second detent.
 *
 * Safe areas are respected on every edge, and at full the composer rides the visual
 * viewport above the on-screen keyboard (`useKeyboardInset`).
 */
export function AgentSheet({
  locale,
  detent,
  onDetentChange,
  returnFocus,
  children,
  mini,
  persistent,
  container,
}: AgentSheetProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const marker = useRef<HTMLSpanElement | null>(null);
  const fullFace = useRef<HTMLDivElement | null>(null);
  const miniFace = useRef<HTMLElement | null>(null);
  const showPageTarget = useRef<HTMLElement | null>(null);
  const backToChatTarget = useRef<HTMLElement | null>(null);
  /** The detent focus last moved for. `closed` first, so mounting at full takes focus in. */
  const settled = useRef<SheetDetent>('closed');

  /*
    Where the sheet is coming from, for CSS: rising from mini, the row stays put under the
    rising chat; dropping from full, the row is already in place under the falling one.
    Adjusted while rendering, the one place the previous detent is still known.
  */
  const [motion, setMotion] = useState<{ readonly from: SheetDetent; readonly to: SheetDetent }>(
    () => ({ from: 'closed', to: detent }),
  );
  if (motion.to !== detent) setMotion({ from: motion.to, to: detent });

  const keyboard = useKeyboardInset(detent === 'full');
  useMirroredTheme(root, marker);

  const controls = useMemo<SheetControls>(
    () => ({
      detent,
      showPage: () => {
        onDetentChange('mini');
      },
      backToChat: () => {
        onDetentChange('full');
      },
      close: () => {
        onDetentChange('closed');
      },
      showPageRef: (element) => {
        showPageTarget.current = element;
      },
      backToChatRef: (element) => {
        backToChatTarget.current = element;
      },
    }),
    [detent, onDetentChange],
  );

  /*
    Every move names where focus goes (SPEC §6.3). Into the dialog on rising to full;
    to `[⤒]` on dropping to mini, when focus was in the sheet (a dropped sheet never takes
    focus from the canvas); back to the rail's button on closing.
  */
  useLayoutEffect(() => {
    const from = settled.current;
    settled.current = detent;
    const element = root.current;
    if (from === detent || element === null) return;
    const page = element.ownerDocument;
    const active = page.activeElement;
    const ours = active === null || active === page.body || element.contains(active);
    if (detent === 'full') {
      const counterpart = from === 'mini' ? showPageTarget.current : null;
      const target = counterpart?.isConnected === true ? counterpart : fullFace.current;
      target?.focus({ preventScroll: true });
      return;
    }
    if (!ours) return;
    if (detent === 'mini') {
      const counterpart = backToChatTarget.current;
      const target = counterpart?.isConnected === true ? counterpart : miniFace.current;
      target?.focus({ preventScroll: true });
      return;
    }
    returnFocus?.()?.focus();
  }, [detent, returnFocus]);

  const onGuardFocus =
    (edge: 'start' | 'end') =>
    (event: FocusEvent<HTMLSpanElement>): void => {
      const face = fullFace.current;
      if (face === null) return;
      const from = event.relatedTarget;
      // Tabbing out past an edge wraps to the other end; arriving from outside enters at
      // the near one.
      const leaving = from instanceof Node && face.contains(from);
      focusEdge(face, leaving === (edge === 'start') ? 'last' : 'first');
    };

  const style = { '--ck-agent-sheet-keyboard': `${String(keyboard)}px` } as CSSProperties;
  const isFull = detent === 'full';
  const name = t(locale, 'header.name');

  const sheet = (
    <div
      ref={root}
      className="ck-agent-sheet"
      data-detent={detent}
      data-from={motion.from}
      role={isFull ? 'dialog' : undefined}
      aria-modal={isFull ? true : undefined}
      aria-label={isFull ? name : undefined}
      style={style}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape' || !isFull || event.defaultPrevented) return;
        if (event.nativeEvent.isComposing) return;
        const target = event.target;
        if (!(target instanceof Element) || fullFace.current?.contains(target) !== true) return;
        if (isTextEntry(target)) return;
        event.preventDefault();
        onDetentChange('closed');
      }}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        // Opening the keyboard raises the sheet to full (SPEC §4.19).
        if (detent === 'mini' && event.target instanceof Element && isTextEntry(event.target)) {
          onDetentChange('full');
        }
      }}
    >
      {isFull ? (
        <div className="ck-agent-sheet__scrim" aria-hidden="true" onClick={controls.showPage} />
      ) : null}
      <div ref={fullFace} className="ck-agent-sheet__full" tabIndex={-1} inert={!isFull}>
        {isFull ? (
          <span
            className="ck-agent-sheet__guard"
            tabIndex={0}
            data-ck-agent-sheet-guard="start"
            onFocus={onGuardFocus('start')}
          />
        ) : null}
        <div className="ck-agent-sheet__content">{children(controls)}</div>
        {isFull ? (
          <span
            className="ck-agent-sheet__guard"
            tabIndex={0}
            data-ck-agent-sheet-guard="end"
            onFocus={onGuardFocus('end')}
          />
        ) : null}
      </div>
      <section
        ref={miniFace}
        className="ck-agent-sheet__mini"
        aria-label={name}
        tabIndex={-1}
        inert={detent !== 'mini'}
      >
        {mini(controls)}
      </section>
      {persistent}
    </div>
  );

  if (container === undefined || container === null) return sheet;
  return (
    <>
      <span ref={marker} hidden />
      {createPortal(sheet, container)}
    </>
  );
}
