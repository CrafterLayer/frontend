/**
 * Starter skills (2026-10-12): a short gallery of skills a person adds in one press and then
 * makes their own. Each is an ordinary draft — word-triggered, small enough to sit beside the
 * built-ins — in the panel's language. They teach what a good skill looks like as much as
 * they help: a name, when it applies, and concrete, checkable instructions.
 */
import type { Locale } from './view-types';
import type { UserSkillDraft } from './user-skills';

export interface SkillTemplate {
  readonly id: string;
  readonly draft: UserSkillDraft;
}

const EN: readonly SkillTemplate[] = [
  {
    id: 'accessible',
    draft: {
      name: 'Accessible by default',
      description: 'Every page and section',
      instructions:
        'Meet WCAG 2.2 AA. Text contrast at least 4.5:1 (3:1 for large text). Every image gets alt text that says what it shows, or an empty alt when it is decoration. One h1 per page, headings in order. Buttons and links say what happens ("Book a table", never "Click here"). Touch targets at least 44px. Never convey meaning by colour alone.',
      keywords: ['accessible', 'accessibility', 'a11y', 'contrast', 'screen reader'],
      mode: 'auto',
    },
  },
  {
    id: 'seo',
    draft: {
      name: 'Search-ready pages',
      description: 'Titles, descriptions and headings that rank',
      instructions:
        'Give every page a unique title under 60 characters with the main keyword first, and a meta description of 140 to 160 characters that ends with a reason to click. Use the keyword in the h1 and once in the first paragraph. Write descriptive image alt text. Prefer real words in addresses (/menu, not /page-2).',
      keywords: ['seo', 'search', 'google', 'rank', 'meta'],
      mode: 'auto',
    },
  },
  {
    id: 'conversion',
    draft: {
      name: 'Conversion copy',
      description: 'Landing pages that turn visitors into customers',
      instructions:
        'Lead with the outcome the visitor wants, not the product. One primary call to action per section, repeated at the end. Put proof (numbers, reviews, logos) right after the first claim. Answer the top three objections before the final call to action. Short paragraphs, concrete numbers, no jargon.',
      keywords: ['landing', 'conversion', 'sales', 'cta', 'sign up'],
      mode: 'auto',
    },
  },
  {
    id: 'data',
    draft: {
      name: 'Data storyteller',
      description: 'Tables and charts that make a point',
      instructions:
        'Show numbers with a Chart or a Table block, never as a wall of text. Pick the chart by the question: change over time is a line or area, comparing items is a bar, parts of a whole (at most five slices) is a donut. Give every chart a title that states the finding ("Bookings doubled since March"), label units, and keep a table for exact values.',
      keywords: ['chart', 'graph', 'table', 'data', 'statistics', 'dashboard'],
      mode: 'auto',
    },
  },
  {
    id: 'luxury',
    draft: {
      name: 'Quiet luxury',
      description: 'Premium, minimal design',
      instructions:
        'Generous white space, at most two typefaces (a refined serif for headings), a restrained palette of one deep colour and neutrals. Large photography, few words. No badges, no exclamation marks, no more than one call to action per screen.',
      keywords: ['luxury', 'premium', 'elegant', 'minimal', 'boutique'],
      mode: 'auto',
    },
  },
  {
    id: 'game',
    draft: {
      name: 'Game designer',
      description: 'Playable scenes and stories',
      instructions:
        'Start with the core loop in one sentence (what the player does again and again). Give the player a goal, a challenge and feedback within ten seconds. Keep controls to arrows and one action key, and show them on screen. Every level teaches one new idea. Celebrate wins with sound and motion.',
      keywords: ['game', 'level', 'player', 'story', 'quest'],
      mode: 'auto',
    },
  },
];

