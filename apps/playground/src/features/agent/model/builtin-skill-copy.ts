/**
 * The built-in skills' names and one-line descriptions in Arabic (2026-10-14), for the panel's
 * "Built-in skills" list. English reads the registry's own words. The instructions the Agent
 * reads stay as written; only what the person sees is translated. No Latin in brackets: a
 * truncated RTL row cuts it mid-word (the default skills' rule).
 */
import type { Locale } from './view-types';

interface Copy {
  readonly name: string;
  readonly description: string;
}

const ARABIC: Readonly<Record<string, Copy>> = {
  'craftkit.accessibility-review': {
    name: 'بنية سهلة الوصول وتباين واضح',
    description:
      'ترتيب العناوين، وتسمية الروابط والصور والأيقونات، وأزواج تباين مقروءة، وحركة معتدلة.',
  },
  'craftkit.arabic-rtl': {
    name: 'العربية والكتابة من اليمين',
    description: 'اتجاه الصفحة، وتخطيط منطقي، وأيقونات معكوسة، وخطوط عربية، وفصل النصوص المختلطة.',
  },
  'craftkit.art-names': {
    name: 'الصور بأسمائها',
    description: 'شعارات موثقة وشخصيات كرتونية ورسوم، تُسمّى حيث توضع الصورة.',
  },
  'craftkit.clinic-page': {
    name: 'صفحة عيادة أو صالون ومواعيد',
    description: 'ما يُعالَج ومن يعالجه وكيف يُحجز: الخدمات والمختصون والحجز.',
  },
  'craftkit.conversion-recipes': {
    name: 'أقسام تحقق التحويل',
    description: 'وصفات دقيقة للبطاقات والأرقام والخطوات والآراء والأسعار والأسئلة الشائعة.',
  },
  'craftkit.copywriting': {
    name: 'العناوين والأزرار والنصوص',
    description: 'قواعد العنوان وزر الدعوة والنص بالعربية والإنجليزية، بنصوص مكتملة وأمثلة واقعية.',
  },
  'craftkit.cv-page': {
    name: 'سيرة ذاتية وملف أعمال',
    description: 'صفحة تبدأ بما يبحث عنه المُوظِّف: التواصل والخبرة والمهارات والتعليم والمشاريع.',
  },
  'craftkit.data-viz': {
    name: 'المخططات والجداول',
    description: 'الأرقام مخططًا أو جدولًا أو قسم تقرير أو صفحة تقرير كاملة محسوبة.',
  },
  'craftkit.design-direction': {
    name: 'اتجاه تصميم متماسك',
    description: 'اتجاه بصري واحد في كل مكان: ألوان وتباين وأحجام خط ومسافات ثابتة.',
  },
  'craftkit.design-tokens': {
    name: 'الرموز والمكوّنات والأنماط',
    description: 'ابنِ المتكرر مرة واحدة: رموز الأدوار ثم الألوان ثم الأصناف، وصنف أساسي بأنماط.',
  },
  'craftkit.logo-design': {
    name: 'شعار أصيل',
    description: 'شعار عملك الخاص: علامة بسيطة واسمك نصًا، في رأس الصفحة وتذييلها.',
  },
  'craftkit.menu-page': {
    name: 'صفحة مقهى أو مطعم أو مخبز',
    description:
      'صفحة مبنية حول قائمة الطعام: الأصناف بأسعارها بالعملة المحلية، والقصة، وساعات العمل.',
  },
  'craftkit.motion': {
    name: 'الحركة والتفاعل',
    description:
      'حركة معتدلة تعمل في الصفحة: انتقالات وتمرير المؤشر ودخول متدرج، مع احترام تقليل الحركة.',
  },
  'craftkit.occasion-page': {
    name: 'دعوة أو وداع أو تهنئة',
    description: 'صفحة بشعور واحد لزفاف أو دعوة أو تهنئة أو مواساة: الأسماء والموعد والمكان.',
  },
  'craftkit.page-composition': {
    name: 'تركيب صفحة احترافي',
    description:
      'ترتيب الأقسام وبنيتها وإيقاعها في صفحة هبوط أو رئيسية كاملة، انطلاقًا من هدف الزائر.',
  },
  'craftkit.photo-direction': {
    name: 'توجيه الصور',
    description: 'صور من القائمة الموثقة فقط: أين توضع وكم عددها وكيف يجلس النص عليها.',
  },
  'craftkit.property-page': {
    name: 'صفحة عقارات',
    description: 'بطاقات عقارات بالسعر والغرف والمساحة، ومرافق، وأرقام موثوقة، وطريقة تواصل.',
  },
  'craftkit.scroll-cinematic': {
    name: 'صفحات رحلة بالتمرير',
    description: 'سرد متصل بالتمرير: مشاهد مرتبة، ومراحل مثبتة، وظهور مرتبط بالتمرير.',
  },
  'craftkit.shop-page': {
    name: 'صفحة متجر ومنتجات',
    description: 'متجر صغير يبيع عبر واتساب: منتجات بأسعارها، ومجموعات، وأجوبة التوصيل والاستبدال.',
  },
  'craftkit.structure-recipes': {
    name: 'أقسام الهيكل',
    description: 'وصفات دقيقة لرأس الصفحة وتذييلها والتواصل والفريق والمعرض والخط الزمني.',
  },
  'craftkit.ui-ux-pro': {
    name: 'مراجعة جودة الواجهة',
    description: 'قائمة اللمسات الأخيرة: أهداف اللمس، وخط مقروء، وتباين، وتركيز ظاهر، وردود فعل.',
  },
  'craftkit.visual-direction': {
    name: 'هوية بصرية مميزة',
    description: 'صفحة نابعة من موضوعها، بلا الأنماط المكررة، بخطوط مختارة بعناية.',
  },
  'craftkit.pixi-animation': {
    name: 'تحريك الشخصيات',
    description: 'انتقالات وتسلسلات زمنية ونوابض وحالات الشخصيات وهياكل تحريكها.',
  },
  'craftkit.pixi-audio': {
    name: 'أصوات الألعاب وموسيقاها',
    description: 'مؤثرات صوتية بلا ملفات، وموسيقى اختيارية، وزر كتم، وبدء بلمسة.',
  },
  'craftkit.pixi-dialogue': {
    name: 'الحوار والقصص المتفرعة',
    description: 'شخصيات وحوار متفرع بمتغيرات ونهايات، وصندوق حوار سهل الوصول.',
  },
  'craftkit.pixi-effects': {
    name: 'مؤثرات وجسيمات وأجواء',
    description: 'انفجارات وطقس وآثار وموجات وومضات واهتزاز ونص طائر.',
  },
  'craftkit.pixi-game-ai': {
    name: 'الأعداء والمطاردات والشخصيات',
    description: 'شخصيات تتحرك بذكاء، ومطاردة حول الجدران، وحالات للأعداء.',
  },
  'craftkit.pixi-games': {
    name: 'ألعاب ثنائية الأبعاد',
    description: 'تحكم محصور، وحالة لعبة ثابتة الخطوة، وتصادمات، وأزرار للجوال، وإعادة اللعب.',
  },
  'craftkit.pixi-hud': {
    name: 'شاشة اللعبة: الصحة والنقاط',
    description: 'أشرطة الصحة والخبرة، ونص النقاط، وأزرار صغيرة لها نظير يعمل بلوحة المفاتيح.',
  },
  'craftkit.pixi-murals': {
    name: 'جداريات بطبقات',
    description: 'تكوين مدروس بعمق وطبقات وخطوط وحدود جودة بدل الجسيمات العامة.',
  },
  'craftkit.pixi-physics': {
    name: 'ألعاب فيزيائية وألغاز',
    description: 'أجسام تتراكم وتسقط وترتد وتنطلق، بخطوة ثابتة وصور ساكنة مستقرة.',
  },
  'craftkit.pixi-scroll-murals': {
    name: 'جداريات بالتمرير',
    description: 'عالم مرسوم واسع يُعبَر بتمرير الصفحة، بعمق متدرج.',
  },
  'craftkit.pixi-stories': {
    name: 'قصص تفاعلية بفصول',
    description: 'فصول واضحة، ومشاهد بطبقات، وتنقل سهل الوصول، وإعادة.',
  },
  'craftkit.pixi-tile-worlds': {
    name: 'عوالم مربعات ومنصات ومتاهات',
    description: 'مستويات مرسومة بالرموز، وتصادم، ومقتنيات، ومنصات، وكاميرا تتبع اللاعب.',
  },
  'craftkit.pixi-v8-core': {
    name: 'المشهد والحلقة والتنظيف',
    description:
      'نصوص المشاهد في وضع الكود الحر: التطبيق والمشهد والمؤقت وتغيير الحجم وتقليل الحركة.',
  },
  'craftkit.pixi-v8-effects': {
    name: 'المرشحات والظلال والجسيمات',
    description: 'مرشحات جاهزة وأنماط مزج ومرشحات مخصصة وشبكات وجسيمات.',
  },
  'craftkit.pixi-v8-graphics': {
    name: 'الرسوم والتدرجات والألوان',
    description: 'ارسم الشكل ثم املأه أو حدّده، بتدرجات وفراغات وألوان.',
  },
  'craftkit.pixi-v8-interaction-perf': {
    name: 'المؤشر وسهولة الوصول والأداء',
    description: 'الفأرة واللمس في المشاهد، وسهولة الوصول، وأداء سلس.',
  },
  'craftkit.pixi-v8-text-assets': {
    name: 'النصوص والخطوط والصور',
    description: 'النصوص وحدود تشكيل العربية والخطوط وتحميل الصور.',
  },
  'craftkit.craft-manual': {
    name: 'دليل الصنعة',
    description:
      'الأساس في كل طلب: هيكل الأقسام والروابط والألوان والاتجاه والخطوط والأخطاء المرفوضة.',
  },
  'craftkit.build-scaffold': {
    name: 'البناء: هيكل الصفحة',
    description: 'يضع كل أقسام الصفحة فارغة بترتيبها ويحدد الاتجاه الذي تتبعه الصفحة كلها.',
  },
  'craftkit.build-fill': {
    name: 'البناء: ملء قسم',
    description: 'يكتب قسمًا واحدًا كاملًا في مكانه، ملتزمًا باتجاه الصفحة.',
  },
  'craftkit.direction-deck': {
    name: 'دليل الاتجاهات حسب المجال',
    description: 'ألوان مجرّبة وأزواج خطوط موثقة وتخطيط لكل قسم وصور لكل مجال عمل.',
  },
};

/** A built-in's name and description in the panel's language; `undefined`: the registry's own. */
export function builtInSkillCopy(locale: Locale, id: string): Copy | undefined {
  return locale === 'ar' ? ARABIC[id] : undefined;
}
