import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

import { isColorToken, tokenCssName, type Theme, type TokenName } from '@craftkit/builder-schema';

import './TokenSwatchGrid.css';

export interface TokenSwatchGridProps {
  /** The values to show. Usually a site design system's `tokens`. */
  readonly tokens: Theme;
  /** Which tokens, in the order they should read. */
  readonly names: readonly TokenName[];
  /** The grid's accessible name — what this group of tokens is. */
  readonly label: string;
  readonly selected?: TokenName | undefined;
  readonly onSelect?: ((token: TokenName) => void) | undefined;
  /** Cells per row. The keyboard model needs it; the CSS follows it. */
  readonly columns?: number | undefined;
  /** What a person reads for each token, in the editor's language. Defaults to the name as words. */
  readonly nameOf?: ((token: TokenName) => string) | undefined;
}

const DEFAULT_COLUMNS = 4;

/** Camel to words, so "surfaceInverse" reads as a person would say it. */
function readable(name: TokenName): string {
  return name.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').toLowerCase();
}

/**
 * The tokens of a design system, as a grid a person can walk.
 *
 * ## Why a swatch is never a colour alone
 *
 * A grid of coloured squares is unusable to anyone who cannot distinguish them
 * — which includes roughly one man in twelve, every screen reader, and anybody
 * on a bad monitor. So every cell carries the token's NAME and its VALUE as
 * text, and the colour is decoration beside them. That is also what makes the
 * measurement tokens fit the same grid: `--t-gap` has no colour to show, and a
 * component built around swatches would have needed a second one for them.
 *
 * ## Why the keyboard model is a grid and not a list
 *
 * Because the eye reads it as one. Arrow keys move by row and column, Home and
 * End go to the ends of a row, and exactly one cell is tabbable at a time —
 * a roving `tabindex`, so tabbing past sixty tokens takes one press rather
 * than sixty.
 */
export function TokenSwatchGrid({
  tokens,
  names,
  label,
  selected,
  onSelect,
  columns = DEFAULT_COLUMNS,
  nameOf = readable,
}: TokenSwatchGridProps) {
  const width = Math.max(1, columns);
  /*
    The roving focus is state, not a ref: it must survive a re-render caused by
    the selection changing, and a ref would leave the tabbable cell wherever it
    was before the grid re-ordered.
  */
  const [focused, setFocused] = useState(0);
  const cellsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const focusCell = useCallback((index: number) => {
    setFocused(index);
    cellsRef.current[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = names.length - 1;
      const row = Math.floor(index / width);
      const rowStart = row * width;
      const rowEnd = Math.min(rowStart + width - 1, last);

      const next = {
        ArrowRight: Math.min(index + 1, last),
        ArrowLeft: Math.max(index - 1, 0),
        ArrowDown: Math.min(index + width, last),
        ArrowUp: Math.max(index - width, 0),
        Home: rowStart,
        End: rowEnd,
      }[event.key];

      if (next === undefined) return;
      event.preventDefault();
      focusCell(next);
    },
    [focusCell, names.length, width],
  );

  return (
    <div role="grid" aria-label={label} aria-colcount={width} className="bldr-swatches">
      {Array.from({ length: Math.ceil(names.length / width) }, (_unused, row) => (
        <div
          role="row"
          className="bldr-swatches__row"
          key={`row-${String(row)}`}
          /*
            The column count is DATA, not a theme token. It was a custom
            property in the theme's own namespace until the coverage gate
            refused it — rightly: every name in that namespace must be a token
            some theme defines, or it resolves to its fallback forever while
            looking themed. The gate reads the raw file, so this comment does
            not spell the name either.
          */
          style={{ gridTemplateColumns: `repeat(${String(width)}, minmax(0, 1fr))` }}
        >
          {names.slice(row * width, row * width + width).map((name, offset) => {
            const index = row * width + offset;
            const value = tokens[name];
            const colour = isColorToken(name);
            return (
              <div role="gridcell" className="bldr-swatches__cell" key={name}>
                <button
                  type="button"
                  ref={(element) => {
                    cellsRef.current[index] = element;
                  }}
                  className="bldr-swatches__swatch"
                  /* One tabbable cell: sixty tokens must not cost sixty presses. */
                  tabIndex={index === focused ? 0 : -1}
                  aria-pressed={selected === name}
                  onKeyDown={(event) => {
                    onKeyDown(event, index);
                  }}
                  onFocus={() => {
                    setFocused(index);
                  }}
                  onClick={() => {
                    onSelect?.(name);
                  }}
                >
                  {colour ? (
                    <span
                      className="bldr-swatches__chip"
                      aria-hidden="true"
                      style={{ background: `var(${tokenCssName(name)}, ${value})` }}
                    />
                  ) : null}
                  <span className="bldr-swatches__name">{nameOf(name)}</span>
                  {/* The value in text, so the cell is legible without the colour. */}
                  {/* A colour value is Latin, left to right: isolated, "#ffffff" never reads "ffffff#" in Arabic. */}
                  <bdi className="bldr-swatches__value" dir="ltr">
                    {value}
                  </bdi>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
