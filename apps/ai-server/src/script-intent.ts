/**
 * Whether an EDIT request is one an edit script answers best — the server's
 * copy of builder-ai `prefersScript` (packages/builder/ai/src/script/
 * script-intent.ts, agent-script DESIGN §A.10).
 *
 * The edit prompt uses it for ONE thing: a per-request tip after the cached
 * prefix ("answer with ONE script.run step"), so the same change on many
 * elements, content built from data, or "every / all / كل" across sections
 * or pages costs ~100 output tokens instead of one step per element. A
 * request without a bulk signal gets nothing: for 1–4 edits plain steps are
 * cheaper.
 *
 * A COPY, rules and all: this app reaches the builder only through
 * `@craftkit/builder/wire`, which carries neither the heuristic nor
 * `normalizeIntentText`, so the matching fold is restated here too.
 * script-card.test.ts runs both on builder-ai's `PREFERS_SCRIPT_TABLE` and
 * fails on any disagreement; change the two together.
 */

// ── The fold (builder-ai intent/normalize-arabic.ts `normalizeIntentText`) ───

/** Harakat, tanween, shadda, sukun, the dagger alif, Quranic marks and tatweel. */
const ARABIC_MARKS =
  /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/gu;
/** أ إ آ ٱ and the hamza-below/above alifs all read as bare alif. */
const ALIF_VARIANTS = /[آأإٱٲٳ]/gu;
const TAA_MARBUTA = /ة/gu;
const ALIF_MAQSURA = /ى/gu;
const PERSIAN_YEH = /ی/gu;
const PERSIAN_KEHEH = /ک/gu;

const ARABIC_PUNCTUATION: Readonly<Record<string, string>> = {
  '؟': '?',
  '،': ',',
  '؛': ';',
  '’': "'",
  '‘': "'",
};

/**
 * The request folded for matching only — never shown or sent: presentation
 * forms decomposed (NFKC), Arabic letter variants folded (ة→ه, أ/إ/آ/ٱ→ا,
 * ى→ي, ی→ي, ک→ك), marks and tatweel dropped, Arabic-Indic digits read as
 * 0–9, Arabic punctuation read as Latin, lower case, one space per run.
 */
