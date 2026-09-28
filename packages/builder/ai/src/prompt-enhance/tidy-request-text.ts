/**
 * The enhancer's floor: what code can fix in a typed request WITHOUT
 * understanding it — used when no model can rewrite it (an offline provider,
 * a server without the enhance route) and nothing else.
 *
 * ## The rule every fix obeys
 *
 * Never a semantic change. Spacing, the Arabic article split from its word,
 * a ه typed for a ة on a curated list of words, a mark typed three times —
 * each is a spelling of the same request. Nothing is translated, reordered,
 * reworded or completed, and three kinds of span are never touched beyond
 * their surrounding whitespace: links and e-mail addresses (a `?` or a `,` in
 * them is data) and quoted copy («…», "…", “…”), which is the person's own
 * text for the page and stays exactly as they wrote it.
 *
 * ## Why the ه/ة fix is a LIST
 *
 * A final ه is often right: it is the possessive "his/its" (مطعمه, "his
 * restaurant"), and it ends real words (وجه, الله, اتجاه, فواكه). A blanket
 * ه → ة would rewrite «صورة وجهه» ("a photo of his face") into «وجهة»
 * ("destination"). So only listed stems change, in two tiers:
 * - `ALWAYS`: the ه form is, in a page request, all but never anything else
 *   («صفحه», «شركه», «خلفيه») — fixed bare or after an article prefix;
 * - `WITH_ARTICLE`: the bare ه form is also a live possessive or imperative
 *   («طريقه» "his way", «ترجمه» "translate it", «دوره» "his role"), but
 *   Arabic never puts the article on a possessed noun — «الطريقه» can only be
 *   «الطريقة» — so these change only after ال / وال / بال / فال / كال / لل
 *   (and ولل / فلل).
 * Single-letter prefixes (و، ب، ل، ف، ك) are deliberately not read: «وجوده»
 * is و + جوده ("its quality") only in theory and "his presence" in practice.
 */

/** Stems (the word without its final ة) whose ه spelling is fixed bare or after an article. */
const ALWAYS: readonly string[] = [
  // The builder's own vocabulary.
  'صفح', // صفحة
  'خلفي', // خلفية
  'رئيسي', // رئيسية
  'واجه', // واجهة
  'قائم', // قائمة
  'قايم', // قايمة (the ending only; the hamza is the person's)
  'فقر', // فقرة
  'جمل', // جملة
  'مقدم', // مقدمة
  'شاش', // شاشة
  'نافذ', // نافذة
  'ايقون', // ايقونة
  'أيقون', // أيقونة
  'بطاق', // بطاقة
  'لوح', // لوحة
  'مساح', // مساحة
  'مجموع', // مجموعة
  'صور', // صورة
  'خريط', // خريطة
  'سل', // سلة
  'باق', // باقة
  'فتر', // فترة
  'مر', // مرة
  'لغ', // لغة
  'رسال', // رسالة
  'اضاف', // اضافة
  'إضاف', // إضافة
  'شهاد', // شهادة
  'جائز', // جائزة
  // Businesses and places a page is made for.
  'شرك', // شركة
  'مدون', // مدونة
  'خدم', // خدمة
  'عياد', // عيادة
  'مدرس', // مدرسة
  'جامع', // جامعة
  'جمعي', // جمعية
  'أكاديمي', // أكاديمية
  'اكاديمي', // اكاديمية
  'وكال', // وكالة
  'حضان', // حضانة
  'روض', // روضة
  'مطبع', // مطبعة
  'مغسل', // مغسلة
  'ورش', // ورشة
  'صيدلي', // صيدلية
  'بقال', // بقالة
  'شق', // شقة
  'غرف', // غرفة
  'قاع', // قاعة
  'حديق', // حديقة
  'مزرع', // مزرعة
  'محط', // محطة
  'منطق', // منطقة
  'مدين', // مدينة
  'دول', // دولة
  'سيار', // سيارة
  'منص', // منصة
  'شبك', // شبكة
  'بواب', // بوابة
  'قهو', // قهوة
  'وجب', // وجبة
  'طاول', // طاولة
  'هدي', // هدية
  'علب', // علبة
  // What a page offers and says.
  'فكر', // فكرة
  'ساع', // ساعة
  'دقيق', // دقيقة
  'جود', // جودة
  'سرع', // سرعة
  'زيار', // زيارة
  'رحل', // رحلة
  'هوي', // هوية
  'علام', // علامة
  'تكلف', // تكلفة
  'عضوي', // عضوية
  'فعالي', // فعالية
  'مناسب', // مناسبة
  'رياض', // رياضة
  'صح', // صحة
  'تغذي', // تغذية
  'قراء', // قراءة
  'صياغ', // صياغة
  'استشار', // استشارة
  'خصوصي', // خصوصية
  'سياس', // سياسة
  'اتفاقي', // اتفاقية
  // How it should look.
  'تجاري', // تجارية
  'احترافي', // احترافية
  'بسيط', // بسيطة
  'جميل', // جميلة
  'جديد', // جديدة
  'كبير', // كبيرة
  'صغير', // صغيرة
  'واضح', // واضحة
  'فاتح', // فاتحة
  'غامق', // غامقة
  'ملون', // ملونة
  'متحرك', // متحركة
  'ثابت', // ثابتة
  'عصري', // عصرية
  'فخم', // فخمة
  'أنيق', // أنيقة
  'انيق', // انيقة
  'راقي', // راقية
  'مميز', // مميزة
  'ممتاز', // ممتازة
  'رائع', // رائعة
  'ناعم', // ناعمة
  'عربي', // عربية
  'انجليزي', // انجليزية
  'إنجليزي', // إنجليزية
  'رسمي', // رسمية
  'ترحيبي', // ترحيبية
  'تعريفي', // تعريفية
  'اضافي', // اضافية
  'إضافي', // إضافية
  'مجاني', // مجانية
  'الكتروني', // الكترونية
  'إلكتروني', // إلكترونية
  'تسويقي', // تسويقية
  'تعليمي', // تعليمية
  'طبي', // طبية
  'عقاري', // عقارية
  'سياحي', // سياحية
  'شخصي', // شخصية
  'خاص', // خاصة
];

