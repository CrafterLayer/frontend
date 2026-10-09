import { defineTemplate, footer, header, json, money, photo, type NavLink } from './build';
import type { TemplateLang } from './types';

/*
  SaaS launch (`saas-launch` / `saas-launch-ar`) — DESIGN §B.3.

  header → split hero with a product shot → logo cloud → bento (featured,
  tall, small, wide: fills the 12- and 6-column mosaics with no blank cell)
  → stats with their own body → split content with a photo → testimonials
  (2 × 2) → pricing as a comparison table (three plans, an action on every
  plan, no repeated label) → FAQ → newsletter → footer.

  Pricing uses `comparisonTable` rather than `pricing`/`pricingPlan`: those two
  render fixed English words ("Plans", "per month", "Popular") that an Arabic
  page cannot change. The comparison table carries every label as copy.
*/

const EN = {
  brand: 'Masar',
  nav: [
    { label: 'Product', href: '#product' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Customers', href: '#customers' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Start free', href: '#pricing' },
  hero: {
    eyebrow: 'Product planning for growing teams',
    heading: 'Plan, ship and learn in one calm workspace',
    body: 'Masar connects your roadmap, delivery and customer feedback, so every release traces back to a decision the whole team understands.',
    trustLine: 'Free for 14 days · No card needed · Arabic and English',
    primary: 'Create your workspace',
    secondary: 'Book a demo',
  },
  logos: {
    eyebrow: 'Trusted by product teams',
    heading: 'Teams from Riyadh to Amman run their releases on Masar',
    items: [
      { name: 'Qamar Pay', descriptor: 'Fintech' },
      { name: 'Nakhla', descriptor: 'Logistics' },
      { name: 'Sahab Cloud', descriptor: 'Infrastructure' },
      { name: 'Wasel', descriptor: 'Delivery' },
      { name: 'Dana Health', descriptor: 'Health tech' },
      { name: 'Rawaj', descriptor: 'E-commerce' },
    ],
  },
  bento: {
    eyebrow: 'Everything in one place',
    heading: 'A workspace that keeps the why beside the work',
    body: 'Roadmaps, specs, releases and feedback live together, so nobody rebuilds context before a decision.',
    items: [
      {
        kicker: 'Roadmaps',
        title: 'One living roadmap for every team',
        body: 'Link goals to the work that moves them and watch progress update itself as tasks close.',
        metric: '3.4× faster planning',
      },
      {
        kicker: 'Feedback',
        title: 'Customer voice, sorted',
        body: 'Bring requests from support, sales and interviews into one inbox and tie each to the right opportunity.',
      },
      {
        kicker: 'Releases',
        title: 'Release notes, ready',
        body: 'Every finished task becomes a clear release note your customers can read.',
      },
      {
        kicker: 'Insights',
        title: 'Measure what each release changed',
        body: 'Track adoption and outcomes per feature, then share one honest report with leadership.',
      },
    ],
  },
  stats: {
    eyebrow: 'Customer results',
    heading: 'Less status chasing, more shipped work',
    body: 'Averages from 120 product teams in their first six months on Masar.',
    items: [
      {
        value: '42%',
        label: 'Faster from idea to release',
        detail: 'Median across customer teams',
      },
      { value: '6 hrs', label: 'Saved by each lead every week', detail: 'Fewer status meetings' },
      {
        value: '3×',
        label: 'More feedback tied to work',
        detail: 'Requests linked to the roadmap',
      },
      { value: '99.95%', label: 'Uptime last year', detail: 'Hosted in the region' },
    ],
  },
  content: {
    eyebrow: 'How teams use it',
    heading: 'From a scattered backlog to a plan everyone can read',
    body: 'Start with the board your team already knows. Masar adds goals, owners and evidence around it, so planning sessions end with decisions instead of more questions.',
    highlights: [
      {
        title: 'A goal on every card',
        body: 'Each task shows the outcome it serves and who owns it.',
      },
      {
        title: 'Bilingual by design',
        body: 'Write in Arabic or English; the workspace mirrors right to left on its own.',
      },
      {
        title: 'Works with your tools',
        body: 'Sync code, design files and chat so updates arrive where people already work.',
      },
      {
        title: 'Reviews in minutes',
        body: 'A weekly digest shows what moved, what slipped and why.',
      },
    ],
    link: 'Take the product tour',
  },
  quotes: {
    eyebrow: 'Customers',
    heading: 'Product teams that plan with confidence',
    items: [
      {
        quote:
          'Our planning meeting went from three hours to forty minutes, and nobody leaves asking what we agreed.',
        author: 'Lina Haddad',
        role: 'Head of Product',
        company: 'Qamar Pay',
      },
      {
        quote:
          'We finally see which customer requests turned into shipped features. Sales stopped guessing.',
        author: 'Omar Khalil',
        role: 'VP Engineering',
        company: 'Nakhla',
      },
      {
        quote:
          'The Arabic interface is not an afterthought. Our whole operations team works in it every day.',
        author: 'Sara Al-Mutairi',
        role: 'Operations Director',
        company: 'Wasel',
      },
      {
        quote:
          'Release notes used to take a full day every sprint. Now they are ready before the demo.',
        author: 'Yousef Nasser',
        role: 'Product Manager',
        company: 'Rawaj',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    heading: 'Simple plans that grow with your team',
    body: 'Every plan includes unlimited projects and the full Arabic and English interface. Prices are per member, billed monthly.',
    featureLabel: 'What is included',
    scrollLabel: 'Plan comparison, scroll for more',
    includedLabel: 'Included',
    excludedLabel: 'Not included',
    plans: [
      {
        name: 'Starter',
        description: 'For small teams finding their rhythm',
        price: money(9, 'USD', 'en'),
        period: 'per member / month',
        actionLabel: 'Choose Starter',
        actionHref: '#signup-starter',
      },
      {
        name: 'Growth',
        description: 'For teams scaling quickly',
        price: money(19, 'USD', 'en'),
        period: 'per member / month',
        badge: 'Most popular',
        actionLabel: 'Choose Growth',
        actionHref: '#signup-growth',
        featured: true,
      },
      {
        name: 'Enterprise',
        description: 'For organisations with special requirements',
        price: 'Custom',
        actionLabel: 'Talk to sales',
        actionHref: '#sales',
      },
    ],
    rows: [
      { feature: 'Members', values: ['Up to 10', 'Up to 100', 'Unlimited'] },
      {
        feature: 'Roadmaps and boards',
        values: ['Included', 'Included', 'Included'],
        highlight: true,
      },
      { feature: 'Customer feedback inbox', values: ['—', 'Included', 'Included'] },
      { feature: 'Release notes and insights', values: ['—', 'Included', 'Included'] },
      { feature: 'Single sign-on and audit log', values: ['—', '—', 'Included'] },
      { feature: 'Support', values: ['Email', 'Priority chat', 'Dedicated manager'] },
    ],
    note: 'Prices in US dollars, excluding VAT. Change or cancel your plan at any time.',
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions before you start',
    items: [
      {
        question: 'Can we move our existing backlog?',
        answer:
          'Yes. Import from a spreadsheet or connect your current tracker, and Masar keeps owners, labels and history.',
      },
      {
        question: 'Is our data hosted in the region?',
        answer: 'Yes. Workspaces are hosted in Gulf data centres with encrypted daily backups.',
      },
      {
        question: 'Do guests need a paid seat?',
        answer:
          'No. Invite clients and partners as guests to the spaces they need, free on every plan.',
      },
      {
        question: 'Can we switch plans later?',
        answer:
          'Upgrade or downgrade at any time. Billing adjusts on your next invoice and nothing is lost.',
      },
    ],
  },
  newsletter: {
    eyebrow: 'Newsletter',
    heading: 'One useful product letter a month',
    body: 'Practical notes on planning, discovery and shipping, written by product leads in the region.',
    emailLabel: 'Work email',
    placeholder: 'name@company.com',
    buttonLabel: 'Subscribe',
    privacy: 'No spam. Unsubscribe in one click.',
  },
  footer: {
    tagline: 'Product planning for teams that ship in Arabic and English.',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Features', href: '#product' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Security', href: '#security' },
          { label: 'Changelog', href: '#changelog' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '#about' },
          { label: 'Careers', href: '#careers' },
          { label: 'Contact', href: '#contact' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Help centre', href: '#help' },
          { label: 'Guides', href: '#guides' },
          { label: 'Service status', href: '#status' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'مسار',
  nav: [
    { label: 'المنتج', href: '#product' },
    { label: 'الأسعار', href: '#pricing' },
    { label: 'العملاء', href: '#customers' },
    { label: 'الأسئلة الشائعة', href: '#faq' },
  ],
  headerCta: { label: 'ابدأ مجاناً', href: '#pricing' },
  hero: {
    eyebrow: 'تخطيط المنتجات للفرق التي تنمو',
    heading: 'خطّط وأطلق وتعلّم من مساحة عمل واحدة هادئة',
    body: 'يربط مسار خارطة الطريق بالتنفيذ وآراء العملاء، فتعود كل ميزة تُطلقها إلى قرار يفهمه الفريق كله.',
    trustLine: 'تجربة مجانية 14 يوماً · بلا بطاقة ائتمان · بالعربية والإنجليزية',
    primary: 'أنشئ مساحة عملك',
    secondary: 'احجز عرضاً توضيحياً',
  },
  logos: {
    eyebrow: 'تثق بنا فرق المنتجات',
    heading: 'فرق من الرياض إلى عمّان تدير إصداراتها على مسار',
    items: [
      { name: 'قمر باي', descriptor: 'تقنية مالية' },
      { name: 'نخلة', descriptor: 'خدمات لوجستية' },
      { name: 'سحاب كلاود', descriptor: 'بنية تحتية' },
      { name: 'واصل', descriptor: 'توصيل' },
      { name: 'دانة الصحية', descriptor: 'تقنية صحية' },
      { name: 'رواج', descriptor: 'تجارة إلكترونية' },
    ],
  },
  bento: {
    eyebrow: 'كل شيء في مكان واحد',
    heading: 'مساحة عمل تُبقي السبب بجانب العمل',
    body: 'خرائط الطريق والمواصفات والإصدارات وآراء العملاء في مكان واحد، فلا يضطر أحد لإعادة بناء السياق قبل كل قرار.',
    items: [
      {
        kicker: 'خرائط الطريق',
        title: 'خارطة طريق حيّة لكل الفرق',
        body: 'اربط الأهداف بالمهام التي تحققها، وتابع التقدّم يتحدّث تلقائياً كلما أُنجزت مهمة.',
        metric: 'تخطيط أسرع 3.4×',
      },
      {
        kicker: 'آراء العملاء',
        title: 'صوت العميل مرتّب',
        body: 'اجمع الطلبات من الدعم والمبيعات والمقابلات في صندوق واحد، واربط كلاً منها بالفرصة المناسبة.',
      },
      {
        kicker: 'الإصدارات',
        title: 'ملاحظات إصدار جاهزة',
        body: 'كل مهمة تُنجز تتحول إلى ملاحظة إصدار واضحة يقرؤها عملاؤك.',
      },
      {
        kicker: 'التحليلات',
        title: 'قِس أثر كل إصدار',
        body: 'تابع استخدام كل ميزة ونتائجها، ثم شارك تقريراً واحداً واضحاً مع الإدارة.',
      },
    ],
  },
  stats: {
    eyebrow: 'نتائج عملائنا',
    heading: 'متابعة أقل للحالة، وإنجاز أكثر',
    body: 'متوسطات من 120 فريق منتج خلال أشهرهم الستة الأولى على مسار.',
    items: [
      { value: '42%', label: 'أسرع من الفكرة إلى الإطلاق', detail: 'الوسيط بين فرق عملائنا' },
      { value: '6 ساعات', label: 'يوفّرها كل قائد فريق أسبوعياً', detail: 'اجتماعات متابعة أقل' },
      { value: '3×', label: 'آراء عملاء مرتبطة بالعمل', detail: 'طلبات مربوطة بخارطة الطريق' },
      { value: '99.95%', label: 'جاهزية الخدمة العام الماضي', detail: 'استضافة داخل المنطقة' },
    ],
  },
  content: {
    eyebrow: 'كيف تستخدمه الفرق',
    heading: 'من قائمة مهام مبعثرة إلى خطة يقرؤها الجميع',
    body: 'ابدأ باللوحة التي يعرفها فريقك. يضيف مسار حولها الأهداف والمسؤولين والأدلة، فتنتهي جلسات التخطيط بقرارات لا بمزيد من الأسئلة.',
    highlights: [
      { title: 'هدف على كل بطاقة', body: 'تُظهر كل مهمة النتيجة التي تخدمها ومن المسؤول عنها.' },
      {
        title: 'ثنائي اللغة من الأساس',
        body: 'اكتب بالعربية أو الإنجليزية، وتنعكس الواجهة من اليمين إلى اليسار تلقائياً.',
      },
      {
        title: 'يتكامل مع أدواتك',
        body: 'زامِن الشيفرة وملفات التصميم والمحادثات لتصل التحديثات حيث يعمل فريقك.',
      },
      { title: 'مراجعة في دقائق', body: 'ملخّص أسبوعي يوضح ما تقدّم وما تأخّر ولماذا.' },
    ],
    link: 'خذ جولة في المنتج',
  },
  quotes: {
    eyebrow: 'عملاؤنا',
    heading: 'فرق منتجات تخطّط بثقة',
    items: [
      {
        quote:
          'اجتماع التخطيط عندنا نزل من ثلاث ساعات إلى أربعين دقيقة، وما عاد أحد يخرج يسأل: على ماذا اتفقنا؟',
        author: 'لينا حداد',
        role: 'رئيسة المنتج',
        company: 'قمر باي',
      },
      {
        quote: 'صرنا نرى أي طلبات العملاء تحوّلت إلى ميزات فعلاً، وتوقف فريق المبيعات عن التخمين.',
        author: 'عمر خليل',
        role: 'نائب رئيس الهندسة',
        company: 'نخلة',
      },
      {
        quote: 'الواجهة العربية ليست إضافة شكلية؛ فريق العمليات كله يعمل عليها كل يوم.',
        author: 'سارة المطيري',
        role: 'مديرة العمليات',
        company: 'واصل',
      },
      {
        quote: 'كانت ملاحظات الإصدار تأخذ يوماً كاملاً في كل دورة، والآن تجهز قبل العرض.',
        author: 'يوسف ناصر',
        role: 'مدير منتج',
        company: 'رواج',
      },
    ],
  },
  pricing: {
    eyebrow: 'الأسعار',
    heading: 'باقات بسيطة تكبر مع فريقك',
    body: 'كل الباقات تشمل مشاريع غير محدودة وواجهة كاملة بالعربية والإنجليزية. السعر لكل عضو ويُدفع شهرياً.',
    featureLabel: 'ما تتضمنه الباقة',
    scrollLabel: 'مقارنة الباقات، مرّر لرؤية المزيد',
    includedLabel: 'متاح',
    excludedLabel: 'غير متاح',
    plans: [
      {
        name: 'الأساسية',
        description: 'للفرق الصغيرة التي تبني إيقاعها',
        price: money(35, 'SAR', 'ar'),
        period: 'لكل عضو شهرياً',
        actionLabel: 'اختر الأساسية',
        actionHref: '#signup-starter',
      },
      {
        name: 'النمو',
        description: 'للفرق التي تتوسع بسرعة',
        price: money(75, 'SAR', 'ar'),
        period: 'لكل عضو شهرياً',
        badge: 'الأكثر طلباً',
        actionLabel: 'اختر النمو',
        actionHref: '#signup-growth',
        featured: true,
      },
      {
        name: 'المؤسسات',
        description: 'للمؤسسات ذات المتطلبات الخاصة',
        price: 'حسب الطلب',
        actionLabel: 'تواصل مع المبيعات',
        actionHref: '#sales',
      },
    ],
    rows: [
      { feature: 'عدد الأعضاء', values: ['حتى 10', 'حتى 100', 'غير محدود'] },
      {
        feature: 'خرائط الطريق واللوحات',
        values: ['متاحة', 'متاحة', 'متاحة'],
        highlight: true,
      },
      { feature: 'صندوق آراء العملاء', values: ['—', 'متاح', 'متاح'] },
      { feature: 'ملاحظات الإصدار والتحليلات', values: ['—', 'متاحة', 'متاحة'] },
      { feature: 'الدخول الموحّد وسجل التدقيق', values: ['—', '—', 'متاح'] },
      { feature: 'الدعم', values: ['بريد إلكتروني', 'محادثة بأولوية', 'مدير حساب مخصّص'] },
    ],
    note: 'الأسعار بالريال السعودي ولا تشمل ضريبة القيمة المضافة. غيّر باقتك أو ألغِها متى شئت.',
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    heading: 'أسئلة قبل أن تبدأ',
    items: [
      {
        question: 'هل يمكننا نقل قائمة المهام الحالية؟',
        answer:
          'نعم. استورد من جدول بيانات أو اربط أداتك الحالية، ويحتفظ مسار بالمسؤولين والتصنيفات والسجل كاملاً.',
      },
      {
        question: 'هل تُستضاف بياناتنا داخل المنطقة؟',
        answer: 'نعم. تُستضاف مساحات العمل في مراكز بيانات خليجية مع نسخ احتياطية مشفّرة يومياً.',
      },
      {
        question: 'هل يحتاج الضيوف إلى مقعد مدفوع؟',
        answer: 'لا. ادعُ عملاءك وشركاءك ضيوفاً إلى المساحات التي يحتاجونها، مجاناً في كل الباقات.',
      },
      {
        question: 'هل يمكننا تغيير الباقة لاحقاً؟',
        answer:
          'رقِّ باقتك أو خفّضها في أي وقت، وتُعدَّل الفاتورة في الدورة التالية دون أن تخسر شيئاً.',
      },
    ],
  },
  newsletter: {
    eyebrow: 'النشرة البريدية',
    heading: 'رسالة مفيدة واحدة عن المنتجات كل شهر',
    body: 'ملاحظات عملية عن التخطيط والاكتشاف والإطلاق، يكتبها قادة منتجات من المنطقة.',
    emailLabel: 'بريد العمل الإلكتروني',
    placeholder: 'name@company.com',
    buttonLabel: 'اشترك',
    privacy: 'بلا رسائل مزعجة، وإلغاء الاشتراك بنقرة واحدة.',
  },
  footer: {
    tagline: 'تخطيط المنتجات لفرق تُطلق بالعربية والإنجليزية.',
    columns: [
      {
        title: 'المنتج',
        links: [
          { label: 'المزايا', href: '#product' },
          { label: 'الأسعار', href: '#pricing' },
          { label: 'الأمان', href: '#security' },
          { label: 'سجل التحديثات', href: '#changelog' },
        ],
      },
      {
        title: 'الشركة',
        links: [
          { label: 'من نحن', href: '#about' },
          { label: 'الوظائف', href: '#careers' },
          { label: 'تواصل معنا', href: '#contact' },
        ],
      },
      {
        title: 'المصادر',
        links: [
          { label: 'مركز المساعدة', href: '#help' },
          { label: 'الأدلة', href: '#guides' },
          { label: 'حالة الخدمة', href: '#status' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'tall', emphasis: 'accent' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'wide', emphasis: 'neutral' },
] as const;

export const saasTemplate = defineTemplate({
  key: 'saas',
  category: 'saas',
  baseId: 'saas-launch',
  name: { en: 'SaaS launch', ar: 'إطلاق منتج رقمي' },
  description: {
    en: 'A software launch page with a product shot, features, results, pricing plans and FAQ.',
    ar: 'صفحة إطلاق لمنتج برمجي مع صورة المنتج والمزايا والنتائج وباقات الأسعار والأسئلة الشائعة.',
  },
  thumbnail: { topic: 'saas', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `saas-${lang}`;
    const heroPhoto = photo('saas', 0, lang);
    const contentPhoto = photo('saas', 2, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#signup',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#demo',
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'wide',
      radius: 'md',
      width: 'full',
      align: 'center',
    });
    page.section(
      'hero',
      'hero',
      {
        variant: 'split',
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('logos', 'logoCloud', {
      eyebrow: copy.logos.eyebrow,
      heading: copy.logos.heading,
      items: json(copy.logos.items),
      variant: 'minimal',
      columns: '6',
      align: 'center',
      tone: 'transparent',
      spacing: 'md',
      width: 'wide',
    });

    page.section('bento', 'bento-grid', {
      eyebrow: copy.bento.eyebrow,
      heading: copy.bento.heading,
      body: copy.bento.body,
      layout: 'mosaic',
      items: json(copy.bento.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] }))),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'cards',
      columns: '4',
      headerLayout: 'split',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('content', 'content-section', {
      eyebrow: copy.content.eyebrow,
      heading: copy.content.heading,
      body: copy.content.body,
      highlights: json(copy.content.highlights),
      imageSrc: contentPhoto.src,
      imageAlt: contentPhoto.alt,
      mediaPosition: 'start',
      link: { label: copy.content.link, href: '#tour' },
      layout: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'cards',
      columns: '2',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('pricing', 'comparisonTable', {
      eyebrow: copy.pricing.eyebrow,
      heading: copy.pricing.heading,
      body: copy.pricing.body,
      featureLabel: copy.pricing.featureLabel,
      scrollLabel: copy.pricing.scrollLabel,
      includedLabel: copy.pricing.includedLabel,
      excludedLabel: copy.pricing.excludedLabel,
      plans: json(copy.pricing.plans),
      rows: json(copy.pricing.rows),
      note: copy.pricing.note,
      emptyValue: '—',
      showActions: true,
      variant: 'boxed',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'cards',
      openFirst: true,
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('newsletter', 'newsletter', {
      eyebrow: copy.newsletter.eyebrow,
      heading: copy.newsletter.heading,
      body: copy.newsletter.body,
      emailLabel: copy.newsletter.emailLabel,
      placeholder: copy.newsletter.placeholder,
      buttonLabel: copy.newsletter.buttonLabel,
      privacy: copy.newsletter.privacy,
      action: '/subscribe',
      variant: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.place(
      footer(
        { prefix, brand: copy.brand, tagline: copy.footer.tagline, columns: copy.footer.columns },
        lang,
      ),
    );
  },
});
