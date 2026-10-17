import { ChoiceGroup, type ChoiceOption } from '../ChoiceGroup';

import './SegmentedChoice.css';

export interface SegmentedChoiceProps {
  /** The group's accessible name ("Justify"). */
  readonly label: string;
  /**
   * Every option. Those with an `icon` become the segmented radios; the
   * rest (rare values such as `inline-grid`) sit in the overflow menu.
   */
  readonly options: readonly ChoiceOption[];
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  /** The layout direction of the segments (arrow keys and mirrored glyphs follow it). */
  readonly dir: 'ltr' | 'rtl';
  /** The overflow menu's accessible name: "More Display options". */
  readonly moreLabel: string;
  readonly disabled?: boolean | undefined;
  readonly mixed?: boolean | undefined;
  readonly mixedLabel?: string | undefined;
}

/**
 * An icon segmented control with an overflow menu (style-manager panel
 * design, after Webstudio and Framer): the everyday values are one-click
 * glyphs, every other value stays one menu away. Nothing the catalogue offers
 * is dropped — a value picked from the menu is shown there, and the segments
 * check nothing.
 */
export function SegmentedChoice({
  label,
  options,
  value,
  onChange,
  dir,
  moreLabel,
  disabled = false,
  mixed = false,
  mixedLabel = 'Mixed',
}: SegmentedChoiceProps) {
  const primary = options.filter((option) => option.icon !== undefined);
  const overflow = options.filter((option) => option.icon === undefined);
  const inOverflow = !mixed && overflow.some((option) => option.value === value);

  return (
    <div className="bldr-segmented-choice" data-overflow-active={inOverflow ? '' : undefined}>
      {primary.length === 0 ? null : (
        <ChoiceGroup
          label={label}
          options={primary}
          value={inOverflow ? undefined : value}
          onChange={onChange}
          dir={dir}
          disabled={disabled}
          mixed={mixed}
          mixedLabel={mixedLabel}
        />
      )}
      {overflow.length === 0 ? null : (
        <span className="bldr-segmented-choice__more">
          <select
            className="bldr-segmented-choice__select"
            aria-label={moreLabel}
            value={inOverflow ? value : ''}
            disabled={disabled}
            onChange={(event) => {
              const picked = event.target.value;
              if (picked !== '' && picked !== value) onChange(picked);
            }}
          >
            <option value="" disabled>
              …
            </option>
            {overflow.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="bldr-segmented-choice__chevron"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4.5 6.5 8 10l3.5-3.5" />
          </svg>
        </span>
      )}
    </div>
  );
}
