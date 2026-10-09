import { defineTemplate, footer, header, json, photo, type NavLink } from '../build';
import type { TemplateLang } from '../types';

/*
  Portfolio and CV (`portfolio-cv` / `portfolio-cv-ar`) — agent-script
  DESIGN §B.3.

  header (Work · About · Experience · Contact) → split hero with a portrait,
  the name and the role → about (content split with a work photo) → three
  figures → six projects (fills 2 and 3 columns) → the experience timeline
  (vertical process steps, the years as each step's meta) → six skills →
  testimonials (2 × 2) → contact with a project form → footer.

  The person is fictional: «رنا حداد», a product designer in Amman.
*/

const PORTRAIT: readonly [string, number] = ['people', 20];
const ABOUT_PHOTO: readonly [string, number] = ['agency', 7];
/** Project photo index in TEMPLATE_PHOTOS.portfolio, per project. */
const WORK_PHOTOS = [0, 1, 2, 3, 4, 5] as const;
const WORK_HREFS = [
  '#work-wallet',
  '#work-design-system',
  '#work-banking',
  '#work-cafe-identity',
  '#work-patient-journey',
  '#work-fleet-console',
] as const;

interface Project {
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
}

const EN = {
  brand: 'Rana Haddad',
  nav: [
    { label: 'Work', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Experience', href: '#experience' },
    { label: 'Contact', href: '#contact' },
  ] as NavLink[],
  headerCta: { label: 'Hire me', href: '#contact' },
  hero: {
    eyebrow: 'Product designer · Amman, working worldwide',
    heading: 'I design calm, bilingual products people trust',
    body: 'Nine years shaping banking, delivery and health apps for teams across the Gulf and the Levant, in Arabic and English from the first sketch.',
    trustLine: 'Open to new projects from November 2026',
    primary: 'See selected work',
    secondary: 'Download my CV',
  },
  about: {
    eyebrow: 'About',
    heading: 'Design that starts with the people who will use it',
    body: "I began as a visual designer in an Amman studio and moved into product design when I saw how much a clear screen could save someone's day. Today I lead research, interface and design-system work, and I make sure the Arabic version is designed, not just translated.",
    highlights: [
      {
        title: 'Research first',
        body: 'Interviews and usability tests come before pixels, so every decision has a reason.',
      },
      {
        title: 'Right to left by default',
        body: 'Layouts, type and icons are planned for both directions from day one.',
      },
      {
        title: 'Shipped, not just shown',
        body: 'I stay with engineering until the release is live and its impact is measured.',
      },
    ],
    link: 'Read my design principles',
  },
  stats: {
    eyebrow: 'In numbers',
    heading: 'A decade of shipping products people use every day',
    body: 'Counted across full-time roles and independent projects since 2016.',
    items: [
      { value: '9 yrs', label: 'In product design', detail: 'Since 2016' },
      { value: '40+', label: 'Products and features shipped', detail: 'Web and mobile' },
      { value: '18', label: 'Clients across the region', detail: 'From start-ups to banks' },
    ],
  },
  work: {
    eyebrow: 'Selected projects',
    heading: 'Recent work, from first research to launch',
    body: 'A few projects I can share in public. More case studies are available on request.',
    actionLabel: 'Read the case study',
    items: [
      {
        category: 'Mobile app · Fintech',
        title: 'Qamar Pay wallet redesign',
        summary:
          'Rebuilt onboarding and payments for a digital wallet used by 1.2 million people, in Arabic and English.',
        metrics: [
          { label: 'Onboarding completion', value: '+38%' },
          { label: 'Support tickets', value: '−24%' },
        ],
      },
      {
        category: 'Design system · Logistics',
        title: 'Nakhla design system',
        summary:
          'A bilingual component library and design tokens shared by four product teams on two platforms.',
        metrics: [
          { label: 'Components', value: '120' },
          { label: 'Design-to-build time', value: '−30%' },
        ],
      },
      {
        category: 'Dashboard · Banking',
        title: 'Small-business banking dashboard',
        summary:
          'Turned twelve reports into one daily view of cash flow, invoices and payroll for business owners.',
        metrics: [{ label: 'Daily active users', value: '3×' }],
      },
      {
        category: 'Brand identity · Hospitality',
        title: 'Identity for a Riyadh speciality café',
        summary: 'A bilingual logotype, menu system and signage for a speciality café with three branches.',
        metrics: [{ label: 'Branches', value: '3' }],
      },
      {
        category: 'Research · Health',
        title: 'Dana Health patient journey',
        summary:
          'Mapped the patient journey across clinics and the app, then redesigned booking and reminders.',
        metrics: [{ label: 'Missed appointments', value: '−19%' }],
      },
      {
        category: 'Web app · Delivery',
        title: 'Wasel fleet operations console',
        summary:
          'A live map and dispatch console for operators who manage 900 couriers every day.',
        metrics: [{ label: 'Dispatch time', value: '−22%' }],
      },
    ] as Project[],
  },
  experience: {
    eyebrow: 'Experience',
    heading: 'Where I have worked',
    body: 'Ten years across studios, scale-ups and independent practice.',
    items: [
      {
        title: 'Lead product designer · Qamar Pay',
        body: 'Lead five designers across payments, cards and onboarding, and own the design system.',
        meta: '2023 — now',
      },
      {
        title: 'Senior product designer · Nakhla',
        body: 'Designed the shipper app and the operations console, and built the first bilingual design system.',
        meta: '2020 — 2023',
      },
      {
        title: 'Product designer · Wasel',
        body: 'Worked on the courier and customer apps, from research to release, at a fast-growing delivery start-up.',
        meta: '2018 — 2020',
      },
      {
        title: 'Visual designer · Studio Sahab',
        body: 'Brand and web projects for cultural and hospitality clients in Amman.',
        meta: '2016 — 2018',
      },
    ],
  },
  skills: {
    eyebrow: 'Skills',
    heading: 'What I bring to a team',
    body: 'The parts of the work I enjoy most and do best.',
    items: [
      {
        title: 'Product strategy',
        body: 'Framing the problem, setting goals and choosing what not to build.',
      },
      {
        title: 'User research',
        body: 'Interviews, usability tests and journey maps the whole team can use.',
      },
      {
        title: 'Interface design',
        body: 'Clear, accessible screens for web and mobile, in light and dark.',
      },
      {
        title: 'Design systems',
        body: 'Tokens, components and documentation that scale across teams.',
      },
      {
        title: 'Arabic typography',
        body: 'Type pairing, line length and numerals that read naturally right to left.',
      },
      {
        title: 'Prototyping',
        body: 'Interactive prototypes to test ideas with real users before any code.',
      },
    ],
  },
  quotes: {
    eyebrow: 'Kind words',
    heading: 'What colleagues and clients say',
    items: [
      {
        quote:
          'Rana asks the questions nobody else thinks to ask, and the product is better for it every single time.',
        author: 'Omar Khalil',
        role: 'VP Engineering',
        company: 'Nakhla',
      },
      {
        quote:
          'Our Arabic app finally feels native. Customers noticed within a week and our ratings went up.',
        author: 'Sara Al-Mutairi',
        role: 'Head of Product',
        company: 'Qamar Pay',
      },
      {
        quote:
          'She turned a messy brief into a clear plan in two workshops, then delivered ahead of schedule.',
        author: 'Yousef Nasser',
        role: 'Founder',
        company: 'Dana Health',
      },
      {
        quote:
          'The design system Rana built is still the backbone of everything we ship, three years later.',
        author: 'Maha Al-Zahrani',
        role: 'Design Manager',
        company: 'Wasel',
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    heading: "Let's build something useful together",
    body: 'Tell me about your product and timeline. I take on two projects at a time, so each gets my full attention.',
    address: 'Amman, Jordan · Working with teams worldwide',
    availability: 'Replies within two working days',
    formTitle: 'Start a project',
    formBody: 'A few lines about the product, the team and the deadline are enough.',
    nameLabel: 'Your name',
    emailLabel: 'Email address',
    messageLabel: 'About your project',
    submitLabel: 'Send message',
  },
  footer: {
    tagline: 'Product designer in Amman, designing in Arabic and English.',
    columns: [
      {
        title: 'Work',
        links: [
          { label: 'Selected projects', href: '#work' },
          { label: 'Experience', href: '#experience' },
          { label: 'Skills', href: '#skills' },
        ],
      },
      {
        title: 'Elsewhere',
        links: [
          { label: 'LinkedIn', href: '#linkedin' },
          { label: 'Behance', href: '#behance' },
          { label: 'Dribbble', href: '#dribbble' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Email me', href: 'mailto:hello@example.com' },
          { label: 'Download CV', href: '#cv' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'رنا حداد',
  nav: [
    { label: 'أعمالي', href: '#work' },
    { label: 'نبذة عني', href: '#about' },
    { label: 'الخبرات', href: '#experience' },
    { label: 'تواصل', href: '#contact' },
  ],
  headerCta: { label: 'لنعمل معاً', href: '#contact' },
  hero: {
    eyebrow: 'مصممة منتجات رقمية · عمّان، وأعمل مع فرق حول العالم',
    heading: 'أصمّم منتجات هادئة ثنائية اللغة يثق بها الناس',
    body: 'تسع سنوات في تصميم تطبيقات البنوك والتوصيل والصحة لفرق في الخليج وبلاد الشام، بالعربية والإنجليزية منذ أول رسمة.',
    trustLine: 'متاحة لمشاريع جديدة ابتداءً من نوفمبر 2026',
    primary: 'شاهد أعمالي',
    secondary: 'حمّل سيرتي الذاتية',
  },
  about: {
    eyebrow: 'نبذة عني',
    heading: 'تصميم يبدأ من الناس الذين سيستخدمونه',
    body: 'بدأت مصممة بصرية في استوديو بعمّان، وانتقلت إلى تصميم المنتجات حين رأيت كم يمكن لشاشة واضحة أن تختصر على الناس يومهم. اليوم أقود أعمال البحث والواجهات وأنظمة التصميم، وأحرص على أن تُصمَّم النسخة العربية لا أن تُترجم فحسب.',
    highlights: [
      {
        title: 'البحث أولاً',
        body: 'مقابلات واختبارات استخدام قبل أي تصميم، ليكون لكل قرار سبب واضح.',
      },
      {
        title: 'من اليمين إلى اليسار من الأساس',
        body: 'تخطيط الصفحات والخطوط والأيقونات للاتجاهين منذ اليوم الأول.',
      },
      {
        title: 'منتج يُطلق لا عرض يُشاهد',
        body: 'أبقى مع فريق التطوير حتى يصل الإصدار إلى الناس ونقيس أثره.',
      },
    ],
    link: 'اقرأ مبادئي في التصميم',
  },
  stats: {
    eyebrow: 'بالأرقام',
    heading: 'عقد من إطلاق منتجات يستخدمها الناس كل يوم',
    body: 'محسوبة عبر الوظائف بدوام كامل والمشاريع المستقلة منذ 2016.',
    items: [
      { value: '9 سنوات', label: 'في تصميم المنتجات', detail: 'منذ 2016' },
      { value: '40+', label: 'منتجاً وميزة أُطلقت', detail: 'للويب والجوال' },
      { value: '18', label: 'عميلاً في المنطقة', detail: 'من الشركات الناشئة إلى البنوك' },
    ],
  },
  work: {
    eyebrow: 'مشاريع مختارة',
    heading: 'أعمال حديثة من البحث الأول حتى الإطلاق',
    body: 'بعض المشاريع التي يمكنني مشاركتها علناً، وتتوفر دراسات حالة إضافية عند الطلب.',
    actionLabel: 'اقرأ دراسة الحالة',
    items: [
      {
        category: 'تطبيق جوال · تقنية مالية',
        title: 'إعادة تصميم محفظة قمر باي',
        summary:
          'أعدت بناء رحلة التسجيل والدفع لمحفظة رقمية يستخدمها 1.2 مليون شخص بالعربية والإنجليزية.',
        metrics: [
          { label: 'إكمال التسجيل', value: '+38%' },
          { label: 'تذاكر الدعم', value: '−24%' },
        ],
      },
      {
        category: 'نظام تصميم · خدمات لوجستية',
        title: 'نظام تصميم نخلة',
        summary: 'مكتبة مكوّنات ورموز تصميم ثنائية اللغة تشترك فيها أربعة فرق منتج على منصتين.',
        metrics: [
          { label: 'مكوّناً', value: '120' },
          { label: 'زمن التصميم حتى التنفيذ', value: '−30%' },
        ],
      },
      {
        category: 'لوحة تحكم · خدمات مصرفية',
        title: 'لوحة الخدمات المصرفية للمنشآت الصغيرة',
        summary:
          'حوّلت اثني عشر تقريراً إلى عرض يومي واحد للتدفق النقدي والفواتير والرواتب لأصحاب المنشآت.',
        metrics: [{ label: 'المستخدمون النشطون يومياً', value: '3×' }],
      },
      {
        category: 'هوية بصرية · ضيافة',
        title: 'هوية مقهى مختص في الرياض',
        summary: 'شعار ثنائي اللغة ونظام قوائم ولافتات لمقهى مختص بثلاثة فروع.',
        metrics: [{ label: 'الفروع', value: '3' }],
      },
      {
        category: 'بحث · صحة',
        title: 'رحلة المريض في دانة الصحية',
        summary: 'رسمت رحلة المريض بين العيادات والتطبيق، ثم أعدت تصميم الحجز والتذكيرات.',
        metrics: [{ label: 'المواعيد الفائتة', value: '−19%' }],
      },
      {
        category: 'تطبيق ويب · توصيل',
        title: 'لوحة عمليات أسطول واصل',
        summary: 'خريطة حيّة ولوحة توزيع لمشغّلين يديرون 900 مندوب توصيل كل يوم.',
        metrics: [{ label: 'زمن التوزيع', value: '−22%' }],
      },
    ],
  },
  experience: {
    eyebrow: 'الخبرات',
    heading: 'أين عملت',
    body: 'عشر سنوات بين الاستوديوهات والشركات سريعة النمو والعمل المستقل.',
    items: [
      {
        title: 'قائدة تصميم المنتجات · قمر باي',
        body: 'أقود خمسة مصممين في المدفوعات والبطاقات والتسجيل، وأتولى نظام التصميم.',
        meta: '2023 — الآن',
      },
      {
        title: 'مصممة منتجات أولى · نخلة',
        body: 'صمّمت تطبيق الشاحنين ولوحة العمليات، وبنيت أول نظام تصميم ثنائي اللغة.',
        meta: '2020 — 2023',
      },
      {
        title: 'مصممة منتجات · واصل',
        body: 'عملت على تطبيقي المندوبين والعملاء من البحث حتى الإطلاق في شركة توصيل سريعة النمو.',
        meta: '2018 — 2020',
      },
      {
        title: 'مصممة بصرية · استوديو سحاب',
        body: 'مشاريع هوية ومواقع لعملاء في الثقافة والضيافة في عمّان.',
        meta: '2016 — 2018',
      },
    ],
  },
  skills: {
    eyebrow: 'المهارات',
    heading: 'ما أضيفه إلى الفريق',
    body: 'جوانب العمل التي أستمتع بها وأتقنها أكثر من غيرها.',
    items: [
      {
        title: 'استراتيجية المنتج',
        body: 'تحديد المشكلة ووضع الأهداف واختيار ما لا يجب بناؤه.',
      },
      {
        title: 'أبحاث المستخدمين',
        body: 'مقابلات واختبارات استخدام وخرائط رحلة يستفيد منها الفريق كله.',
      },
      {
        title: 'تصميم الواجهات',
        body: 'شاشات واضحة وسهلة الوصول للويب والجوال، بالوضعين الفاتح والداكن.',
      },
      {
        title: 'أنظمة التصميم',
        body: 'رموز ومكوّنات وتوثيق تتوسع مع الفرق.',
      },
      {
        title: 'الطباعة العربية',
        body: 'اختيار الخطوط وطول السطر والأرقام لتُقرأ بسلاسة من اليمين إلى اليسار.',
      },
      {
        title: 'النماذج التفاعلية',
        body: 'نماذج تفاعلية لاختبار الأفكار مع مستخدمين حقيقيين قبل البرمجة.',
      },
    ],
  },
  quotes: {
    eyebrow: 'شهادات',
    heading: 'ماذا يقول الزملاء والعملاء',
    items: [
      {
        quote: 'تطرح رنا الأسئلة التي لا يفكر بها غيرها، ويخرج المنتج أفضل في كل مرة.',
        author: 'عمر خليل',
        role: 'نائب رئيس الهندسة',
        company: 'نخلة',
      },
      {
        quote: 'أصبح تطبيقنا العربي يبدو أصيلاً أخيراً. لاحظ العملاء الفرق خلال أسبوع وارتفعت تقييماتنا.',
        author: 'سارة المطيري',
        role: 'رئيسة المنتج',
        company: 'قمر باي',
      },
      {
        quote: 'حوّلت متطلبات مبعثرة إلى خطة واضحة في ورشتي عمل، ثم سلّمت قبل الموعد.',
        author: 'يوسف ناصر',
        role: 'المؤسس',
        company: 'دانة الصحية',
      },
      {
        quote: 'نظام التصميم الذي بنته رنا ما زال أساس كل ما نطلقه بعد ثلاث سنوات.',
        author: 'مها الزهراني',
        role: 'مديرة التصميم',
        company: 'واصل',
      },
    ],
  },
  contact: {
    eyebrow: 'تواصل',
    heading: 'لنبنِ معاً شيئاً مفيداً',
    body: 'أخبرني عن منتجك وجدولك الزمني. أعمل على مشروعين فقط في الوقت نفسه ليحظى كل منهما باهتمامي الكامل.',
    address: 'عمّان، الأردن · أعمل مع فرق حول العالم',
    availability: 'أرد خلال يومي عمل',
    formTitle: 'ابدأ مشروعاً',
    formBody: 'تكفي أسطر قليلة عن المنتج والفريق والموعد النهائي.',
    nameLabel: 'اسمك',
    emailLabel: 'بريدك الإلكتروني',
    messageLabel: 'عن مشروعك',
    submitLabel: 'أرسل الرسالة',
  },
  footer: {
    tagline: 'مصممة منتجات في عمّان، أصمّم بالعربية والإنجليزية.',
    columns: [
      {
        title: 'أعمالي',
        links: [
          { label: 'مشاريع مختارة', href: '#work' },
          { label: 'الخبرات', href: '#experience' },
          { label: 'المهارات', href: '#skills' },
        ],
      },
      {
        title: 'تجدونني على',
        links: [
          { label: 'لينكدإن', href: '#linkedin' },
          { label: 'بيهانس', href: '#behance' },
          { label: 'دريبل', href: '#dribbble' },
        ],
      },
      {
        title: 'تواصل',
        links: [
          { label: 'راسليني', href: 'mailto:hello@example.com' },
          { label: 'حمّل السيرة الذاتية', href: '#cv' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const portfolioTemplate = defineTemplate({
  key: 'portfolio',
  category: 'portfolio',
  baseId: 'portfolio-cv',
  name: { en: 'Portfolio and CV', ar: 'ملف أعمال وسيرة ذاتية' },
  description: {
    en: 'A personal portfolio with a portrait hero, projects, an experience timeline, skills and a contact form.',
    ar: 'ملف أعمال شخصي بصورة تعريفية ومشاريع وخط زمني للخبرات والمهارات ونموذج تواصل.',
  },
  thumbnail: { topic: PORTRAIT[0], index: PORTRAIT[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `portfolio-${lang}`;
    const portrait = photo(PORTRAIT[0], PORTRAIT[1], lang);
    const aboutPhoto = photo(ABOUT_PHOTO[0], ABOUT_PHOTO[1], lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#work',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#cv',
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: portrait.src,
      alt: portrait.alt,
      fit: 'cover',
      ratio: 'portrait',
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
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('about', 'content-section', {
      eyebrow: copy.about.eyebrow,
      heading: copy.about.heading,
      body: copy.about.body,
      highlights: json(copy.about.highlights),
      imageSrc: aboutPhoto.src,
      imageAlt: aboutPhoto.alt,
      imageFit: 'cover',
      mediaPosition: 'start',
      link: { label: copy.about.link, href: '#principles' },
      layout: 'split',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'minimal',
      columns: '3',
      headerLayout: 'split',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('work', 'portfolioGrid', {
      eyebrow: copy.work.eyebrow,
      heading: copy.work.heading,
      body: copy.work.body,
      actionLabel: copy.work.actionLabel,
      showMetrics: true,
      variant: 'grid',
      columns: '3',
      items: json(
        copy.work.items.map((item, index) => {
          const image = photo('portfolio', WORK_PHOTOS[index] ?? -1, lang);
          return {
            ...item,
            imageSrc: image.src,
            imageAlt: image.alt,
            href: WORK_HREFS[index] ?? '#work',
          };
        }),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('experience', 'processSteps', {
      eyebrow: copy.experience.eyebrow,
      heading: copy.experience.heading,
      body: copy.experience.body,
      steps: json(copy.experience.items),
      variant: 'minimal',
      layout: 'vertical',
      columns: 'auto',
      showNumbers: false,
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('skills', 'features', {
      eyebrow: copy.skills.eyebrow,
      heading: copy.skills.heading,
      body: copy.skills.body,
      items: json(copy.skills.items),
      columns: '3',
      variant: 'bordered',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'cards',
      columns: '2',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'hello@example.com',
      phone: '+962 79 555 0186',
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/contact',
      method: 'post',
      variant: 'split',
      tone: 'light',
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
