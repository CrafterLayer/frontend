import type { ArtKind, ArtWords } from './types';

/**
 * The words people use for the art they want, in English and Arabic, mapped
 * to the catalog's own words (art catalog, 2026-10-14). Loaded with the data,
 * never on its own. Each group reads `synonym|synonym => target target`:
 * the synonyms are what a person may say («طبيب», "doctor"), the targets are
 * Fluent Emoji names (or DiceBear style ids), best first. The first Arabic
 * synonym of a group is the Arabic alt text of its first target. A test
 * checks every target exists in the pinned data.
 */

const KIND_WORDS: Readonly<Record<ArtKind, readonly string[]>> = {
  logo: [
    'logo',
    'logos',
    'brand',
    'brands',
    'شعار',
    'شعارات',
    'لوغو',
    'لوجو',
    'لوقو',
    'علامة تجارية',
  ],
  character: [
    'character',
    'characters',
    'avatar',
    'avatars',
    'cartoon',
    'mascot',
    'شخصية',
    'شخصيات',
    'أفاتار',
    'افاتار',
    'كرتون',
    'كرتونية',
    'كارتون',
    'صورة رمزية',
  ],
  illustration: [
    'illustration',
    'illustrations',
    'drawing',
    'رسم',
    'رسمة',
    'رسومات',
    'رسم توضيحي',
    'ايقونة',
    'أيقونة',
  ],
};

const CHARACTER_GROUPS: readonly string[] = [
  'robot|robots|bot|روبوت|آلي => bottts bottts-neutral',
  'pixel|8bit|retro|game|بكسل|ريترو => pixel-art pixel-art-neutral',
  'sketch|doodle|hand drawn|line art|notion|خط|رسم يدوي => notionists open-peeps',
  'people|person|team|staff|member|فريق|موظف|شخص => notionists lorelei open-peeps avataaars',
  'woman|girl|female|امرأة|بنت|فتاة => lorelei notionists',
  'face|portrait|وجه => lorelei-neutral notionists-neutral avataaars-neutral',
  'thumb|fun|playful|مرح => thumbs',
];

