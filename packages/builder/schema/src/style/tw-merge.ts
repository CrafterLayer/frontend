/**
 * `ckTwMerge`: tailwind-merge, taught this product's tokens and logical sides
 * (style-manager DESIGN.md D3).
 *
 * tailwind-merge 3.6.0 knows the logical utilities but not how they conflict
 * with the axis shorthands: it keeps both `ps-2 px-4`, both `pbs-4 py-2` and
 * both `inline-64 w-32`, though the later class fully replaces the earlier
 * one. Named-style expansion (D6) and paste-style merge with this, so "own
 * class wins" holds for logical sides too.
 *
 * As in tailwind-merge, a group lists the groups IT overrides when it comes
 * later; a later `px-4` removes an earlier `ps-2`, while a later `ps-2` only
 * refines an earlier `px-4` and both stay.
 */
import { extendTailwindMerge } from 'tailwind-merge';

import { TOKEN_UTILITY_NAMES } from './token-utilities';

export const ckTwMerge: (...classLists: string[]) => string = extendTailwindMerge({
  extend: {
    theme: {
      color: [...TOKEN_UTILITY_NAMES.color],
      spacing: [...TOKEN_UTILITY_NAMES.spacing],
      container: [...TOKEN_UTILITY_NAMES.container],
      radius: [...TOKEN_UTILITY_NAMES.radius],
      shadow: [...TOKEN_UTILITY_NAMES.shadow],
      font: [...TOKEN_UTILITY_NAMES.font],
      text: [...TOKEN_UTILITY_NAMES.text],
      'font-weight': [...TOKEN_UTILITY_NAMES['font-weight']],
      leading: [...TOKEN_UTILITY_NAMES.leading],
      tracking: [...TOKEN_UTILITY_NAMES.tracking],
    },
    /*
      Tailwind generates `inline-content-wide` / `max-inline-page` from the
      container namespace; tailwind-merge's logical size groups do not read it.
    */
    classGroups: {
      'inline-size': [{ inline: [...TOKEN_UTILITY_NAMES.container] }],
      'min-inline-size': [{ 'min-inline': [...TOKEN_UTILITY_NAMES.container] }],
      'max-inline-size': [{ 'max-inline': [...TOKEN_UTILITY_NAMES.container] }],
    },
    conflictingClassGroups: {
      // Padding and margin: the axis shorthands cover their logical sides.
      px: ['ps', 'pe'],
      py: ['pbs', 'pbe'],
      pt: ['pbs'],
      pb: ['pbe'],
      pbs: ['pt'],
      pbe: ['pb'],
      mx: ['ms', 'me'],
      my: ['mbs', 'mbe'],
      mt: ['mbs'],
      mb: ['mbe'],
      mbs: ['mt'],
      mbe: ['mb'],
      // Sizes: inline/block are width/height in horizontal writing.
      w: ['inline-size'],
      'inline-size': ['w'],
      h: ['block-size'],
      'block-size': ['h'],
      size: ['inline-size', 'block-size'],
      'min-w': ['min-inline-size'],
      'min-inline-size': ['min-w'],
      'max-w': ['max-inline-size'],
      'max-inline-size': ['max-w'],
      'min-h': ['min-block-size'],
      'min-block-size': ['min-h'],
      'max-h': ['max-block-size'],
      'max-block-size': ['max-h'],
      // Inset: inset-x/y cover the logical edges.
      'inset-x': ['start', 'end'],
      'inset-y': ['inset-bs', 'inset-be'],
      top: ['inset-bs'],
      bottom: ['inset-be'],
      'inset-bs': ['top'],
      'inset-be': ['bottom'],
      // Radius: the top and bottom rows are the block-start and block-end corners.
      'rounded-t': ['rounded-ss', 'rounded-se'],
      'rounded-b': ['rounded-es', 'rounded-ee'],
      // Border widths and colours per logical side.
      'border-w-x': ['border-w-s', 'border-w-e'],
      'border-w-y': ['border-w-bs', 'border-w-be'],
      'border-w-t': ['border-w-bs'],
      'border-w-b': ['border-w-be'],
      'border-w-bs': ['border-w-t'],
      'border-w-be': ['border-w-b'],
      'border-color-x': ['border-color-s', 'border-color-e'],
      'border-color-y': ['border-color-bs', 'border-color-be'],
      'border-color-t': ['border-color-bs'],
      'border-color-b': ['border-color-be'],
      'border-color-bs': ['border-color-t'],
      'border-color-be': ['border-color-b'],
    },
  },
});