/** Stems whose bare ه form is also a possessive or an imperative: fixed only after an article. */
const WITH_ARTICLE: readonly string[] = [
  'طريق', // طريقه "his way" / الطريقة
  'خبر', // خبره "his news" / الخبرة
  'تذكر', // تذكره "you remember him" / التذكرة
  'مؤسس', // مؤسسه "its founder" / المؤسسة
  'منظم', // منظمه "its organiser" / المنظمة
  'حديث', // حديثه "his talk" / الحديثة
  'مكتب', // مكتبه "his office" / المكتبة
  'خاتم', // خاتمه "his ring" / الخاتمة
  'كلم', // كلمه "talk to him" / الكلمة
  'ميز', // ميزه "set it apart" / الميزة
  'قيم', // قيمه "his values" / القيمة
  'حال', // حاله "his state" / الحالة
  'دعو', // دعوه "they left him" / الدعوة
  'عام', // عامه "his year" / العامة
  'نسخ', // نسخه "copy it" / النسخة
  'خط', // خطه "his handwriting" / الخطة
  'قص', // قصه "cut it" / القصة
  'نسب', // نسبه "his lineage" / النسبة
  'حمل', // حمله "carried it" / الحملة
  'ترجم', // ترجمه "translate it" / الترجمة
  'كتاب', // كتابه "his book" / الكتابة
  'مقال', // مقاله "his article" / المقالة
  'برمج', // برمجه "program it" / البرمجة
  'مساعد', // مساعده "his assistant" / المساعدة
  'دور', // دوره "his role" / الدورة
  'سن', // سنه "his tooth" / السنة
  'مد', // مده "extend it" / المدة
  'خان', // خانه "betrayed him" / الخانة
  'تجرب', // تجربه "you try it" / التجربة
];

/** Longest first, so an alternation never settles for a shorter stem inside a longer one. */
function alternation(stems: readonly string[]): string {
  return [...stems].sort((a, b) => b.length - a.length).join('|');
}

/** A word edge in Arabic text: no letter, mark or digit on that side. */
const BEFORE = '(?<![\\p{L}\\p{M}\\p{N}])';
const AFTER = '(?![\\p{L}\\p{M}\\p{N}])';
/** The article with the prefixes it takes: ال، وال، بال، فال، كال، لل، ولل، فلل. */
const ARTICLE = '(?:[وبفك]?ال|[وف]?لل)';

