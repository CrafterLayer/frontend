import type { Ref } from 'react';

import { tParts } from '../../copy';
import type { Locale, RunBarView, StatusKey } from '../../model/view-types';
import { RunClock } from '../RunClock';
import { RunGlyph } from '../RunGlyph';
import { StopButton } from '../StopButton';

import './RunBar.css';

export interface RunBarProps {
  readonly locale: Locale;
  /** The live run (`AgentViewState.run`). The Composer mounts the bar only while it is set. */
  readonly run: RunBarView;
  readonly onStop: () => void;
  /**
   * The run has ended and the bar is folding away (`useExitPresence`): it is `inert` for
   * those 140ms, so nothing in it can be focused or pressed on its way out.
   */
  readonly leaving?: boolean | undefined;
  /** The bar itself: the Composer checks whether focus was in it when it leaves. */
  readonly ref?: Ref<HTMLDivElement> | undefined;
  /** The Stop button. */
  readonly stopRef?: Ref<HTMLButtonElement> | undefined;
  /** ⌘ or Ctrl for Stop's shortcut; the running platform's by default. */
  readonly apple?: boolean | undefined;
  /** Appended to `ck-agent-runbar`. */
  readonly className?: string | undefined;
}

/**
 * The live run's one line (SPEC §4.17, §4.3 "the visible status"), fused to the top of the
 * composer: the working glyph, what the run is doing now, the run's one clock, and Stop.
 *
 * It is the status line's visible home and nothing more. It is not a live region: the
 * panel's only one is LiveStatus (SPEC §6.1), which speaks a throttled, MSA subset of what
 * this line shows, and the line may change faster than anyone could hear it. The clock is
 * `aria-hidden` and never announced (SPEC §4.3).
 *
 * The status is the view's `statusKey` in the catalog's words, its interpolated title in
 * `<bdi>`; while stopping it reads "Stopping…" whatever the key, because a stop that was
 * pressed outranks any stage the run reports on its way down.
 */
export function RunBar({
  locale,
  run,
  onStop,
  leaving = false,
  ref,
  stopRef,
  apple,
  className,
}: RunBarProps) {
  const status: StatusKey = run.stopping ? 'stopping' : run.statusKey;
  return (
    <div
      ref={ref}
      className={className === undefined ? 'ck-agent-runbar' : `ck-agent-runbar ${className}`}
      data-leaving={leaving ? '' : undefined}
      data-stopping={run.stopping ? '' : undefined}
      inert={leaving}
    >
      <div className="ck-agent-runbar__clip">
        <div className="ck-agent-runbar__row">
          <RunGlyph state="working" className="ck-agent-runbar__glyph" />
          <p className="ck-agent-runbar__status">
            {tParts(locale, status, run.params).map((part, index) =>
              part.kind === 'value' ? <bdi key={index}>{part.text}</bdi> : part.text,
            )}
          </p>
          <RunClock startedAt={run.startedAt} className="ck-agent-runbar__clock" />
          <StopButton
            ref={stopRef}
            locale={locale}
            stopping={run.stopping}
            onStop={onStop}
            apple={apple}
          />
        </div>
      </div>
    </div>
  );
}
