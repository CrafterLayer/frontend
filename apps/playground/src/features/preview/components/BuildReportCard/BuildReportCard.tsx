import { ChromeButton } from '@craftkit/builder';

import {
  IconCheck,
  IconSparkle,
  IconStop,
  IconUndo,
} from '../AssistantPanel/AssistantPanel.icons';
import { buildCount, TASK_STATUS_LABEL } from '../AssistantPanel/AssistantPanel.build';
import type { BuiltTurn } from '../AssistantPanel/AssistantPanel.turns';

export interface BuildReportCardProps {
  /** The settled build: what landed, what did not, and why each. */
  readonly report: BuiltTurn;
  /** Stable prefix for the rows' React keys. */
  readonly turnId: string;
  /**
   * Whether this panel may write at all right now.
   *
   * Undo is withheld in Plan mode for the same reason Apply is: the mode is a
   * promise about this panel, and this button loops `kernel.undo()` — it writes
   * MORE than the others, not less.
   */
  readonly canUndo: boolean;
  readonly onUndoTask: (position: number, total: number, title: string, spent: number) => void;
  /** Ask again for the skipped sections, and only those. */
  readonly onRetrySkipped: (titles: readonly string[]) => void;
  /** The timing line, when the run left evidence for one. */
  /** The panel is working, so nothing here starts another run. */
  readonly busy: boolean;
}

/**
 * What a build actually did: every section, its outcome, and the reason for
 * each one that did not land.
 *
 * A build is many transactions, so the report is the only place a person can
 * see them as one thing — and each section can still be undone alone, which is
 * what made pressing Build safe in the first place.
 */
export function BuildReportCard({
  report,
  turnId,
  busy,
  canUndo,
  onUndoTask,
  onRetrySkipped,
}: BuildReportCardProps) {
  return (
    <div
      className={`pg-chat__card ${
        report.stopped === true
          ? 'pg-chat__card--discarded'
          : 'pg-chat__card--applied'
      }`}
      data-state={report.stopped === true ? 'build-stopped' : 'built'}
    >
      <div className="pg-chat__card-head">
        <span
          className="pg-chat__card-kind"
          data-kind={report.stopped === true ? 'stopped' : 'applied'}
        >
          {report.stopped === true ? <IconStop /> : <IconCheck />}
          {report.stopped === true ? 'Stopped' : 'Built'}
        </span>
        <span className="pg-chat__card-count">{buildCount(report.progress)}</span>
      </div>
      {report.receipt === undefined ? null : (
        <p className="pg-chat__receipt">
          {`${String(report.receipt.applied)}/${String(report.receipt.total)} built in ${report.receipt.elapsed}`}
        </p>
      )}
      <ol className="pg-chat__tasks" aria-label="Sections">
        {report.progress.tasks.map((task) => (
          <li
            key={`${turnId}-built-${String(task.position)}`}
            className="pg-chat__task"
            data-status={task.status}
          >
            <span className="pg-chat__task-line">
              <span className="pg-chat__task-title" dir="auto">
                {task.title}
              </span>
              {/*
                Withheld in Plan mode for the same reason the
                card's Undo is: this one loops `kernel.undo()`,
                so it writes more than the others, not less.
              */}
              {task.status === 'applied' &&
              report.undoable === true &&
              canUndo ? (
                <ChromeButton
                  variant="quiet"
                  size="sm"
                  className="pg-chat__task-undo"
                  aria-label={`Undo ${task.title}`}
                  disabled={
                    report.undoneFrom !== undefined &&
                    task.position >= report.undoneFrom
                  }
                  onClick={() => {
                    onUndoTask(task.position,
                      report.progress.tasks.length,
                      task.title,
                      report.undoneSteps ?? 0,
                    );
                  }}
                >
                  <IconUndo />
                  Undo
                </ChromeButton>
              ) : (
                <span className="pg-chat__task-state">
                  {TASK_STATUS_LABEL[task.status]}
                </span>
              )}
            </span>
            {/* A section that would not be written twice says
                why, in the door's own words. */}
            {task.status === 'skipped' && task.reason !== undefined ? (
              <span className="pg-chat__task-reason" dir="auto">
                {task.reason}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {report.request === undefined ||
      report.progress.tasks.every((task) => task.status !== 'skipped') ? null : (
        <ChromeButton
          variant="quiet"
          size="sm"
          disabled={busy}
          onClick={() => {
            onRetrySkipped(
              report.progress.tasks
                .filter((task) => task.status === 'skipped')
                .map((task) => task.title),
            );
          }}
        >
          <IconSparkle />
          Retry skipped
        </ChromeButton>
      )}
    </div>
  );
}
