import type { AiValidatedProposal } from '@craftkit/builder';
import type { Ref } from 'react';

import { AgentFace, moodForTurn, type AgentLocale, type AgentMoodSnapshot } from '../AgentFace';
import { AgentRunCard } from '../AgentRunCard';
import type { AssistantMode } from '../AssistantPanel/AssistantPanel.modes';
import type { Turn } from '../AssistantPanel/AssistantPanel.turns';
import { BuildApprovalCard } from '../BuildApprovalCard';
import { BuildReportCard } from '../BuildReportCard';
import { BuildSectionList } from '../BuildSectionList';
import { LiveStageClock } from '../LiveStageClock';
import { OutcomeCard } from '../OutcomeCard';
import { OutlineCard } from '../OutlineCard';
import { PlanCard } from '../PlanCard';

export interface AssistantThreadProps {
  readonly turns: readonly Turn[];
  /** The LIVE mood, which only an in-flight bubble may wear. */
  readonly face: AgentMoodSnapshot;
  readonly locale: AgentLocale;
  /** The panel's mode NOW, which is not always the mode a card was proposed under. */
  readonly mode: AssistantMode;
  /** A run owns the panel: Retry and the report's own actions must not start a second. */
  readonly busy: boolean;
  /** Whether this panel may write at all. Gates Apply and every Undo. */
  readonly canWrite: boolean;
  /** The scroller, so the panel can keep the newest turn in view. */
  readonly threadRef: Ref<HTMLDivElement>;
  /** The empty state's zone and seat, from `useFaceLook`. */
  readonly watchEmptyZone: Ref<HTMLDivElement>;
  readonly holdEmptySeat: Ref<HTMLSpanElement>;
  /** The build's ONE question, answered: continue with the list, or stop here. */
  readonly onApproval: (answer: 'build' | 'stop') => void;
  readonly onStop: () => void;
  readonly onUndoTask: (
    turnId: string,
    position: number,
    total: number,
    title: string,
    spent: number,
  ) => void;
  readonly onRetrySkipped: (titles: readonly string[]) => void;
  readonly onRetry: (request: string) => void;
  /** Turn a planned page into a real build: a new run, at a writing authority. */
  readonly onBuild: (request: string) => void;
  /** Take the person to a section on the canvas. Absent when there is nowhere to go. */
  readonly onJump?: ((id: string) => void) | undefined;
  /** What the rest of a build would cost to send. Absent when it cannot be estimated. */
  readonly buildCostTokens?: number | undefined;
  readonly onApplyPlan: (turnId: string, proposal: AiValidatedProposal) => void;
  readonly onPreviewPlan: (turnId: string, proposal: AiValidatedProposal) => void;
  readonly onDiscardPlan: (turnId: string) => void;
  readonly onUndoPlan: () => void;
  readonly onReviewAsCode?: (() => void) | undefined;
}

/**
 * The conversation itself: every turn, in order, each rendered as the kind of
 * thing it is.
 *
 * A `role="log"`, because that is what a thread is — content appended over
 * time, which a screen reader should be able to review rather than have
 * announced. The panel keeps ONE live region of its own; this one stays quiet
 * so a person is not told the same thing twice.
 *
 * It dispatches, it does not decide. Every card below owns its own rules — when
 * Apply is withdrawn, when Undo is a write, when Retry would re-send nothing —
 * and this component's whole job is to hand each turn to the card that knows
 * what to do with it.
 */
