import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { IconCheck, IconChevron } from '../AssistantPanel/AssistantPanel.icons';

/** The one thing this menu needs to know about a conversation. */
export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  /** How many turns it holds. Zero reads as "Empty", not "0 messages". */
  readonly turnCount: number;
}

export interface ConversationMenuProps {
  /** Every conversation, newest first. The caller decides whether to render at all. */
  readonly conversations: readonly ConversationSummary[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

/**
 * The conversation picker in the panel's header: which chat you are in, how
 * many there are, and a menu to move between them.
 *
 * Everything about being a MENU is owned here — open state, dismissal, where
 * focus enters and where it returns, and the arrow keys `role="menu"` promises.
 * None of that is the panel's business, and while it lived up there the panel
 * carried two refs, an id, a `useState`, a document-level effect and a keyboard
 * handler for a control it does not otherwise think about.
 */
export function ConversationMenu({ conversations, activeId, onSelect }: ConversationMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const active = conversations.find((conversation) => conversation.id === activeId);

  /*
    The popup dismisses the way every popup a person has used does: Escape, or a
    press anywhere outside it. Escape returns focus to the trigger — a menu that
    closes into nowhere strands a keyboard user on the document body with no way
    back to what they just left.
  */
  useEffect(() => {
    if (!open) {
      return;
    }
    // Focus enters on the chat you are IN, so the arrows start from where the
    // reader already is rather than from the top of a list they did not choose.
    rootRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
      ?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const menu = rootRef.current;
      if (menu !== null && !menu.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /**
   * Arrow keys through the history, because `role="menu"` PROMISES them.
   *
   * The items are native buttons, so Tab already reaches each one — but a menu
   * that answers Tab and ignores ArrowDown is a menu only in the accessibility
   * tree, and a screen-reader user who is told "menu" reaches for the arrows
   * first. Home/End are part of the same promise.
   */
  const moveThrough = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    event.preventDefault();
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    ];
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }, []);

  return (
    <div className="pg-chat__sessions" ref={rootRef}>
      <button
        type="button"
        className="pg-chat__sessions-trigger"
        ref={triggerRef}
        aria-label="Conversation"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="pg-chat__sessions-title">{active?.title ?? 'New chat'}</span>
        <span className="pg-chat__sessions-count">{conversations.length}</span>
        <span className="pg-chat__sessions-chevron" aria-hidden="true">
          <IconChevron />
        </span>
      </button>
      {open ? (
        <div className="pg-chat__sessions-menu" id={listId} role="menu" onKeyDown={moveThrough}>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              role="menuitemradio"
              aria-checked={conversation.id === activeId}
              className="pg-chat__sessions-item"
              onClick={() => {
                onSelect(conversation.id);
                setOpen(false);
              }}
            >
              <span className="pg-chat__sessions-item-check" aria-hidden="true">
                {conversation.id === activeId ? <IconCheck /> : null}
              </span>
              <span className="pg-chat__sessions-item-title">{conversation.title}</span>
              <span className="pg-chat__sessions-item-meta">
                {conversation.turnCount === 0
                  ? 'Empty'
                  : `${String(conversation.turnCount)} messages`}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
