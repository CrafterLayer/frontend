import { ChromeButton } from '@craftkit/builder';

import { IconCheck, IconSparkle, IconStop } from '../AssistantPanel/AssistantPanel.icons';
import type { BuildTask } from '../AssistantPanel/AssistantPanel.build';

export interface BuildApprovalCardProps {
  /** The scaffold's rationale, verbatim — every section will obey this text. */
  readonly direction: string;
  /** The sections the scaffold laid down, in page order. */
  readonly tasks: readonly BuildTask[];
  /** Stable prefix for the list's React keys, so two cards cannot collide. */
  readonly turnId: string;
  readonly onAnswer: (answer: 'build' | 'stop') => void;
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
 * each section lands as its own transaction, so any one of them can be undone
 * alone afterwards.
 */
export function BuildApprovalCard({
  direction,
  tasks,
  turnId,
  onAnswer,
}: BuildApprovalCardProps) {
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
        <span className="pg-chat__card-count">{String(tasks.length)} sections</span>
      </div>
      <p className="pg-chat__rationale" dir="auto">
        {direction}
      </p>
      <ol className="pg-chat__steps">
        {tasks.map((task) => (
          <li key={`${turnId}-ask-${String(task.position)}`}>
            <span className="pg-chat__step-title">{task.title}</span>
          </li>
        ))}
      </ol>
      <p className="pg-chat__tasks-note">
        The skeleton is already on the page. Each section is applied as its own change, so any step
        can be undone on its own.
      </p>
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
