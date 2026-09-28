import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { formatWhen, t } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type { Locale, SessionSummary } from '../../model/view-types';
import { IconButton } from '../IconButton';
import { InlineConfirm } from '../InlineConfirm';

import './HistoryRow.css';

export interface HistoryRowProps {
  readonly locale: Locale;
  readonly session: SessionSummary;
  /** "Now", epoch ms, for the row's time. The list passes one value to every row. */
  readonly now: number;
  /** Open this conversation (the row button: click, Enter or Space). */
  readonly onOpen: (id: string) => void;
  /** Delete it, once the InlineConfirm is answered. */
  readonly onDelete: (id: string) => void;
  /**
   * The row holds the list's one tab stop (a roving tabindex: the arrow keys move between
   * rows, Tab moves on). Both of its buttons are then in the tab order. Default `true`.
   */
  readonly tabStop?: boolean | undefined;
  /**
   * Opening waits: a run is live in the current conversation. The row stays focusable,
   * `aria-disabled`, and is described by `unavailableId`.
   */
  readonly openUnavailable?: boolean | undefined;
  /** Deleting waits: the current conversation, while its run is live. */
  readonly deleteUnavailable?: boolean | undefined;
  /** The id of the line that says why opening waits. */
  readonly unavailableId?: string | undefined;
  /**
   * The phone sheet's list (SPEC §4.18 "Phone"): rows are 44px and Delete is always
   * visible, as on a coarse pointer, whatever the pointer.
   */
  readonly touch?: boolean | undefined;
  /** Whether the delete confirm is open. Leave it out to let the row own it. */
  readonly confirming?: boolean | undefined;
  readonly onConfirmingChange?: ((confirming: boolean) => void) | undefined;
}

/**
 * One conversation in the Conversations list (SPEC §4.18): the first request as its title
 * (Read, one line, an ellipsis at its own end) and its time at the inline end (Meta,
 * Slate). The current conversation is marked three ways, none of them a check mark (✓
 * means only "on the page"): a Mist fill, a 2px Indigo bar at the inline start, and the
 * word "Current" before the time, which `aria-current` also says.
 *
 * Delete is a trailing 32px icon button beside the row button, never inside it: two
 * sibling controls, so each keeps its own name. On a mouse it appears on hover and with
 * focus anywhere in the row, over the time; on a finger it is always there, beside it.
 * The Delete key on the row does the same (Backspace too: the key a Mac labels "delete").
 * It asks first, in the row, with InlineConfirm: focus goes to Cancel, and Esc or Cancel
 * brings focus back to whichever control opened it.
 */
export function HistoryRow({
  locale,
  session,
  now,
  onOpen,
  onDelete,
  tabStop = true,
  openUnavailable = false,
  deleteUnavailable = false,
  unavailableId,
  touch = false,
  confirming: confirmingProp,
  onConfirmingChange,
}: HistoryRowProps) {
  const titleId = useId();
  const [ownConfirming, setOwnConfirming] = useState(false);
  const confirming = confirmingProp ?? ownConfirming;
  const openButton = useRef<HTMLButtonElement | null>(null);
  /** The confirm was opened from the row button (the Delete key), so it returns there. */
  const returnToRow = useRef(false);

  const setConfirming = (next: boolean): void => {
    if (confirmingProp === undefined) setOwnConfirming(next);
    onConfirmingChange?.(next);
  };

  /*
    InlineConfirm hands focus back to its opener, the trash button, when it is cancelled.
    Opened from the row by the Delete key, the opener a person used was the row itself, so
    once the confirm closes focus goes on to the row button. A parent's layout effect runs
    after its child's, so this lands after InlineConfirm's own.
  */
  useLayoutEffect(() => {
    if (confirming || !returnToRow.current) return;
    returnToRow.current = false;
    if (openButton.current?.isConnected === true) openButton.current.focus();
  }, [confirming]);

  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const titleDir = resolveDir(session.title, uiDir);
  const when =
    session.updatedAt === null ? null : formatWhen(locale, session.updatedAt, now);
  const name =
    when === null ? session.title : t(locale, 'history.row', { title: session.title, when });

  return (
    <li
      className="ck-agent-history-row"
      data-current={session.current ? '' : undefined}
      data-confirming={confirming ? '' : undefined}
      data-touch={touch ? '' : undefined}
      data-session={session.id}
    >
      <button
        ref={openButton}
        type="button"
        className="ck-agent-history-row__open"
        tabIndex={tabStop ? 0 : -1}
        aria-label={name}
        aria-current={session.current ? 'true' : undefined}
        aria-disabled={openUnavailable ? true : undefined}
        aria-describedby={openUnavailable ? unavailableId : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          if (openUnavailable) {
            event.preventDefault();
            return;
          }
          onOpen(session.id);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return;
          event.preventDefault();
          if (deleteUnavailable || confirming) return;
          returnToRow.current = true;
          setConfirming(true);
        }}
      >
        <span
          id={titleId}
          className="ck-agent-history-row__title"
          dir={titleDir}
          lang={titleDir === uiDir ? undefined : titleDir === 'rtl' ? 'ar' : 'en'}
        >
          {session.title}
        </span>
        {session.current || when !== null ? (
          <span className="ck-agent-history-row__meta">
            {session.current ? (
              <span className="ck-agent-history-row__current">{t(locale, 'history.current')}</span>
            ) : null}
            {when === null || session.updatedAt === null ? null : (
              <time dateTime={new Date(session.updatedAt).toISOString()}>{when}</time>
            )}
          </span>
        ) : null}
      </button>
      <InlineConfirm
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        className="ck-agent-history-row__confirm"
        message={t(locale, 'history.confirm')}
        confirmLabel={t(locale, 'history.confirm.yes')}
        cancelLabel={t(locale, 'history.confirm.no')}
        onConfirm={() => {
          returnToRow.current = false;
          onDelete(session.id);
        }}
        renderOpener={({ open }) => (
          <IconButton
            icon="trash"
            label={t(locale, 'history.delete')}
            describedBy={titleId}
            className="ck-agent-history-row__delete"
            tabIndex={tabStop ? 0 : -1}
            unavailable={deleteUnavailable}
            hint={deleteUnavailable ? t(locale, 'history.delete.busy') : undefined}
            tooltipAlign="end"
            onClick={() => {
              returnToRow.current = false;
              open();
            }}
          />
        )}
      />
    </li>
  );
}
