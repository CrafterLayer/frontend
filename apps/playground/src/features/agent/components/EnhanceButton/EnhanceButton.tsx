import { ChromeButton } from '@craftkit/builder';
import { useId, type MouseEvent } from 'react';

import { t } from '../../copy';
import type { EnhancementView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { ComposerTooltip } from '../ComposerToolbar/ComposerTooltip';

import './EnhanceButton.css';
import { SPARKLE } from './sparkle';

export interface EnhanceButtonProps {
  readonly locale: Locale;
  /** The Improve state (`AgentViewState.enhancement`). `unavailable` draws nothing. */
  readonly enhancement: EnhancementView;
  /** The draft is empty: there is nothing to improve yet. */
  readonly empty: boolean;
  /** A run is live: Improve waits until it ends. */
  readonly running: boolean;
  /** Rewrite the draft (`AgentController.enhanceDraft`). Never called while unavailable. */
  readonly onEnhance: () => void;
  /** Appended to `ck-agent-enhance`. */
  readonly className?: string | undefined;
}

/**
 * ✨ Improve my request («حسّن طلبي»): the owner's tool that reads the request and fixes it
 * before it runs, in the request's own language, with the person's own words one Restore
 * away (EnhanceNote). A 32px ghost in the composer's toolbar, 44 on a coarse pointer.
 *
 * It is absent when the provider cannot rewrite (`unavailable`): a control that can never
 * work is worse than none. It is present but `aria-disabled`, with the reason as its
 * tooltip's second line, on an empty draft or while a run is live. While it works it keeps
 * the same button: the sparkle turns into the spinner, the name says "Improving your
 * request", and the Composer shimmers the locked draft.
 *
 * Ghost, not Indigo: Improve helps with the request, it is not the request (SPEC §2.1
 * rule 3). The sparkle is static JSX, so a press survives the textarea's blur.
 */
export function EnhanceButton({
  locale,
  enhancement,
  empty,
  running,
  onEnhance,
  className,
}: EnhanceButtonProps) {
  const hintId = useId();
  if (enhancement.status === 'unavailable') return null;

  const working = enhancement.status === 'enhancing';
  // What holds it back, most pressing first: the work in flight, then an empty box.
  const hint = working
    ? undefined
    : running
      ? t(locale, 'enhance.busy')
      : empty
        ? t(locale, 'enhance.empty')
        : undefined;
  const unavailable = working || running || empty;
  const name = t(locale, working ? 'enhance.working' : 'enhance.button');

  return (
    <ComposerTooltip label={name} hint={hint} align="end">
      <ChromeButton
        className={className === undefined ? 'ck-agent-enhance' : `ck-agent-enhance ${className}`}
        size="lg"
        aria-label={name}
        aria-disabled={unavailable ? true : undefined}
        // Explicit: the tooltip repeats the name, so only the reason may describe it.
        aria-describedby={hint === undefined ? undefined : hintId}
        data-working={working ? '' : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          if (unavailable) {
            event.preventDefault();
            return;
          }
          onEnhance();
        }}
      >
        {working ? <AgentIcon name="spinner" /> : SPARKLE}
        {hint === undefined ? null : (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
      </ChromeButton>
    </ComposerTooltip>
  );
}
