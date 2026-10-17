import { ChromeButton } from '@craftkit/builder';
import { useId, useState } from 'react';

import { t, tParts, type Key } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type { EnhancementView, FailureClass, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { SPARKLE } from '../EnhanceButton';

import './EnhanceNote.css';

export interface EnhanceNoteProps {
  readonly locale: Locale;
  /** The Improve state. Only `enhanced` and `failed` draw anything. */
  readonly enhancement: EnhancementView;
  /** Restore my text (`AgentController.restoreDraft`); offered while `canRestore`. */
  readonly onRestore: () => void;
  /** Appended to `ck-agent-enhance-note`. */
  readonly className?: string | undefined;
}

/**
 * A failed Improve says what it knows. Only three causes mean anything to a person here;
 * the rest (a result that failed validation, a refusal, the unknown) all end the same way,
 * with the one fact that matters: the text is as it was.
 */
const FAILED_CAPTION = {
  timeout: 'enhance.failed.timeout',
  unreachable: 'enhance.failed.unreachable',
  busy: 'enhance.failed.busy',
  invalid: 'enhance.failed.other',
  outOfScope: 'enhance.failed.other',
  pageChanged: 'enhance.failed.other',
  declined: 'enhance.failed.other',
  unknown: 'enhance.failed.other',
} as const satisfies Readonly<Record<FailureClass, Key>>;

/**
 * What ✨ Improve did (the owner's request, 2026-09-28), docked on top of the text it
 * rewrote, in QueueHeader's language: a mark and a label on the first line with its one
 * action at the inline end, the detail under it.
 *
 * Improved: "Request improved", then "Understood: …" (the model's one-line restatement,
 * so the person can check it read them right), what changed as a short list behind a
 * disclosure, and Restore my text, which puts the person's own words back. Failed: an
 * honest line that says the text is unchanged, with the cause when it is known.
 *
 * Not a live region: LiveStatus speaks `enhance.ready`. The note is where the eye and a
 * screen reader's reading find the detail afterwards.
 */
export function EnhanceNote({ locale, enhancement, onRestore, className }: EnhanceNoteProps) {
  const labelId = useId();
  const captionId = useId();
  const changesId = useId();
  const [open, setOpen] = useState(false);

  if (enhancement.status !== 'enhanced' && enhancement.status !== 'failed') return null;

  const root =
    className === undefined ? 'ck-agent-enhance-note' : `ck-agent-enhance-note ${className}`;

  if (enhancement.status === 'failed') {
    return (
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={captionId}
        className={root}
        data-status="failed"
      >
        <p id={labelId} className="ck-agent-enhance-note__label">
          {SPARKLE}
          <span>{t(locale, 'enhance.failed')}</span>
        </p>
        <p id={captionId} className="ck-agent-enhance-note__caption">
          {t(locale, FAILED_CAPTION[enhancement.reason])}
        </p>
      </div>
    );
  }

  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const { understood, changes, canRestore } = enhancement;

  return (
    <div role="group" aria-labelledby={labelId} className={root} data-status="enhanced">
      <p id={labelId} className="ck-agent-enhance-note__label">
        {SPARKLE}
        <span>{t(locale, 'enhance.done')}</span>
      </p>
      {canRestore ? (
        <ChromeButton className="ck-agent-enhance-note__restore" size="lg" onClick={onRestore}>
          {t(locale, 'enhance.restore')}
        </ChromeButton>
      ) : null}
      {understood.trim() === '' ? null : (
        <p className="ck-agent-enhance-note__caption">
          {tParts(locale, 'enhance.understood', { prompt: understood }).map((part, index) =>
            part.kind === 'value' ? (
              <bdi key={index} dir={resolveDir(part.text, uiDir)}>
                {part.text}
              </bdi>
            ) : (
              part.text
            ),
          )}
        </p>
      )}
      {changes.length === 0 ? null : (
        <>
          <ChromeButton
            className="ck-agent-enhance-note__toggle"
            size="lg"
            aria-expanded={open}
            aria-controls={changesId}
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            <AgentIcon name="disclosure" className="ck-agent-enhance-note__chevron" />
            {open
              ? t(locale, 'enhance.changes.hide')
              : t(locale, 'enhance.changes.show', { n: changes.length })}
          </ChromeButton>
          <div
            id={changesId}
            className="ck-agent-enhance-note__changes"
            data-open={open ? '' : undefined}
            inert={!open}
          >
            {/* `role="list"`: WebKit drops list semantics from a list without markers. */}
            <ul role="list" className="ck-agent-enhance-note__list">
              {changes.map((change, index) => (
                <li key={`${String(index)}:${change}`}>{change}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
