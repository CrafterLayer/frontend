/**
 * The marketing landing's words, in English and in Arabic (blocks-polish,
 * 2026-10-08).
 *
 * The landing used to carry English copy with three Arabic strings mixed in
 * (a hero button, a feature card, a testimonial), and its Arabic mode was the
 * same English page mirrored. The templates audit flagged both. The copy now
 * lives here, one complete set per language, and `marketingLanding(dir)`
 * picks a set by direction; the node structure and every node id stay in
 * `create-playground-kernel.ts`, because other tests address them.
 *
 * The Arabic is written for an Arabic reader, not translated word for word:
 * Arabic-Indic digits, Jordanian dinar prices, Arab names and places. Brand
 * and product names ("CraftKit", "RTL", "LTR") stay Latin.
 */

export type LandingLanguage = 'en' | 'ar';

export interface LandingCopy {
  readonly title: string;
  readonly announcement: { readonly label: string; readonly message: string; readonly linkLabel: string };
  readonly hero: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly trustLine: string;
  };
  readonly ctaStart: string;
  readonly ctaDocs: string;
  readonly logos: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly name: string; readonly descriptor: string }[];
  };
  readonly marquee: {
    readonly label: string;
    readonly items: readonly { readonly title: string; readonly meta: string }[];
  };
  readonly carousel: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly {
      readonly label: string;
      readonly title: string;
      readonly body: string;
      readonly imageAlt: string;
      readonly action: string;
    }[];
  };
  readonly showcaseAlt: string;
  readonly about: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly highlights: readonly { readonly title: string; readonly body: string }[];
    readonly link: string;
  };
  /** "Why it holds": a heading, then one paragraph with a bold phrase and a link. */
  readonly story: {
    readonly heading: string;
    readonly before: string;
    readonly bold: string;
    readonly between: string;
    readonly link: string;
    readonly after: string;
  };
  readonly bento: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly kicker: string; readonly title: string; readonly body: string; readonly metric?: string }[];
  };
  readonly stats: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly value: string; readonly label: string; readonly detail: string }[];
  };
  readonly features: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly kicker: string; readonly icon: string; readonly title: string; readonly body: string }[];
  };
  readonly pricing: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly solo: { readonly name: string; readonly price: string; readonly period: string; readonly body: string; readonly cta: string };
    readonly team: {
      readonly name: string;
      readonly price: string;
      readonly period: string;
      readonly badge: string;
      readonly body: string;
      readonly cta: string;
    };
  };
  readonly quotes: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly quote: string; readonly author: string; readonly role: string; readonly company: string }[];
  };
  readonly faq: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly items: readonly { readonly question: string; readonly answer: string }[];
  };
  readonly form: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly name: string;
    readonly email: string;
    readonly websiteType: string;
    readonly websitePlaceholder: string;
    /** In the order saas, commerce, portfolio, services. */
    readonly options: readonly [string, string, string, string];
    readonly timeline: string;
    readonly brief: string;
    readonly briefHelper: string;
    readonly submitLabel: string;
    readonly footerNote: string;
  };
  readonly promo: {
    readonly label: string;
    readonly headline: string;
    readonly body: string;
    readonly primary: string;
    readonly secondary: string;
  };
  readonly newsletter: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly body: string;
    readonly emailLabel: string;
    readonly placeholder: string;
    readonly buttonLabel: string;
    readonly privacy: string;
  };
  readonly inline: { readonly title: string; readonly message: string; readonly story: string };
  readonly codeView: { readonly title: string; readonly heading: string; readonly body: string };
}

