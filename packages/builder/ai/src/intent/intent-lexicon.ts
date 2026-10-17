/**
 * The words the intent router reads, in both languages, ALREADY FOLDED.
 *
 * Every Arabic entry here is written the way `normalizeArabic` leaves it —
 * ه for ة, bare ا for أ/إ/آ, ي for ى — because the router only ever compares
 * folded text with folded text. An entry written with a taa marbuta would be a
 * rule that can never fire, and nothing would say so; the lexicon test checks
 * every entry is its own fold for exactly that reason.
 *
 * Arabic nouns are listed BARE. The clitics a real sentence glues on — و "and",
 * ال "the", ل "for", ب "with", ي "my" — are peeled by the tokenizer
 * (`intent-tokens.ts`), which also records whether the reading it found was
 * definite. Verbs are the exception: their prefixes and suffixes are part of
 * the form ("تسويلي", "you make for me"), so each verb is one pattern.
 *
 * The lists are deliberately short and concrete. A router that knew every word
 * would be a language model; this one knows the words that decide the five
 * outcomes, and the table test is the proof of what it covers.
 */

/** What a noun names, which decides what a request is asking for. */
export type NounCategory = 'site' | 'page' | 'section' | 'element';

function entries(category: NounCategory, words: readonly string[]): [string, NounCategory][] {
  return words.map((word) => [word, category]);
}

/*
  PAGE-LEVEL nouns. "site" nouns are the ones that can hold several pages —
  they are what turns "with about and services pages" into a site.
*/
const SITE_EN = [
  'website',
  'websites',
  'site',
  'sites',
  'microsite',
  'webshop',
  'store',
  'shop',
  'storefront',
  'ecommerce',
  'commerce',
  'blog',
];
const PAGE_EN = [
  'page',
  'pages',
  'webpage',
  'homepage',
  'landing',
  'pager',
  'onepager',
  'portfolio',
  'resume',
  'cv',
  'invitation',
  'invite',
];
/* SECTIONS: a region of a page, named as such or by what it is for. */
const SECTION_EN = [
  'section',
  'sections',
  'band',
  'block',
  'blocks',
  'pricing',
  'testimonials',
  'faq',
  'faqs',
  'features',
  'gallery',
  'team',
  'stats',
  'statistics',
  'newsletter',
  'timeline',
  'partners',
  'logos',
  'clients',
  'reviews',
  'hero',
  'cta',
  'footer',
  'header',
  'navbar',
  'nav',
  'navigation',
  'sidebar',
  'menu',
  'banner',
  'carousel',
  'slider',
  'countdown',
  'schedule',
  'agenda',
  'rsvp',
];
/* ELEMENTS: the parts a section is made of. Naming one is never a page ask. */
const ELEMENT_EN = [
  'button',
  'buttons',
  'btn',
  'link',
  'links',
  'tab',
  'tabs',
  'dropdown',
  'image',
  'images',
  'photo',
  'photos',
  'picture',
  'pictures',
  'img',
  'logo',
  'icon',
  'icons',
  'title',
  'heading',
  'headline',
  'subtitle',
  'subheading',
  'text',
  'paragraph',
  'copy',
  'font',
  'fonts',
  'color',
  'colour',
  'colors',
  'colours',
  'background',
  'spacing',
  'padding',
  'margin',
  'border',
  'shadow',
  'card',
  'cards',
  'form',
  'field',
  'input',
  'video',
  'table',
  'list',
  'column',
  'columns',
  'row',
  'grid',
  'date',
  'time',
  'price',
  'prices',
  'label',
  'caption',
  'quote',
  'badge',
  'divider',
  'animation',
  'map',
  // "Add a page break" asks for a break; read as a page it built one (wave-1 verifier).
  'break',
  'breaks',
];

const SITE_AR = ['موقع', 'مواقع', 'ويبسايت', 'سايت', 'متجر', 'مدونه'];
const PAGE_AR = [
  'صفحه',
  'صفحات',
  'لاندنج',
  'لاندينج',
  'لاندنغ',
  'لاندينغ',
  'لاندينق',
  'بيج',
  'دعوه',
  'سيره',
  'بورتفوليو',
  'بروفايل',
];
const SECTION_AR = [
  'قسم',
  'اقسام',
  'سكشن',
  'سيكشن',
  'جزء',
  'بلوك',
  'اسعار',
  'باقات',
  'اراء',
  'تقييمات',
  'شهادات',
  'اسئله',
  'مميزات',
  'ميزات',
  'معرض',
  'فريق',
  'احصائيات',
  'نشره',
  'هيرو',
  'هيدر',
  'فوتر',
  'ترويسه',
  'تذييل',
  'بانر',
  /*
    What a nav is called: "قائمة" (a menu, a list) and "شريط" (a bar). Unknown,
    "أضف قائمة فيها روابط لصفحات من نحن والخدمات" had no object at all, and its
    link targets were read as two pages to make (wave-1 verifier, 2026-09-28).
    "قائمة طعام" stays the menu PAGE's name: page names read pairs first.
  */
  'قائمه',
  'شريط',
  'منيو',
  'شركاء',
  'عملاء',
  'برنامج',
];
const ELEMENT_AR = [
  'زر',
  'زرار',
  'ازرار',
  'بوتون',
  'رابط',
  'روابط',
  'لينك',
  'صوره',
  'صور',
  'شعار',
  'لوجو',
  'لوغو',
  'ايقونه',
  'ايقونات',
  'عنوان',
  'عناوين',
  'نص',
  'نصوص',
  'فقره',
  'خط',
  'خطوط',
  'لون',
  'الوان',
  'خلفيه',
  'مسافه',
  'مسافات',
  'حواف',
  'ظل',
  'نموذج',
  'فورم',
  'فيديو',
  'جدول',
  'تاريخ',
  'سعر',
  'وقت',
  'موعد',
  'اقتباس',
  'خريطه',
];

export const NOUNS: ReadonlyMap<string, NounCategory> = new Map([
  ...entries('site', SITE_EN),
  ...entries('page', PAGE_EN),
  ...entries('section', SECTION_EN),
  ...entries('element', ELEMENT_EN),
  ...entries('site', SITE_AR),
  ...entries('page', PAGE_AR),
  ...entries('section', SECTION_AR),
  ...entries('element', ELEMENT_AR),
]);

/**
 * Two-word Arabic nouns whose FIRST word alone means something else: a gallery
 * of work is a portfolio, not a gallery section; an invitation card is an
 * invitation, not a card. Checked before the single-word reading.
 */
