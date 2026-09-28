import { ChromeButton } from '@craftkit/builder';
import { useContext } from 'react';

import { IconCheck, IconSparkle, IconStop, IconUndo } from '../AssistantPanel/AssistantPanel.icons';
import {
  buildCount,
  buildNoticeText,
  TASK_STATUS_LABEL,
} from '../AssistantPanel/AssistantPanel.build';
import type { BuiltTurn } from '../AssistantPanel/AssistantPanel.turns';
import { BuildCardSeamContext } from './build-card-seam';
import {
  offersSectionUndo,
  removeUnfilledLabel,
  revertMayRetry,
  revertRefusedText,
  unfilledRemovalRefusedText,
  unfilledRemovalText,
} from './copy';

export interface BuildReportCardProps {
  /** The settled build: what landed, what did not, and why each. */
  readonly report: BuiltTurn;
  /** Stable prefix for the rows' React keys. */
  readonly turnId: string;
  /**
   * Whether this panel may write at all right now.
   *
   * Undo is withheld in Plan mode for the same reason Apply is: the mode is a
   * promise about this panel, and putting a section back is a write — a new
   * transaction, like any other.
   */
  readonly canUndo: boolean;
  /**
   * Put ONE section back. The panel finds the section by this card's turn and
   * `position`; `total` and `title` name it for a reader of the call, and
   * `spent` is always 0 since the forward revert (2026-09-28) — it counted the
   * kernel undos the old cascade had used, and stays only so the thread that
   * forwards this call compiles unchanged.
   */
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
 * see them as one thing — and each section can still be put back alone, which
 * is what made pressing Build safe in the first place. Putting one back is a
 * FORWARD transaction on that section's region (`revertBuildSection`), so it
 * never takes another section, or the person's own later edits, with it.
 */
export function BuildReportCard({
  report,
  turnId,
  busy,
  canUndo,
  onUndoTask,
  onRetrySkipped,
}: BuildReportCardProps) {
  const seam = useContext(BuildCardSeamContext);
  const reverted = new Set(report.reverted ?? []);
  const refused = new Map(
    (report.revertRefused ?? []).map((entry) => [entry.position, entry.code]),
  );
  const emptyLeft = report.unfilled ?? 0;
  const offersRemoval =
    emptyLeft > 0 &&
    report.unfilledRemoval === undefined &&
    report.undoable === true &&
    canUndo &&
    seam.onRemoveUnfilled !== undefined;
  return (
    <div
      className={`pg-chat__card ${
        report.stopped === true ? 'pg-chat__card--discarded' : 'pg-chat__card--applied'
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
        {report.progress.tasks.map((task) => {
          const refusal = refused.get(task.position);
          return (
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
                  Withheld in Plan mode for the same reason the card's
                  Undo is: putting a section back is a write. And withheld
                  from a section the skeleton wrote in full, which has no
                  earlier version — it reads "Done", because it is.
                */}
                {offersSectionUndo(task) && report.undoable === true && canUndo ? (
                  <ChromeButton
                    variant="quiet"
                    size="sm"
                    className="pg-chat__task-undo"
                    aria-label={`Undo ${task.title}`}
                    disabled={
                      reverted.has(task.position) ||
                      (refusal !== undefined && !revertMayRetry(refusal))
                    }
                    onClick={() => {
                      onUndoTask(task.position, report.progress.tasks.length, task.title, 0);
                    }}
                  >
                    <IconUndo />
                    Undo
                  </ChromeButton>
                ) : (
                  <span className="pg-chat__task-state">{TASK_STATUS_LABEL[task.status]}</span>
                )}
              </span>
              {/* A section that would not be written twice says
                  why, in the door's own words. */}
              {task.status === 'skipped' && task.reason !== undefined ? (
                <span className="pg-chat__task-reason" dir="auto">
                  {task.reason}
                </span>
              ) : null}
              {/* A section that would not be PUT BACK says why too:
                  nothing was written, and pressing again must not
                  look like it might do something different. */}
              {refusal === undefined ? null : (
                <span className="pg-chat__task-reason" dir="auto">
                  {revertRefusedText(refusal, seam.locale)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {(report.notices ?? []).map((notice) => (
        <p key={notice} className="pg-chat__tasks-note" role="note">
          {buildNoticeText(notice, seam.locale)}
        </p>
      ))}
      {report.unfilledRemoval === undefined ? null : (
        <p className="pg-chat__tasks-note" role="status">
          {unfilledRemovalText(report.unfilledRemoval, seam.locale)}
        </p>
      )}
      {/* Refused whole, so the page is unchanged and the offer below still stands. */}
      {report.unfilledRemovalRefused === true && report.unfilledRemoval === undefined ? (
        <p className="pg-chat__tasks-note" role="status">
          {unfilledRemovalRefusedText(seam.locale)}
        </p>
      ) : null}
      {/*
        The empty placeholders a stopped (or partly skipped) build leaves are
        the page's shape with nothing in it. The build never removes them itself
        — a stopped page keeps its shape until the person says so — and this is
        where they say so: one transaction, one Undo back.
      */}
      {offersRemoval ? (
        <ChromeButton
          variant="quiet"
          size="sm"
          disabled={busy}
          onClick={() => {
            seam.onRemoveUnfilled?.(turnId);
          }}
        >
          <IconUndo />
          {removeUnfilledLabel(emptyLeft, seam.locale)}
        </ChromeButton>
      ) : null}
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
