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
