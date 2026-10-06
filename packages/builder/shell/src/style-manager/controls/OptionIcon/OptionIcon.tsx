import { optionGlyph } from './option-glyphs';

import './OptionIcon.css';

export interface OptionIconProps {
  /** The catalogue property id (`flexDirection`), or `bucket` for the header. */
  readonly property: string;
  /** The option value (`row-reverse`). */
  readonly value: string;
}

/**
 * The glyph of one segmented-control option (style-manager panel design).
 *
 * Decorative only: the option button around it carries the accessible name
 * and the tooltip. A glyph along the inline axis is stamped `data-mirror`, and
 * the stylesheet flips it inside a right-to-left group, so "row" points the
 * way an Arabic row runs. Renders nothing when the option has no glyph.
 */
export function OptionIcon({ property, value }: OptionIconProps) {
  const glyph = optionGlyph(property, value);
  if (glyph === undefined) return null;
  if (glyph.text !== undefined) {
    return (
      <span className="bldr-option-icon bldr-option-icon--text" aria-hidden="true">
        {glyph.text}
      </span>
    );
  }
  return (
    <svg
      className="bldr-option-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-mirror={glyph.mirror === true ? '' : undefined}
    >
      {(glyph.paths ?? []).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