export const NOUN_PAIRS_AR: readonly (readonly [string, string, NounCategory])[] = [
  ['معرض', 'اعمال', 'page'],
  ['بطاقه', 'دعوه', 'page'],
  ['سيره', 'ذاتيه', 'page'],
  ['صفحه', 'هبوط', 'page'],
  /*
    "دعوة لاتخاذ إجراء" is "call to action": a section. Read as the invitation
    "دعوة" names, "صمم دعوة لاتخاذ إجراء" built a whole page (probed 2026-09-28).
  */
  ['دعوه', 'اتخاذ', 'section'],
];

/** The words that call a part a SECTION outright: "a testimonials SECTION", "قسم أسعار". */
export const SECTION_WORDS: ReadonlySet<string> = new Set([
  'section',
  'sections',
  'band',
  'block',
  'blocks',
  'قسم',
  'اقسام',
  'سكشن',
  'سيكشن',
  'جزء',
  'بلوك',
]);

/** The nouns that count as "a page" when something is ADDED — never a site. */
export const ADDABLE_PAGE_NOUNS: ReadonlySet<string> = new Set([
  'page',
  'pages',
  'webpage',
  'landing',
  'صفحه',
  'صفحات',
]);

/** The plural page nouns: "pages" is how a request asks for more than one. */
export const PLURAL_PAGE_NOUNS: ReadonlySet<string> = new Set(['pages', 'صفحات']);
/** Every page noun, singular or plural — "an about page" names a page. */
export const PAGE_WORDS: ReadonlySet<string> = new Set(['page', 'pages', 'صفحه', 'صفحات']);

/*
  PAGE NAMES — what a site's pages are called. Counted DISTINCT, so "about us"
  and "about" are one page. Several of them beside a page word make a site.
*/
export const PAGE_NAMES_EN: ReadonlyMap<string, string> = new Map([
  ['home', 'home'],
  ['homepage', 'home'],
  ['about', 'about'],
  ['services', 'services'],
  ['service', 'services'],
  ['contact', 'contact'],
  ['blog', 'blog'],
  ['pricing', 'pricing'],
  ['team', 'team'],
  ['portfolio', 'portfolio'],
  ['work', 'portfolio'],
  ['projects', 'portfolio'],
  ['gallery', 'gallery'],
  ['faq', 'faq'],
  ['careers', 'careers'],
  ['jobs', 'careers'],
  ['shop', 'shop'],
  ['products', 'shop'],
  ['menu', 'menu'],
  ['testimonials', 'testimonials'],
  ['news', 'news'],
  ['events', 'events'],
  ['booking', 'booking'],
]);
export const PAGE_NAMES_AR: ReadonlyMap<string, string> = new Map([
  ['رئيسيه', 'home'],
  ['عنا', 'about'],
  ['خدمات', 'services'],
  ['خدماتنا', 'services'],
  ['تواصل', 'contact'],
  ['اتصال', 'contact'],
  ['مدونه', 'blog'],
  ['اسعار', 'pricing'],
  ['فريق', 'team'],
  ['اعمال', 'portfolio'],
  ['اعمالنا', 'portfolio'],
  ['منتجات', 'shop'],
  ['معرض', 'gallery'],
  ['وظائف', 'careers'],
  ['اخبار', 'news'],
  ['حجز', 'booking'],
  ['منيو', 'menu'],
]);
/** Two-word page names: "من نحن" is "about us", and neither word alone is. */
export const PAGE_NAME_PAIRS_AR: readonly (readonly [string, string, string])[] = [
  ['من', 'نحن', 'about'],
  ['اتصل', 'بنا', 'contact'],
  ['قائمه', 'طعام', 'menu'],
];

/** The kind of verb, which decides what its object is being asked for. */
export type VerbKind =
  /** Makes something new: build, design, سوي, صمم. */
  | 'create'
  /** Asks for something to exist: need, want, بدي, اريد. */
  | 'want'
  /** "Make" — creation with a new object, an edit with a known one. */
  | 'make'
  /** Adds something to what exists: add, insert, اضف, ضيف. */
  | 'add'
  /** Changes what exists: change, fix, translate, غير, عدل. */
  | 'edit';

export const VERBS_EN: ReadonlyMap<string, VerbKind> = new Map([
  ...(
    [
      'build',
      'create',
      'design',
      'generate',
      'craft',
      'develop',
      'produce',
      'draft',
      'prototype',
      'launch',
      'start',
      'setup',
      'code',
      'give',
      'get',
    ] as const
  ).map((word): [string, VerbKind] => [word, 'create']),
  /*
    The third person asks as surely as the first: "my bakery NEEDS a website"
    is a page ask, and read as no verb at all it fell through to an edit
    (probed 2026-09-28). "Needs" stays a copula below too — "the page needs
    work" still says nothing is being named as a page.
  */
  ...(
    ['need', 'needs', 'want', 'wants', 'require', 'requires', "i'd", 'would', 'looking'] as const
  ).map((word): [string, VerbKind] => [word, 'want']),
  ['make', 'make'],
  // "How about MAKING the button blue?" — the suggestion form of the same verb.
  ['making', 'make'],
  ...(['add', 'insert', 'append', 'include', 'put', 'attach', 'embed', 'place'] as const).map(
    (word): [string, VerbKind] => [word, 'add'],
  ),
  ...(
    [
      'change',
      'update',
      'edit',
      'modify',
      'fix',
      'adjust',
      'tweak',
      'replace',
      'remove',
      'delete',
      'move',
      'translate',
      'rename',
      'rewrite',
      'reword',
      'retitle',
      'shorten',
      'shrink',
      'enlarge',
      'swap',
      'set',
      'turn',
      'recolor',
      'recolour',
      'restyle',
      'style',
      'improve',
      'polish',
      'correct',
      'align',
      'center',
      'centre',
      'increase',
      'decrease',
      'reduce',
      'darken',
      'lighten',
      'hide',
      'fill',
      'write',
      'use',
      'apply',
      'refine',
      'simplify',
      'redo',
      'rebuild',
      'redesign',
      'remake',
      'duplicate',
      'clone',
      /*
        Imperatives that change how what exists is SHOWN. Unknown, a request
        opening with one read as a page's name — "show new pages in the nav"
        built a page (probed 2026-09-28). Words that are nouns as often as
        verbs ("link", "list", "order") are left out: an edit verb inside
        "a landing page with a link to my shop" would read as a change.
      */
      'show',
      'display',
      // "What if the hero SAID Welcome home?" — what a part says is its text.
      'say',
      'says',
      'said',
      'highlight',
      'emphasize',
      'emphasise',
      'sort',
      'reorder',
      'collapse',
      'expand',
      'enable',
      'disable',
      'bold',
      'underline',
      'italicize',
      'capitalize',
      'animate',
      'resize',
      'crop',
      'rotate',
      'pin',
      'unpin',
      /*
        LINKING changes what exists — the nav, a button, the links between
        pages — and never makes a page (final test, 2026-09-29). "Link" is a
        noun as often, so it is a verb only where a request's verb stands
        (`LEADING_VERBS_EN`); these never name a part.
      */
      'connect',
      'interlink',
      'relink',
      'unlink',
    ] as const
  ).map((word): [string, VerbKind] => [word, 'edit']),
]);