const AR: readonly SkillTemplate[] = [
  {
    id: 'accessible',
    draft: {
      name: 'إتاحة افتراضية',
      description: 'كل صفحة وكل قسم',
      instructions:
        'التزم بمعيار WCAG 2.2 AA. تباين النص 4.5:1 على الأقل. لكل صورة نص بديل يصف ما تُظهره، أو نص فارغ إن كانت زخرفة. عنوان h1 واحد لكل صفحة والعناوين بالترتيب. الأزرار تقول ما سيحدث («احجز طاولة» لا «اضغط هنا»). أهداف اللمس 44px على الأقل. لا تعتمد على اللون وحده لإيصال المعنى.',
      keywords: ['إتاحة', 'وصول', 'تباين', 'قارئ الشاشة', 'accessible'],
      mode: 'auto',
    },
  },
  {
    id: 'seo',
    draft: {
      name: 'صفحات جاهزة للبحث',
      description: 'عناوين وأوصاف تتصدّر النتائج',
      instructions:
        'لكل صفحة عنوان فريد دون 60 حرفًا تبدأ بالكلمة المفتاحية، ووصف بين 140 و160 حرفًا ينتهي بسبب للنقر. ضع الكلمة المفتاحية في العنوان h1 ومرة في الفقرة الأولى. اكتب نصًا بديلًا وصفيًا للصور. فضّل كلمات حقيقية في العناوين (/menu لا /page-2).',
      keywords: ['سيو', 'محركات البحث', 'بحث', 'جوجل', 'seo'],
      mode: 'auto',
    },
  },
  {
    id: 'conversion',
    draft: {
      name: 'نصوص تحويل',
      description: 'صفحات هبوط تحوّل الزوار إلى عملاء',
      instructions:
        'ابدأ بالنتيجة التي يريدها الزائر لا بالمنتج. دعوة رئيسية واحدة لكل قسم وتتكرر في النهاية. ضع الدليل (أرقام، آراء، شعارات) بعد أول ادعاء مباشرة. أجب عن أهم ثلاثة اعتراضات قبل الدعوة الأخيرة. فقرات قصيرة وأرقام محددة وبلا مصطلحات معقدة.',
      keywords: ['صفحة هبوط', 'تحويل', 'مبيعات', 'تسجيل', 'landing'],
      mode: 'auto',
    },
  },
  {
    id: 'data',
    draft: {
      name: 'راوي البيانات',
      description: 'جداول ومخططات توصل فكرة',
      instructions:
        'اعرض الأرقام في مخطط بياني أو جدول، لا في كتلة نص. اختر المخطط حسب السؤال: التغيّر عبر الزمن خطي أو مساحي، والمقارنة أعمدة، وأجزاء الكل (خمسة أجزاء على الأكثر) دائري مجوّف. اجعل عنوان المخطط يقول النتيجة («تضاعفت الحجوزات منذ مارس»)، واذكر الوحدات، واحتفظ بجدول للقيم الدقيقة.',
      keywords: ['مخطط', 'رسم بياني', 'جدول', 'بيانات', 'إحصائيات', 'لوحة'],
      mode: 'auto',
    },
  },
  {
    id: 'luxury',
    draft: {
      name: 'فخامة هادئة',
      description: 'تصميم راقٍ وبسيط',
      instructions:
        'مساحات بيضاء واسعة، وخطّان على الأكثر، ولوحة ألوان محدودة من لون عميق واحد وألوان محايدة. صور كبيرة وكلمات قليلة. بلا شارات ولا علامات تعجب، ودعوة واحدة على الأكثر في كل شاشة.',
      keywords: ['فخم', 'فاخر', 'راقٍ', 'بسيط', 'بوتيك'],
      mode: 'auto',
    },
  },
  {
    id: 'game',
    draft: {
      name: 'مصمم ألعاب',
      description: 'مشاهد وقصص قابلة للعب',
      instructions:
        'ابدأ بالحلقة الأساسية في جملة واحدة (ما يفعله اللاعب مرة بعد مرة). أعطِ اللاعب هدفًا وتحديًا وردّ فعل خلال عشر ثوانٍ. اجعل التحكم بالأسهم ومفتاح واحد واعرضه على الشاشة. كل مستوى يعلّم فكرة جديدة واحدة. احتفل بالفوز بصوت وحركة.',
      keywords: ['لعبة', 'مستوى', 'لاعب', 'قصة', 'مغامرة'],
      mode: 'auto',
    },
  },
];

export function skillTemplates(locale: Locale): readonly SkillTemplate[] {
  return locale === 'ar' ? AR : EN;
}