const EN: LandingCopy = {
  title: 'CraftKit Landing',
  announcement: {
    label: 'New',
    message: 'Professional page templates are now in the builder.',
    linkLabel: 'Explore the library',
  },
  hero: {
    eyebrow: 'The professional website builder',
    heading: 'Build pages your kernel can prove',
    body: 'Design a complete, production-ready experience from premium blocks while every change stays validated and reversible.',
    trustLine: 'Original templates · Responsive by default · RTL ready',
  },
  ctaStart: 'Get started',
  ctaDocs: 'Read the docs',
  logos: {
    eyebrow: 'Built for ambitious teams',
    heading: 'A dependable foundation from first concept to global launch',
    body: 'Product, studio, and commerce teams share the same professional design vocabulary.',
    items: [
      { name: 'Northstar', descriptor: 'Product' },
      { name: 'Arcform', descriptor: 'Design' },
      { name: 'Meridian', descriptor: 'Commerce' },
      { name: 'Canopy', descriptor: 'Operations' },
      { name: 'Fieldwork', descriptor: 'Research' },
    ],
  },
  marquee: {
    label: 'Professional capabilities',
    items: [
      { title: 'Responsive', meta: 'Container-aware' },
      { title: 'Accessible', meta: 'Semantic by default' },
      { title: 'RTL-ready', meta: 'Logical layout' },
      { title: 'Token-bound', meta: 'Fully themeable' },
      { title: 'Atomic', meta: 'Reliable undo' },
      { title: 'AI-ready', meta: 'Validated commands' },
    ],
  },
  carousel: {
    eyebrow: 'A complete visual system',
    heading: 'Move from a strong first frame to a complete story',
    body: 'Each slide is responsive, accessible, editable, and safe to publish.',
    items: [
      {
        label: '01 · Compose',
        title: 'Start with a professional structure',
        body: 'Use complete sections and templates instead of rebuilding the same page skeleton.',
        imageAlt: 'A product team composing a launch plan together',
        action: 'Explore templates',
      },
      {
        label: '02 · Customize',
        title: 'Shape every block through explicit controls',
        body: 'Typography, spacing, layout, colour roles, motion, media, and content stay inspectable.',
        imageAlt: 'A designer refining a responsive interface system',
        action: 'See customization',
      },
      {
        label: '03 · Prove',
        title: 'Publish from a document the kernel can validate',
        body: 'Atomic changes, safe URLs, and deterministic composition keep quality in the architecture.',
        imageAlt: 'A product analytics view showing a successful launch',
        action: 'Read the architecture',
      },
    ],
  },
  showcaseAlt: 'A grid of coloured panels seen from directly above.',
  about: {
    eyebrow: 'Designed as a system',
    heading: 'Move fast without trading away quality or control',
    body: 'CraftKit combines a curated design vocabulary with a deterministic editing kernel. The result is a builder that stays expressive, inspectable, and safe as the site grows.',
    highlights: [
      { title: 'One validated door', body: 'Every edit becomes a transparent transaction with reliable undo.' },
      { title: 'A real design language', body: 'Responsive spacing, typography, surfaces, and motion stay token-bound.' },
    ],
    link: 'See the architecture',
  },
  story: {
    heading: 'Why it holds',
    before: 'Every edit is ',
    bold: 'one transaction',
    between: ' through a ',
    link: 'validated door',
    after: ', so design freedom never creates a second mutation path.',
  },
  bento: {
    eyebrow: 'Everything works together',
    heading: 'A professional building system, not a pile of disconnected widgets',
    body: 'Compose rich sections, preserve design coherence, and keep the document portable.',
    items: [
      {
        kicker: 'Vocabulary',
        title: '32 production-ready marketing blocks',
        body: 'From sliders, banners, galleries, and video to products, forms, comparisons, and editorial content.',
        metric: '32',
      },
      { kicker: 'Templates', title: 'Complete pages in one action', body: 'Start with a coherent layout and then refine every block independently.', metric: '4' },
      { kicker: 'Safety', title: 'Atomic changes', body: 'Validation happens before the document changes.' },
      { kicker: 'Reach', title: 'Responsive and RTL-ready', body: 'Logical properties and container queries adapt without fragile overrides.' },
    ],
  },
  stats: {
    eyebrow: 'Quality you can inspect',
    heading: 'A stronger starting point for every launch',
    body: 'The library is designed to reduce repetitive setup while keeping every decision editable.',
    items: [
      { value: '32', label: 'Marketing blocks', detail: 'Across the full customer journey' },
      { value: '4', label: 'Page templates', detail: 'Inserted as one transaction' },
      { value: '100%', label: 'Token-bound', detail: 'No theme-breaking magic values' },
      { value: 'RTL', label: 'Native direction', detail: 'The same document model' },
    ],
  },
  features: {
    eyebrow: 'Built for real work',
    heading: 'Why CraftKit',
    body: 'The core guarantees stay invisible when you design, and dependable when you ship.',
    items: [
      { kicker: 'Predictable', icon: '01', title: 'Deterministic', body: 'Same seed, same history, bit for bit.' },
      { kicker: 'Protected', icon: '02', title: 'Sealed', body: 'One validated door; no second mutation path.' },
      { kicker: 'Global', icon: '03', title: 'Bidirectional', body: 'RTL and LTR from the same document.' },
    ],
  },
  pricing: {
    eyebrow: 'Plans',
    heading: 'Pricing',
    body: 'Start alone, grow into a team. Every plan publishes the same validated pages.',
    solo: { name: 'Solo', price: '$9', period: 'per month', body: 'One project, and everything to publish it.', cta: 'Choose Solo' },
    team: {
      name: 'Team',
      price: '$29',
      period: 'per month',
      badge: 'Popular',
      body: 'Unlimited projects and priority support.',
      cta: 'Choose Team',
    },
  },
  quotes: {
    eyebrow: 'What teams notice',
    heading: 'Loved by teams',
    body: 'A builder can feel fast without becoming careless.',
    items: [
      {
        quote: 'The best page-building experience we have tried. Speed and quality, finally in one place.',
        author: 'Sara Haddad',
        role: 'Founder',
        company: 'Madar',
      },
      {
        quote: 'We moved from a rough idea to a coherent launch page without fighting the system.',
        author: 'Maya Chen',
        role: 'Product lead',
        company: 'Northstar',
      },
    ],
  },
  faq: {
    eyebrow: 'Answers, upfront',
    heading: 'Everything you need before you start building',
    body: 'Straight answers about templates, customization, and document safety.',
    items: [
      {
        question: 'Can I customize every template?',
        answer: 'Yes. A template inserts ordinary registered blocks, so every supported property remains editable.',
      },
      {
        question: 'Does inserting a template create many undo steps?',
        answer: 'No. The complete composition is validated and inserted as one atomic transaction.',
      },
      {
        question: 'Will the sections work on mobile?',
        answer: 'Each professional block uses responsive, container-aware layouts and logical spacing.',
      },
      {
        question: 'Can the same page be used in Arabic?',
        answer: 'Yes. The document direction can switch to RTL without maintaining a separate component set.',
      },
    ],
  },
  form: {
    eyebrow: 'Build something consequential',
    heading: 'Start with the outcome you want to create',
    body: 'A flexible native form for enquiries, applications, bookings, and custom workflows.',
    name: 'Name',
    email: 'Work email',
    websiteType: 'What are you building?',
    websitePlaceholder: 'Choose a website type',
    options: ['Product or SaaS', 'Commerce', 'Portfolio or studio', 'Professional services'],
    timeline: 'Ideal launch date',
    brief: 'What must this website achieve?',
    briefHelper: 'A few direct sentences are enough.',
    submitLabel: 'Send the brief',
    footerNote: 'Every field, label, action, and visual treatment remains editable.',
  },
  promo: {
    label: 'Ready when the page matters',
    headline: 'Begin with a complete professional system, then make it unmistakably yours',
    body: 'Choose a template or compose from the full block catalog. Every part stays editable and every change remains reversible.',
    primary: 'Open templates',
    secondary: 'Browse all blocks',
  },
  newsletter: {
    eyebrow: 'Product notes',
    heading: 'Build the next version with us',
    body: 'A concise note about new blocks, templates, and the decisions behind them.',
    emailLabel: 'Work email',
    placeholder: 'name@company.com',
    buttonLabel: 'Join the list',
    privacy: 'No noise. Unsubscribe in one click.',
  },
  inline: {
    title: 'Inline editing',
    message: 'Edit me in place',
    story: 'Select this line and make it bold.',
  },
  codeView: {
    title: 'Code view editing',
    heading: 'Build pages your kernel can prove',
    body: 'Every edit passes through one door, and every edit can be undone.',
  },
};