/**
 * Words that are a verb only where a request's verb stands — first, or first
 * after a break: "LINK this page to the home page", "…. link it in the nav".
 * Anywhere else they are the noun: "a landing page with a LINK to my shop"
 * names a part of the page asked for, and read as an edit there it would turn
 * the page ask into a change (see the note on `VERBS_EN`).
 */
export const LEADING_VERBS_EN: ReadonlyMap<string, VerbKind> = new Map([
  ['link', 'edit'],
  ['hyperlink', 'edit'],
  /*
    "Can you DO a landing page for my gym?" — "do" makes what it names where a
    request's verb stands; elsewhere it is an auxiliary ("how do I…", "I don't
    …"), and "do you" / "do I" open questions before any verb is read.
  */
  ['do', 'create'],
]);

/*
  ARABIC VERBS, one pattern per verb, over a FOLDED token. Every pattern takes
  an optional leading و/ف ("and", "so"), the imperfect prefixes ت/ي/ن where
  the verb has them ("تسوي", "you make"), and the object suffixes a request
  glues on ("لي", "لنا" — "for me", "for us").
*/
const VERB_SUFFIX = '(?:ي|و|وا|ين|لي|للي|لنا|ها|ه|هم)?';
const verb = (stem: string, prefixes = '(?:ا|ت|ي|ن)?'): RegExp =>
  new RegExp(`^[وف]?${prefixes}${stem}${VERB_SUFFIX}$`, 'u');

export const VERBS_AR: readonly (readonly [RegExp, VerbKind])[] = [
  [verb('سو(?:ي|و)', '(?:ت|ي|ن)?'), 'create'],
  [verb('عمل'), 'create'],
  [verb('صمم', '(?:ت|ي|ن)?'), 'create'],
  [verb('نش(?:ئ|ي|ء)'), 'create'],
  [/^[وف]?(?:ب|ل)?(?:ال)?انشاء$/u, 'create'],
  [verb('بني', '(?:ا|ت|ي|ن)'), 'create'],
  [/^[وف]?(?:ب|ل)?(?:ال)?بناء$/u, 'create'],
  [verb('جهز', '(?:ت|ي|ن)?'), 'create'],
  [verb('صنع', '(?:ا|ت|ي|ن)'), 'create'],
  [/^[وف]?(?:ب|ل)?(?:ال)?توليد$/u, 'create'],
  // "ابدأ", and "we / you start" ("خلينا نبدأ من جديد", "لازم تبدأ من الصفر").
  [/^[وف]?(?:ا|ت|ن)بدا$/u, 'create'],
  [/^[وف]?بد(?:ي|نا|ك|يش)$/u, 'want'],
  [/^[وف]?(?:ا|ن)ريد(?:ه|ها)?$/u, 'want'],
  [/^[وف]?(?:ا|ن)بغ(?:ي|ا)$/u, 'want'],
  [/^[وف]?(?:ا|ن)بي$/u, 'want'],
  [/^[وف]?عا(?:ي|و)ز(?:ه|ين)?$/u, 'want'],
  [/^[وف]?حاب(?:ب|ه|ين)$/u, 'want'],
  [/^[وف]?(?:ا|ن|م)?حتاج(?:ين|ه)?$/u, 'want'],
  // "Give me", and after «هل تقدر» / «ممكن» the second person's «تعطيني».
  [/^[وف]?(?:ا|ت)?عط(?:ي)?(?:ني|نا)$/u, 'want'],
  [verb('جعل'), 'make'],
  [/^[وف]?خل(?:ي|يها|يه|يلي)$/u, 'make'],
  [verb('ضي?ف'), 'add'],
  [/^[وف]?(?:ب|ل)?(?:ال)?اضاف(?:ه)?$/u, 'add'],
  [verb('ز(?:ي|و)د', '(?:ت|ي|ن)?'), 'add'],
  [/^[وف]?ضع(?:ي|و)?$/u, 'add'],
  [verb('حط', '(?:ت|ي|ن)?'), 'add'],
  [verb('درج'), 'add'],
  [verb('غير', '(?:ت|ي|ن)?'), 'edit'],
  [verb('عدل', '(?:ت|ي|ن)?'), 'edit'],
  [verb('صحح', '(?:ت|ي|ن)?'), 'edit'],
  [verb('صلح', '(?:ا|ت|ي|ن)'), 'edit'],
  [verb('بدل', '(?:ت|ي|ن)?'), 'edit'],
  [verb('حذف', '(?:ا|ت|ي|ن)'), 'edit'],
  [verb('مسح', '(?:ا|ت|ي|ن)'), 'edit'],
  [verb('شيل', '(?:ت|ي|ن)?'), 'edit'],
  [verb('نقل', '(?:ا|ت|ي|ن)'), 'edit'],
  [verb('حرك', '(?:ت|ي|ن)?'), 'edit'],
  [verb('ترجم', '(?:ت|ي|ن)?'), 'edit'],
  [verb('(?:كبر|صغر)', '(?:ت|ي|ن)?'), 'edit'],
  [verb('كتب', '(?:ا|ت|ي|ن)'), 'edit'],
  [/^[وف]?اعد$/u, 'edit'],
  [/^[وف]?(?:ب|ل)?اعاده$/u, 'edit'],
  [verb('جرب', '(?:ت|ي|ن)?'), 'edit'],
  /*
    "Link": «اربط الصفحة بالقائمة», «هل يمكنك تربط الصفحة…», and MSA's «ربط
    صفحة التواصل بالفوتر». Unknown, the owner's «هل يمكنك تربط ال صفحه هاي
    داخل عليها» read «صفحه» as a page to build, at 0.8 on an empty page (final
    test, 2026-09-29).
  */
  [verb('ربط'), 'edit'],
];

/** Two-word English verbs whose first word alone means something else: "set up". */
export const VERB_PAIRS_EN: readonly (readonly [string, string, VerbKind])[] = [
  // "Get" alone makes ("get me a site"); "get rid of" removes.
  ['get', 'rid', 'edit'],
  ['set', 'up', 'create'],
  ['put', 'together', 'create'],
  ['mock', 'up', 'create'],
  ['spin', 'up', 'create'],
  ['whip', 'up', 'create'],
];

/**
 * The words between a verb and what it is asked to make — "build ME a site",
 * "I'd LIKE a page", "looking FOR a site", "سوي LI موقع". Skipped only right
 * after the verb, so a "for" later in the sentence still ends the phrase.
 */