export function AssistantThread({
  turns,
  face,
  locale,
  mode,
  busy,
  canWrite,
  threadRef,
  watchEmptyZone,
  holdEmptySeat,
  onApproval,
  onStop,
  onUndoTask,
  onRetrySkipped,
  onRetry,
  onBuild,
  onJump,
  buildCostTokens,
  onApplyPlan,
  onPreviewPlan,
  onDiscardPlan,
  onUndoPlan,
  onReviewAsCode,
}: AssistantThreadProps) {
  return (
    <div className="pg-chat__thread" ref={threadRef} role="log" aria-label="Conversation">
      {turns.length === 0 ? (
        <div className="pg-chat__empty" ref={watchEmptyZone}>
          <span className="pg-chat__empty-mark" aria-hidden="true" ref={holdEmptySeat}>
            <AgentFace mood="idle" size="lg" />
          </span>
          <p>Ask for a section and I will propose the exact changes.</p>
        </div>
      ) : null}

      {turns.map((turn) => (
        <article
          key={turn.id}
          className="pg-chat__turn"
          data-from={turn.from}
          data-kind={turn.from === 'assistant' ? turn.kind : 'text'}
        >
          {turn.from === 'you' ? (
            <p className="pg-chat__you" dir="auto">
              {turn.text}
            </p>
          ) : (
            <div className="pg-chat__reply">
              {/* One avatar for every reply: the live thinking bubble mirrors
              the header's phase (still static — sm never animates), every
              other bubble is frozen at the mood it earned. */}
              <span className="pg-chat__avatar" aria-hidden="true">
                <AgentFace
                  size="sm"
                  {...(turn.kind === 'thinking' || turn.kind === 'building'
                    ? { mood: face.mood, variant: face.variant }
                    : turn.kind === 'built'
                      ? { mood: turn.stopped === true ? ('stopped' as const) : ('done' as const) }
                      : moodForTurn(turn))}
                />
              </span>
              <div className="pg-chat__reply-body">
                {turn.kind === 'thinking' ? (
                  <AgentRunCard
                    status="running"
                    title={`Working on ${turn.subject}`}
                    currentTask={turn.progress ?? `Reading ${turn.subject}…`}
                    completed={turn.run.stages.filter((stage) => stage.status === 'done').length}
                    total={turn.run.stages.length}
                    onStop={onStop}
                  />
                ) : null}
                {turn.kind === 'building' ? (
                  <div className="pg-chat__inflight" data-state="building">
                    {turn.awaiting === true ? (
                      <BuildApprovalCard
                        direction={turn.progress.direction}
                        tasks={turn.progress.tasks}
                        turnId={turn.id}
                        onAnswer={onApproval}
                        costTokens={buildCostTokens}
                        locale={locale}
                      />
                    ) : turn.progress.tasks.length === 0 ? (
                      /* Before the list exists there is one thing to watch:
                       the skeleton. It is an ordinary run, so it gets the
                       ordinary rows. */
                      <>
                        {turn.progress.run === null ? null : (
                          <LiveStageClock
                            heading="Working on the page skeleton"
                            run={turn.progress.run}
                          />
                        )}
                        <div className="pg-chat__thinking">
                          <span className="pg-chat__thinking-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                          <p>Laying out the page…</p>
                        </div>
                      </>
                    ) : (
                      <BuildSectionList progress={turn.progress} turnId={turn.id} onJump={onJump} />
                    )}
                  </div>
                ) : null}
                {turn.kind === 'built' ? (
                  <BuildReportCard
                    report={turn}
                    turnId={turn.id}
                    busy={busy}
                    canUndo={canWrite}
                    onUndoTask={(position, total, title, spent) => {
                      onUndoTask(turn.id, position, total, title, spent);
                    }}
                    onRetrySkipped={(titles) => {
                      onRetrySkipped(titles);
                    }}
                  />
                ) : null}
                {turn.kind === 'stopped' || turn.kind === 'refused' || turn.kind === 'discarded' ? (
                  <OutcomeCard
                    turn={turn}
                    busy={busy}
                    onRetry={(request) => {
                      onRetry(request);
                    }}
                  />
                ) : null}
                {turn.kind === 'outline' ? (
                  <OutlineCard
                    text={turn.text}
                    dropped={turn.dropped}
                    sections={turn.sections}
                    busy={busy}
                    {...(turn.request === undefined
                      ? {}
                      : {
                          onBuild: () => {
                            onBuild(turn.request ?? '');
                          },
                        })}
                  />
                ) : null}
                {turn.kind === 'plan' ? (
                  <PlanCard
                    turn={turn}
                    locale={locale}
                    mode={mode}
                    canWrite={canWrite}
                    onApply={() => {
                      if (turn.proposal !== undefined) {
                        onApplyPlan(turn.id, turn.proposal);
                      }
                    }}
                    onPreview={() => {
                      if (turn.proposal !== undefined) {
                        onPreviewPlan(turn.id, turn.proposal);
                      }
                    }}
                    onDiscard={() => {
                      onDiscardPlan(turn.id);
                    }}
                    onUndo={() => {
                      onUndoPlan();
                    }}
                    onReviewAsCode={onReviewAsCode}
                  />
                ) : null}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
