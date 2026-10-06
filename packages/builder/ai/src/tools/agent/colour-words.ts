/**
 * Colour words a person types, folded by `normalizeIntentText` (أ/إ/آ→ا,
 * ة→ه, ى→ي, lower case), each to ONE palette shade that holds a readable
 * label (white or black) at AA. Shared by the page-colour tool reading
 * (`theme.apply`) and the element-colour reading, so «احمر» means one red.
 */
export const COLOUR_WORDS: Readonly<Record<string, string>> = {
  اخضر: 'emerald-700',
  خضراء: 'emerald-700',
  خضرا: 'emerald-700',
  زيتي: 'lime-800',
  ازرق: 'blue-700',
  زرقاء: 'blue-700',
  زرقا: 'blue-700',
  كحلي: 'blue-900',
  سماوي: 'sky-700',
  احمر: 'red-700',
  حمراء: 'red-700',
  حمرا: 'red-700',
  عنابي: 'rose-900',
  خمري: 'rose-900',
  برتقالي: 'orange-700',
  اصفر: 'amber-400',
  صفراء: 'amber-400',
  صفرا: 'amber-400',
  ذهبي: 'yellow-700',
  بنفسجي: 'violet-700',
  موف: 'purple-700',
  نيلي: 'indigo-700',
  وردي: 'pink-700',
  زهري: 'pink-700',
  اسود: 'neutral-900',
  سوداء: 'neutral-900',
  سودا: 'neutral-900',
  رمادي: 'slate-600',
  بني: 'amber-800',
  فيروزي: 'teal-700',
  تركواز: 'teal-700',
  تركوازي: 'teal-700',
  green: 'emerald-700',
  emerald: 'emerald-700',
  olive: 'lime-800',
  blue: 'blue-700',
  navy: 'blue-900',
  sky: 'sky-700',
  red: 'red-700',
  maroon: 'rose-900',
  burgundy: 'rose-900',
  orange: 'orange-700',
  yellow: 'amber-400',
  gold: 'yellow-700',
  golden: 'yellow-700',
  purple: 'purple-700',
  violet: 'violet-700',
  indigo: 'indigo-700',
  pink: 'pink-700',
  black: 'neutral-900',
  gray: 'slate-600',
  grey: 'slate-600',
  brown: 'amber-800',
  teal: 'teal-700',
  turquoise: 'teal-700',
};

/**
 * Words for white: a text colour, never a page accent (a white accent holds
 * no readable label on a white page), so only the element reading takes them.
 */
export const WHITE_WORDS: Readonly<Record<string, string>> = {
  ابيض: 'white',
  بيضاء: 'white',
  بيضا: 'white',
  white: 'white',
};

/** A word with its Arabic article or preposition taken off: الأخضر, للأخضر, بالأخضر. */
export function colourOf(
  word: string,
  table: Readonly<Record<string, string>> = COLOUR_WORDS,
): string | undefined {
  for (const candidate of [word, word.replace(/^(?:بال|لل|ال|ل|ب)/u, '')]) {
    const shade = table[candidate];
    if (shade !== undefined) return shade;
  }
  return undefined;
}

/** A shade's name for a history label, in both languages («بالأحمر», "red"). */
export const SHADE_NAMES: Readonly<Record<string, { readonly ar: string; readonly en: string }>> = {
  'emerald-700': { ar: 'الأخضر', en: 'green' },
  'lime-800': { ar: 'الزيتي', en: 'olive' },
  'blue-700': { ar: 'الأزرق', en: 'blue' },
  'blue-900': { ar: 'الكحلي', en: 'navy' },
  'sky-700': { ar: 'السماوي', en: 'sky blue' },
  'red-700': { ar: 'الأحمر', en: 'red' },
  'rose-900': { ar: 'العنابي', en: 'maroon' },
  'orange-700': { ar: 'البرتقالي', en: 'orange' },
  'amber-400': { ar: 'الأصفر', en: 'yellow' },
  'yellow-700': { ar: 'الذهبي', en: 'gold' },
  'violet-700': { ar: 'البنفسجي', en: 'violet' },
  'purple-700': { ar: 'الموف', en: 'purple' },
  'indigo-700': { ar: 'النيلي', en: 'indigo' },
  'pink-700': { ar: 'الوردي', en: 'pink' },
  'neutral-900': { ar: 'الأسود', en: 'black' },
  'slate-600': { ar: 'الرمادي', en: 'grey' },
  'amber-800': { ar: 'البني', en: 'brown' },
  'teal-700': { ar: 'الفيروزي', en: 'teal' },
  white: { ar: 'الأبيض', en: 'white' },
};