export const OBJECT_FILLERS: ReadonlySet<string> = new Set([
  'me',
  'us',
  'up',
  'out',
  'together',
  'just',
  'quickly',
  'please',
  'like',
  'for',
  'to',
  'have',
  'لي',
  'لنا',
  'معي',
  'واحد',
  'وحده',
]);

/** The words that end a noun phrase: prepositions, conjunctions, relatives. */
export const PHRASE_STOPS: ReadonlySet<string> = new Set([
  'to',
  'on',
  'in',
  'into',
  'onto',
  'under',
  'above',
  'below',
  'after',
  'before',
  'for',
  'with',
  'at',
  'about',
  'of',
  'from',
  'by',
  'that',
  'which',
  'so',
  'and',
  'or',
  'then',
  'like',
  'but',
  'where',
  'using',
  'without',
  'called',
  'named',
  'في',
  'علي',
  'الي',
  'تحت',
  'فوق',
  'بعد',
  'قبل',
  'مع',
  'عن',
  'من',
  'عشان',
  'لاجل',
  'حتي',
  'او',
  'ثم',
  'بس',
  'فيه',
  'فيها',
  'بدون',
  'اسمه',
  'اسمها',
  'زي',
  'مثل',
]);

export const DEFINITE_EN: ReadonlySet<string> = new Set([
  'the',
  'this',
  'that',
  'these',
  'those',
  'my',
  'our',
  'your',
  'his',
  'her',
  'their',
  'its',
  'all',
  'every',
  'each',
]);
export const INDEFINITE_EN: ReadonlySet<string> = new Set([
  'a',
  'an',
  'one',
  'new',
  'another',
  'some',
  'any',
]);
/** Arabic demonstratives make the noun after them definite, like "this page". */
export const DEFINITE_AR: ReadonlySet<string> = new Set(['هذا', 'هذه', 'هذي', 'هاد', 'هاي']);

/** Words asking for something ELSE of the same kind: "a new page", "صفحه جديده". */
export const NEW_WORDS_EN: ReadonlySet<string> = new Set([
  'new',
  'another',
  'separate',
  'second',
  'extra',
  'additional',
  'fresh',
]);
export const NEW_WORDS_AR: ReadonlySet<string> = new Set([
  'جديده',
  'جديد',
  'ثانيه',
  'تانيه',
  'اخري',
  'اخر',
  'منفصله',
  'اضافيه',
]);

/** The comparatives of an edit: "darker", "أغمق". Nothing new is darker. */
export const COMPARATIVES: ReadonlySet<string> = new Set([
  'darker',
  'lighter',
  'brighter',
  'bigger',
  'smaller',
  'larger',
  'wider',
  'narrower',
  'taller',
  'shorter',
  'bolder',
  'thinner',
  'cleaner',
  'simpler',
  'calmer',
  'warmer',
  'cooler',
  'softer',
  'stronger',
  'tighter',
  'looser',
  'more',
  'less',
  'better',
  'nicer',
  'prettier',
  'اغمق',
  'افتح',
  'افخم',
  'اكبر',
  'اصغر',
  'احلي',
  'اجمل',
  'اوضح',
  'ابسط',
  'اعرض',
  'اضيق',
  'اقوي',
  'احسن',
  'افضل',
  'اخف',
  'اهدي',
]);

/** A statement about what exists: "the page IS slow", "the hero LOOKS off". */
export const COPULAS: ReadonlySet<string> = new Set([
  'is',
  'are',
  'was',
  'were',
  'looks',
  'look',
  'seems',
  'feels',
  'has',
  'have',
  "isn't",
  "doesn't",
  "don't",
  'needs',
  'should',
  'يبدو',
  'شكلها',
  'شكله',
  'صار',
  'صارت',
  'كان',
  'كانت',
]);

/*
  QUESTIONS — the first word of the request (after any courtesy) decides it.
  "What" and "how" open a question whatever follows; a polite "can you" does
  not, which is why courtesy is stripped before this is read.
*/
export const INTERROGATIVES: ReadonlySet<string> = new Set([
  'how',
  'what',
  "what's",
  'whats',
  'why',
  'which',
  'where',
  'when',
  'who',
  'whose',
  'is',
  'are',
  "isn't",
  'does',
  'did',
  'should',
  'explain',
  'كيف',
  'كيفيه',
  'ليش',
  'ليه',
  'لماذا',
  'ماذا',
  'شو',
  'ايش',
  'وش',
  'وين',
  'اين',
  'متي',
  'مين',
  'هل',
  'كم',
  'قديش',
  'اشلون',
  'شلون',
  'ازاي',
  'اشرح',
  'شرح',
  'وضح',
  'فسر',
  /*
    Asking for an ANSWER in words — a summary, a description, a critique. On
    an empty page each of these used to be read as the brief for a whole page
    (probed 2026-09-28: "لخص الصفحة", "ممكن تشرح لي الصفحة؟" both built one).
    The second-person forms are here because courtesy is stripped first:
    "ممكن تشرح…" reaches this list as "تشرح…".
  */
  'summarize',
  'summarise',
  'describe',
  'critique',
  'evaluate',
  'assess',
  'تشرح',
  'تشرحي',
  'تشرحلي',
  'اشرحلي',
  'يشرح',
  'توضح',
  'توضحلي',
  'وضحلي',
  'لخص',
  'تلخص',
  'لخصلي',
]);
/** Two-word openings that ask rather than instruct: "do you", "can I", "ما هو". */
export const INTERROGATIVE_PAIRS: readonly (readonly [string, string])[] = [
  ['do', 'you'],
  ['do', 'i'],
  ['do', 'we'],
  ['can', 'i'],
  ['could', 'i'],
  ['should', 'i'],
  ['may', 'i'],
  ['tell', 'me'],
  ['ما', 'هو'],
  ['ما', 'هي'],
  ['ما', 'هذا'],
  ['ما', 'هذه'],
  ['ما', 'الفرق'],
  ['ما', 'معني'],
];

/**
 * Openings that SUGGEST rather than ask: "how about…", "why not…", "ليش ما
 * تضيف…" ("why don't you add…"), "شو رأيك…" ("what do you think of…"). Each
 * opens with a question word, and read as one they were answered in words at
 * 0.9 where the person was asking for the change (wave-2 verifier's route
 * probe, 2026-09-28). The router strips one only when what follows asks for
 * something — "why not?" and "ليش ما اشتغل؟" ("why didn't it work?") stay
 * questions — and routes the rest as an idea to weigh, never above 0.7 and
 * never as a build. "Is it possible to…" is not here: it asks what CAN be done
 * (see `OPENERS`, `possibility`). Longest first.
 */
