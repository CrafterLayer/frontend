import { ChromeButton } from '@craftkit/builder';
import { useId, type MouseEvent } from 'react';

import { t, type Key } from '../../copy';
import { SEND_SLOT, type SendSlot } from '../../model/send-state';
import type { Locale, SendState } from '../../model/view-types';
import { AgentIcon, type AgentIconName } from '../AgentIcon';
import { ComposerTooltip } from '../ComposerToolbar/ComposerTooltip';

import './SendButton.css';

export interface SendButtonProps {
  readonly locale: Locale;
  /** The Send slot's machine (`AgentViewState.send`, `model/send-state.ts`). */
  readonly state: SendState;
  /**
   * Send the draft, or queue it while a run is live (`AgentController.send` decides by the
   * run). Never called while the slot is `aria-disabled`.
   */
  readonly onSend: () => void;
  /** Appended to `ck-agent-send`. */
  readonly className?: string | undefined;
}

type SlotLabel = SendSlot['label'];

/** Send ↑ never mirrors; Queue ↵ points back to the reading start (mirrored by AgentIcon). */
const GLYPH = {
  send: 'send',
  queue: 'queue',
  queued: 'check',
} as const satisfies Readonly<Record<SlotLabel, AgentIconName>>;

const NAME_KEY = {
  send: 'send',
  queue: 'queue',
  queued: 'queued',
} as const satisfies Readonly<Record<SlotLabel, Key>>;

/**
 * The Send slot (SPEC §4.17 SendButton): a 32px circle (44 on a coarse pointer) that is
 * Send ↑, Queue as next ↵, or Queued ✓, and nothing else. Stop is never one of its states
 * (SPEC §6.5): it has its own place in the RunBar, so a double press here can never stop
 * the run the first press started.
 *
 * Ready states are the Indigo primary; an empty draft leaves it `aria-disabled` (Wash, a
 * Slate glyph), still focusable and still explained by its tooltip. Queued becomes a pill
 * with its word: the queued request is the composer's own text, and a lone ✓ in a circle
 * would read as "done", which it is not.
 *
 * The glyph is static JSX, so the textarea blurring under a press (and the panel
 * re-rendering on that blur) cannot take the press away: the first click always lands.
 */
export function SendButton({ locale, state, onSend, className }: SendButtonProps) {
  const hintId = useId();
  const slot = SEND_SLOT[state];
  const name = t(locale, NAME_KEY[slot.label]);
  // The tooltip's second line: the keys, while Enter sends; what "Queued" means, once queued.
  const hint =
    slot.label === 'send'
      ? t(locale, 'keys.hint')
      : slot.label === 'queued'
        ? t(locale, 'queue.caption')
        : undefined;

  return (
    <ComposerTooltip label={name} hint={hint} align="end">
      <ChromeButton
        className={className === undefined ? 'ck-agent-send' : `ck-agent-send ${className}`}
        size="lg"
        data-slot={slot.label}
        aria-label={name}
        aria-disabled={slot.disabled ? true : undefined}
        // Explicit, even when empty: the open tooltip repeats the name, so it must not
        // become the description as well ("Send, button, Send").
        aria-describedby={hint === undefined ? undefined : hintId}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          if (slot.disabled) {
            event.preventDefault();
            return;
          }
          onSend();
        }}
      >
        <AgentIcon name={GLYPH[slot.label]} className="ck-agent-send__glyph" />
        {slot.label === 'queued' ? <span className="ck-agent-send__label">{name}</span> : null}
        {hint === undefined ? null : (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
      </ChromeButton>
    </ComposerTooltip>
  );
}
