import { useState } from 'react';

import type { BlockParts } from '@craftkit/builder-schema';

import type { FieldControlProps } from '../controls/field-control-props';
import type { FieldCommitResult } from '../field-commit';
import { useFieldLabels, useFieldServices } from '../field-services-context';
import { partStyleKeyLabel } from '../part-styles-reset';
import './PartStylesField.css';

export interface PartStylesFieldProps extends FieldControlProps {
  /** The block's declared parts — where each key's localized label comes from. */
  readonly parts?: BlockParts | undefined;
  /**
   * Reset one part's own style as ONE labelled transaction (the host plans
   * it with `planPartStyleReset`, which uses `planPartDir` for a
   * direction-only entry). Absent ⇒ no Reset buttons.
   */
  readonly onReset?: ((key: string, label: string) => FieldCommitResult) | undefined;
}

interface Entry {
  readonly key: string;
  readonly classes: readonly string[];
  readonly dir: string | undefined;
}

function entriesOf(value: unknown): readonly Entry[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    const record = raw as Record<string, unknown>;
    const className = typeof record['className'] === 'string' ? record['className'] : '';
    const dir = typeof record['dir'] === 'string' ? record['dir'] : undefined;
    const classes = className.split(/\s+/u).filter((token) => token !== '');
    return classes.length === 0 && dir === undefined ? [] : [{ key, classes, dir }];
  });
}

/**
 * The block's `partStyles` record, as a person reads it: which PARTS have a
 * style of their own, named by their localized labels ("Heading",
 * "العنوان", "Item title 3"), what that style is, and a Reset per part.
 *
 * Styles are WRITTEN on the canvas (the quick bar) and in the part panel's
 * Design tab; this Advanced row is where a person sees all of them at once
 * and takes one back. Each Reset is one transaction, so one Undo. It replaces
 * the raw JSON this record would otherwise show.
 */
export function PartStylesField({
  value,
  disabled,
  controlId,
  describedBy,
  labelledBy,
  parts,
  onReset,
}: PartStylesFieldProps) {
  const labels = useFieldLabels();
  const { locale } = useFieldServices();
  const entries = entriesOf(value);
  const [problem, setProblem] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <p id={controlId} className="bldr-part-styles-field__empty" aria-describedby={describedBy}>
        {labels.partStylesNone}
      </p>
    );
  }

  return (
    <div
      id={controlId}
      className="bldr-part-styles-field"
      role={labelledBy === undefined ? undefined : 'group'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <ul className="bldr-part-styles-field__list">
        {entries.map((entry) => {
          const label = partStyleKeyLabel(entry.key, parts, locale ?? 'en');
          return (
            <li
              key={entry.key}
              className="bldr-part-styles-field__row"
              data-part-style-key={entry.key}
            >
              <div className="bldr-part-styles-field__head">
                <span className="bldr-part-styles-field__name" dir="auto">
                  {label}
                </span>
                {onReset === undefined ? null : (
                  <button
                    type="button"
                    className="bldr-part-styles-field__reset"
                    aria-label={labels.resetPart(label)}
                    disabled={disabled}
                    onClick={() => {
                      const result = onReset(entry.key, label);
                      setProblem(result.ok ? null : result.message);
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M3 8a5 5 0 1 0 1.5-3.5M3 3v2.5h2.5" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="bldr-part-styles-field__summary">
                {entry.classes.length > 0 ? (
                  <span className="bldr-part-styles-field__classes" dir="ltr">
                    {entry.classes.map((token) => (
                      <code key={token} className="bldr-part-styles-field__class">
                        {token}
                      </code>
                    ))}
                  </span>
                ) : null}
                {entry.dir === undefined ? null : (
                  <span className="bldr-part-styles-field__dir">
                    {labels.partDirection(entry.dir)}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      {problem === null ? null : (
        <p className="bldr-inspector__rejection" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
