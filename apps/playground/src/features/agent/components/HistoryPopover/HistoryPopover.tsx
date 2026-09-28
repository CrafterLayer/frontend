import * as Popover from '@radix-ui/react-popover';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';

import { t } from '../../copy';
import { useTicker } from '../../hooks/use-ticker';
import type { Locale, SessionSummary } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { HistoryRow } from '../HistoryRow';
import { IconButton, usePortalScope } from '../IconButton';

import './HistoryPopover.css';
import { matchesQuery } from './match-conversation';

/** Where the list shows: under `[◷]` in the docked panel, or as the phone sheet's page. */
export type HistoryPresentation = 'popover' | 'sheet';

/** Above this many conversations the list gets a search field (SPEC §4.18). */
export const SEARCH_THRESHOLD = 8;

export interface HistoryPopoverProps {
  readonly locale: Locale;
  /** Every conversation, in the order to list them (newest first). */
  readonly sessions: readonly SessionSummary[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenConversation: (id: string) => void;
  readonly onDeleteConversation: (id: string) => void;
  /**
   * The header's Conversations button `[◷]` (AgentHeader's `conversationsRef`): the
   * popover hangs from it, and focus returns to it when the list closes (SPEC §4.18, §6.3).
   * AgentHeader owns the button, its `aria-expanded` and its `aria-controls`.
   */
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** `popover` (default) in the docked panel; `sheet` in the phone sheet (SPEC §4.18). */
  readonly presentation?: HistoryPresentation | undefined;
  /** The list's id, for the button's `aria-controls`. Generated when absent. */
  readonly id?: string | undefined;
  /**
   * A run is live in the current conversation: opening another one waits, and so does
   * deleting the current one, with a line that says so (as New conversation, SPEC §4.2).
   */
  readonly running?: boolean | undefined;
  /**
   * Where focus goes when a delete leaves no conversation at all (SPEC §6.3: "New
   * conversation when none remain"). Without it, focus stays in the list, on its empty line.
   */
  readonly focusWhenEmpty?: (() => HTMLElement | null | undefined) | undefined;
  /** "Now" for the rows' times, epoch ms. Default: the panel's shared clock, while open. */
  readonly now?: number | undefined;
}

const ROW = '[data-session]';
const ROW_BUTTON = '.ck-agent-history-row__open';

/** The row button of `sessionId` inside `list`, found by walking the rows (no escaping). */
function rowButton(list: HTMLElement | null, sessionId: string): HTMLButtonElement | null {
  if (list === null) return null;
  for (const row of list.querySelectorAll<HTMLElement>(ROW)) {
    if (row.getAttribute('data-session') === sessionId) {
      return row.querySelector<HTMLButtonElement>(ROW_BUTTON);
    }
  }
  return null;
}

/**
 * The Conversations list (SPEC §4.18, §3.13): a Radix Popover under `[◷]` in the docked
 * panel (e2, radius 9, the panel's width less 16 and at most 360, at most 60% of the
 * panel's height), and a full page of the phone sheet with a Back button (§3.17).
 *
 * Keys (SPEC §6.7): ↑ ↓ move between conversations, Home and End jump, Enter opens,
 * Delete asks to delete, Esc closes and returns focus to `[◷]`. The rows share one tab
 * stop, so Tab goes from the search field into the list and on out of it, instead of
 * through every row. Above eight conversations a search field comes first; ↓ from it
 * enters the list, ↑ from the first row returns to it.
 *
 * Focus (SPEC §6.3): opening lands on the search field, else on the current conversation.
 * After a delete it lands on the row that took the deleted one's place (or the new last
 * row); if nothing is left, on the search field while a search narrows the list, else on
 * `focusWhenEmpty()` (New conversation), else on the empty line.
 *
 * It renders views and calls callbacks: opening and deleting are the controller's.
 */
export function HistoryPopover({
  locale,
  sessions,
  open,
  onOpenChange,
  onOpenConversation,
  onDeleteConversation,
  anchorRef,
  presentation = 'popover',
  id,
  running = false,
  focusWhenEmpty,
  now,
}: HistoryPopoverProps) {
  const generatedId = useId();
  const listId = id ?? generatedId;
  const titleId = useId();
  const busyId = useId();
  const { scope, capture } = usePortalScope();
  const clock = useTicker(open && now === undefined);

  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Each opening starts afresh: no search, no question open, the current row first.
  const [openSeen, setOpenSeen] = useState(open);
  if (openSeen !== open) {
    setOpenSeen(open);
    if (open) {
      setQuery('');
      setActiveId(null);
      setConfirmingId(null);
    }
  }

  const listRef = useRef<HTMLUListElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const emptyRef = useRef<HTMLParagraphElement | null>(null);
  /** The row just deleted and where it stood, until the list no longer holds it. */
  const pendingDelete = useRef<{ readonly id: string; readonly index: number } | null>(null);
  /** The list closed by an interaction elsewhere: focus stays where the person put it. */
  const interactedOutside = useRef(false);
  /** The sheet's list was closed from inside it: focus goes back to `[◷]` once it has. */
  const returnToAnchor = useRef(false);

  const searchable = sessions.length > SEARCH_THRESHOLD;
  const visible =
    searchable && query !== ''
      ? sessions.filter((session) => matchesQuery(session.title, query))
      : sessions;
  const tabStopId =
    activeId !== null && visible.some((session) => session.id === activeId)
      ? activeId
      : (visible.find((session) => session.current)?.id ?? visible[0]?.id ?? null);

  // Read the panel's scope off `[◷]` itself, before the popover opens, so the list mounts
  // inside the panel, in its theme, language and direction (IconButton's use-portal-scope).
  useEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) return undefined;
    const read = (): void => {
      capture(anchor);
    };
    read();
    anchor.addEventListener('pointerdown', read);
    anchor.addEventListener('keydown', read);
    return () => {
      anchor.removeEventListener('pointerdown', read);
      anchor.removeEventListener('keydown', read);
    };
  }, [anchorRef, capture]);

  const focusRow = (sessionId: string): void => {
    setActiveId(sessionId);
    rowButton(listRef.current, sessionId)?.focus();
  };

  const focusInitial = (): void => {
    if (searchRef.current !== null) {
      searchRef.current.focus();
      return;
    }
    const first = tabStopId === null ? null : rowButton(listRef.current, tabStopId);
    if (first !== null) {
      first.focus();
      return;
    }
    emptyRef.current?.focus();
  };

  // After a delete, once the list no longer holds the row (SPEC §6.3).
  useLayoutEffect(() => {
    const pending = pendingDelete.current;
    if (pending === null || visible.some((session) => session.id === pending.id)) return;
    pendingDelete.current = null;
    const next = visible[Math.min(pending.index, visible.length - 1)];
    if (next !== undefined) {
      rowButton(listRef.current, next.id)?.focus();
      return;
    }
    if (searchRef.current !== null && sessions.length > 0) {
      searchRef.current.focus();
      return;
    }
    const target = sessions.length === 0 ? focusWhenEmpty?.() : undefined;
    if (target !== undefined && target !== null) {
      // Focus leaving a non-modal popover closes it; the sheet's list closes here.
      interactedOutside.current = true;
      target.focus();
      if (presentation === 'sheet') onOpenChange(false);
      return;
    }
    emptyRef.current?.focus();
  }, [visible, sessions, focusWhenEmpty, presentation, onOpenChange]);

  // The sheet's list: focus in when it opens, back to `[◷]` once it has closed.
  const sheetOpen = presentation === 'sheet' && open;
  useLayoutEffect(() => {
    if (presentation !== 'sheet') return;
    if (sheetOpen) {
      if (searchRef.current !== null) searchRef.current.focus();
      else {
        const current = listRef.current?.querySelector<HTMLButtonElement>(
          `${ROW_BUTTON}[tabindex="0"]`,
        );
        if (current !== null && current !== undefined) current.focus();
        else emptyRef.current?.focus();
      }
      return;
    }
    if (returnToAnchor.current) {
      returnToAnchor.current = false;
      anchorRef.current?.focus();
    }
  }, [sheetOpen, presentation, anchorRef]);

  const close = (): void => {
    returnToAnchor.current = true;
    interactedOutside.current = false;
    pendingDelete.current = null;
    onOpenChange(false);
  };

  const openConversation = (sessionId: string): void => {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    // The current conversation is already on screen: choosing it just closes the list.
    if (session !== undefined && !session.current) onOpenConversation(sessionId);
    close();
  };

  const deleteConversation = (sessionId: string): void => {
    pendingDelete.current = {
      id: sessionId,
      index: Math.max(
        0,
        visible.findIndex((session) => session.id === sessionId),
      ),
    };
    setConfirmingId(null);
    onDeleteConversation(sessionId);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement;
    // A confirm's own buttons keep their keys.
    if (target.closest('.ck-agent-confirm') !== null) return;
    const sessionId = target.closest<HTMLElement>(ROW)?.getAttribute('data-session');
    const index = visible.findIndex((session) => session.id === sessionId);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && index === 0) {
      searchRef.current?.focus();
      return;
    }
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? visible.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(index + 1, visible.length - 1)
            : index - 1;
    const session = visible[next];
    if (session !== undefined) focusRow(session.id);
  };

  const onListFocus = (event: FocusEvent<HTMLUListElement>): void => {
    const sessionId = (event.target as HTMLElement).closest<HTMLElement>(ROW)?.getAttribute(
      'data-session',
    );
    if (sessionId !== null && sessionId !== undefined && sessionId !== activeId) {
      setActiveId(sessionId);
    }
  };

  const at = now ?? clock;
  const body = (
    <>
      <div className="ck-agent-history__head">
        {presentation === 'sheet' ? (
          <IconButton
            icon="back"
            label={t(locale, 'history.back')}
            className="ck-agent-history__back"
            tooltipAlign="start"
            onClick={close}
          />
        ) : null}
        <h2 id={titleId} className="ck-agent-history__title">
          {t(locale, 'history.title')}
        </h2>
      </div>
      {searchable ? (
        <div className="ck-agent-history__search">
          <AgentIcon name="search" className="ck-agent-history__search-icon" />
          <input
            ref={searchRef}
            type="search"
            className="ck-agent-history__search-field"
            aria-label={t(locale, 'history.search')}
            aria-controls={`${listId}-list`}
            placeholder={t(locale, 'history.search')}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setQuery(event.target.value);
              setActiveId(null);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key !== 'ArrowDown') return;
              const first = visible[0];
              if (first === undefined) return;
              event.preventDefault();
              focusRow(first.id);
            }}
          />
        </div>
      ) : null}
      {running ? (
        <p id={busyId} className="ck-agent-history__busy">
          {t(locale, 'history.busy')}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p ref={emptyRef} tabIndex={-1} className="ck-agent-history__empty">
          {t(locale, sessions.length === 0 ? 'history.empty' : 'history.noMatch')}
        </p>
      ) : (
        <ul
          ref={listRef}
          id={`${listId}-list`}
          role="list"
          aria-labelledby={titleId}
          className="ck-agent-history__list"
          onKeyDown={onListKeyDown}
          onFocus={onListFocus}
        >
          {visible.map((session) => (
            <HistoryRow
              key={session.id}
              locale={locale}
              session={session}
              now={at}
              tabStop={session.id === tabStopId}
              touch={presentation === 'sheet'}
              openUnavailable={running && !session.current}
              deleteUnavailable={running && session.current}
              unavailableId={running ? busyId : undefined}
              confirming={confirmingId === session.id}
              onConfirmingChange={(confirming) => {
                setConfirmingId(confirming ? session.id : null);
              }}
              onOpen={openConversation}
              onDelete={deleteConversation}
            />
          ))}
        </ul>
      )}
    </>
  );

  if (presentation === 'sheet') {
    if (!open) return null;
    return (
      <section
        id={listId}
        className="ck-agent-history"
        data-presentation="sheet"
        aria-labelledby={titleId}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          // InlineConfirm spends its own Esc; any other Esc goes back to the chat.
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      >
        {body}
      </section>
    );
  }

  const container = scope.container;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) pendingDelete.current = null;
        onOpenChange(next);
      }}
    >
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal container={container ?? null}>
        <Popover.Content
          id={listId}
          className="ck-agent-history"
          data-presentation="popover"
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          // Inside the panel, the panel is the boundary: the list spans it less 8px a side.
          collisionBoundary={container?.matches('.ck-agent') === true ? container : undefined}
          sticky="always"
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          aria-labelledby={titleId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusInitial();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!interactedOutside.current) anchorRef.current?.focus();
            interactedOutside.current = false;
          }}
          onEscapeKeyDown={(event) => {
            // The open question spends this Esc (InlineConfirm); the list stays open.
            if (confirmingId !== null) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target as Node | null;
            // `[◷]` itself toggles the list; a press on it is not "elsewhere".
            if (target !== null && anchorRef.current?.contains(target) === true) {
              event.preventDefault();
              return;
            }
            interactedOutside.current = true;
          }}
        >
          {body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