const AR: LandingCopy = {
  title: 'صفحة CraftKit',
  announcement: {
    label: 'جديد',
    message: 'قوالب صفحات احترافية متاحة الآن داخل المحرر.',
    linkLabel: 'تصفّح المكتبة',
  },
  hero: {
    eyebrow: 'منشئ المواقع الاحترافي',
    heading: 'صفحات يثبت المحرّك صحّتها قبل نشرها',
    body: 'صمّم تجربة متكاملة جاهزة للنشر من أقسام احترافية، وكل تعديل يُتحقَّق منه ويمكن التراجع عنه.',
    trustLine: 'قوالب أصلية · متجاوبة تلقائيًا · عربية من اليمين إلى اليسار',
  },
  ctaStart: 'ابدأ الآن',
  ctaDocs: 'اقرأ التوثيق',
  logos: {
    eyebrow: 'لفرق تطمح إلى الأفضل',
    heading: 'أساس موثوق من الفكرة الأولى حتى الإطلاق',
    body: 'فرق المنتجات والاستوديوهات والمتاجر تعمل بلغة تصميم احترافية واحدة.',
    items: [
      { name: 'مدار', descriptor: 'منتجات' },
      { name: 'نقطة', descriptor: 'تصميم' },
      { name: 'سوق البلد', descriptor: 'تجارة' },
      { name: 'رافد', descriptor: 'عمليات' },
      { name: 'ميدان', descriptor: 'أبحاث' },
    ],
  },
  marquee: {
    label: 'قدرات احترافية',
    items: [
      { title: 'متجاوب', meta: 'يتكيّف مع الحاوية' },
      { title: 'سهل الوصول', meta: 'بنية دلالية' },
      { title: 'عربي أولًا', meta: 'اتجاه منطقي' },
      { title: 'مرتبط بالرموز', meta: 'قابل لإعادة التلوين' },
      { title: 'تعديل ذرّي', meta: 'تراجع موثوق' },
      { title: 'جاهز للذكاء الاصطناعي', meta: 'أوامر مُتحقَّق منها' },
    ],
  },
  carousel: {
    eyebrow: 'نظام بصري متكامل',
    heading: 'من لقطة أولى قوية إلى قصة كاملة',
    body: 'كل شريحة متجاوبة وسهلة الوصول وقابلة للتعديل وآمنة للنشر.',
    items: [
      {
        label: '١ · التركيب',
        title: 'ابدأ ببنية احترافية جاهزة',
        body: 'استخدم أقسامًا وقوالب كاملة بدل إعادة بناء الهيكل نفسه في كل صفحة.',
        imageAlt: 'فريق منتج يخطط معًا لإطلاق جديد',
        action: 'تصفّح القوالب',
      },
      {
        label: '٢ · التخصيص',
        title: 'شكّل كل قسم بأدوات واضحة',
        body: 'الخطوط والمسافات والتخطيط والألوان والحركة والوسائط والمحتوى كلها قابلة للفحص.',
        imageAlt: 'مصممة تضبط نظام واجهة متجاوبًا',
        action: 'اكتشف التخصيص',
      },
      {
        label: '٣ · الإثبات',
        title: 'انشر من مستند يتحقق منه المحرّك',
        body: 'تعديلات ذرّية وروابط آمنة وتركيب حتمي، فتبقى الجودة جزءًا من البنية.',
        imageAlt: 'لوحة تحليلات تُظهر إطلاقًا ناجحًا',
        action: 'اقرأ عن البنية',
      },
    ],
  },
  showcaseAlt: 'شبكة من الألواح الملوّنة تُرى من الأعلى مباشرة.',
  about: {
    eyebrow: 'مصمَّم كنظام',
    heading: 'أسرع في العمل دون أن تتنازل عن الجودة أو التحكم',
    body: 'يجمع CraftKit مفردات تصميم منتقاة بعناية مع محرّك تعديل حتمي، فتحصل على منشئ يبقى معبّرًا وواضحًا وآمنًا مهما كبر موقعك.',
    highlights: [
      { title: 'باب واحد مُتحقَّق منه', body: 'كل تعديل معاملة شفافة يمكن التراجع عنها بثقة.' },
      { title: 'لغة تصميم حقيقية', body: 'المسافات والخطوط والأسطح والحركة كلها مرتبطة برموز التصميم.' },
    ],
    link: 'تعرّف على البنية',
  },
  story: {
    heading: 'لماذا يصمد',
    before: 'كل تعديل هو ',
    bold: 'معاملة واحدة',
    between: ' تمر عبر ',
    link: 'باب مُتحقَّق منه',
    after: '، فلا تفتح حرية التصميم طريقًا ثانيًا لتغيير المستند.',
  },
  bento: {
    eyebrow: 'كل شيء يعمل معًا',
    heading: 'نظام بناء احترافي، لا كومة من الأدوات المتفرقة',
    body: 'ركّب أقسامًا غنية، وحافظ على تناسق التصميم، وأبقِ المستند قابلًا للنقل.',
    items: [
      {
        kicker: 'المفردات',
        title: '٣٢ قسمًا تسويقيًا جاهزًا للإنتاج',
        body: 'من الشرائح واللافتات والمعارض والفيديو إلى المنتجات والنماذج والمقارنات والمحتوى التحريري.',
        metric: '٣٢',
      },
      { kicker: 'القوالب', title: 'صفحات كاملة بخطوة واحدة', body: 'ابدأ بتخطيط متناسق ثم حسّن كل قسم على حدة.', metric: '٤' },
      { kicker: 'الأمان', title: 'تعديلات ذرّية', body: 'التحقق يحدث قبل أن يتغيّر المستند.' },
      { kicker: 'الانتشار', title: 'متجاوب وعربي أولًا', body: 'الخصائص المنطقية واستعلامات الحاوية تتكيّف دون حلول هشّة.' },
    ],
  },
  stats: {
    eyebrow: 'جودة يمكنك فحصها',
    heading: 'نقطة انطلاق أقوى لكل إطلاق',
    body: 'صُمّمت المكتبة لتختصر الإعداد المتكرر، مع إبقاء كل قرار قابلًا للتعديل.',
    items: [
      { value: '٣٢', label: 'قسمًا تسويقيًا', detail: 'تغطي رحلة العميل كاملة' },
      { value: '٤', label: 'قوالب صفحات', detail: 'تُدرج في معاملة واحدة' },
      { value: '١٠٠٪', label: 'مرتبط بالرموز', detail: 'لا قيم سحرية تكسر الثيم' },
      { value: '٢', label: 'اتجاهان للكتابة', detail: 'من نموذج المستند نفسه' },
    ],
  },
  features: {
    eyebrow: 'مبني للعمل الحقيقي',
    heading: 'لماذا CraftKit',
    body: 'الضمانات الأساسية لا تراها وأنت تصمم، لكنك تعتمد عليها حين تنشر.',
    items: [
      { kicker: 'متوقَّع', icon: '١', title: 'حتمي', body: 'البذرة نفسها تعطي السجل نفسه، حرفًا بحرف.' },
      { kicker: 'محمي', icon: '٢', title: 'محكم', body: 'باب واحد مُتحقَّق منه، ولا طريق ثانٍ لتغيير المستند.' },
      { kicker: 'عالمي', icon: '٣', title: 'ثنائي الاتجاه', body: 'من اليمين إلى اليسار ومن اليسار إلى اليمين بالمستند نفسه.' },
    ],
  },
  pricing: {
    eyebrow: 'الخطط',
    heading: 'الأسعار',
    body: 'ابدأ وحدك ثم انتقل إلى فريق كامل. كل خطة تنشر الصفحات المُتحقَّق منها نفسها.',
    solo: { name: 'فردي', price: '٩ د.أ', period: 'شهريًا', body: 'مشروع واحد وكل ما يلزم لنشره.', cta: 'اختر الخطة الفردية' },
    team: {
      name: 'الفريق',
      price: '٢٩ د.أ',
      period: 'شهريًا',
      badge: 'الأكثر طلبًا',
      body: 'مشاريع غير محدودة ودعم بأولوية.',
      cta: 'اختر خطة الفريق',
    },
  },
  quotes: {
    eyebrow: 'ما تلاحظه الفرق',
    heading: 'فرق تحب العمل به',
    body: 'يمكن للمنشئ أن يكون سريعًا دون أن يكون متهاونًا.',
    items: [
      {
        quote: 'أفضل تجربة بناء صفحات جربناها. أخيرًا اجتمعت السرعة والجودة في مكان واحد.',
        author: 'سارة حداد',
        role: 'مؤسِّسة',
        company: 'مدار',
      },
      {
        quote: 'انتقلنا من فكرة أولية إلى صفحة إطلاق متماسكة في عمّان دون أن نصارع النظام.',
        author: 'مايا الخطيب',
        role: 'قائدة المنتج',
        company: 'رافد',
      },
    ],
  },
  faq: {
    eyebrow: 'إجابات واضحة',
    heading: 'كل ما تحتاج معرفته قبل أن تبدأ البناء',
    body: 'إجابات مباشرة عن القوالب والتخصيص وأمان المستند.',
    items: [
      {
        question: 'هل يمكنني تخصيص كل قالب؟',
        answer: 'نعم. القالب يُدرج أقسامًا مسجّلة عادية، فتبقى كل خاصية مدعومة قابلة للتعديل.',
      },
      {
        question: 'هل يُنشئ إدراج القالب خطوات تراجع كثيرة؟',
        answer: 'لا. التركيب الكامل يُتحقَّق منه ويُدرج في معاملة ذرّية واحدة.',
      },
      {
        question: 'هل تعمل الأقسام على الجوال؟',
        answer: 'كل قسم احترافي يستخدم تخطيطًا متجاوبًا يراعي الحاوية ومسافات منطقية.',
      },
      {
        question: 'هل يمكن استخدام الصفحة نفسها بالعربية؟',
        answer: 'نعم. يتحوّل اتجاه المستند إلى اليمين دون الحاجة إلى مجموعة مكوّنات منفصلة.',
      },
    ],
  },
  form: {
    eyebrow: 'ابنِ شيئًا يُحدث فرقًا',
    heading: 'ابدأ بالنتيجة التي تريد تحقيقها',
    body: 'نموذج أصلي مرن للاستفسارات والطلبات والحجوزات وسير العمل الخاص بك.',
    name: 'الاسم',
    email: 'بريد العمل',
    websiteType: 'ماذا تبني؟',
    websitePlaceholder: 'اختر نوع الموقع',
    options: ['منتج أو خدمة سحابية', 'متجر إلكتروني', 'معرض أعمال أو استوديو', 'خدمات مهنية'],
    timeline: 'موعد الإطلاق المثالي',
    brief: 'ما الذي يجب أن يحققه هذا الموقع؟',
    briefHelper: 'تكفي بضع جمل مباشرة.',
    submitLabel: 'أرسل الملخص',
    footerNote: 'كل حقل وعنوان وإجراء ومعالجة بصرية يبقى قابلًا للتعديل.',
  },
  promo: {
    label: 'جاهز حين تهمّ الصفحة',
    headline: 'ابدأ بنظام احترافي متكامل، ثم اجعله يحمل هويتك بوضوح',
    body: 'اختر قالبًا أو ركّب صفحتك من مكتبة الأقسام كاملة. كل جزء يبقى قابلًا للتعديل وكل تغيير يمكن التراجع عنه.',
    primary: 'افتح القوالب',
    secondary: 'تصفّح كل الأقسام',
  },
  newsletter: {
    eyebrow: 'ملاحظات المنتج',
    heading: 'ابنِ الإصدار القادم معنا',
    body: 'رسالة موجزة عن الأقسام والقوالب الجديدة والقرارات التي تقف خلفها.',
    emailLabel: 'بريد العمل',
    placeholder: 'name@company.com',
    buttonLabel: 'انضم إلى القائمة',
    privacy: 'بلا إزعاج. يمكنك إلغاء الاشتراك بنقرة واحدة.',
  },
  inline: {
    title: 'التحرير المباشر',
    message: 'عدّلني في مكاني',
    story: 'حدّد هذا السطر واجعله عريضًا.',
  },
  codeView: {
    title: 'تحرير الشيفرة',
    heading: 'صفحات يثبت المحرّك صحّتها قبل نشرها',
    body: 'كل تعديل يمر من باب واحد، ويمكن التراجع عنه.',
  },
};

export const LANDING_COPY: Readonly<Record<LandingLanguage, LandingCopy>> = Object.freeze({
  en: EN,
  ar: AR,
});

/** The copy for a document direction: Arabic for right to left, English otherwise. */
export function landingCopy(dir: 'ltr' | 'rtl'): LandingCopy {
  return LANDING_COPY[dir === 'rtl' ? 'ar' : 'en'];
}
