import { useFieldServices } from '../../fields/field-services-context';
import { schemaName, schemaOption } from '../../i18n/schema-words';
import { alignmentIconOption, SEGMENT_LABELS, SEGMENT_PATHS } from './segment-icons';
import type { DocumentDirection, SegmentKind, SegmentOption } from './types';

export interface SegmentedControlProps {
  readonly kind: SegmentKind;
  readonly options: readonly SegmentOption[];
  readonly value: string | undefined;
  /** Start/end icons mirror under rtl so the mark matches the page. */
  readonly dir: DocumentDirection;
  readonly disabled: boolean;
  readonly onSelect: (option: SegmentOption) => void;
}

/** Icon segments for alignment and direction enums; exactly one is pressed. */
export function SegmentedControl({
  kind,
  options,
  value,
  dir,
  disabled,
  onSelect,
}: SegmentedControlProps) {
  const locale = useFieldServices().locale ?? 'en';
  return (
    <div className="bldr-inspector__alignment-control">
      <div className="bldr-inspector__segments">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="bldr-inspector__segment"
            aria-label={
              locale === 'ar'
                ? `${schemaOption(option, locale)} · ${schemaName(kind, locale)}`
                : `${SEGMENT_LABELS[option]} ${kind}`
            }
            aria-pressed={value === option}
            disabled={disabled}
            onClick={() => {
              if (value !== option) {
                onSelect(option);
              }
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
              {SEGMENT_PATHS[alignmentIconOption(option, dir)].map((path) => (
                <path key={path} d={path} />
              ))}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
