import { ChromeButton } from '@craftkit/builder';

import './AgentRunCard.css';

export type AgentRunCardStatus = 'queued' | 'running' | 'stopped' | 'failed' | 'done';

export interface AgentRunCardProps {
  readonly status: AgentRunCardStatus;
  readonly title: string;
  readonly currentTask?: string | undefined;
  readonly completed: number;
  readonly total: number;
  readonly summary?: string | undefined;
  readonly details?: readonly string[] | undefined;
  /** Provider narration received live over SSE, newest last. */
  readonly liveUpdates?: readonly string[] | undefined;
  readonly diffSummary?: string | undefined;
  readonly onStop?: (() => void) | undefined;
  readonly onUndo?: (() => void) | undefined;
  readonly onReviewDiff?: (() => void) | undefined;
}

const STATUS_LABEL: Readonly<Record<AgentRunCardStatus, string>> = {
  queued: 'Queued',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  done: 'Done',
};

/** One run, one compact card. The useful outcome leads; technical detail starts closed. */
export function AgentRunCard({
  status,
  title,
  currentTask,
  completed,
  total,
  summary,
  details = [],
  liveUpdates = [],
  diffSummary,
  onStop,
  onUndo,
  onReviewDiff,
}: AgentRunCardProps) {
  const boundedTotal = Math.max(0, total);
  const boundedCompleted = Math.min(Math.max(0, completed), boundedTotal);
  const progress = boundedTotal === 0 ? 0 : (boundedCompleted / boundedTotal) * 100;

  return (
    <article className="pg-agent-run" data-status={status} aria-label={`${title} · ${STATUS_LABEL[status]}`}>
      <header className="pg-agent-run__head">
        <div>
          <span className="pg-agent-run__status">{STATUS_LABEL[status]}</span>
          <h3>{title}</h3>
        </div>
        <span className="pg-agent-run__count" aria-label={`${String(boundedCompleted)} of ${String(boundedTotal)} tasks complete`}>
          {boundedCompleted}/{boundedTotal}
        </span>
      </header>
      <div
        className="pg-agent-run__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={boundedTotal}
        aria-valuenow={boundedCompleted}
        aria-label="Run progress"
      >
        <span style={{ inlineSize: `${String(progress)}%` }} />
      </div>
      {currentTask === undefined ? null : <p className="pg-agent-run__current" dir="auto">{currentTask}</p>}
      {summary === undefined ? null : <p className="pg-agent-run__summary" dir="auto">{summary}</p>}
      {diffSummary === undefined ? null : <p className="pg-agent-run__diff">{diffSummary}</p>}
      {liveUpdates.length === 0 ? null : (
        <section className="pg-agent-run__live" aria-label="Live agent stream" aria-live="polite">
          <header>Live agent stream</header>
          <ol>
            {liveUpdates.map((update, index) => (
              <li key={`${String(index)}-${update}`} dir="auto">{update}</li>
            ))}
          </ol>
        </section>
      )}
      <div className="pg-agent-run__actions">
        {status === 'running' && onStop !== undefined ? (
          <ChromeButton size="sm" onClick={onStop}>Stop and revise</ChromeButton>
        ) : null}
        {status === 'done' && onReviewDiff !== undefined ? (
          <ChromeButton size="sm" onClick={onReviewDiff}>Review changes</ChromeButton>
        ) : null}
        {status === 'done' && onUndo !== undefined ? (
          <ChromeButton size="sm" onClick={onUndo}>Undo</ChromeButton>
        ) : null}
      </div>
      {details.length === 0 ? null : (
        <details className="pg-agent-run__details">
          <summary>Tools and files</summary>
          <ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        </details>
      )}
    </article>
  );
}
