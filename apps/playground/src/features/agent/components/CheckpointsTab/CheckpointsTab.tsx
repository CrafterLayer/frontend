import { useId, useState } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import type { CheckpointsView } from '../../model/knowledge';
import type { Locale } from '../../model/view-types';

import '../knowledge-form.css';
import './CheckpointsTab.css';

export interface CheckpointsTabProps {
  readonly checkpoints: CheckpointsView;
  readonly labels: KnowledgeLabels;
  readonly locale: Locale;
}

/** "12 Oct, 14:05" in the panel's language, digits kept Latin (the editor's rule). */
function when(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}

/**
 * The Checkpoints tab (2026-10-12): the page as it was before each request, newest first, and
 * the points the person saved — each with Restore. A restore is one forward change on the
 * page, so Undo takes it back; its outcome is said once in the status line. A field and Save
 * keep the page as it is now, under the person's name for it.
 */
export function CheckpointsTab({ checkpoints, labels, locale }: CheckpointsTabProps) {
  const id = useId();
  const words = labels.checkpoints;
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const { items } = checkpoints;

  return (
    <div className="ck-agent-checkpoints">
      <p className="ck-agent-kn-intro">{words.intro}</p>
      <form
        className="ck-agent-checkpoints__save"
        onSubmit={(event) => {
          event.preventDefault();
          const label = name.trim() === '' ? words.defaultName : name.trim();
          setBusy(true);
          void checkpoints.save(label).then((saved) => {
            setBusy(false);
            setStatus(saved ? words.saved : words.saveFailed);
            if (saved) setName('');
          });
        }}
      >
        <label className="ck-agent-kn-field ck-agent-checkpoints__name" htmlFor={`${id}-name`}>
          <span className="bldr-visually-hidden">{words.nameField}</span>
          <input
            id={`${id}-name`}
            className="ck-agent-kn-input"
            dir="auto"
            value={name}
            maxLength={120}
            placeholder={words.namePlaceholder}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <button type="submit" className="ck-agent-kn-button" data-variant="primary" disabled={busy}>
          {words.save}
        </button>
      </form>
      <p className="ck-agent-kn-status" role="status">
        {status}
      </p>
      {items === undefined ? (
        <p className="ck-agent-kn-empty">{words.loading}</p>
      ) : items.length === 0 ? (
        <p className="ck-agent-kn-empty">{words.empty}</p>
      ) : (
        <ul className="ck-agent-kn-list" role="list">
          {items.map((point) => (
            <li key={point.id} className="ck-agent-checkpoints__point" data-kind={point.kind}>
              <span className="ck-agent-checkpoints__text">
                <span className="ck-agent-checkpoints__label" dir="auto">
                  {point.label}
                </span>
                <span className="ck-agent-checkpoints__meta">
                  <span>{words.kinds[point.kind]}</span>
                  <time dateTime={new Date(point.at).toISOString()}>{when(point.at, locale)}</time>
                </span>
              </span>
              <button
                type="button"
                className="ck-agent-kn-button"
                aria-label={words.restore(point.label)}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void checkpoints.restore(point.id).then((outcome) => {
                    setBusy(false);
                    setStatus(words.outcomes[outcome]);
                  });
                }}
              >
                {words.restoreShort}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