const ALWAYS_ENDING = new RegExp(`${BEFORE}(${ARTICLE}?)(${alternation(ALWAYS)})ه${AFTER}`, 'gu');
const ARTICLE_ENDING = new RegExp(
  `${BEFORE}(${ARTICLE})(${alternation(WITH_ARTICLE)})ه${AFTER}`,
  'gu',
);

/**
 * «ال صفحه» → «الصفحه»: the article (or لل) typed as its own word before an
 * Arabic word. Never across a line break, and never onto a word that already
 * has an article («ال الصفحة» is left for a person to read).
 */
const SPLIT_ARTICLE = new RegExp(`${BEFORE}(ال|لل) (?=[\\u0621-\\u064a])(?!ال)`, 'gu');

/** Links, e-mail addresses and quoted copy: never rewritten. */
const PROTECTED = /(https?:\/\/\S+|www\.\S+|[^\s@«»"“”]+@[^\s@]+\.[^\s@]+|«[^»]*»|"[^"]*"|“[^”]*”)/iu;

/** One kind of fix, for a note to the person about what changed. */
export type TidyFix = 'spacing' | 'article' | 'word-ending' | 'punctuation';

/** The tidied text and which kinds of fix it took, in the order they were applied. */
export interface TidiedRequest {
  readonly text: string;
  readonly fixes: readonly TidyFix[];
}

/** Horizontal whitespace: tabs, no-break spaces and the typographic spaces, not line breaks. */
const HORIZONTAL_SPACE = /[\t\v\f    -   　]+/gu;

function normalizeSpacing(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(HORIZONTAL_SPACE, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** Rewrites that apply only OUTSIDE the protected spans. */
interface SegmentRule {
  readonly fix: TidyFix;
  readonly apply: (segment: string) => string;
}

/*
  In this order so that tidying twice changes nothing: a mark is collapsed
  before the spaces around it are judged («a !!» → «a !» → «a!»), and the
  space AFTER a mark is added before the space BEFORE it is removed
  («a ،b» → «a ، b» → «a، b»). The other way round, each left work for a
  second pass.
*/
const SEGMENT_RULES: readonly SegmentRule[] = [
  {
    // "!!!" → "!", «؟؟» → «؟», "...." → "..."; mixed "?!" is left as typed.
    fix: 'punctuation',
    apply: (segment) => segment.replace(/([!?؟،,؛])\1+/gu, '$1').replace(/\.{4,}/gu, '...'),
  },
  {
    // «مطعم،مقهى» → «مطعم، مقهى»; a Latin comma only before a LETTER, so
    // "1,500" stays a number.
    fix: 'spacing',
    apply: (segment) =>
      segment.replace(/([،؛؟])(?=[\p{L}\p{N}])/gu, '$1 ').replace(/,(?=\p{L})/gu, ', '),
  },
  {
    // «مرحبا ، كيف» → «مرحبا، كيف»; only before a mark that ends a clause, so
    // ".NET" and an ellipsis after a space keep their space.
    fix: 'spacing',
    apply: (segment) => segment.replace(/ +([,،؛؟!?.:;])(?=\s|$)/gu, '$1'),
  },
  { fix: 'article', apply: (segment) => segment.replace(SPLIT_ARTICLE, '$1') },
  {
    fix: 'word-ending',
    apply: (segment) => segment.replace(ALWAYS_ENDING, '$1$2ة').replace(ARTICLE_ENDING, '$1$2ة'),
  },
];

/**
 * Tidy a typed request and say which kinds of fix it took. Pure and
 * idempotent: tidying the result again changes nothing.
 */
export function tidyRequest(text: string): TidiedRequest {
  const fixes = new Set<TidyFix>();
  const spaced = normalizeSpacing(text);
  if (spaced !== text.trim()) fixes.add('spacing');

  // `split` with a capturing group puts each protected span at an odd index.
  const parts = spaced.split(PROTECTED);
  for (const rule of SEGMENT_RULES) {
    for (let index = 0; index < parts.length; index += 2) {
      const before = parts[index] ?? '';
      const after = rule.apply(before);
      if (after !== before) {
        parts[index] = after;
        fixes.add(rule.fix);
      }
    }
  }
  return { text: parts.join(''), fixes: [...fixes] };
}

/**
 * The tidied text alone: spacing, «ال صفحه» → «الصفحة», the listed ه/ة
 * endings, and repeated punctuation — never a change of meaning.
 */
export function tidyRequestText(text: string): string {
  return tidyRequest(text).text;
}
