import { useId, useState, type KeyboardEvent } from 'react';

import type { FieldControlProps } from '../controls/field-control-props';
import { useFieldLabels } from '../field-services-context';
import './KeyValueField.css';

export type KeyValueFieldProps = FieldControlProps;

type Entry = readonly [key: string, value: string | null];

function entriesOf(value: unknown): readonly Entry[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    typeof item === 'string'
      ? item
      : typeof item === 'number' || typeof item === 'boolean'
        ? String(item)
        : null,
  ]);
}

function toRecord(entries: readonly Entry[]): Record<string, string | null> {
  return Object.fromEntries(entries);
}

interface PendingEntry {
  readonly key: string;
  readonly value: string;
}

type Drafts = Readonly<Record<string, string>>;

/**
 * A record property (`z.record(name, string)`) as name/value rows: rename,
 * edit, remove, add. The first user is a symbol instance's per-element
 * attribute overrides, which used to show as raw JSON.
 *
 * Each input drafts locally and commits ONCE on blur or Enter — the whole
 * record through the row's door, so one change is one Undo. A name already in
 * use is refused with a sentence. A `null` value (the override law for
 * "remove this attribute") stays null until the person types one.
 */
export function KeyValueField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  labelledBy,
}: KeyValueFieldProps) {
  const uid = useId();
  const labels = useFieldLabels();
  const entries = entriesOf(value);
  const [keyDrafts, setKeyDrafts] = useState<{ source: unknown; drafts: Drafts }>({
    source: value,
    drafts: {},
  });
  const [valueDrafts, setValueDrafts] = useState<{ source: unknown; drafts: Drafts }>({
    source: value,
    drafts: {},
  });
  const [pending, setPending] = useState<PendingEntry | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const liveKeys = Object.is(keyDrafts.source, value) ? keyDrafts.drafts : {};
  const liveValues = Object.is(valueDrafts.source, value) ? valueDrafts.drafts : {};
  const errorId = `${uid}-error`;

  const write = (next: readonly Entry[]) => {
    setProblem(null);
    onChange(toRecord(next));
  };

  const renameAt = (index: number, nextKey: string) => {
    const [key, item] = entries[index] ?? ['', null];
    const trimmed = nextKey.trim();
    setKeyDrafts({ source: value, drafts: { ...liveKeys, [key]: trimmed } });
    if (trimmed === key) return;
    if (trimmed === '') {
      setKeyDrafts({ source: value, drafts: {} });
      return;
    }
    if (entries.some(([other], at) => at !== index && other === trimmed)) {
      setProblem(labels.duplicateKey(trimmed));
      return;
    }
    write(entries.map((entry, at) => (at === index ? [trimmed, item] : entry)));
  };

  const setValueAt = (index: number, nextValue: string) => {
    const [key, item] = entries[index] ?? ['', null];
    if (nextValue === (item ?? '')) return;
    write(entries.map((entry, at) => (at === index ? [key, nextValue] : entry)));
  };

  const commitPending = (entry: PendingEntry) => {
    const key = entry.key.trim();
    if (key === '') return;
    if (entries.some(([other]) => other === key)) {
      setProblem(labels.duplicateKey(key));
      return;
    }
    setPending(null);
    write([...entries, [key, entry.value]]);
  };

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div
      className="bldr-kv-field"
      role={labelledBy === undefined ? undefined : 'group'}
      aria-labelledby={labelledBy}
      aria-describedby={
        [describedBy, problem === null ? undefined : errorId]
          .filter((id): id is string => id !== undefined)
          .join(' ') || undefined
      }
    >
      {entries.length === 0 && pending === null ? (
        <p className="bldr-kv-field__empty">{labels.empty}</p>
      ) : null}
      {entries.length > 0 || pending !== null ? (
        <ul className="bldr-kv-field__list">
          {entries.map(([key, item], index) => (
            <li className="bldr-kv-field__row" key={key}>
              <input
                id={index === 0 ? controlId : undefined}
                className="bldr-field__input bldr-kv-field__key"
                type="text"
                dir="ltr"
                spellCheck={false}
                aria-label={`${labels.keyLabel} ${String(index + 1)}`}
                value={liveKeys[key] ?? key}
                disabled={disabled}
                onChange={(event) => {
                  setKeyDrafts({
                    source: value,
                    drafts: { ...liveKeys, [key]: event.target.value },
                  });
                }}
                onBlur={(event) => {
                  renameAt(index, event.target.value);
                }}
                onKeyDown={onEnter}
              />
              <input
                className="bldr-field__input bldr-kv-field__value"
                type="text"
                dir="auto"
                aria-label={`${labels.valueLabel} ${key}`}
                value={liveValues[key] ?? item ?? ''}
                disabled={disabled}
                onChange={(event) => {
                  setValueDrafts({
                    source: value,
                    drafts: { ...liveValues, [key]: event.target.value },
                  });
                }}
                onBlur={(event) => {
                  setValueAt(index, event.target.value);
                }}
                onKeyDown={onEnter}
              />
              <button
                type="button"
                className="bldr-kv-field__remove"
                aria-label={labels.removeEntry(key)}
                disabled={disabled}
                onClick={() => {
                  write(entries.filter((_, at) => at !== index));
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          ))}
          {pending === null ? null : (
            <li
              className="bldr-kv-field__row"
              onBlur={(event) => {
                // The new entry is written once focus leaves the ROW — moving
                // from its name to its value must not commit a half-typed pair.
                const next = event.relatedTarget;
                if (next instanceof Node && event.currentTarget.contains(next)) return;
                commitPending(pending);
              }}
            >
              <input
                className="bldr-field__input bldr-kv-field__key"
                type="text"
                dir="ltr"
                spellCheck={false}
                aria-label={`${labels.keyLabel} ${String(entries.length + 1)}`}
                value={pending.key}
                disabled={disabled}
                // The person just asked for this row: put the caret in it.
                autoFocus
                onChange={(event) => {
                  setPending({ ...pending, key: event.target.value });
                }}
                onKeyDown={onEnter}
              />
              <input
                className="bldr-field__input bldr-kv-field__value"
                type="text"
                dir="auto"
                aria-label={`${labels.valueLabel} ${pending.key}`}
                value={pending.value}
                disabled={disabled}
                onChange={(event) => {
                  setPending({ ...pending, value: event.target.value });
                }}
                onKeyDown={onEnter}
              />
              <span className="bldr-kv-field__remove-spacer" aria-hidden="true" />
            </li>
          )}
        </ul>
      ) : null}
      <button
        type="button"
        className="bldr-kv-field__add"
        disabled={(disabled ?? false) || pending !== null}
        onClick={() => {
          setPending({ key: '', value: '' });
        }}
      >
        {labels.addEntry}
      </button>
      {problem === null ? null : (
        <p id={errorId} className="bldr-inspector__rejection" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
