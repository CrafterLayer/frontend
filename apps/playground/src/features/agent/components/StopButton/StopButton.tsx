import { ChromeButton } from '@craftkit/builder';
import type { MouseEvent, Ref } from 'react';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { ComposerTooltip } from '../ComposerToolbar/ComposerTooltip';

import './StopButton.css';
import { IS_APPLE_PLATFORM, stopKeyShortcuts, stopShortcutLabel } from './stop-shortcut';

export interface StopButtonProps {
  readonly locale: Locale;
  /**
   * Stop was pressed and the engine has not settled yet: the spinner replaces ■, the name
   * becomes "Stopping…", and the button is `aria-disabled` (never `disabled`, which would
   * drop the focus the person's press just put here).
   */
  readonly stopping: boolean;
  readonly onStop: () => void;
  /** ⌘ or Ctrl in the tooltip and in `aria-keyshortcuts`; the running platform's by default. */
  readonly apple?: boolean | undefined;
  /** The button, for the Composer's focus bookkeeping when the RunBar leaves. */
  readonly ref?: Ref<HTMLButtonElement> | undefined;
  /** Appended to `ck-agent-stop`. */
  readonly className?: string | undefined;
}

/**
 * Stop (SPEC §4.17): in its own fixed place at the RunBar's inline end, never swapped into
 * the Send slot, so a second press on Send can never stop the run the first press started
 * (SPEC Appendix A.2).
 *
 * It keeps its word at every width. A lone ■ in a 32px box is the easiest control in the
 * panel to mistake, and this is the one whose mistake costs work: ■ **and** «إيقاف» / "Stop".
 *
 * Stopping keeps the same button, so focus stays exactly where the person put it: the
 * glyph turns into the spinner, the visible word stays (the RunBar's status already says
 * "Stopping…"), and the accessible name says "Stopping…", which still contains the visible
 * word (WCAG 2.5.3). When the RunBar leaves, the Composer sends focus to the textarea.
 *
 * The glyphs are static JSX (AgentIcon), so a re-render between pointerdown and pointerup
 * (the textarea blurring under the press) cannot take the press away.
 */
export function StopButton({
  locale,
  stopping,
  onStop,
  apple = IS_APPLE_PLATFORM,
  ref,
  className,
}: StopButtonProps) {
  return (
    <ComposerTooltip
      label={t(locale, 'stop.tooltip', { shortcut: stopShortcutLabel(apple) })}
      // "Stop the work" would be a promise already kept while it stops.
      silent={stopping}
      align="end"
    >
      <ChromeButton
        ref={ref}
        className={className === undefined ? 'ck-agent-stop' : `ck-agent-stop ${className}`}
        size="lg"
        aria-label={stopping ? t(locale, 'stopping') : undefined}
        aria-disabled={stopping ? true : undefined}
        aria-keyshortcuts={stopKeyShortcuts(apple)}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          if (stopping) {
            event.preventDefault();
            return;
          }
          onStop();
        }}
      >
        <AgentIcon name={stopping ? 'spinner' : 'stop'} className="ck-agent-stop__glyph" />
        <span className="ck-agent-stop__label">{t(locale, 'stop')}</span>
      </ChromeButton>
    </ComposerTooltip>
  );
}
