import { useRef } from 'react';
import type { ReactNode } from 'react';

import { focusRadioAt, rovingIndex } from '../../roving';

import './ChoiceGroup.css';

export interface ChoiceOption {
  readonly value: string;
  /** The accessible name, and the visible text when there is no icon. */
  readonly label: string;
  /** An optional glyph; the label then becomes the accessible name only. */
  readonly icon?: ReactNode;
}

export interface ChoiceGroupProps {
  /** The group's accessible name ("Display", "Bucket"). */
  readonly label: string;
  readonly options: readonly ChoiceOption[];
  /** The checked value; `undefined` checks nothing (unset or Mixed). */
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  /** The layout direction of the group, which decides which arrow moves forward. */
  readonly dir: 'ltr' | 'rtl';
  readonly disabled?: boolean | undefined;
  /** Several targets disagree: nothing is checked and the group says so. */
  readonly mixed?: boolean | undefined;
  readonly mixedLabel?: string | undefined;
}

/**
 * A single-choice row: a WAI-ARIA radio group with one tab stop. Arrows move
 * the choice (and commit it, as a radio group does), mirrored for RTL; a
 * click on the checked option is not a second write.
 */
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  dir,
  disabled = false,
  mixed = false,
  mixedLabel = 'Mixed',
}: ChoiceGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const checkedIndex = mixed ? -1 : options.findIndex((option) => option.value === value);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;

  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined || disabled) return;
    if (option.value !== value || mixed) onChange(option.value);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={mixed ? `${label} (${mixedLabel})` : label}
      aria-disabled={disabled || undefined}
      className="bldr-choice-group"
      dir={dir}
      data-mixed={mixed ? '' : undefined}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={index === checkedIndex}
          aria-label={option.icon === undefined ? undefined : option.label}
          title={option.icon === undefined ? undefined : option.label}
          tabIndex={index === tabStop ? 0 : -1}
          disabled={disabled}
          className="bldr-choice-group__option"
          onClick={() => {
            choose(index);
          }}
          onKeyDown={(event) => {
            const next = rovingIndex(event.key, index, options.length, dir);
            if (next === undefined) return;
            event.preventDefault();
            choose(next);
            focusRadioAt(groupRef.current, next);
          }}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}