export const SUGGESTION_OPENERS: readonly (readonly string[])[] = [
  ['why', "don't", 'you'],
  ['why', 'dont', 'you'],
  ['why', 'not', 'just'],
  ['how', 'about'],
  ['what', 'about'],
  ['what', 'if'],
  ['why', 'not'],
  ['شو', 'رايك', 'لو'],
  ['ايش', 'رايك', 'لو'],
  ['وش', 'رايك', 'لو'],
  ['ما', 'رايك', 'لو'],
  ['شو', 'رايك'],
  ['ايش', 'رايك'],
  ['وش', 'رايك'],
  ['ما', 'رايك'],
  ['ليش', 'ما'],
  ['ليش', 'لا'],
  ['ليه', 'ما'],
  ['ليه', 'لا'],
  ['لماذا', 'لا'],
];

/**
 * Openings of a CONDITION — "if I delete the hero, will the page break?",
 * "لو حذفت الفوتر، هل ستتعطل الصفحة؟". Alone they say nothing: "if possible,
 * make the hero darker" is an instruction under a condition. Followed by a
 * clause that ASKS ("will…", "هل…", "شو بيصير"), the whole request asks what
 * would happen, and is answered in words.
 */
export const HYPOTHETICAL_OPENERS: readonly (readonly string[])[] = [
  ['what', 'would', 'happen', 'if'],
  ['what', 'happens', 'if'],
  ['in', 'case'],
  ['supposing'],
  ['suppose'],
  ['imagine'],
  ['if'],
  ['ماذا', 'لو'],
  ['شو', 'لو'],
  ['وش', 'لو'],
  ['ايش', 'لو'],
  ['افرض'],
  ['فرضا'],
  ['لو'],
  ['اذا'],
];

/**
 * Words that open a clause ASKING about an outcome: "…, WILL the page break?",
 * "…, WOULD it load slower?", "…، هل ستتعطل الصفحة؟", "…، رح تبطئ؟". The
 * interrogatives count too. After a suggestion or a condition, such a clause
 * makes the request a question about the consequence: "what if I remove the
 * footer, will the page break?" routed edit@0.8 — a write — where wave 1
 * answered it (wave-2 verifier, 2026-09-28). "Can you" / "could you" after the
 * idea still asks the assistant to act, and is not one of these.
 */
export const CONSEQUENCE_AUXILIARIES: ReadonlySet<string> = new Set([
  'will',
  'would',
  'could',
  'can',
  'might',
  'shall',
  "won't",
  "wouldn't",
  "can't",
  "couldn't",
  'رح',
  'راح',
  'حي',
  'سوف',
  'بيصير',
  'بتصير',
  'بيخرب',
  'بتخرب',
]);

/**
 * The person as the subject of the idea: "what if I delete the hero?", "how
 * about I add a map?", "ما رأيك لو أنا…". They are asking about their OWN
 * action — what it would do, whether they should — and a question about the
 * person's action is answered, never performed for them.
 */
export const FIRST_PERSON: ReadonlySet<string> = new Set([
  'i',
  "i'm",
  'im',
  "i'll",
  "i'd",
  "i've",
  'me',
  'myself',
  'انا',
  'اني',
]);

/** The subject a suggestion proposes for — "what if WE changed…", "how about YOU add…" — set aside. */
export const SUGGESTION_SUBJECTS: ReadonlySet<string> = new Set([
  'we',
  'you',
  'u',
  'احنا',
  'نحن',
  'انت',
  'انتي',
]);

/**
 * "There is / was …" after a suggestion proposes that the thing EXIST: "what
 * if there was a contact form?" asks for one to be added. Arabic says it "لو
 * فيه …" / "لو كان في …", only after the "لو" of the opener — elsewhere "في"
 * is "in".
 */
export const EXISTENTIALS_EN: readonly (readonly string[])[] = [
  ['there', 'was'],
  ['there', 'were'],
  ['there', 'is'],
  ['there', 'are'],
  ["there's"],
];
export const EXISTENTIALS_AR: readonly (readonly string[])[] = [
  ['كان', 'فيه'],
  ['كان', 'في'],
  ['يكون', 'فيه'],
  ['يكون', 'في'],
  ['فيه'],
  ['في'],
];

/*
  English pasts that do not end in -ed. A suggestion proposes in the past or
  the gerund — "what if we MADE the hero darker", "how about ADDING a map" —
  and the router reads such a word as its present, but only inside a
  suggestion: elsewhere "made" and "adding" describe, and are left alone.
*/
export const IRREGULAR_PASTS_EN: ReadonlyMap<string, string> = new Map([
  ['made', 'make'],
  ['built', 'build'],
  ['rebuilt', 'rebuild'],
  ['remade', 'remake'],
  ['redid', 'redo'],
  ['wrote', 'write'],
  ['rewrote', 'rewrite'],
  ['gave', 'give'],
  ['got', 'get'],
  ['hid', 'hide'],
]);

/**
 * The endings of the Arabic PAST — "أضفتَ" (you added), "غيّرنا" (we changed),
 * "حطّيتوا" (you all put) — which a suggestion after "لو" proposes in: "ما
 * رأيك لو أضفت قسم أسعار؟". Unread, those routed question@0.75 where "ما رأيك
 * لو تضيف…" routed the section (v1-panel verifier, 2026-09-28). Longest first.
 */
export const PAST_SUFFIXES_AR: readonly string[] = ['توا', 'تو', 'تم', 'تي', 'نا', 'ت'];

/**
 * MSA VERBAL NOUNS of change — "تغيير" (changing), "تعديل" (editing), "حذف"
 * (deleting)… Standard Arabic asks for a change with one: "تغيير عنوان القسم
 * إلى مرحبا", "أريد تعديل سعر القهوة", "الرجاء حذف قسم المنيو". Unread, those
 * had no verb at all, so on an empty page — which is how the skill resolver
 * routes every request today — they were the brief for a whole page and loaded
 * its playbooks: 3,138-3,205 tokens (wave-2 verifier, 2026-09-28). They are
 * nouns as often ("شركة نقل", a moving company; "ترجمة معتمدة", certified
 * translation), so the router reads one as a verb only where a request's verb
 * stands — see `route-intent.ts` `verbalNounsOf`.
 */
export const CHANGE_VERBAL_NOUNS_AR: ReadonlySet<string> = new Set([
  'تغيير',
  'تعديل',
  'حذف',
  'ازاله',
  'استبدال',
  'تبديل',
  'تكبير',
  'تصغير',
  'نقل',
  'تحريك',
  'ترجمه',
  'تصحيح',
  'اصلاح',
  'تحديث',
  'تحسين',
  'مسح',
  'كتابه',
  'اخفاء',
  'تلوين',
  'توسيط',
  'تنسيق',
  'تقليل',
  'زياده',
  'تفتيح',
  'تغميق',
  // «هل يمكن ربط الصفحة بالقائمة؟» — linking, asked of the product (final test, 2026-09-29).
  'ربط',
]);

