import { normalizeIntentText } from '../intent/normalize-arabic';

/**
 * Whether a request is one an edit script answers best (agent-script DESIGN
 * §A.10): the same change on many elements, content built from data, or
 * "every / all / كل" across sections or pages. Pure and deterministic: the
 * edit lane appends a one-line tip when it is true, and nothing otherwise.
 *
 * Measured basis: a script costs the same ~100 output tokens for 5 elements
 * or 60, while plain steps grow with the count; for 1–4 edits plain steps are
 * cheaper (programmatic tool calling measured ~8% MORE on 1–2-call turns), so
 * a request without a bulk signal stays false.
 *
 * Matched on `normalizeIntentText`: Arabic letter variants folded (أ→ا, ة→ه,
 * ى→ي), harakat dropped, Arabic-Indic digits read as 0–9, English lowercased.
 * The ai-server keeps its own copy; `PREFERS_SCRIPT_TABLE` is the drift test.
 */

// كل / جميع / كافة / كامل + a plural element noun (or the noun + كلها / جميعها).
const AR_NOUNS = '(?:ال)?(?:ازرار|عناوين|بطاقات|كروت|صور|اقسام|سكشنات|روابط|اسعار|نصوص|ايقونات|فقرات|عناصر|صفحات)';
const AR_ALL = new RegExp(`(?:كل|جميع|كافه|كامل)\\s+${AR_NOUNS}|${AR_NOUNS}\\s+(?:كلها|جميعها|كلهم)`, 'u');

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
const LIST_NOUN = /(?:منيو|قائمه طعام|قائمه الطعام|اطباق|فريق|معرض|اسئله|خطط|باقات|\bmenu\b|\bdishes\b|\bteam\b|\bgallery\b|\bfaq\b|\bplans\b|\bpricing\b|\bschedule\b|جدول)/u;
const ANY_COUNT = /(?:\b(?:[2-9]|[1-9]\d+)\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|dozen)\b|(?:^|\s)(?:و)?(?:اثنين|ثلاث|ثلاثه|اربع|اربعه|خمس|خمسه|ست|سته|سبع|سبعه|ثمان|ثمانيه|تسع|تسعه|عشر|عشره|عشرين)(?=\s|$))/u;

const TRANSLATE_ALL = /(?:ترجم\s+(?:كل|جميع|كامل|الصفحه كلها|الموقع)|\btranslate\s+(?:all|every|everything|the whole|the entire)\b)/u;
const ACROSS_PAGES = /(?:(?:علي|في|ب|ل)\s*(?:كل|جميع|كافه)\s+(?:ال)?صفحات|(?:كل|جميع)\s+صفحات\s+الموقع|\bacross\s+(?:all\s+)?(?:the\s+)?pages\b|\bevery page\b|\ball (?:the )?pages\b|\beach page\b)/u;

/** True when a script should answer this request (DESIGN §A.10). */
export function prefersScript(request: string): boolean {
  const text = normalizeIntentText(request);
  if (text === '') return false;
  if (TRANSLATE_ALL.test(text) || ACROSS_PAGES.test(text)) return true;
  if (AR_ALL.test(text) || EN_ALL.test(text)) return true;
  if (COUNT_NOUN.test(text)) return true;
  return LIST_NOUN.test(text) && ANY_COUNT.test(text);
}

/** The drift table the ai-server's copy is held to: ≥ 30 rows, Arabic and English, both answers. */
export const PREFERS_SCRIPT_TABLE: readonly { readonly text: string; readonly expected: boolean }[] = Object.freeze([
  // Bulk: every / all / كل
  { text: 'خلي كل الأزرار مدورة', expected: true },
  { text: 'خلّي جميع العناوين باللون الأزرق', expected: true },
  { text: 'كبّر كل الصور', expected: true },
  { text: 'حط ظل لكل البطاقات', expected: true },
  { text: 'غيّر كافة الروابط لتفتح صفحة التواصل', expected: true },
  { text: 'الأزرار كلها خليها سوداء', expected: true },
  { text: 'round every button', expected: true },
  { text: 'make all the headings bold', expected: true },
  { text: 'give each card the same height', expected: true },
  { text: 'make all buttons pill shaped', expected: true },
  { text: 'for each image add rounded corners', expected: true },
  // Data-driven content with a count
  { text: 'ضيف 12 طبق للمنيو بأسعار من 2 لـ 8 دنانير', expected: true },
  { text: 'اعمل جدول أسعار 3 خطط شهري/سنوي', expected: true },
  { text: 'أضف عشرين سؤال للأسئلة الشائعة', expected: true },
  { text: 'add 8 menu items with prices', expected: true },
  { text: 'add twelve dishes to the menu', expected: true },
  { text: 'fill the gallery with 9 photos', expected: true },
  { text: 'ضيف ٦ أعضاء للفريق', expected: true },
  // Translate everything / across pages
  { text: 'ترجم كل العناوين للإنجليزي', expected: true },
  { text: 'translate all the headings to Arabic', expected: true },
  { text: 'translate the whole page to English', expected: true },
  { text: 'غيّر اسم الشركة على كل الصفحات', expected: true },
  { text: 'rename the brand across all pages', expected: true },
  { text: 'put the same footer on every page', expected: true },
  // Targeted edits, creative work: plain steps or generation
  { text: 'كبّر عنوان الهيرو', expected: false },
  { text: 'غيّر نص الزر الرئيسي إلى اشترك الآن', expected: false },
  { text: 'اعمل صفحة هبوط لمطعم', expected: false },
  { text: 'make the hero heading bigger', expected: false },
  { text: 'change the button text to Buy now', expected: false },
  { text: 'add a testimonials section', expected: false },
  { text: 'change the price to 8 JOD', expected: false },
  { text: 'replace the hero photo with a coffee picture', expected: false },
  { text: 'make the footer dark', expected: false },
  { text: 'أضف قسم تواصل معنا', expected: false },
]);