const ILLUSTRATION_GROUPS: readonly string[] = [
  // People and jobs
  'طبيب|دكتور|طبيبة|doctor|physician|health|health worker|clinic|عيادة => health-worker woman-health-worker man-health-worker',
  'ممرض|ممرضة|nurse|nursing => woman-health-worker health-worker',
  'مهندس|مهندسة|engineer|engineering => technologist construction-worker factory-worker',
  'مبرمج|مطور|برمجة|programmer|developer|coder|software => technologist man-technologist woman-technologist',
  'عامل بناء|بناء|مقاول|builder|construction|contractor => construction-worker construction',
  'ميكانيكي|فني|mechanic|technician|repair|صيانة => mechanic wrench hammer-and-wrench',
  'عالم|باحث|scientist|science|research|lab|مختبر => scientist microscope dna',
  'معلم|معلمة|مدرس|أستاذ|teacher|tutor|education|تعليم => teacher woman-teacher man-teacher',
  'طالب|طالبة|تلميذ|student|pupil|learning|دراسة => student graduation-cap books',
  'طباخ|شيف|طاهي|cook|chef|kitchen|مطبخ => cook man-cook woman-cook cooking',
  'مزارع|فلاح|زراعة|farmer|farm|agriculture => farmer seedling tractor',
  'طيار|pilot|aviation => pilot airplane',
  'شرطي|شرطة|police|officer|security guard|أمن => police-officer guard police-car',
  'قاضي|محامي|محاماة|قانون|judge|lawyer|law|legal => judge balance-scale classical-building',
  'فنان|رسام|مصمم|artist|designer|design|painter|تصميم => artist artist-palette paintbrush',
  'رائد فضاء|فضاء|astronaut|space => astronaut rocket',
  'موظف|موظفة|مكتب|office worker|employee|office|business|أعمال => office-worker man-office-worker woman-office-worker briefcase',
  'رجل اطفاء|اطفاء|firefighter|fire fighter => firefighter fire-engine',
  'مغني|مطرب|singer|vocalist => singer microphone',
  'محقق|detective|investigation => detective magnifying-glass-tilted-left',
  'طفل|أطفال|اطفال|child|kid|kids|children => child baby teddy-bear',
  'رجل|man|men => man',
  'امرأة|سيدة|woman|women|lady => woman',
  'مصافحة|شراكة|اتفاق|handshake|partnership|deal|agreement => handshake',
  'تصفيق|نجاح|clapping|applause|success => clapping-hands trophy',
  'اعجاب|موافق|like|thumbs up|approve => thumbs-up',
  'ترحيب|مرحبا|hello|welcome|wave => waving-hand',
  'حب|قلب|love|heart|care|رعاية => red-heart heart-hands',
  // Food and drink
  'قهوة|قهوه|كافيه|coffee|cafe|espresso|latte => hot-beverage',
  'شاي|tea => teacup-without-handle teapot',
  'كعك|كيك|كعكة|عيد ميلاد|cake|birthday|bakery => birthday-cake shortcake',
  'خبز|مخبز|bread|bakery bread => bread croissant baguette-bread',
  'بيتزا|pizza => pizza',
  'برجر|همبرجر|burger|hamburger|fast food => hamburger french-fries',
  'حلويات|حلوى|sweets|dessert|candy => doughnut cookie ice-cream',
  'طعام|أكل|اكل|وجبة|مطعم|food|meal|restaurant|dinner => fork-and-knife-with-plate pot-of-food steaming-bowl',
  'سلطة|صحي|salad|healthy|diet|رجيم => green-salad',
  'فلافل|falafel => falafel',
  'عصير|مشروب|juice|drink|beverage => tropical-drink cup-with-straw',
  'فواكه|فاكهة|fruit|fruits => red-apple grapes banana',
  // Animals and nature
  'قط|قطة|cat|kitten|pet => cat cat-face',
  'كلب|dog|puppy => dog dog-face',
  'حصان|خيل|horse => horse',
  'جمل|camel|desert animal => camel two-hump-camel',
  'طائر|عصفور|bird => bird',
  'وردة|ورد|زهرة|زهور|flower|flowers|rose|florist => rose bouquet tulip blossom',
  'شجرة|أشجار|tree|trees|nature|طبيعة => deciduous-tree evergreen-tree palm-tree',
  'نبات|نبتة|plant|plants|growth plant => seedling herb potted-plant',
  'شمس|sun|sunny|summer|صيف => sun',
  'قمر|هلال|moon|crescent => crescent-moon',
  'نجمة|نجوم|star|stars|rating|تقييم => star glowing-star',
  'ماء|مياه|water|drop => droplet water-wave',
  'نار|fire|hot|flame => fire',
  'بحر|شاطئ|sea|beach|ocean => beach-with-umbrella water-wave',
  'جبل|جبال|mountain|hiking => mountain camping',
  // Places and travel
  'سيارة|سيارات|car|cars|auto|vehicle => automobile oncoming-automobile racing-car',
  'شاحنة|توصيل|شحن|delivery|shipping|truck|courier => delivery-truck package',
  'طائرة|طيران|airplane|plane|flight|airline => airplane airplane-departure',
  'سفر|رحلة|سياحة|travel|trip|tourism|holiday => luggage airplane world-map',
  'فندق|hotel|stay|إقامة => hotel bed',
  'بيت|منزل|عقار|عقارات|home|house|real estate|property => house house-with-garden houses',
  'مبنى|شركة|building|company|offices => office-building cityscape',
  'مستشفى|hospital => hospital ambulance',
  'مدرسة|school => school',
  'جامعة|تخرج|university|graduation|college => graduation-cap classical-building',
  'بنك|مصرف|bank|banking => bank',
  'مسجد|جامع|mosque|prayer|صلاة => mosque kaaba prayer-beads',
  'رمضان|ramadan|iftar|إفطار => crescent-moon star-and-crescent',
  'خريطة|موقع|مكان|map|location|address|عنوان => world-map round-pushpin',
  'عالم|دولي|global|world|international => globe-showing-europe-africa globe-with-meridians',
  'باص|حافلة|bus|transport|مواصلات => bus',
  'دراجة|bicycle|bike|cycling => bicycle',
  'قطار|train|railway => train',
  'سفينة|قارب|ship|boat => ship sailboat',
  'مصنع|factory|industry|صناعة => factory',
  'متجر|محل|store|shop => department-store convenience-store',
  // Objects and ideas
  'كتاب|كتب|قراءة|مكتبة|book|books|reading|library => books open-book',
  'حاسوب|كمبيوتر|لابتوب|laptop|computer|tech|تقنية => laptop desktop-computer',
  'هاتف|جوال|موبايل|تطبيق|phone|mobile|app|smartphone => mobile-phone',
  'صاروخ|انطلاق|إطلاق|rocket|launch|startup|fast => rocket',
  'هدية|هدايا|gift|present|offer|عرض => wrapped-gift',
  'احتفال|عيد|حفلة|party|celebration|event|مناسبة => party-popper confetti-ball balloon',
  'مال|فلوس|نقود|ربح|money|cash|profit|finance|مالية => money-bag dollar-banknote coin',
  'دفع|بطاقة|payment|card|pay|checkout => credit-card',
  'فاتورة|إيصال|invoice|receipt|bill => receipt',
  'تسوق|سلة|شراء|shopping|cart|ecommerce|buy => shopping-cart shopping-bags',
  'فكرة|إبداع|ابداع|idea|creative|innovation|ابتكار => light-bulb',
  'نمو|زيادة|تحليل|growth|analytics|increase|chart|إحصاء => chart-increasing bar-chart',
  'أمان|امان|حماية|security|safe|protection|privacy|خصوصية => shield locked',
  'مفتاح|key|access => key',
  'هدف|أهداف|target|goal|focus => bullseye',
  'جائزة|كأس|فوز|award|trophy|winner|achievement|إنجاز => trophy 1st-place-medal sports-medal',
  'بريد|رسالة|ايميل|email|mail|message|newsletter => envelope e-mail incoming-envelope',
  'محادثة|دردشة|تواصل|chat|talk|support|دعم|contact => speech-balloon',
  'اعلان|تسويق|announcement|marketing|promo => megaphone loudspeaker',
  'تنبيه|إشعار|notification|alert|reminder => bell',
  'تقويم|موعد|حجز|calendar|date|appointment|booking|schedule => calendar spiral-calendar',
  'وقت|ساعة|زمن|time|clock|hours|دوام => alarm-clock hourglass-done stopwatch',
  'عمل|وظيفة|وظائف|job|jobs|career|work|hiring|توظيف => briefcase office-worker',
  'ملف|مستند|وثيقة|document|file|docs => page-facing-up file-folder memo',
  'قائمة|مهام|checklist|tasks|todo|list => clipboard check-mark-button',
  'كتابة|قلم|write|writing|pen|blog|مدونة => memo pencil writing-hand',
  'بحث|search|find|explore => magnifying-glass-tilted-left',
  'إعدادات|اعدادات|settings|setup|config => gear',
  'أدوات|ادوات|tools|maintenance => hammer-and-wrench toolbox',
  'طرد|صندوق|package|box|parcel => package',
  'كاميرا|تصوير|صور|camera|photography|photo => camera camera-with-flash',
  'فيديو|فيلم|سينما|video|film|movie|cinema => movie-camera clapper-board film-projector',
  'موسيقى|أغاني|music|song|audio => musical-note headphone',
  'بودكاست|إذاعة|podcast|radio|broadcast => studio-microphone radio',
  'ألعاب|العاب|لعبة|gaming|games|esports => video-game joystick',
  'رياضة|كرة|sport|sports|football|soccer => soccer-ball',
  'لياقة|نادي|جيم|gym|fitness|workout|training => person-lifting-weights flexed-biceps',
  'جري|ركض|running|run|marathon => person-running running-shoe',
  'دواء|صيدلية|علاج|medicine|pharmacy|pill|treatment => pill syringe stethoscope',
  'أسنان|اسنان|سن|dentist|dental|tooth|teeth => tooth',
  'نظارة|نظارات|بصريات|glasses|optics|optician => glasses',
  'ملابس|أزياء|ازياء|موضة|fashion|clothes|clothing => t-shirt dress shopping-bags',
  'حذاء|احذية|shoe|shoes|sneakers => running-shoe',
  'مجوهرات|ذهب|خاتم|jewelry|jewellery|gold|ring|diamond => gem-stone ring',
  'عطر|عطور|perfume|fragrance|cosmetics|تجميل|مكياج|makeup|beauty => lipstick nail-polish',
  'حلاق|حلاقة|صالون|barber|salon|haircut => barber-pole person-getting-haircut',
  'زفاف|عرس|wedding|marriage => wedding ring bouquet',
  'طاقة|كهرباء|energy|power|electric|electricity => high-voltage battery electric-plug',
  'روبوت|ذكاء اصطناعي|robot|ai|automation|أتمتة => robot',
  'عقل|تفكير|brain|mind|thinking|smart => brain',
  'رابط|ربط|link|integration|connect|تكامل => link',
  'نجاح مالي|استثمار|invest|investment|stocks|أسهم => chart-increasing money-with-wings',
  'وقود|بنزين|fuel|gas station|petrol => fuel-pump',
  'تنظيف|نظافة|cleaning|clean|housekeeping => broom soap sponge',
  'سباكة|سباك|plumber|plumbing => wrench toilet',
  'كرسي|أثاث|اثاث|furniture|chair|interior => chair couch-and-lamp',
  'نجمة لامعة|سحر|magic|sparkle|new|جديد => sparkles',
];

