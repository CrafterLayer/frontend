import type { BuilderKernel } from '@craftkit/builder-core';

import {
  namedSection,
  namingWords,
  outlinePageSections,
  roleSections,
  speaksOfWholePage,
} from '../../context/document-tree-mode';
import type { SectionTone } from './builtin/section-tone';

/*
  The zero-token reading of a section's tone (2026-10-13, ready scripts):
  «خلّي قسم الأسعار داكن», «اجعل خلفية الهيرو فاتحة», "make the hero section
  dark", "give the pricing section an accent background" — the WHOLE request,
  folded (direct-tool.ts) — becomes one `section.ops {op:'tone'}` step with
  no model. The text that goes with the ground («بنص فاتح», "with light text")
  and why ("so it stands out") may be said too: the kit gives a band its own
  ink, so they ask nothing more — unless they contradict the tone. The section is named the way a person names it: its label,
  heading or anchor («الأسعار», "Our menu"), or its role («الهيرو», "the
  footer"); one section exactly, or the model decides. "Darker" and "lighter"
  are left to the model (a shade of the same ground, not a band), and so are
  black and white, which the element-colour reading reads as colours.
*/

export interface SectionToneReading {
  readonly calls: readonly { readonly name: string; readonly input: Record<string, unknown> }[];
  readonly label: { readonly ar: string; readonly en: string };
}

const AR_TONES: ReadonlyMap<string, SectionTone> = new Map([
  ['داكن', 'dark'],
  ['داكنه', 'dark'],
  ['غامق', 'dark'],
  ['غامقه', 'dark'],
  ['ليلي', 'dark'],
  ['فاتح', 'light'],
  ['فاتحه', 'light'],
  ['هادي', 'surface'],
  ['هاديه', 'surface'],
]);
const EN_TONES: ReadonlyMap<string, SectionTone> = new Map([
  ['dark', 'dark'],
  ['light', 'light'],
  ['accent', 'accent'],
  ['brand', 'accent'],
  ['brand-coloured', 'accent'],
  ['brand-colored', 'accent'],
]);

const AR_VERB = '(?:خلي|خل|اجعل|صير|حول|غير)';
/** «… بنص فاتح»: the band's text, said with it. */
const AR_TEXT = '(?:\\s+(?:و\\s*)?(?:ب|مع\\s+)(?:نص|نصوص|خط|كتابه)\\s+(فاتح|ابيض|داكن|غامق|اسود))?';
const AR_TONE = new RegExp(
  `^${AR_VERB}\\s+(?:لون\\s+|خلفيه\\s+)?(.+?)\\s+(?:(?:ب|ل)?(?:خلفيه|لون)\\s+)?(${[...AR_TONES.keys()].join('|')})${AR_TEXT}$`,
  'u',
);
/** «خلّي قسم الأسعار بلون الهوية»: the band in the brand's colour. */
const AR_ACCENT = new RegExp(
  `^${AR_VERB}\\s+(?:خلفيه\\s+)?(.+?)\\s+(?:بلون|باللون|لون)\\s+(?:ال)?(?:هويه|اساسي|رئيسي|موقع|براند|علامه)$`,
  'u',
);
const EN_TONE =
  /^(?:make|turn|set|change|switch)\s+(?:the\s+)?(.+?)\s+(?:(?:background|ground)\s+)?(?:to\s+|into\s+)?(?:an?\s+)?(dark|light|accent|brand(?:-colou?red)?)(?:\s+(?:band|section|background|one))?(?:\s+with\s+(light|white|dark|black)\s+(?:text|type|writing))?(?:\s+so\s+(?:that\s+)?it\s+stands\s+out(?:\s+from\s+the\s+rest(?:\s+of\s+the\s+page)?)?)?$/u;
/** The text said with a tone must be the one that reads on it. */
const READS_ON: Readonly<Record<SectionTone, ReadonlySet<string>>> = {
  dark: new Set(['light', 'white', 'فاتح', 'ابيض']),
  light: new Set(['dark', 'black', 'داكن', 'غامق', 'اسود']),
  surface: new Set(['dark', 'black', 'داكن', 'غامق', 'اسود']),
  accent: new Set(),
};

function consistent(tone: SectionTone, text: string | undefined): boolean {
  return text === undefined || READS_ON[tone].has(text);
}
const EN_GIVE =
  /^give\s+(?:the\s+)?(.+?)\s+(?:an?\s+)?(dark|light|accent|brand(?:-colou?red)?)\s+(?:background|ground|band|look)$/u;
/** Words that name the kind of thing, not the section: «قسم», "section". */
const SECTION_WORDS = /^(?:(?:ال)?(?:قسم|سكشن|جزء)\s+)|(?:\s+(?:section|band|area))$/gu;

const NAMES: Readonly<Record<SectionTone, { readonly ar: string; readonly en: string }>> = {
  dark: { ar: 'بخلفية داكنة', en: 'a dark band' },
  light: { ar: 'بخلفية فاتحة', en: 'a light band' },
  surface: { ar: 'بخلفية هادئة', en: 'a soft band' },
  accent: { ar: 'بلون الهوية', en: 'an accent band' },
};

function asked(text: string): { readonly name: string; readonly tone: SectionTone } | undefined {
  const ar = AR_TONE.exec(text);
  const arTone = ar === null ? undefined : AR_TONES.get(ar[2] ?? '');
  if (ar !== null && arTone !== undefined) {
    return consistent(arTone, ar[3]) ? { name: ar[1] ?? '', tone: arTone } : undefined;
  }
  const accent = AR_ACCENT.exec(text);
  if (accent !== null) return { name: accent[1] ?? '', tone: 'accent' };
  const en = EN_TONE.exec(text) ?? EN_GIVE.exec(text);
  const enTone = en === null ? undefined : EN_TONES.get(en[2] ?? '');
  if (en === null || enTone === undefined || !consistent(enTone, en[3])) return undefined;
  return { name: en[1] ?? '', tone: enTone };
}

/**
 * The request (folded by `normalizeIntentText`) as one tone step on ONE
 * composed section the words name, or undefined.
 */
export function readSectionTone(
  text: string,
  kernel: BuilderKernel,
): SectionToneReading | undefined {
  const request = asked(text);
  if (request === undefined) return undefined;
  const name = request.name.replace(SECTION_WORDS, '').trim();
  if (name === '' || speaksOfWholePage(name)) return undefined;
  const document = kernel.getDocument();
  const sections = outlinePageSections(document).filter(({ type }) => type === 'customCode');
  const words = namingWords(name);
  const byRole = roleSections(words, sections, document);
  const section = namedSection(words, sections) ?? (byRole.length === 1 ? byRole[0] : undefined);
  if (section === undefined) return undefined;
  const label = section.label ?? section.heading ?? section.id;
  return {
    calls: [{ name: 'section.ops', input: { op: 'tone', id: section.id, tone: request.tone } }],
    label: {
      ar: `قسم «${label}» ${NAMES[request.tone].ar}`,
      en: `Make “${label}” ${NAMES[request.tone].en}`,
    },
  };
}
