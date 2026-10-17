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
  /**
   * Take the person to this section on the canvas.
   *
   * Absent when the host has nowhere to take them — a story, a report revived
   * from storage. The row is then plain text rather than a button, because a
   * button that goes nowhere is worse than a label.
   */
  readonly onJump?: ((id: string) => void) | undefined;
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
export function BuildSectionList({ progress, turnId, onJump }: BuildSectionListProps) {
  const eta = buildEta(progress);
  return (
    <>
      <p className="pg-chat__tasks-head">
        <span className="pg-chat__tasks-count">{buildCount(progress)}</span>
        {eta === null ? null : <span className="pg-chat__tasks-eta">{` · ${eta}`}</span>}
      </p>
      {progress.liveLog === undefined || progress.liveLog.length === 0 ? null : (
        <section className="pg-chat__live-stream" aria-label="Live agent stream" aria-live="polite">
          <header>Live agent stream</header>
          {progress.liveLine === undefined ? null : (
            <p className="pg-chat__live-current" dir="auto">{progress.liveLine}</p>
          )}
          <ol>
            {progress.liveLog.map((line, index) => (
              <li key={`${String(index)}-${line}`} dir="auto">{line}</li>
            ))}
          </ol>
        </section>
      )}
      <ol className="pg-chat__tasks" aria-label="Sections">
        {progress.tasks.map((task) => (
          <li
            key={`${turnId}-task-${String(task.position)}`}
            className="pg-chat__task"
            data-status={task.status}
          >
            <span className="pg-chat__task-line">
              {/*
                JUMP TO SECTION. A build writes eight regions down a page a
                person cannot see all of; naming one and not being able to reach
                it is the gap this closes.

                Only a section that EXISTS is reachable. A row still waiting has
                no node yet, and one that was never written has none either — a
                button for those would select nothing and look broken. The title
                stays exactly where it was either way, so the list does not
                reflow as sections land.
              */}
              {onJump === undefined || task.id === '' || task.status === 'waiting' ? (
                // The title is the model's, in the request's language.
                <span className="pg-chat__task-title" dir="auto">
                  {task.title}
                </span>
              ) : (
                <button
                  type="button"
                  className="pg-chat__task-title pg-chat__task-jump"
                  dir="auto"
                  onClick={() => {
                    onJump(task.id);
                  }}
                >
                  {task.title}
                </button>
              )}
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