/** Every verbal noun a request is made with — the change ones, and making and adding. */
export const VERBAL_NOUNS_AR: ReadonlySet<string> = new Set([
  ...CHANGE_VERBAL_NOUNS_AR,
  'انشاء',
  'بناء',
  'توليد',
  'تصميم',
  'عمل',
  'صنع',
  'تجهيز',
  'اضافه',
  'وضع',
  'اعاده',
]);

/**
 * Words before which a verb (or its verbal noun) still stands: "لازم تبدأ",
 * "يجب إعادة تصميم…", "ضروري تغيير…" — must, should, necessary.
 */
export const VERB_GOVERNORS_AR: ReadonlySet<string> = new Set(['لازم', 'يجب', 'ضروري', 'لابد']);

/**
 * "This time", "next time", "هالمرة" — WHEN, not a part: "start over, this
 * time for a bakery" read "time" as the page's time element, aimed the
 * start-over at it, and routed edit@0.8 (wave-2 verifier, 2026-09-28).
 */
export const TIME_ADVERBS: readonly (readonly string[])[] = [
  ['this', 'time'],
  ['next', 'time'],
  ['this', 'round'],
  ['هذه', 'المره'],
  ['هذي', 'المره'],
  ['هاي', 'المره'],
  ['المره', 'هذه'],
  ['المره', 'هذي'],
  ['المره', 'هاي'],
  ['المره', 'الجايه'],
  ['هالمره'],
];

/**
 * The person saying what the business IS, as the clause after a start-over:
 * "rebuild the page — WE'RE a dental clinic now", "start over, WE sell
 * handmade soap", "ابدأ من جديد، احنا صرنا مطعم". Read as nothing, those
 * dropped from a briefed 0.85 to a bare 0.5 (wave-2 verifier, 2026-09-28).
 * They say who, not what, so they are no subject by themselves.
 */
export const IDENTITY_WORDS: ReadonlySet<string> = new Set([
  "we're",
  'we',
  'are',
  "i'm",
  'im',
  'am',
  'احنا',
  'نحن',
  'صرنا',
  'اصبحنا',
  'صرت',
  'اصبحت',
]);

/**
 * Words that JUDGE what exists — "the hero was UGLY", "الألوان كلها غلط". A
 * clause holding one comments on the page; it does not say what the next page
 * is for. Only the words that CONDEMN: the kind ones ("nice", "fine",
 * "حلو") and "like" / "old" name businesses as often ("fine dining", "a site
 * like Airbnb", "Old Town Coffee", "كافيه حلو"), and a brief read as a comment
 * costs the person one question, where a comment read as a brief builds a page
 * nobody described.
 */
export const JUDGMENTS: ReadonlySet<string> = new Set([
  'ugly',
  'bad',
  'terrible',
  'awful',
  'horrible',
  'boring',
  'bland',
  'cluttered',
  'messy',
  'mess',
  'wrong',
  'broken',
  'dated',
  'outdated',
  'slow',
  'weird',
  'meh',
  'hate',
  'hated',
  'dislike',
  'unhappy',
  'sucks',
  'crap',
  'trash',
  'disaster',
  'confusing',
  'tired',
  'bored',
  'too',
  'غلط',
  'خطا',
  'خاطئ',
  'سيء',
  'سيئ',
  'سيئه',
  'وحش',
  'وحشه',
  'بشع',
  'بشعه',
  'قديم',
  'قديمه',
  'خربان',
  'خربانه',
  'زفت',
  'ممل',
  'ممله',
  'مزعج',
  'عاجبني',
  'عجبني',
  'يعجبني',
  'كرهت',
  'مبهدل',
  'مخربط',
  'فاشل',
]);

/**
 * Words that open a clause about the conversation, not a business: "start
 * over, YOU messed up", "start over and DO it properly this time", "…and TRY
 * again", "…، بس …". Before a verbless clause after a start-over, each routed
 * a briefed 0.85 on the words around it (probed 2026-09-28).
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'you',
  'u',
  "you're",
  'he',
  'she',
  'they',
  "they're",
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'would',
  'should',
  'must',
  'might',
  'may',
  'just',
  'only',
  'also',
  'even',
  'very',
  'so',
  'try',
  'go',
  'let',
  'stay',
  'stays',
  'هو',
  'هي',
  'انت',
  'انتي',
  'انتو',
  'هم',
  'يعني',
  'كمان',
  'برضو',
  'لكن',
  'بس',
]);

/** Words that deny: a clause holding one comments on the page ("النص مش واضح"). */
export const NEGATIONS: ReadonlySet<string> = new Set([
  'not',
  'no',
  'never',
  "don't",
  'dont',
  "doesn't",
  'doesnt',
  "isn't",
  'isnt',
  "aren't",
  "wasn't",
  "didn't",
  "can't",
  "won't",
  'مش',
  'مو',
  'ما',
  'لا',
  'ليس',
  'ليست',
  'مب',
  'لم',
  'لن',
]);

/**
 * Courtesy, vocatives and greetings a request may open with. Stripped before
 * the question test, so "can you build me a site?" is a build and "هل يمكنك
 * إضافة قسم؟" is a section — and "يا أبو غضب" is the assistant's own name.
 *
 * `polite` marks courtesy: a request that opened with it and ends in "?" is
 * still a request. A greeting or a name says nothing about that.
 */
export interface Opener {
  readonly words: readonly string[];
  readonly polite: boolean;
  /**
   * The opener asks whether a thing CAN be done — "is it possible to add
   * pages?" — which is a question about the product before it is a request.
   * English asks it with an infinitive, so every such opener does
   * (`'infinitive'`). Arabic's impersonal "هل يمكن" / "هل ممكن" ("is it
   * possible") does only before a VERBAL NOUN — "هل يمكن إضافة صفحات؟" — and is
   * the courtesy "could you" before a verb: "هل ممكن تضيف قسم؟"
   * (`'verbal-noun'`). Read as courtesy, "is it possible to add pages?" built
   * a page at 0.75 and "is it possible to make a multi-page site?" a site at
   * 0.9 (wave-2 verifier, 2026-09-28); both were questions in wave 1.
   */
  readonly possibility?: 'infinitive' | 'verbal-noun';
  /**
   * The opener asks whether the ASSISTANT can do something — "can you",
   * «هل يمكنك», «هل بتقدر», the Levantine «ممكن» — so the word after it is the
   * verb that says what. When that word is no verb the router knows, a page
   * named later in the request is a guess at what is asked: «هل يمكنك تربط ال
   * صفحه هاي» built a page at 0.8 before «تربط» was known (final test,
   * 2026-09-29). Courtesy that asks nothing of the assistant ("please", «من
   * فضلك») and a name or greeting are not.
   */
  readonly ability?: true;
}