export function foldIntentText(text: string): string {
  const folded = text
    .normalize('NFKC')
    .replace(ARABIC_MARKS, '')
    .replace(ALIF_VARIANTS, 'ا')
    .replace(TAA_MARBUTA, 'ه')
    .replace(ALIF_MAQSURA, 'ي')
    .replace(PERSIAN_YEH, 'ي')
    .replace(PERSIAN_KEHEH, 'ك');
  return folded
    .replace(/[٠-٩۰-۹]/gu, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/[؟،؛’‘]/gu, (mark) => ARABIC_PUNCTUATION[mark] ?? mark)
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

// ── The rules (builder-ai script/script-intent.ts, verbatim) ──────────────────

// كل / جميع / كافة / كامل + a plural element noun (or the noun + كلها / جميعها).
const AR_NOUNS =
  '(?:ال)?(?:ازرار|عناوين|بطاقات|كروت|صور|اقسام|سكشنات|روابط|اسعار|نصوص|ايقونات|فقرات|عناصر|صفحات)';
const AR_ALL = new RegExp(
  `(?:كل|جميع|كافه|كامل)\\s+${AR_NOUNS}|${AR_NOUNS}\\s+(?:كلها|جميعها|كلهم)`,
  'u',
);

// every / each / all (the|of the|my) + an element noun; "for each" too.
const EN_NOUN =
  '(?:buttons?|headings?|headers?|titles?|cards?|images?|photos?|pictures?|sections?|links?|prices?|texts?|icons?|items?|paragraphs?|pages?|elements?|ctas?|labels?|numbers?|digits?)';
const EN_ALL = new RegExp(
  `\\b(?:every|each|for each|all(?:\\s+(?:the|of the|my|our))?)\\s+(?:[a-z-]+\\s+)?${EN_NOUN}\\b`,
  'u',
);

// A count ≥ 5 before an element / list noun.
const AR_COUNT_NOUN =
  '(?:طبق|اطباق|صنف|اصناف|وجبه|وجبات|خطه|خطط|باقه|باقات|بطاقه|بطاقات|كرت|كروت|صوره|صور|سؤال|اسئله|زر|ازرار|قسم|اقسام|رابط|روابط|ميزه|ميزات|مميزات|منتج|منتجات|خدمه|خدمات|عضو|اعضاء|شخص|اشخاص|صفحه|صفحات|عنوان|عناوين|عنصر|عناصر|بند|بنود|شهاده|شهادات|ايقونه|ايقونات|اسم|اسماء|مشروع|مشاريع|عقار|عقارات|غرفه|غرف)';
const EN_COUNT_NOUN =
  '(?:items?|dishes|dish|meals?|plans?|packages?|tiers?|cards?|photos?|images?|pictures?|questions?|faqs?|buttons?|sections?|links?|features?|products?|services?|members?|people|persons?|pages?|headings?|titles?|elements?|testimonials?|reviews?|projects?|properties|listings?|rooms?|names?|logos?|steps?|stats?)';
const AR_NUMBER_WORDS =
  '(?:خمس|خمسه|ست|سته|سبع|سبعه|ثمان|ثماني|ثمانيه|تسع|تسعه|عشر|عشره|احد عشر|اثنا عشر|اثني عشر|ثلاث عشر|ثلاثه عشر|اربع عشر|اربعه عشر|خمس عشر|خمسه عشر|ست عشر|سته عشر|سبع عشر|سبعه عشر|ثماني عشر|ثمانيه عشر|تسع عشر|تسعه عشر|عشرين|دزينه)';
const EN_NUMBER_WORDS =
  '(?:five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|a dozen|dozen)';
const COUNT_NOUN = new RegExp(
  `(?:\\b(?:[5-9]|[1-9]\\d+)\\b|(?:^|\\s|و)${AR_NUMBER_WORDS}|\\b${EN_NUMBER_WORDS}\\b)\\s+(?:[^\\s]+\\s+)?(?:${AR_COUNT_NOUN}|${EN_COUNT_NOUN}\\b)`,
  'u',
);

// A list noun beside any count ≥ 2: "3 خطط", "menu with 12 dishes", "a FAQ of 6 questions".
const LIST_NOUN =
  /(?:منيو|قائمه طعام|قائمه الطعام|اطباق|فريق|معرض|اسئله|خطط|باقات|\bmenu\b|\bdishes\b|\bteam\b|\bgallery\b|\bfaq\b|\bplans\b|\bpricing\b|\bschedule\b|جدول)/u;
const ANY_COUNT =
  /(?:\b(?:[2-9]|[1-9]\d+)\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|dozen)\b|(?:^|\s)(?:و)?(?:اثنين|ثلاث|ثلاثه|اربع|اربعه|خمس|خمسه|ست|سته|سبع|سبعه|ثمان|ثمانيه|تسع|تسعه|عشر|عشره|عشرين)(?=\s|$))/u;

const TRANSLATE_ALL =
  /(?:ترجم\s+(?:كل|جميع|كامل|الصفحه كلها|الموقع)|\btranslate\s+(?:all|every|everything|the whole|the entire)\b)/u;
const ACROSS_PAGES =
  /(?:(?:علي|في|ب|ل)\s*(?:كل|جميع|كافه)\s+(?:ال)?صفحات|(?:كل|جميع)\s+صفحات\s+الموقع|\bacross\s+(?:all\s+)?(?:the\s+)?pages\b|\bevery page\b|\ball (?:the )?pages\b|\beach page\b)/u;

/** True when an edit script should answer this request (DESIGN §A.10). */
export function prefersScriptServer(request: string): boolean {
  const text = foldIntentText(request);
  if (text === '') return false;
  if (TRANSLATE_ALL.test(text) || ACROSS_PAGES.test(text)) return true;
  if (AR_ALL.test(text) || EN_ALL.test(text)) return true;
  if (COUNT_NOUN.test(text)) return true;
  return LIST_NOUN.test(text) && ANY_COUNT.test(text);
}
