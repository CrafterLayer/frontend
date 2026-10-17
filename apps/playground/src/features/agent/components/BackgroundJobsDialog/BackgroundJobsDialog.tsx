import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { isActive } from '../../../jobs';
import { jobsLabels } from '../../copy/jobs-labels';
import type { JobsDialogView } from '../../hooks/use-jobs-ui';
import { retriedKey, type BackgroundJobsView } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { BackgroundJobRow } from '../BackgroundJobRow';
import { BatchJobForm } from '../BatchJobForm';
import { IconButton, portalScopeOf, type PortalScope } from '../IconButton';

import '../knowledge-form.css';
import './BackgroundJobsDialog.css';

export interface BackgroundJobsDialogProps {
  readonly locale: Locale;
  readonly jobs: BackgroundJobsView;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The list of jobs, or the form that starts one. */
  readonly view: JobsDialogView;
  readonly onViewChange: (view: JobsDialogView) => void;
  /** "Run on several pages": the host opens the form, on the composer's draft when it has one. */
  readonly onStart: () => void;
  /** The form's first words, and whether they came from the composer's draft. */
  readonly request?: string | undefined;
  readonly fromDraft?: boolean | undefined;
  /** Changes on every opening of the form, so it starts afresh (`JobsUi.opening`). */
  readonly opening?: number | undefined;
  /** Whether the panel is shown: the list asks about batches in progress only then. */
  readonly visible?: boolean | undefined;
  /** Where focus returns when it closes: the header's Background jobs button. */
  readonly returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  /** The dialog's id, for the button's `aria-controls`. Generated when absent. */
  readonly id?: string | undefined;
}

const NO_SCOPE: PortalScope = { container: undefined, lang: undefined, dir: undefined };

/** Where focus lands in each view: the list's start button, the form's request. */
const AUTOFOCUS = '[data-autofocus]';

/**
 * "Background jobs" (2026-10-12): the agent's big requests run as background batches through
 * the assistant server, at half the price of a live run. A Radix Dialog centred over the
 * editor like "Skills & memory", in the panel's theme, language and direction.
 *
 * The list: what a job is for, "Run on several pages" (half price), then each job newest
 * first (BackgroundJobRow). While it is open, in front of the person and a batch is still
 * answering, the jobs in progress are asked about at once and every 30 s; never while the
 * panel or the tab is hidden. "Retry live" on a page closes the dialog so the run is seen.
 *
 * The form (BatchJobForm) starts a job; a send that succeeds goes back to the list, where a
 * status line says the job is at its top. When the server cannot batch, the form shows its
 * own sentence and Submit waits. Esc closes; inside a Remove confirm it only closes that.
 */
