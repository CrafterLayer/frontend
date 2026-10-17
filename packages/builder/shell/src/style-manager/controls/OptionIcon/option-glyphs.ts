/**
 * The glyphs of the style panel's segmented controls, keyed `property:value`.
 *
 * Every glyph is drawn on a 16 × 16 grid as stroked paths (`d` strings), or
 * as a short text mark for typographic choices (`Aa`). A glyph that points
 * along the INLINE axis is `mirror`: it is drawn for a left-to-right page and
 * flipped on a right-to-left one, so "row" points the way the row runs.
 */
export interface OptionGlyph {
  readonly paths?: readonly string[] | undefined;
  /** A typographic mark instead of paths ("AA", "Aa"). */
  readonly text?: string | undefined;
  /** Drawn for LTR; flipped along the inline axis on an RTL page. */
  readonly mirror?: boolean | undefined;
}

const ARROW_RIGHT = ['M2.5 8h11', 'M10 4.5 13.5 8 10 11.5'];
const ARROW_LEFT = ['M13.5 8h-11', 'M6 4.5 2.5 8 6 11.5'];
const ARROW_DOWN = ['M8 2.5v11', 'M4.5 10 8 13.5 11.5 10'];
const ARROW_UP = ['M8 13.5v-11', 'M4.5 6 8 2.5 11.5 6'];
const CIRCLE = 'M2.5 8a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0';

