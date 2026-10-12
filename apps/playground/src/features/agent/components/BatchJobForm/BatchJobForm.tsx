import { AI_BATCH_MAX_ITEMS } from '@craftkit/builder';
import { useId, useRef, useState } from 'react';

import { jobsLabels } from '../../copy/jobs-labels';
import type { BatchPageOption } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { PagePicker } from '../PagePicker';

import '../knowledge-form.css';
import './BatchJobForm.css';

export interface BatchJobFormProps {
  readonly locale: Locale;
  /** The site's pages, in site order. */
  readonly pages: readonly BatchPageOption[];
  /** The words the request starts with: `/batch`'s, or the composer's draft. */
  readonly initialRequest?: string | undefined;
  /** Those words came from the composer's draft: the field says so. */
  readonly fromDraft?: boolean | undefined;
  /** Whether the host has an assistant server; without one nothing can be sent. */
  readonly connected: boolean;
  /** The server's own sentence when it cannot batch (501, 409): Submit waits. */
  readonly unavailable?: string | undefined;
  readonly submitting?: boolean | undefined;
  /** Why the last submit failed, as the server or the runner said it. */
  readonly error?: string | undefined;
  readonly onSubmit: (request: string, pageIds: readonly string[]) => void;
  readonly onCancel: () => void;
}

type Scope = 'all' | 'some';

/**
 * "Run on several pages in the background" (2026-10-12): the form that starts a background
 * job. The request (prefilled from `/batch` or the composer's draft), the pages — every page
 * of the site, or a checklist that starts on the page open now — the price note (half price,
 * answers in minutes, one Undo per page), then Run in the background and Cancel.
 *
 * Submit is `aria-disabled` rather than `disabled` (the panel's rule): it stays focusable and
 * is described by why it waits — no assistant server, the server's own sentence when it
 * cannot batch, or a send in flight. A missing request or page is said under its field, and
 * focus goes to the first one.
 */
export function BatchJobForm({
  locale,
  pages,
  initialRequest = '',
  fromDraft = false,
  connected,
  unavailable,
  submitting = false,
  error,
  onSubmit,
  onCancel,
}: BatchJobFormProps) {
  const id = useId();
  const labels = jobsLabels(locale);
  const words = labels.form;
  const [request, setRequest] = useState(initialRequest);
  const [scope, setScope] = useState<Scope>('all');
  const [chosen, setChosen] = useState<readonly string[]>(() =>
    pages.filter((page) => page.current).map((page) => page.id),
  );
  const [checked, setChecked] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const someRef = useRef<HTMLInputElement>(null);

  const pageIds = scope === 'all' ? pages.map((page) => page.id) : chosen;
  const missingRequest = request.trim() === '';
  const missingPages = pageIds.length === 0;
  const tooMany = pageIds.length > AI_BATCH_MAX_ITEMS;
  const blockedBy = !connected ? labels.noServer : unavailable;
  const waiting = blockedBy !== undefined || submitting;
  const showRequest = checked && missingRequest;
  const showPages = checked && (missingPages || tooMany);

  const submit = (): void => {
    if (waiting) return;
    setChecked(true);
    if (missingRequest) {
      field.current?.focus();
      return;
    }
    if (missingPages || tooMany) {
      someRef.current?.focus();
      return;
    }
    onSubmit(request.trim(), pageIds);
  };

  return (
    <form
      className="ck-agent-batch-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="ck-agent-kn-field">
        <label htmlFor={`${id}-request`}>{words.request}</label>
        <textarea
          ref={field}
          id={`${id}-request`}
          className="ck-agent-kn-textarea ck-agent-batch-form__request"
          data-autofocus=""
          dir="auto"
          rows={3}
          value={request}
          placeholder={words.requestPlaceholder}
          aria-invalid={showRequest ? true : undefined}
          aria-describedby={showRequest ? `${id}-request-error` : undefined}
          onChange={(event) => {
            setRequest(event.currentTarget.value);
          }}
        />
        {fromDraft && request === initialRequest ? (
          <span className="ck-agent-kn-hint">{words.fromDraft}</span>
        ) : null}
        {showRequest ? (
          <p id={`${id}-request-error`} className="ck-agent-kn-refusal">
            {words.needsRequest}
          </p>
        ) : null}
      </div>

      <fieldset className="ck-agent-batch-form__scope">
        <legend className="ck-agent-batch-form__legend">{words.pages}</legend>
        <div className="ck-agent-batch-form__choices">
          <label className="ck-agent-batch-form__choice">
            <input
              type="radio"
              name={`${id}-scope`}
              checked={scope === 'all'}
              onChange={() => {
                setScope('all');
              }}
            />
            <span>{words.allPages(pages.length)}</span>
          </label>
          <label className="ck-agent-batch-form__choice">
            <input
              ref={someRef}
              type="radio"
              name={`${id}-scope`}
              checked={scope === 'some'}
              onChange={() => {
                setScope('some');
              }}
            />
            <span>{words.choosePages}</span>
          </label>
        </div>
        {scope === 'some' ? (
          <PagePicker
            locale={locale}
            pages={pages}
            selected={chosen}
            onChange={setChosen}
            label={words.choosePages}
            invalid={showPages}
            describedBy={showPages ? `${id}-pages-error` : undefined}
          />
        ) : null}
        {showPages ? (
          <p id={`${id}-pages-error`} className="ck-agent-kn-refusal">
            {tooMany ? words.tooMany(AI_BATCH_MAX_ITEMS) : words.needsPages}
          </p>
        ) : null}
      </fieldset>

      <p className="ck-agent-batch-form__price">
        <AgentIcon name="layers" className="ck-agent-batch-form__price-glyph" />
        <span>
          <strong className="ck-agent-batch-form__tag">{labels.halfPrice}</strong> {words.priceNote}
        </span>
      </p>

      {blockedBy === undefined ? null : (
        <div id={`${id}-blocked`} className="ck-agent-batch-form__blocked" role="status">
          {connected ? (
            <p className="ck-agent-batch-form__blocked-lead">{labels.unavailable}</p>
          ) : null}
          <p dir="auto">{blockedBy}</p>
        </div>
      )}
      {error === undefined ? null : (
        <p className="ck-agent-kn-refusal" role="alert" dir="auto">
          {error}
        </p>
      )}

      <div className="ck-agent-kn-actions ck-agent-batch-form__actions">
        <button
          type="submit"
          className="ck-agent-kn-button"
          data-variant="primary"
          aria-disabled={waiting ? true : undefined}
          aria-describedby={blockedBy === undefined ? undefined : `${id}-blocked`}
        >
          {submitting ? words.submitting : words.submit}
        </button>
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="quiet"
          onClick={onCancel}
        >
          {words.cancel}
        </button>
      </div>
    </form>
  );
}