const polite = (...words: string[]): Opener => ({ words, polite: true });
const ask = (...words: string[]): Opener => ({ words, polite: true, ability: true });
const vocative = (...words: string[]): Opener => ({ words, polite: false });
const possible = (...words: string[]): Opener => ({
  words,
  polite: true,
  possibility: /[؀-ۿ]/u.test(words.join('')) ? 'verbal-noun' : 'infinitive',
  ability: true,
});

/** Longest first, so "can you please" is stripped whole rather than as "can you". */
export const OPENERS: readonly Opener[] = [
  possible('would', 'it', 'be', 'possible', 'to'),
  possible('is', 'it', 'possible', 'to'),
  possible('is', 'there', 'any', 'way', 'to'),
  possible('is', 'there', 'a', 'way', 'to'),
  polite("i'd", 'like', 'you', 'to'),
  polite('i', 'want', 'you', 'to'),
  polite('i', 'need', 'you', 'to'),
  ask('would', 'you', 'please'),
  ask('can', 'you', 'please'),
  ask('could', 'you', 'please'),
  ask('can', 'you'),
  ask('could', 'you'),
  ask('would', 'you'),
  ask('will', 'you'),
  ask('can', 'u'),
  polite('please'),
  polite('pls'),
  polite('kindly'),
  possible('هل', 'من', 'الممكن'),
  ask('هل', 'يمكنك'),
  possible('هل', 'يمكن'),
  possible('هل', 'ممكن'),
  possible('هل', 'بالامكان'),
  ask('هل', 'تستطيع'),
  ask('هل', 'بامكانك'),
  ask('هل', 'تقدر'),
  polite('لو', 'سمحت'),
  polite('من', 'فضلك'),
  ask('اذا', 'ممكن'),
  ask('لو', 'ممكن'),
  polite('يا', 'ريت'),
  polite('ياريت'),
  /*
    Bare "ممكن" is the Levantine "could you": "ممكن عمل موقع لمطعمي؟" asks for
    the site. Only the QUESTION of possibility — "هل يمكن…", like "is it
    possible…" — is asked of the product.
  */
  ask('ممكن'),
  polite('رجاء'),
  polite('رجاءا'),
  /*
    MSA's "please" before a verbal noun: "أرجو تغيير صور الشقة", "يرجى حذف
    القسم". Unstripped, the request opened with an unknown word and its verbal
    noun was never read as the change it asks for (wave-2 verifier, 2026-09-28).
  */
  polite('ارجو'),
  polite('نرجو'),
  polite('يرجي'),
  polite('بليز'),
  ask('تقدر'),
  ask('بتقدر'),
  ask('تقدري'),
  ask('بتقدري'),
  vocative('يا', 'ابو', 'غضب'),
  vocative('ابو', 'غضب'),
  vocative('abu', 'ghadab'),
  vocative('hey'),
  vocative('hi'),
  vocative('hello'),
  vocative('مرحبا'),
  vocative('اهلا'),
  vocative('هلا'),
];

/** A request that is only a greeting, thanks or a yes/no is conversation, not work. */
export const GREETINGS: ReadonlySet<string> = new Set([
  'hi',
  'hello',
  'hey',
  'yo',
  'thanks',
  'thank',
  'you',
  'thx',
  'ok',
  'okay',
  'cool',
  'yes',
  'yep',
  'no',
  'nope',
  'تمام',
  'اوكي',
  'نعم',
  'لا',
  'ايوه',
  'مرحبا',
  'اهلا',
  'هلا',
  'السلام',
  'سلام',
  'عليكم',
  'شكرا',
  'صباح',
  'مساء',
  'الخير',
  'النور',
]);

/**
 * A start-over's Arabic verbal noun with its OBJECT glued on — "أعد تصميمه",
 * redesign IT; "أعد بناءها", rebuild HER (a feminine part or page). The object
 * points back at something named earlier, as "it" does, and the router reads
 * the thing it points at. The tokenizer peels ها and هم as possessives but
 * not a bare ه — every folded ة ends in one — so these are listed whole, in
 * the spellings the hamza takes before a suffix (بناءه / بنائه / بناؤه).
 */
export const START_OVER_OBJECTS_AR: readonly string[] = [
  'تصميمه',
  'تصميمها',
  'تصميمهم',
  'بناءه',
  'بناءها',
  'بناءهم',
  'بنائه',
  'بنائها',
  'بنائهم',
  'بناؤه',
];

/*
  "Redo" in the Levantine the product's first users type is "عيد" ("عيد
  تصميم الصفحة" — redesign the page); MSA says "أعد". Both take the same
  objects, glued on or not. "تعيد" / "نعيد" are the same verb asked of you or
  of us ("ممكن تعيد تصميم الصفحة؟"), which read as nothing routed edit@0.6.

  "عيد" is also Eid, the noun: "بطاقة عيد تصميم بسيط" (an Eid card, a simple
  design) routed as a confident start-over, build-page/replace@0.85 over a
  page with content (wave-2 verifier, 2026-09-28). So each of these counts
  only where a verb stands, with its object written bare — see
  `route-intent.ts` `restartsAt`.
*/
export const RESTART_VERBS_AR = ['اعد', 'اعاده', 'عيد', 'تعيد', 'نعيد'] as const;
const RESTART_OBJECTS_AR = ['بناء', 'تصميم', ...START_OVER_OBJECTS_AR] as const;

/*
  START OVER. Strong phrases replace the page on their own; weak ones only
  when a page noun is also named ("redo the page", not "redo").
*/
export const REPLACE_STRONG: readonly (readonly string[])[] = [
  ['from', 'scratch'],
  ['start', 'over'],
  ['start', 'again'],
  ['start', 'fresh'],
  ['rebuild'],
  ['re', 'build'],
  ['redesign'],
  ['remake'],
  ['scrap'],
  ['من', 'صفر'],
  ['ابدا', 'من', 'جديد'],
  ['نبدا', 'من', 'جديد'],
  ['تبدا', 'من', 'جديد'],
  ...RESTART_VERBS_AR.flatMap((verb) => RESTART_OBJECTS_AR.map((object) => [verb, object])),
];
export const REPLACE_WEAK: readonly (readonly string[])[] = [
  ['redo'],
  ['replace'],
  ['wipe'],
  ['من', 'جديد'],
  ['امسح'],
];

/**
 * What may sit between a start-over and the thing it restarts: "start over ON
 * the hero", "ابدأ من جديد في قسم الأسعار". Skipped before the object is read,
 * so the object decides whether the PAGE or one PART of it starts over.
 */
/**
 * Start-overs that are ADVERBS of the verb before them — "build a landing page
 * FROM SCRATCH with a hero" restarts the landing page, and what follows is its
 * complement — so the object is read before them first. The others ("start
 * over", "redesign", "أعد تصميم") are verbs, and their object follows.
 */
