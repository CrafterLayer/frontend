import { useId, useState } from 'react';

import { ChoiceGroup } from '../ChoiceGroup';
import { MEDIA_PARAM_FIELDS_LABELS_EN, type MediaParamFieldsLabels } from './MediaParamFields.labels';

import './MediaParamFields.css';

/** One behaviour param: a closed choice, or a free-text value (an email address). */
export interface MediaParamRow {
  /** The attribute it writes (`data-ck-indicator`). */
  readonly key: string;
  readonly label: string;
  readonly value: string | undefined;
  /** The closed values in order; absent ⇒ a text input. */
  readonly choices?: readonly string[] | undefined;
  /** The keyboard a text row asks for. */
  readonly input?: 'email' | 'text' | undefined;
}

export interface MediaParamFieldsProps {
  readonly rows: readonly MediaParamRow[];
  /**
   * One row changed: the caller writes it as ONE labelled transaction
   * (`undefined` removes the param, so the runtime default applies).
   */
  readonly onCommit: (key: string, value: string | undefined) => void;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: MediaParamFieldsLabels | undefined;
}

function TextRow({
  row,
  onCommit,
  disabled,
  hint,
}: {
  readonly row: MediaParamRow;
  readonly onCommit: (key: string, value: string | undefined) => void;
  readonly disabled: boolean;
  readonly hint: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(row.value ?? '');
  const [seen, setSeen] = useState(row.value);
  // The document changed under the field (Undo, the agent): show the new value.
  if (seen !== row.value) {
    setSeen(row.value);
    setDraft(row.value ?? '');
  }
  const commit = () => {
    const next = draft.trim();
    if (next === (row.value ?? '')) return;
    onCommit(row.key, next === '' ? undefined : next);
  };
  return (
    <div className="bldr-media-params__row">
      <label className="bldr-media-params__label" htmlFor={id}>
        {row.label}
      </label>
      <input
        id={id}
        className="bldr-media-params__input"
        type={row.input === 'email' ? 'email' : 'text'}
        inputMode={row.input === 'email' ? 'email' : undefined}
        dir={row.input === 'email' ? 'ltr' : 'auto'}
        value={draft}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            setDraft(row.value ?? '');
          }
        }}
      />
      <span id={`${id}-hint`} className="bldr-media-params__hint">
        {hint}
      </span>
    </div>
  );
}

/**
 * Typed rows for the media behaviours' params (media-motion DESIGN §B.3, §E):
 * a carousel's indicator, autoplay and speed, a mailto form's address, a
 * toggle option's side. A closed list is a radio group (one tab stop, arrows
 * mirrored for RTL) whose first choice, Default, removes the param; a text
 * row commits on Enter or when focus leaves. Every change is one write.
 */
export function MediaParamFields({
  rows,
  onCommit,
  dir = 'ltr',
  disabled = false,
  labels = MEDIA_PARAM_FIELDS_LABELS_EN,
}: MediaParamFieldsProps) {
  if (rows.length === 0) return null;
  return (
    <div className="bldr-media-params" role="group" aria-label={labels.group} dir={dir}>
      {rows.map((row) =>
        row.choices === undefined ? (
          <TextRow key={row.key} row={row} onCommit={onCommit} disabled={disabled} hint={labels.commitHint} />
        ) : (
          <div key={row.key} className="bldr-media-params__row">
            <span className="bldr-media-params__label" aria-hidden="true">
              {row.label}
            </span>
            <ChoiceGroup
              label={row.label}
              dir={dir}
              disabled={disabled}
              value={row.value ?? ''}
              options={[
                { value: '', label: labels.byDefault },
                ...row.choices.map((value) => ({ value, label: labels.values[value] ?? value })),
              ]}
              onChange={(value) => {
                onCommit(row.key, value === '' ? undefined : value);
              }}
            />
          </div>
        ),
      )}
    </div>
  );
}
