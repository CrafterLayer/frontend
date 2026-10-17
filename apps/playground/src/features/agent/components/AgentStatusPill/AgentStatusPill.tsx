import type { ReactNode } from 'react';

import { tParts, t, type Key } from '../../copy';
import type { CopyParams, FaceView, Locale } from '../../model/view-types';
import { AgentFace } from '../../../preview/components/AgentFace';
import { IconButton } from '../IconButton';

import './AgentStatusPill.css';
import type { PillView } from './pill-view';

export interface AgentStatusPillProps {
  readonly locale: Locale;
  /** The line (`pillView(state, finished)`). The host renders nothing when it is `null`. */
  readonly view: PillView;
  /** The header face's mood (`AgentViewState.face`); idle when absent. */
  readonly face?: FaceView | undefined;
  /** Activating the pill opens the panel (SPEC §4.20). */
  readonly onOpen: () => void;
  /** Stop the live run. Left out once the run has ended (`done`): nothing to stop. */
  readonly onStop?: (() => void) | undefined;
  /** Stop was pressed and the engine has not settled: `aria-disabled`, "Stopping…". */
  readonly stopping?: boolean | undefined;
}

function lineOf(view: PillView): { readonly key: Key; readonly params: CopyParams } {
  switch (view.kind) {
    case 'building':
      return { key: 'pill.building', params: { done: view.done, total: view.total } };
    case 'editing':
      return { key: 'pill.editing', params: { target: view.target } };
    case 'working':
      return { key: 'pill.working', params: {} };
    case 'done':
      return { key: 'pill.done', params: { n: view.sections } };
  }
}

function Line({ locale, view }: { readonly locale: Locale; readonly view: PillView }): ReactNode {
  const { key, params } = lineOf(view);
  return tParts(locale, key, params).map((part, index) =>
    part.kind === 'value' ? (
      <bdi key={index} dir={typeof params[part.slot] === 'number' ? 'ltr' : undefined}>
        {part.text}
      </bdi>
    ) : (
      part.text
    ),
  );
}

/**
 * The agent's line in the editor's status bar while the panel is hidden (SPEC §4.20,
 * §7.2 #52): 28px, the mini face, the sentence, and a 32px-hit Stop. It replaces the
 * three "Assistant: …" change chips a build used to stack there, so one run is one line.
 *
 * Its own `ck-agent` root with `dir` and `lang`: it is drawn in the status bar, outside
 * the panel, and still speaks the panel's language (the tooltip mounts inside it too).
 * Not live: the panel's LiveStatus stays mounted while hidden and says the outcome.
 */
export function AgentStatusPill({
  locale,
  view,
  face,
  onOpen,
  onStop,
  stopping = false,
}: AgentStatusPillProps) {
  const text = t(locale, lineOf(view).key, lineOf(view).params);
  return (
    <div
      className="ck-agent ck-agent-pill"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      data-kind={view.kind}
    >
      <button type="button" className="ck-agent-pill__open" aria-label={text} onClick={onOpen}>
        <span className="ck-agent-pill__face" aria-hidden="true">
          <AgentFace
            size="sm"
            mood={face?.mood ?? (view.kind === 'done' ? 'done' : 'working')}
            variant={face?.variant}
            outcome={face?.outcome}
            typing={false}
          />
        </span>
        <span className="ck-agent-pill__text">
          <Line locale={locale} view={view} />
        </span>
      </button>
      {onStop === undefined ? null : (
        <IconButton
          className="ck-agent-pill__stop"
          icon={stopping ? 'spinner' : 'stop'}
          label={t(locale, stopping ? 'stopping' : 'stop')}
          unavailable={stopping}
          tooltipSide="top"
          tooltipAlign="end"
          onClick={onStop}
        />
      )}
    </div>
  );
}
