import { LiveStageClock } from '../LiveStageClock';
import {
  buildCount,
  buildEta,
  TASK_STATUS_LABEL,
  type BuildProgress,
} from '../AssistantPanel/AssistantPanel.build';

export interface BuildSectionListProps {
  readonly progress: BuildProgress;
  /** Stable prefix for the rows' React keys, so two builds cannot collide. */
  readonly turnId: string;
}

/**
 * The sections of a build in flight: what is done, what is running, what waits.
 *
 * A RUNNING row carries the same clock a single call would have shown, one
 * level in — so a build reads as the ordinary run it is made of, repeated,
 * rather than as an opaque bar.
 *
 * More than one row can be running at once: the fill loop writes with a pool
 * and lands in page order, so several sections are in flight while the page
 * fills top to bottom. They share one clock — the WAVE's, started by the first
 * section of the wave — because "how long has this been going" is a question
 * about the wave, and a per-row clock would restart visibly every time another
 * writer picked up work.
 */
export function BuildSectionList({ progress, turnId }: BuildSectionListProps) {
  const eta = buildEta(progress);
  return (
    <>
      <p className="pg-chat__tasks-head">
        <span className="pg-chat__tasks-count">{buildCount(progress)}</span>
        {eta === null ? null : <span className="pg-chat__tasks-eta">{` · ${eta}`}</span>}
      </p>
      <ol className="pg-chat__tasks" aria-label="Sections">
        {progress.tasks.map((task) => (
          <li
            key={`${turnId}-task-${String(task.position)}`}
            className="pg-chat__task"
            data-status={task.status}
          >
            <span className="pg-chat__task-line">
              {/* The title is the model's, in the request's language. */}
              <span className="pg-chat__task-title" dir="auto">
                {task.title}
              </span>
              <span className="pg-chat__task-state">{TASK_STATUS_LABEL[task.status]}</span>
            </span>
            {task.status === 'running' && progress.run !== null ? (
              <span className="pg-chat__task-run">
                <LiveStageClock heading={`Working on ${task.title}`} run={progress.run} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}
