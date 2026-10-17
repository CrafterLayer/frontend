import { ChromeButton } from '@craftkit/builder';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import './InlineConfirm.css';

/** What `renderOpener` receives. */
export interface InlineConfirmOpener {
  /** Opens the confirm in the opener's place. */
  readonly open: () => void;
}

/** What focus returns to: the opener's first focusable element. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export type InlineConfirmTone = 'default' | 'danger';

export interface InlineConfirmProps {
  /** The consequence, in one or two sentences (`confirm.undoBuild`, `history.confirm`). */
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /**
   * `danger` for what cannot be undone (deleting a conversation): the confirm becomes an
   * Alarm outline. Undo build can be redone, so it stays `default`.
   */
  readonly tone?: InlineConfirmTone | undefined;
  /**
   * The confirmed action. If it moves focus (Undo build → the record's head, SPEC §6.3),
   * focus stays there; if it moves focus nowhere, focus returns to the opener.
   */
  readonly onConfirm: () => void;
  readonly onCancel?: (() => void) | undefined;
  /** Controlled open state, for an owner that opens it itself (Delete on a history row). */
  readonly open?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  /** The button that opens it, drawn while it is closed. */
  readonly renderOpener: (opener: InlineConfirmOpener) => ReactNode;
  /** Appended to `ck-agent-confirm`. */
  readonly className?: string | undefined;
}

/**
 * An in-place confirm (SPEC §4.15): it replaces the button that opened it, inside the same
 * footer row, and never becomes a modal. The thread stays readable and scrollable around
 * it; nothing else is blocked while it asks.
 *
 * Opening moves focus to Cancel, the answer that changes nothing. Esc or Cancel closes it
 * and returns focus to the opener. Esc is spent here and does not reach the composer or a
 * popover around it through the React tree (a Radix popover listens on the document in the
 * capture phase: an owner inside one prevents its `onEscapeKeyDown` while confirming).
 *
 * It is a `group` named by its message, so a screen reader landing on Cancel hears what
 * is being confirmed.
 */
export function InlineConfirm({
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel,
  open: openProp,
  onOpenChange,
  renderOpener,
  className,
}: InlineConfirmProps) {
  const messageId = useId();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;

  /*
    The opener sits in a `display: contents` slot this component owns, so focus can return
    to it without the caller wiring a ref: the slot adds no box, and a flex footer lays the
    opener out as if the slot were not there.
  */
  const openerSlot = useRef<HTMLSpanElement>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(open);
  const returnToOpener = useRef(false);

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  /*
    Focus follows the swap, after React has committed it: the element focus goes to did
    not exist a moment earlier. A layout effect, so the ring never paints on `body` first.
  */
  useLayoutEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) {
      cancelRef.current?.focus();
      return;
    }
    const active = document.activeElement;
    const focusLost = active === null || active === document.body;
    if (returnToOpener.current || focusLost) {
      openerSlot.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    returnToOpener.current = false;
  }, [open]);

  const cancel = () => {
    returnToOpener.current = true;
    setOpen(false);
    onCancel?.();
  };

  const confirm = () => {
    onConfirm();
    setOpen(false);
  };

  if (!open) {
    return (
      <span ref={openerSlot} className="ck-agent-confirm-opener">
        {renderOpener({
          open: () => {
            setOpen(true);
          },
        })}
      </span>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={messageId}
      className={className === undefined ? 'ck-agent-confirm' : `ck-agent-confirm ${className}`}
      data-tone={tone}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }}
    >
      <p id={messageId} className="ck-agent-confirm__message">
        {message}
      </p>
      <div className="ck-agent-confirm__actions">
        <ChromeButton
          className="ck-agent-confirm__button ck-agent-confirm__confirm"
          size="lg"
          onClick={confirm}
        >
          {confirmLabel}
        </ChromeButton>
        <ChromeButton
          ref={cancelRef}
          className="ck-agent-confirm__button ck-agent-confirm__cancel"
          size="lg"
          onClick={cancel}
        >
          {cancelLabel}
        </ChromeButton>
      </div>
    </div>
  );
}