export const ADVERBIAL_START_OVERS: readonly (readonly string[])[] = [
  ['from', 'scratch'],
  ['من', 'صفر'],
];

export const START_OVER_LINKS: ReadonlySet<string> = new Set([
  'on',
  'with',
  // "Rebuild it AS a resume" names a page type, as "start over WITH a portfolio" does.
  'as',
  'in',
  'of',
  'for',
  'في',
  'علي',
  'مع',
]);

/**
 * Words a start-over carries that say nothing about WHAT replaces the page:
 * "start over", "rebuild the WHOLE website from scratch", "أعد تصميم الموقع
 * بالكامل". A start-over made only of these (and of articles, fillers, page
 * nouns and verbs) has no brief, so it routes below the confirm line — a host
 * asks before it wipes a page with nothing to build in its place. Measured
 * 2026-09-28 (wave-1 verifier): "start over" and "redesign the page" routed at
 * 0.85, the same as "start over with a landing page for my bakery".
 */
export const BARE_START_OVER_WORDS: ReadonlySet<string> = new Set([
  'whole',
  'entire',
  'entirely',
  'completely',
  'totally',
  'fully',
  'all',
  'again',
  'now',
  'please',
  'everything',
  'over',
  'fresh',
  'anew',
  'scratch',
  'zero',
  'thing',
  'things',
  'stuff',
  // What to drop or keep says nothing about what replaces the page.
  'keep',
  'except',
  'leave',
  'ابقي',
  'ابق',
  'احتفظ',
  'كامل',
  'كامله',
  'كاملا',
  'كليا',
  'كله',
  'كلها',
  'تماما',
  'كل',
  'شي',
  'شيء',
  'مره',
  'ثانيه',
  'تانيه',
  'جديد',
  'صفر',
  'الان',
  'هلا',
  /*
    Conversation around a start-over — "OK", "let's", "hmm", "يلا", "طيب" —
    which says no more about the page that replaces it than the start-over
    does. Measured 2026-09-28 (wave-2 verifier): "ok start over" and "hmm,
    start from scratch" routed at 0.85, the same as a start-over with a brief.
  */
  "let's",
  'lets',
  'let',
  'ok',
  'okay',
  'alright',
  'hmm',
  'hm',
  'um',
  'yeah',
  'well',
  'actually',
  'honestly',
  'really',
  'طيب',
  'يلا',
  'اوكي',
  'تمام',
  'خلينا',
  /*
    Words that name no subject: "start over, we need SOMETHING DIFFERENT" says
    as little about the next page as "start over" does.
  */
  'something',
  'anything',
  'different',
  'else',
  'other',
  'هالمره',
  'اشي',
  'مختلف',
]);

/**
 * Object pronouns that point back at something named earlier: "redesign IT",
 * "start over on THEM", "أعد تصميم هذا". A start-over whose object is one of
 * these restarts what it points at — the hero in "the hero looks bad,
 * redesign it from scratch" — not the page by default (wave-2 verifier,
 * 2026-09-28). "Everything" and "كله" are not here: they point at all of it.
 */
export const OBJECT_PRONOUNS: ReadonlySet<string> = new Set([
  'it',
  'this',
  'that',
  'them',
  'these',
  'those',
  'هذا',
  'هذه',
  'هذي',
  'هاد',
  'هاي',
]);

/**
 * Words that fold to a spelling opening with "ال" and carry no article:
 * "إلكتروني" (electronic) is "الكتروني" once its hamza folds, so "موقع
 * إلكتروني" — an online site, one to make — would read as the construct "the
 * site of the …", a site that exists.
 */
export const NOT_THE_ARTICLE: ReadonlySet<string> = new Set([
  'الكتروني',
  'الكترونيه',
  'الكترونيا',
  'اليكتروني',
  'اليكترونيه',
]);

/**
 * The third person of "want": "the menu NEEDS new prices". Its subject is
 * something that exists, so when its object is a part — not a page — it asks
 * to put that part into what exists, which on an empty page is an edit with
 * nothing to edit, not a brief (probed 2026-09-28). "My bakery needs a
 * website" keeps its page object and stays a page ask.
 */
export const THIRD_PERSON_WANTS: ReadonlySet<string> = new Set(['needs', 'wants', 'requires']);

/*
  CLEAR THE PAGE. A start-over only when a page is being made in the same
  breath — "delete everything and build a website for my bakery" — because
  then the person has said both what goes and what replaces it. Alone,
  "delete everything" names no page to build: it is an edit, and a build with
  no brief would invent one.
*/
export const CLEAR_ALL: readonly (readonly string[])[] = [
  ['delete', 'everything'],
  ['remove', 'everything'],
  ['clear', 'everything'],
  ['erase', 'everything'],
  ['delete', 'all'],
  ['remove', 'all'],
  ['clear', 'the', 'page'],
  ['امسح', 'كل'],
  ['احذف', 'كل'],
  ['شيل', 'كل'],
];

/*
  RUN CONTROL — words that steer the assistant or the history, not the page.
  A request made of nothing else is never a brief: on an empty page "undo"
  built a page titled by the word, and on the skeleton a stopped build left
  behind, "كمل" ("carry on") replaced the skeleton with a fresh scaffold
  (probed 2026-09-28). Affirmations ("go ahead", "do it") are deliberately NOT
  here: after an answer that proposed a page they mean "build it".
*/
export const CONTROL_WORDS: ReadonlySet<string> = new Set([
  'undo',
  'stop',
  'cancel',
  'continue',
  'resume',
  'retry',
  'again',
  'تراجع',
  'الغي',
  'الغاء',
  'وقف',
  'توقف',
  'كمل',
  'اكمل',
  'استمر',
  'تابع',
  'كفايه',
  'خلاص',
  'عيد',
]);
/** What may sit beside a control word and leave it one: "undo the last change". */
export const CONTROL_FILLERS: ReadonlySet<string> = new Set([
  'the',
  'it',
  'that',
  'this',
  'last',
  'change',
  'changes',
  'step',
  'edit',
  'build',
  'building',
  'run',
  'generation',
  'please',
  'now',
  'one',
  'more',
  'time',
  'try',
  'all',
  'مره',
  'ثانيه',
  'تانيه',
  'كمان',
  'اخر',
  'تعديل',
  'تغيير',
  'بناء',
  'شغل',
]);

/*
  PRONOUN OBJECTS — "make IT pop", "make THIS cleaner". A "make" whose object
  points back at something is changing what exists; on an empty page there is
  nothing for it to point at, and building a page around "make it pop" answers
  a request nobody made.
*/
export const PRONOUNS: ReadonlySet<string> = new Set([
  'it',
  'this',
  'that',
  'them',
  'these',
  'those',
  'everything',
  'هذا',
  'هذه',
  'هذي',
  'هاد',
  'هاي',
  'كله',
  'كلها',
]);
