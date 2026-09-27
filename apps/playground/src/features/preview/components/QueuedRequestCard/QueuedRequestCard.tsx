import { ChromeButton } from '@craftkit/builder';

import './QueuedRequestCard.css';

export type QueuedRequestState = 'editable' | 'stale' | 'missing-target';

export interface QueuedRequestCardProps {
  readonly request: string;
  readonly context: string;
  readonly state?: QueuedRequestState | undefined;
  readonly paused?: boolean | undefined;
  readonly onChange: (request: string) => void;
  readonly onRemove: () => void;
  readonly onRun?: (() => void) | undefined;
}

const STATE_COPY: Readonly<Record<QueuedRequestState, string>> = {
  editable: 'Runs next',
  stale: 'Target changed · will revalidate',
  'missing-target': 'Target missing · select a new target',
};

/** The only request permitted behind an active run, editable without changing its captured scope. */
export function QueuedRequestCard({
  request,
  context,
  state = 'editable',
  paused = false,
  onChange,
  onRemove,
  onRun,
}: QueuedRequestCardProps) {
  const blocked = state === 'missing-target';
  return (
    <section className="pg-agent-queue" data-state={state} aria-label="Queued request">
      <header>
        <div>
          <strong>Next request</strong>
          <span>{paused ? 'Paused · revise or continue' : STATE_COPY[state]}</span>
        </div>
        <div className="pg-agent-queue__actions">
          {paused && onRun !== undefined ? <ChromeButton size="sm" onClick={onRun}>Continue</ChromeButton> : null}
          <ChromeButton size="sm" onClick={onRemove}>Remove</ChromeButton>
        </div>
      </header>
      <p className="pg-agent-queue__context">Target · {context}</p>
      <label>
        <span className="bldr-visually-hidden">Edit queued request</span>
        <textarea
          rows={2}
          value={request}
          aria-invalid={blocked}
          aria-describedby={blocked ? 'pg-agent-queue-target-error' : undefined}
          onChange={(event) => { onChange(event.currentTarget.value); }}
        />
      </label>
      {blocked ? <p id="pg-agent-queue-target-error" role="alert">Choose a new target before this request can run.</p> : null}
    </section>
  );
}