export const OPTION_GLYPHS: Readonly<Record<string, OptionGlyph>> = {
  // Display: the four everyday ones; the rest live in the overflow menu.
  'display:block': { paths: ['M2.5 4.5h11v7h-11z'] },
  'display:flex': { paths: ['M2.5 4.5h3v7h-3z', 'M6.5 4.5h3v7h-3z', 'M10.5 4.5h3v7h-3z'], mirror: true },
  'display:grid': { paths: ['M2.5 2.5h4.5v4.5h-4.5z', 'M9 2.5h4.5v4.5H9z', 'M2.5 9h4.5v4.5h-4.5z', 'M9 9h4.5v4.5H9z'] },
  'display:none': { paths: [CIRCLE, 'M4.2 4.2l7.6 7.6'] },

  'flexDirection:row': { paths: ARROW_RIGHT, mirror: true },
  'flexDirection:row-reverse': { paths: ARROW_LEFT, mirror: true },
  'flexDirection:column': { paths: ARROW_DOWN },
  'flexDirection:column-reverse': { paths: ARROW_UP },

  'flexWrap:wrap': { paths: ['M2.5 4h8.5a2.5 2.5 0 0 1 0 5H4.5', 'M6.5 7 4.5 9l2 2', 'M2.5 13h5'], mirror: true },
  'flexWrap:wrap-reverse': { paths: ['M2.5 12h8.5a2.5 2.5 0 0 0 0-5H4.5', 'M6.5 9 4.5 7l2-2', 'M2.5 3h5'], mirror: true },
  'flexWrap:nowrap': { paths: ['M2 8h9.5', 'M9 5.5 11.5 8 9 10.5', 'M14 3.5v9'], mirror: true },

  'justifyContent:start': { paths: ['M2.5 2.5v11', 'M4.5 5.5h3v5h-3z', 'M8.5 5.5h3v5h-3z'], mirror: true },
  'justifyContent:center': { paths: ['M8 2.5v11', 'M3 5.5h3v5H3z', 'M10 5.5h3v5h-3z'] },
  'justifyContent:end': { paths: ['M13.5 2.5v11', 'M4.5 5.5h3v5h-3z', 'M8.5 5.5h3v5h-3z'], mirror: true },
  'justifyContent:between': { paths: ['M2.5 2.5v11', 'M13.5 2.5v11', 'M4 5.5h2.5v5H4z', 'M9.5 5.5H12v5H9.5z'] },
  'justifyContent:around': { paths: ['M2.5 2.5v11', 'M13.5 2.5v11', 'M5 6.5h2v3H5z', 'M9 6.5h2v3H9z'] },
  'justifyContent:evenly': {
    paths: ['M2.5 2.5v11', 'M13.5 2.5v11', 'M4.5 6.5h1.5v3H4.5z', 'M7.25 6.5h1.5v3h-1.5z', 'M10 6.5h1.5v3H10z'],
  },

  'alignItems:start': { paths: ['M2.5 2.5h11', 'M4.5 4.5h3v7h-3z', 'M8.5 4.5h3v4h-3z'] },
  'alignItems:center': { paths: ['M2.5 8h11', 'M4.5 4.5h3v7h-3z', 'M8.5 6h3v4h-3z'] },
  'alignItems:end': { paths: ['M2.5 13.5h11', 'M4.5 4.5h3v7h-3z', 'M8.5 7.5h3v4h-3z'] },
  'alignItems:stretch': { paths: ['M2.5 2.5h11', 'M2.5 13.5h11', 'M4.5 4.5h3v7h-3z', 'M8.5 4.5h3v7h-3z'] },
  'alignItems:baseline': { paths: ['M2 10h12', 'M4.5 3.5h3v6.5h-3z', 'M8.5 6.5h3v3.5h-3z'] },

  'textAlign:start': { paths: ['M2.5 4h11', 'M2.5 7h7', 'M2.5 10h11', 'M2.5 13h7'], mirror: true },
  'textAlign:center': { paths: ['M2.5 4h11', 'M4.5 7h7', 'M2.5 10h11', 'M4.5 13h7'] },
  'textAlign:end': { paths: ['M2.5 4h11', 'M6.5 7h7', 'M2.5 10h11', 'M6.5 13h7'], mirror: true },
  'textAlign:justify': { paths: ['M2.5 4h11', 'M2.5 7h11', 'M2.5 10h11', 'M2.5 13h11'] },

  'textTransform:uppercase': { text: 'AA' },
  'textTransform:lowercase': { text: 'aa' },
  'textTransform:capitalize': { text: 'Aa' },
  'textTransform:none': { paths: ['M4 8h8'] },

  'textDecorationLine:underline': { paths: ['M5 2.5v4.5a3 3 0 0 0 6 0V2.5', 'M4 13.5h8'] },
  'textDecorationLine:overline': { paths: ['M4 2.5h8', 'M5 5.5v4.5a3 3 0 0 0 6 0V5.5'] },
  'textDecorationLine:line-through': {
    paths: ['M3 8h10', 'M11 4.5C10.5 3.5 9.4 3 8 3 6.3 3 5 3.9 5 5.2', 'M5 11.5c.5 1 1.6 1.5 3 1.5 1.7 0 3-.9 3-2.2'],
  },
  'textDecorationLine:none': { paths: ['M4 8h8'] },

  'fontStyle:italic': { paths: ['M7 3h5', 'M4 13h5', 'M9.5 3l-3 10'] },
  'fontStyle:normal': { paths: ['M5 3h6', 'M5 13h6', 'M8 3v10'] },

  // Gradient directions are logical: inline-start is on the right of an RTL page.
  'gradientDirection:to-block-start': { paths: ARROW_UP },
  'gradientDirection:to-block-end': { paths: ARROW_DOWN },
  'gradientDirection:to-inline-start': { paths: ARROW_LEFT, mirror: true },
  'gradientDirection:to-inline-end': { paths: ARROW_RIGHT, mirror: true },
  'gradientDirection:to-block-start-inline-start': { paths: ['M12.5 12.5l-9-9', 'M3.5 9V3.5H9'], mirror: true },
  'gradientDirection:to-block-start-inline-end': { paths: ['M3.5 12.5l9-9', 'M7 3.5h5.5V9'], mirror: true },
  'gradientDirection:to-block-end-inline-start': { paths: ['M12.5 3.5l-9 9', 'M3.5 7v5.5H9'], mirror: true },
  'gradientDirection:to-block-end-inline-end': { paths: ['M3.5 3.5l9 9', 'M12.5 7v5.5H7'], mirror: true },
  'gradientDirection:radial': { paths: [CIRCLE, 'M5.5 8a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'] },
  'gradientDirection:conic': { paths: [CIRCLE, 'M8 8V2.5', 'M8 8l4.2 3.4'] },

  // The screen-size buckets of the panel header.
  'bucket:base': { paths: ['M2 3h12v8.5H2z', 'M6 14h4', 'M8 11.5V14'] },
  'bucket:tablet': { paths: ['M3.5 2h9v12h-9z', 'M7.25 12h1.5'] },
  'bucket:mobile': { paths: ['M5 2h6v12H5z', 'M7.25 12h1.5'] },
};

/** The glyph for one option, when the panel has one. */
export function optionGlyph(property: string, value: string): OptionGlyph | undefined {
  return OPTION_GLYPHS[`${property}:${value}`];
}
