import { useCallback, useId, useSyncExternalStore } from 'react';

import { ChromeButton } from '@craftkit/builder';

import type { SourceAgentMode, SourceAgentPort } from '../../source-agent-types';
import { AgentRunCard } from '../AgentRunCard';
import { QueuedRequestCard } from '../QueuedRequestCard';

import './SourceAgentPanel.css';

export interface SourceAgentPanelProps {
  port: SourceAgentPort;
  /** The panel stays mounted while another rail destination is active. */
  visible?: boolean | undefined;
}

const MODE_COPY: Readonly<
  Record<SourceAgentMode, { readonly label: string; readonly hint: string; readonly action: string }>
> = {
  ask: {
    label: 'Ask',
    hint: 'Explain only. Source stays read only.',
    action: 'Ask agent',
  },
  plan: {
    label: 'Plan',
    hint: 'Plan the source changes without applying them.',
    action: 'Create plan',
  },
  auto: {
    label: 'Auto',
    hint: 'Draft source, verify the preview, then commit once.',
    action: 'Run agent',
  },
};

const MODES: readonly SourceAgentMode[] = ['ask', 'plan', 'auto'];

const EMPTY_SUGGESTIONS = [
  'Explain the selected component',
  'Plan a stronger responsive composition',
  'Improve this section and verify the preview',
] as const;

/**
 * Compact source-agent surface. The subscribed port owns every async state
 * transition; this component only renders snapshots and forwards user intent.
 */
export function SourceAgentPanel({ port, visible = true }: SourceAgentPanelProps) {
  const uid = useId();
  const modeHintId = `${uid}-mode-hint`;
  const subscribe = useCallback((listener: () => void) => port.subscribe(listener), [port]);
  const getSnapshot = useCallback(() => port.getSnapshot(), [port]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const canSubmit = snapshot.enabled && snapshot.draft.trim().length > 0 && snapshot.queued === null;
  const modeCopy = MODE_COPY[snapshot.mode];

  return (
    <section
      className="pg-source-agent"
      aria-label="Source agent"
      hidden={!visible}
      data-busy={snapshot.busy ? 'true' : 'false'}
    >
      <header className="pg-source-agent__header">
        <div>
          <span className="pg-source-agent__mark" aria-hidden="true">
            AI
          </span>
          <h2>Agent</h2>
        </div>
        <ChromeButton size="sm" onClick={() => port.newConversation()}>
          New conversation
        </ChromeButton>
      </header>

      <p className="pg-source-agent__context" aria-label="Agent context">
        <span>Context</span>
        <strong dir="auto">{snapshot.context}</strong>
      </p>

      <div className="pg-source-agent__thread" aria-label="Agent conversation" aria-live="polite">
        {snapshot.turns.length === 0 ? (
          <div className="pg-source-agent__empty">
            <strong>What should change?</strong>
            <span>Ask about the source, plan an edit, or let Auto verify and commit it.</span>
            <div aria-label="Suggested requests">
              {EMPTY_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => port.setDraft(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          snapshot.turns.map((turn) => (
            <article key={turn.id} className="pg-source-agent__turn">
              <div className="pg-source-agent__prompt">
                <span>You · {turn.pageTitle}</span>
                <p dir="auto">{turn.prompt}</p>
              </div>
              <AgentRunCard
                status={turn.status}
                title={turn.pageTitle}
                currentTask={turn.currentTask === '' ? undefined : turn.currentTask}
                completed={turn.completed}
                total={turn.total}
                summary={turn.summary === '' ? undefined : turn.summary}
                details={[...turn.files, ...turn.details]}
                diffSummary={
                  turn.files.length === 0
                    ? undefined
                    : `${String(turn.files.length)} ${turn.files.length === 1 ? 'file' : 'files'} changed`
                }
                onStop={turn.status === 'running' ? () => void port.stop() : undefined}
                onReviewDiff={
                  turn.status === 'done'
                    ? () => {
                        port.reviewChanges(turn.id);
                      }
                    : undefined
                }
                onUndo={
                  turn.status === 'done' && turn.canUndo
                    ? () => {
                        port.undo(turn.id);
                      }
                    : undefined
                }
              />
              {turn.canResume ? (
                <ChromeButton
                  size="sm"
                  className="pg-source-agent__resume"
                  onClick={() => void port.resume(turn.id)}
                >
                  Resume incomplete work
                </ChromeButton>
              ) : null}
            </article>
          ))
        )}
        {snapshot.queued === null ? null : (
          <QueuedRequestCard
            request={snapshot.queued.prompt}
            context={snapshot.queued.context}
            paused={!snapshot.busy}
            onChange={(prompt) => void port.editQueued(prompt)}
            onRemove={() => void port.removeQueued()}
          />
        )}
        {snapshot.message === undefined ? null : (
          <p className="pg-source-agent__message" role={snapshot.enabled ? 'status' : 'alert'}>
            {snapshot.message}
          </p>
        )}
      </div>

      <form
        className="pg-source-agent__composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void port.submit();
        }}
      >
        <label htmlFor={`${uid}-request`} className="bldr-visually-hidden">
          Agent request
        </label>
        <textarea
          id={`${uid}-request`}
          rows={2}
          value={snapshot.draft}
          placeholder={snapshot.busy ? 'Type one next request…' : 'Ask for a source change…'}
          disabled={!snapshot.enabled}
          onChange={(event) => port.setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSubmit) void port.submit();
            }
          }}
        />
        <div className="pg-source-agent__composer-row">
          <div
            className="pg-source-agent__modes"
            role="radiogroup"
            aria-label="Agent mode"
            aria-describedby={modeHintId}
            aria-disabled={snapshot.busy || !snapshot.enabled ? 'true' : undefined}
          >
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={snapshot.mode === mode}
                tabIndex={snapshot.mode === mode ? 0 : -1}
                disabled={snapshot.busy || !snapshot.enabled}
                data-mode={mode}
                onClick={() => port.setMode(mode)}
                onKeyDown={(event) => {
                  const step =
                    event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? 1
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? -1
                        : 0;
                  if (step === 0) return;
                  event.preventDefault();
                  const index = MODES.indexOf(snapshot.mode);
                  const next = MODES[(index + step + MODES.length) % MODES.length];
                  if (next === undefined) return;
                  port.setMode(next);
                  event.currentTarget.parentElement
                    ?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)
                    ?.focus();
                }}
              >
                {MODE_COPY[mode].label}
              </button>
            ))}
          </div>
          <div className="pg-source-agent__submit-actions">
            {snapshot.busy ? (
              <ChromeButton size="sm" onClick={() => void port.stop()}>
                Stop and revise
              </ChromeButton>
            ) : null}
            <ChromeButton type="submit" tone="primary" size="sm" disabled={!canSubmit}>
              {snapshot.busy ? 'Queue next' : modeCopy.action}
            </ChromeButton>
          </div>
        </div>
        <p id={modeHintId} className="pg-source-agent__mode-hint">
          {snapshot.busy ? 'Stop the active run to change its mode.' : modeCopy.hint}
        </p>
      </form>
    </section>
  );
}