function addAll<T>(map: Map<string, T>, key: string, value: T): void {
  if (!map.has(key)) map.set(key, value);
}

const ARABIC = /[؀-ۿ]/u;

/** The search words as maps; `fold` is the search's own folding, so a key and a query compare alike. */
export function buildArtWords(fold: (text: string) => string): ArtWords {
  const kinds = new Map<string, ArtKind>();
  for (const [kind, words] of Object.entries(KIND_WORDS) as [ArtKind, readonly string[]][]) {
    for (const word of words) addAll(kinds, fold(word), kind);
  }
  const groups = (lines: readonly string[]) =>
    lines.map((line) => {
      const [synonyms = '', targets = ''] = line.split('=>');
      return {
        synonyms: synonyms
          .split('|')
          .map((word) => word.trim())
          .filter((word) => word !== ''),
        targets: targets
          .trim()
          .split(/\s+/u)
          .filter((name) => name !== ''),
      };
    });
  const characters = new Map<string, readonly string[]>();
  for (const { synonyms, targets } of groups(CHARACTER_GROUPS)) {
    for (const word of synonyms) addAll(characters, fold(word), targets);
  }
  const illustrations = new Map<string, readonly string[]>();
  const arabicLabels = new Map<string, string>();
  for (const { synonyms, targets } of groups(ILLUSTRATION_GROUPS)) {
    for (const word of synonyms) addAll(illustrations, fold(word), targets);
    const label = synonyms.find((word) => ARABIC.test(word));
    const first = targets[0];
    if (label !== undefined && first !== undefined) addAll(arabicLabels, first, label);
  }
  return { kinds, illustrations, characters, arabicLabels };
}

/** Every emoji name and style id the word groups point at (the data test checks they all exist). */
export function artWordTargets(): {
  readonly illustrations: readonly string[];
  readonly characters: readonly string[];
} {
  const targets = (lines: readonly string[]) =>
    [...new Set(lines.flatMap((line) => (line.split('=>')[1] ?? '').trim().split(/\s+/u)))].filter(
      (name) => name !== '',
    );
  return { illustrations: targets(ILLUSTRATION_GROUPS), characters: targets(CHARACTER_GROUPS) };
}