export function BackgroundJobsDialog({
  locale,
  jobs,
  open,
  onOpenChange,
  view,
  onViewChange,
  onStart,
  request = '',
  fromDraft = false,
  opening = 0,
  visible = true,
  returnFocusRef,
  id,
}: BackgroundJobsDialogProps) {
  const generated = useId();
  const rootId = id ?? generated;
  const labels = jobsLabels(locale);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [sent, setSent] = useState(false);
  const content = useRef<HTMLDivElement | null>(null);
  const scope = anchor === null ? NO_SCOPE : portalScopeOf(anchor);
  const records = jobs.jobs;
  const anyActive = records?.some(isActive) ?? false;

  // Polling is the list's: only while it is open, on the list, and the panel is shown.
  const { watch } = jobs;
  const watching = open && visible && view === 'list';
  useEffect(() => {
    watch(watching);
  }, [watch, watching]);
  useEffect(
    () => () => {
      watch(false);
    },
    [watch],
  );

  const title = view === 'new' ? labels.formTitle : labels.title;

  // Moving between the list and the form, focus follows to the view's first control.
  useLayoutEffect(() => {
    content.current?.querySelector<HTMLElement>(AUTOFOCUS)?.focus();
  }, [view]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setSent(false);
        onOpenChange(next);
      }}
    >
      <span ref={setAnchor} hidden />
      <Dialog.Portal container={scope.container ?? null}>
        <Dialog.Overlay className="ck-agent-jobs__scrim" />
        <Dialog.Content
          ref={content}
          id={rootId}
          className="ck-agent-jobs"
          data-view={view}
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            const first = content.current?.querySelector<HTMLElement>(AUTOFOCUS);
            if (first === null || first === undefined) return;
            event.preventDefault();
            first.focus();
          }}
          onEscapeKeyDown={(event) => {
            // A Remove confirm spends Esc itself: it closes the confirm, not the window.
            const target = event.target;
            if (target instanceof Element && target.closest('.ck-agent-confirm') !== null) {
              event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            const trigger = returnFocusRef?.current;
            if (!trigger?.isConnected) return;
            event.preventDefault();
            trigger.focus();
          }}
        >
          <div className="ck-agent-jobs__bar">
            {view === 'new' ? (
              <IconButton
                icon="back"
                label={labels.form.back}
                tooltipAlign="start"
                onClick={() => {
                  onViewChange('list');
                }}
              />
            ) : (
              <AgentIcon name="layers" className="ck-agent-jobs__glyph" />
            )}
            <Dialog.Title className="ck-agent-jobs__title">{title}</Dialog.Title>
            {view === 'new' ? <span className="ck-agent-jobs__tag">{labels.halfPrice}</span> : null}
            <IconButton
              icon="close"
              label={labels.close}
              tooltipAlign="end"
              onClick={() => {
                onOpenChange(false);
              }}
            />
          </div>

          <div className="ck-agent-jobs__body">
            {view === 'new' ? (
              <BatchJobForm
                key={opening}
                locale={locale}
                pages={jobs.pages}
                initialRequest={request}
                fromDraft={fromDraft}
                connected={jobs.connected}
                unavailable={jobs.unavailable}
                submitting={jobs.submitting}
                error={jobs.submitError}
                onSubmit={(words, pageIds) => {
                  void jobs.submit(words, pageIds).then((ok) => {
                    if (!ok) return;
                    setSent(true);
                    onViewChange('list');
                  });
                }}
                onCancel={() => {
                  onViewChange('list');
                }}
              />
            ) : (
              <>
                <p className="ck-agent-kn-intro">{labels.intro}</p>
                <div className="ck-agent-jobs__toolbar">
                  <button
                    type="button"
                    className="ck-agent-kn-button"
                    data-variant="primary"
                    data-autofocus=""
                    onClick={() => {
                      setSent(false);
                      onStart();
                    }}
                  >
                    <AgentIcon name="plus" />
                    {labels.start}
                  </button>
                  <span className="ck-agent-jobs__tag">{labels.halfPrice}</span>
                  {anyActive && jobs.connected ? (
                    <button
                      type="button"
                      className="ck-agent-kn-button ck-agent-jobs__refresh"
                      data-variant="quiet"
                      onClick={() => {
                        jobs.refresh();
                      }}
                    >
                      <AgentIcon name="retry" />
                      {labels.refreshAll}
                    </button>
                  ) : null}
                </div>
                {jobs.connected ? null : (
                  <p className="ck-agent-jobs__offline">{labels.noServer}</p>
                )}
                <p className="ck-agent-kn-status" role="status">
                  {sent ? labels.form.submitted : ''}
                </p>
                {records === undefined ? (
                  <p className="ck-agent-kn-empty">{labels.loading}</p>
                ) : records.length === 0 ? (
                  <div className="ck-agent-jobs__empty">
                    <p className="ck-agent-kn-empty">{labels.empty}</p>
                    <p className="ck-agent-kn-intro">{labels.emptyHint}</p>
                  </div>
                ) : (
                  <ul className="ck-agent-jobs__list" role="list">
                    {records.map((job) => (
                      <li key={job.id}>
                        <BackgroundJobRow
                          locale={locale}
                          job={job}
                          now={jobs.now}
                          pages={jobs.pages}
                          connected={jobs.connected}
                          busy={jobs.pending.includes(job.id)}
                          notice={jobs.notices[job.id]}
                          retried={job.pageIds.filter((pageId) =>
                            jobs.retried.includes(retriedKey(job.id, pageId)),
                          )}
                          onRefresh={() => {
                            jobs.refresh(job.id);
                          }}
                          onCancel={() => {
                            jobs.cancel(job.id);
                          }}
                          onApply={() => {
                            jobs.apply(job.id);
                          }}
                          onRemove={() => {
                            jobs.remove(job.id);
                          }}
                          onRetryLive={(pageId) => {
                            jobs.retryLive(job.id, pageId);
                            onOpenChange(false);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
