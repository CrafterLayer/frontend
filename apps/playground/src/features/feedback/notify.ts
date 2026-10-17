import { createElement } from 'react';
import { toast } from 'sonner';

import type { FeedbackLabels } from './feedback.labels';

/*
  The editor's action feedback (Studio Indigo, 2026-10-12). UI UX Pro Max's builder profile
  asks every consequential action to answer: a quiet "working" while it runs, the outcome
  when it lands, and a way forward when it fails. One toast carries all three — it starts
  as "Publishing the site…", becomes the result in place, and a failure offers Try again.

  Only the outcome of a person's own action is toasted. Background facts (saving, the
  assistant's progress) keep their own quiet places in the status bar and the panel.
*/

const FAILURE_DURATION_MS = 10_000;

/** A failure the toast reports, carrying nothing but the fact that it failed. */
class PublishFailed extends Error {}

/**
 * Run a publish and narrate it in one toast. `publish` resolves with the files it made, or
 * `undefined` when it failed; `retry` is what Try again runs.
 */
export function notifyPublish(
  publish: () => Promise<readonly unknown[] | undefined>,
  labels: FeedbackLabels,
  retry: () => void,
): Promise<void> {
  const run = publish().then((files) => {
    if (files === undefined) throw new PublishFailed();
    return files.length;
  });
  toast.promise(run, {
    loading: labels.publishing,
    success: (count) => ({ message: labels.published(count), description: labels.publishedDetail }),
    error: () => ({
      // A failure waits longer: it carries a way forward the person may need a moment for.
      duration: FAILURE_DURATION_MS,
      message: labels.publishFailed,
      description: labels.publishFailedDetail,
      action: { label: labels.retry, onClick: retry },
    }),
  });
  return run.then(
    () => undefined,
    () => undefined,
  );
}

/** One history step, said once: which way it went, what it was, and the way back. */
export interface HistoryStepNotice {
  readonly direction: 'undo' | 'redo';
  /** The step's name in the editor's language ("Duplicate · Hero"). */
  readonly step: string;
  /** Takes the step the other way (redo after an undo, undo after a redo). */
  readonly reverse: () => void;
}

/** Short: a confirmation, not news. A later step replaces it rather than stacking. */
const HISTORY_STEP_DURATION_MS = 3_000;
const HISTORY_STEP_TOAST_ID = 'pg-history-step';

/**
 * Undo and redo, answered (UX pass, 2026-10-13). Undo used to change the page and say
 * nothing anywhere a sighted person looks, so after a busy minute the question "what did
 * that just take back?" had no answer. One toast names the step and offers the way back;
 * repeated presses update the same toast instead of stacking a column of them.
 */
export function notifyHistoryStep(notice: HistoryStepNotice, labels: FeedbackLabels): void {
  const undo = notice.direction === 'undo';
  const verb = undo ? labels.redo : labels.undo;
  toast.info(undo ? labels.undone(notice.step) : labels.redone(notice.step), {
    id: HISTORY_STEP_TOAST_ID,
    duration: HISTORY_STEP_DURATION_MS,
    action: {
      /* The word is the top bar's ("Redo"); the spoken name says WHICH step, so the toast's
         button is never a second, identical "Redo" beside the toolbar's. */
      label: createElement('span', { 'aria-label': labels.reverseStep(verb, notice.step) }, verb),
      onClick: notice.reverse,
    },
  });
}
