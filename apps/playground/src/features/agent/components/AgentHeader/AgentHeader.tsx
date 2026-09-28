import { useId, type Ref } from 'react';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import {
  AgentFace,
  type AgentMood,
  type AgentMoodOutcome,
  type AgentMoodVariant,
} from '../../../preview/components/AgentFace';
import { IconButton } from '../IconButton';

import './AgentHeader.css';

/** The header face's state, as `useAgentMood` reports it for the live run (SPEC §4.2). */
export interface AgentHeaderFace {
  readonly mood: AgentMood;
  /** `planning` only. */
  readonly variant?: AgentMoodVariant | undefined;
  /** `done` only. */
  readonly outcome?: AgentMoodOutcome | undefined;
  /** The listening nudge while the person types. */
  readonly typing?: boolean | undefined;
}

export interface AgentHeaderProps {
  readonly locale: Locale;
  readonly face: AgentHeaderFace;
  /**
   * The thread is scrolled beneath the header: a 1px Hairline at its block end
   * (SPEC §2.5). AgentThread reports it (`onScrolledChange`); at rest there is no line.
   */
  readonly scrolled: boolean;
  /**
   * A run is live: New conversation stays focusable but is `aria-disabled`, and its
   * tooltip says when it will be available (SPEC §4.2).
   */
  readonly running: boolean;
  /** Whether the Conversations popover is open: the button's `aria-expanded`. */
  readonly conversationsOpen: boolean;
  /** Conversations `[◷]` was pressed: open or close HistoryPopover. */
  readonly onConversations: () => void;
  readonly onNewConversation: () => void;
  /**
   * The Conversations button, for HistoryPopover to anchor to (Radix `Popover.Anchor
   * virtualRef`) and to return focus to when it closes (SPEC §4.18: Esc returns to `[◷]`).
   */
  readonly conversationsRef?: Ref<HTMLButtonElement> | undefined;
  /** The open popover's id, for `aria-controls` while it is open. */
  readonly conversationsControls?: string | undefined;
  /** The `h2`'s id, so AgentPanel can name its region by it. Generated when absent. */
  readonly headingId?: string | undefined;
  /**
   * The phone sheet's Close `[×]`, drawn at the inline start (SPEC §3.16, §4.2). Leave it
   * out in the docked panel.
   */
  readonly onClose?: (() => void) | undefined;
  /** The phone sheet's Show the page `[⤓]`, drawn after New conversation. */
  readonly onShowPage?: (() => void) | undefined;
}

/**
 * The panel's header (SPEC §4.2): one 44px line. أبو غضب's 24px face, his name, and two
 * ghost icon buttons, Conversations and New conversation. Nothing else, ever: no status
 * (the RunBar owns it), no conversation title, no count, no second name. The owner's
 * screenshot of the v1 header ("Agent  Let m…", a truncated title and a badge) is the
 * list of what this replaces.
 *
 * One name, in the UI locale: «أبو غضب» or "Abu Ghadab", never both, never "Agent". It is
 * the panel's `h2`. The face is decoration (`aria-hidden`); it is `live`, the one face in
 * the panel whose moods move, and its mood follows the run.
 *
 * In the phone sheet the same header gains Close at the inline start and Show the page at
 * the inline end, all 44px on a coarse pointer; AgentSheet sets the 56px height through
 * `--bldr-agent-header-height`.
 */
export function AgentHeader({
  locale,
  face,
  scrolled,
  running,
  conversationsOpen,
  onConversations,
  onNewConversation,
  conversationsRef,
  conversationsControls,
  headingId,
  onClose,
  onShowPage,
}: AgentHeaderProps) {
  const generatedId = useId();
  const nameId = headingId ?? generatedId;
  const sheet = onClose !== undefined;
  return (
    <header
      className="ck-agent-header"
      data-scrolled={scrolled ? '' : undefined}
      data-sheet={sheet ? '' : undefined}
    >
      {onClose === undefined ? null : (
        <IconButton
          icon="close"
          label={t(locale, 'sheet.close')}
          tooltipAlign="start"
          onClick={onClose}
        />
      )}
      <span className="ck-agent-header__face" aria-hidden="true">
        <AgentFace
          size="sm"
          live
          mood={face.mood}
          variant={face.variant}
          outcome={face.outcome}
          typing={face.typing}
        />
      </span>
      <h2 id={nameId} className="ck-agent-header__name">
        {t(locale, 'header.name')}
      </h2>
      <div className="ck-agent-header__actions">
        <IconButton
          ref={conversationsRef}
          icon="history"
          label={t(locale, 'header.conversations')}
          aria-haspopup="dialog"
          aria-expanded={conversationsOpen}
          aria-controls={conversationsOpen ? conversationsControls : undefined}
          onClick={onConversations}
        />
        <IconButton
          icon="plus"
          label={t(locale, 'header.new')}
          tooltipAlign={onShowPage === undefined ? 'end' : 'center'}
          unavailable={running}
          hint={running ? t(locale, 'header.new.busy') : undefined}
          onClick={onNewConversation}
        />
        {onShowPage === undefined ? null : (
          <IconButton
            icon="showPage"
            label={t(locale, 'sheet.showPage')}
            tooltipAlign="end"
            onClick={onShowPage}
          />
        )}
      </div>
    </header>
  );
}
