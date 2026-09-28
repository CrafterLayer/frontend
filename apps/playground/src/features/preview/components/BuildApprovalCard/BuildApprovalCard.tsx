import { ChromeButton } from '@craftkit/builder';
import { useContext } from 'react';

import { IconCheck, IconSparkle, IconStop } from '../AssistantPanel/AssistantPanel.icons';
import { buildNoticeText, type BuildTask } from '../AssistantPanel/AssistantPanel.build';
import { BuildCardSeamContext } from '../BuildReportCard/build-card-seam';
import { approvalNote, describeBuildCost } from './cost';

export interface BuildApprovalCardProps {
  /** The scaffold's rationale, verbatim — every section will obey this text. */
  readonly direction: string;
  /**
   * The sections the skeleton WOULD create, in page order. Nothing is on the
   * page yet: the engine asks before its first write (2026-09-28, P0-4).
   */
  readonly tasks: readonly BuildTask[];
  /** Stable prefix for the list's React keys, so two cards cannot collide. */
  readonly turnId: string;
  readonly onAnswer: (answer: 'build' | 'stop') => void;
  /**
   * Roughly what the rest of this build will cost to SEND, in tokens.
   *
   * An estimate of the requests, not of the answers, and it is labelled as one.
   * It belongs on this card and nowhere else: this is the only moment a person
   * is asked to authorise a run that is many calls long, and "eight sections"
   * says nothing about what eight sections costs.
   *
   * Absent when the host cannot estimate — a story, or a run whose context is
   * already gone. Nothing is shown rather than a zero, because a zero is a
   * claim and an absence is not.
   */
  readonly costTokens?: number | undefined;
  readonly locale?: 'ar' | 'en';
}

/**
 * The ONE question a build asks.
 *
 * A split build is minutes of work and many model calls, so it stops here once
 * — with the direction it decided, the sections it will write, and two buttons
 * — and then answers its own failures to the end. That is the whole point of
 * the split: a long build does not keep interrupting.
 *
 * The note is not reassurance, it is the fact that makes "Build" safe to press:
 * nothing is written until it is pressed, and then each section lands as its
 * own transaction, so any one of them can be put back alone afterwards.
 *
 * It said "The skeleton is already on the page" until 2026-09-28, which was
 * true while the skeleton landed before this question — and became false the
 * moment the engine stopped writing before approval (agent-audit P0-4).
 */
export function BuildApprovalCard({
  direction,
  tasks,
  turnId,
  onAnswer,
  costTokens,
  locale = 'en',
}: BuildApprovalCardProps) {
  const seam = useContext(BuildCardSeamContext);
  const notices = seam.noticesOf(turnId);
  return (
    <div
      className="pg-chat__card pg-chat__card--pending"
      data-state="awaiting-build"
      role="group"
      aria-label="Build this page"
    >
      <div className="pg-chat__card-head">
        <span className="pg-chat__card-kind" data-kind="ask">
          <IconSparkle />
          Build
        </span>
        {costTokens === undefined ? null : (
          <span className="pg-chat__card-count">{describeBuildCost(costTokens, locale)}</span>
        )}
        <span className="pg-chat__card-count">{String(tasks.length)} sections</span>
      </div>
      <p className="pg-chat__rationale" dir="auto">
        {direction}
      </p>
      <ol className="pg-chat__steps">
        {tasks.map((task) => (
          <li key={`${turnId}-ask-${String(task.position)}`}>
            <span className="pg-chat__step-title">{task.title}</span>
            {/* A PagePlan build says what each section is FOR — a title alone
                ("Proof") tells a person little about what will be written. */}
            {task.purpose === undefined ? null : (
              <span className="pg-chat__task-reason" dir="auto">
                {task.purpose}
              </span>
            )}
          </li>
        ))}
      </ol>
      {notices.map((notice) => (
        <p key={notice} className="pg-chat__tasks-note" role="note">
          {buildNoticeText(notice, locale)}
        </p>
      ))}
      <p className="pg-chat__tasks-note">{approvalNote(locale)}</p>
      <div className="pg-chat__decide">
        <ChromeButton
          variant="primary"
          onClick={() => {
            onAnswer('build');
          }}
        >
          <IconCheck />
          Build
        </ChromeButton>
        <ChromeButton
          variant="quiet"
          size="sm"
          className="pg-chat__decide-discard"
          onClick={() => {
            onAnswer('stop');
          }}
        >
          <IconStop />
          Stop build
        </ChromeButton>
      </div>
    </div>
  );
}
