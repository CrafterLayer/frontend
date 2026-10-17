import type { Ref } from 'react';

import { JUMP_LABEL_KEY, t } from '../../copy';
import type { Locale, RunActivity } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './JumpToLatest.css';

export interface JumpToLatestProps {
  readonly locale: Locale;
  /**
   * What the live run is doing, or `null` when nothing runs: the pill says why there is
   * news below (SPEC §3.12): "Latest" idle, "Building" or "Editing" while a run is live.
   */
  readonly activity: RunActivity | null;
  /**
   * Shown only while the reader is away from the bottom, and never while it would cover
   * the focused element. AgentThread decides both (SPEC §4.4, WCAG 2.4.11).
   */
  readonly visible: boolean;
  /** Back to the newest line; AgentThread then focuses the newest record's head. */
  readonly onJump: () => void;
  /** The button, so AgentThread can tell when the pill hides while it has focus. */
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}

/**
 * The jump pill (SPEC §4.4): a 32px floating button (44px on a coarse pointer) centred
 * 12px above the dock. AgentThread places it; this is the button.
 *
 * Its visible word says why there is something to jump to. Its accessible name opens with
 * that word and then says what pressing it does (WCAG 2.5.3 Label in Name): "Building: jump
 * to the latest". Idle, "Jump to the latest" already contains the pill's "Latest".
 *
 * Hidden, it is `hidden`: out of the tab order and the accessibility tree, not merely
 * transparent. Its fade and 4px rise (SPEC §5 moment 9) are CSS on that attribute.
 */
export function JumpToLatest({ locale, activity, visible, onJump, ref }: JumpToLatestProps) {
  const label = t(locale, activity === null ? 'jump.idle' : JUMP_LABEL_KEY[activity]);
  const name = activity === null ? t(locale, 'jump.aria') : t(locale, 'jump.aria.live', { label });
  return (
    <button
      ref={ref}
      type="button"
      className="ck-agent-jump"
      aria-label={name}
      data-activity={activity ?? 'idle'}
      hidden={!visible}
      onClick={onJump}
    >
      <AgentIcon name="arrowDown" />
      <span className="ck-agent-jump__label">{label}</span>
    </button>
  );
}
