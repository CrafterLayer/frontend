import { defineTemplate, footer, header, json, photo, type NavLink } from './build';
import type { TemplateLang } from './types';

/*
  Creative agency (`creative-agency` / `creative-agency-ar`) — DESIGN §B.3.

  header → split hero with a studio photo → portfolio (6 case studies, 3 × 2,
  every one photographed, none repeated) → process (4 steps; the badge is the
  only number, the label is a duration) → stats with their own body → team
  (4 portraits) → testimonials (2 × 2 wall) → journal (featured layout: one
  wide post over two, so no cell is left empty) → contact → footer.
*/

const EN = {
  brand: 'Studio Noor',
  nav: [
    { label: 'Work', href: '#work' },
    { label: 'Process', href: '#process' },
    { label: 'Studio', href: '#team' },
    { label: 'Journal', href: '#journal' },
  ] as NavLink[],
  headerCta: { label: 'Start a project', href: '#contact' },
  hero: {
    eyebrow: 'Brand and digital studio · Amman & Dubai',
    heading: 'We build brands people remember and products they enjoy',
    body: 'Strategy, identity and digital design for ambitious companies across the Middle East, from the first idea to launch day.',
    trustLine: 'Brand strategy · Visual identity · Websites and apps',
    primary: 'See our work',
    secondary: 'How we work',
  },
  work: {
    eyebrow: 'Selected work',
    heading: 'Work that moved the numbers',
    body: 'Six recent partnerships across finance, culture, property, delivery, education and technology.',
    actionLabel: 'View case study',
    items: [
      {
        category: 'Fintech',
        title: 'Qamar Pay: a bank brand built on trust',
        summary:
          'Positioning, identity and app design for a digital bank launching in Jordan and the Gulf.',
        metrics: [
          { label: 'Account sign-ups', value: '+61%' },
          { label: 'App store rating', value: '4.8' },
        ],
      },
      {
        category: 'Culture',
        title: 'Darat Arts: a home for contemporary art',
        summary:
          'An editorial website and exhibition experience that gives artists and visitors room to breathe.',
        metrics: [
          { label: 'Time on site', value: '+38%' },
          { label: 'Memberships', value: '+17%' },
        ],
      },
      {
        category: 'Real estate',
        title: 'Ufuq: an identity for a new skyline',
        summary: 'Naming, identity and a launch campaign for a mixed-use development in Amman.',
        metrics: [
          { label: 'Pre-sold homes', value: '320' },
          { label: 'Site visits', value: '+2.4×' },
        ],
      },
      {
        category: 'Delivery',
        title: 'Wasel: an app riders actually like',
        summary: 'A rider app redesign shaped by forty field interviews in three cities.',
        metrics: [
          { label: 'Completed orders', value: '+19%' },
          { label: 'Support tickets', value: '−32%' },
        ],
      },
      {
        category: 'Education',
        title: 'Madrasati: one platform for forty schools',
        summary: 'A bilingual learning platform designed for students, teachers and parents.',
        metrics: [
          { label: 'Active learners', value: '28,000' },
          { label: 'Teacher satisfaction', value: '92%' },
        ],
      },
      {
        category: 'Technology',
        title: 'Sahab Cloud: a brand for a regional cloud',
        summary: 'Identity, website and a design system for a Gulf-based cloud provider.',
        metrics: [
          { label: 'Qualified leads', value: '+45%' },
          { label: 'Launch time', value: '11 weeks' },
        ],
      },
    ],
  },
  process: {
    eyebrow: 'Process',
    heading: 'Clarity first, then craft',
    body: 'A small senior team stays with you from the first workshop to launch week.',
    steps: [
      {
        meta: 'Weeks 1–2',
        title: 'Discover',
        body: 'Interviews, market research and a workshop to agree on the real problem.',
      },
      {
        meta: 'Weeks 3–4',
        title: 'Define',
        body: 'Positioning, message and a creative direction your whole team signs off.',
      },
      {
        meta: 'Weeks 5–9',
        title: 'Design',
        body: 'Identity, website and product screens, tested with real users as we go.',
      },
      {
        meta: 'Launch week',
        title: 'Launch',
        body: 'Guidelines, files and launch support so your team can own the system.',
      },
    ],
  },
  stats: {
    eyebrow: 'Studio in numbers',
    heading: 'Twelve years of brands that last',
    body: 'Since 2014 we have helped founders and established companies in nine countries find their voice.',
    items: [
      { value: '140+', label: 'Brands launched', detail: 'From start-ups to listed companies' },
      { value: '9', label: 'Countries served', detail: 'Across the Gulf, Levant and North Africa' },
      { value: '87%', label: 'Clients who come back', detail: 'For a second project or retainer' },
    ],
  },
  team: {
    eyebrow: 'Studio',
    heading: 'The people behind the work',
    body: 'Senior designers and strategists who stay on your project from start to finish.',
    profileLabel: 'View profile',
    members: [
      {
        name: 'Lina Khoury',
        role: 'Founder & Creative Director',
        bio: 'Fifteen years shaping brands for banks, museums and start-ups.',
      },
      {
        name: 'Karim Haddad',
        role: 'Strategy Director',
        bio: 'Turns research and workshops into positioning teams can act on.',
      },
      {
        name: 'Reem Saleh',
        role: 'Design Director',
        bio: 'Leads identity systems and the details that make them last.',
      },
      {
        name: 'Tariq Mansour',
        role: 'Digital Lead',
        bio: 'Designs websites and products that are fast, accessible and bilingual.',
      },
    ],
  },
  quotes: {
    eyebrow: 'Clients',
    heading: 'The kind of partnership people remember',
    items: [
      {
        quote: 'They found the one idea that tied our product, our culture and our story together.',
        author: 'Hala Barakat',
        role: 'Chief Marketing Officer',
        company: 'Qamar Pay',
      },
      {
        quote: 'Brave work, commercially sharp, and it still feels like ours two years later.',
        author: 'Majed Al-Otaibi',
        role: 'Founder',
        company: 'Ufuq Developments',
      },
      {
        quote: 'Our bilingual website finally reads as well in Arabic as it does in English.',
        author: 'Nadia Fares',
        role: 'Director',
        company: 'Darat Arts',
      },
      {
        quote:
          'Rider ratings rose the month the new app shipped. The research paid for itself quickly.',
        author: 'Sami Odeh',
        role: 'Head of Product',
        company: 'Wasel',
      },
    ],
  },
  journal: {
    eyebrow: 'Journal',
    heading: 'What we are noticing',
    body: 'Short notes on brands, products and the culture around them.',
    actionLabel: 'Read article',
    posts: [
      {
        title: 'Why a bilingual brand needs two voices, not one translation',
        excerpt:
          'Arabic and English audiences hear a brand differently. Here is how we write for both without losing the idea.',
        category: 'Brand',
        author: 'Lina Khoury',
        publishedLabel: '12 Sep 2026',
        dateTime: '2026-09-12',
        readingTime: '6 min read',
      },
      {
        title: 'Designing right-to-left interfaces that feel native',
        excerpt:
          'Mirroring a layout is the easy part. Icons, numbers and motion need their own rules.',
        category: 'Product',
        author: 'Tariq Mansour',
        publishedLabel: '28 Aug 2026',
        dateTime: '2026-08-28',
        readingTime: '8 min read',
      },
      {
        title: 'What a good brief looks like',
        excerpt:
          'Five questions that save weeks on any branding project, and why the budget is not one of them.',
        category: 'Practice',
        author: 'Karim Haddad',
        publishedLabel: '9 Aug 2026',
        dateTime: '2026-08-09',
        readingTime: '4 min read',
      },
    ],
  },
  contact: {
    eyebrow: 'Start a project',
    heading: 'Tell us what you want to change',
    body: 'Share where you are today and where you want to be. We reply within two working days with clear next steps.',
    address: '42 Rainbow Street, Jabal Amman, Jordan',
    availability: 'Booking new projects from November 2026',
    formTitle: 'A few details are enough',
    formBody: 'No need for a perfect brief. Start with what you know.',
    nameLabel: 'Your name',
    emailLabel: 'Work email',
    messageLabel: 'What are you working on?',
    submitLabel: 'Send message',
  },
  footer: {
    tagline: 'A brand and digital studio in Amman and Dubai.',
    columns: [
      {
        title: 'Studio',
        links: [
          { label: 'Work', href: '#work' },
          { label: 'Process', href: '#process' },
          { label: 'Team', href: '#team' },
          { label: 'Journal', href: '#journal' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Email us', href: 'mailto:hello@example.com' },
          { label: 'Visit the studio', href: '#contact' },
          { label: 'Careers', href: '#careers' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'استوديو نور',
  nav: [
    { label: 'أعمالنا', href: '#work' },
    { label: 'منهجيتنا', href: '#process' },
    { label: 'الفريق', href: '#team' },
    { label: 'المدوّنة', href: '#journal' },
  ],
  headerCta: { label: 'ابدأ مشروعك', href: '#contact' },
  hero: {
    eyebrow: 'استوديو هوية وتصميم رقمي · عمّان ودبي',
    heading: 'نصنع علامات تبقى في الذاكرة ومنتجات يستمتع بها الناس',
    body: 'استراتيجية وهوية بصرية وتصميم رقمي لشركات طموحة في الشرق الأوسط، من الفكرة الأولى حتى يوم الإطلاق.',
    trustLine: 'استراتيجية العلامة · الهوية البصرية · المواقع والتطبيقات',
    primary: 'شاهد أعمالنا',
    secondary: 'كيف نعمل',
  },
  work: {
    eyebrow: 'أعمال مختارة',
    heading: 'أعمال حرّكت الأرقام',
    body: 'ست شراكات حديثة في المال والثقافة والعقار والتوصيل والتعليم والتقنية.',
    actionLabel: 'اقرأ دراسة الحالة',
    items: [
      {
        category: 'تقنية مالية',
        title: 'قمر باي: علامة مصرفية مبنية على الثقة',
        summary: 'تموضع وهوية وتصميم تطبيق لبنك رقمي ينطلق في الأردن والخليج.',
        metrics: [
          { label: 'فتح الحسابات', value: '+61%' },
          { label: 'تقييم التطبيق', value: '4.8' },
        ],
      },
      {
        category: 'ثقافة',
        title: 'دارة الفنون: بيت للفن المعاصر',
        summary: 'موقع تحريري وتجربة معارض تمنح الفنانين والزوار مساحة للتأمل.',
        metrics: [
          { label: 'مدة التصفح', value: '+38%' },
          { label: 'العضويات', value: '+17%' },
        ],
      },
      {
        category: 'تطوير عقاري',
        title: 'أفق: هوية لأفق مدينة جديد',
        summary: 'اسم وهوية وحملة إطلاق لمشروع سكني متعدد الاستخدامات في عمّان.',
        metrics: [
          { label: 'وحدات بيعت مسبقاً', value: '320' },
          { label: 'زيارات الموقع', value: '+2.4×' },
        ],
      },
      {
        category: 'توصيل',
        title: 'واصل: تطبيق يحبه السائقون فعلاً',
        summary: 'إعادة تصميم تطبيق السائقين بعد أربعين مقابلة ميدانية في ثلاث مدن.',
        metrics: [
          { label: 'الطلبات المكتملة', value: '+19%' },
          { label: 'تذاكر الدعم', value: '−32%' },
        ],
      },
      {
        category: 'تعليم',
        title: 'مدرستي: منصة واحدة لأربعين مدرسة',
        summary: 'منصة تعلّم ثنائية اللغة صُممت للطلاب والمعلمين وأولياء الأمور.',
        metrics: [
          { label: 'متعلمون نشطون', value: '28,000' },
          { label: 'رضا المعلمين', value: '92%' },
        ],
      },
      {
        category: 'تقنية',
        title: 'سحاب كلاود: علامة لسحابة إقليمية',
        summary: 'هوية وموقع ونظام تصميم لمزوّد خدمات سحابية في الخليج.',
        metrics: [
          { label: 'عملاء محتملون مؤهَّلون', value: '+45%' },
          { label: 'مدة الإطلاق', value: '11 أسبوعاً' },
        ],
      },
    ],
  },
  process: {
    eyebrow: 'منهجيتنا',
    heading: 'الوضوح أولاً، ثم الإتقان',
    body: 'فريق صغير من الخبراء يرافقك من أول ورشة عمل حتى أسبوع الإطلاق.',
    steps: [
      {
        meta: 'الأسبوعان 1–2',
        title: 'الاكتشاف',
        body: 'مقابلات وبحث في السوق وورشة عمل لنتفق على المشكلة الحقيقية.',
      },
      {
        meta: 'الأسبوعان 3–4',
        title: 'التحديد',
        body: 'تموضع ورسالة واتجاه إبداعي يعتمده فريقك بالكامل.',
      },
      {
        meta: 'الأسابيع 5–9',
        title: 'التصميم',
        body: 'الهوية والموقع وشاشات المنتج، نختبرها مع مستخدمين حقيقيين أولاً بأول.',
      },
      {
        meta: 'أسبوع الإطلاق',
        title: 'الإطلاق',
        body: 'أدلة الاستخدام والملفات ودعم الإطلاق ليمتلك فريقك النظام بالكامل.',
      },
    ],
  },
  stats: {
    eyebrow: 'الاستوديو بالأرقام',
    heading: 'اثنا عشر عاماً من علامات تدوم',
    body: 'منذ 2014 نساعد المؤسسين والشركات الراسخة في تسع دول على إيجاد صوتهم.',
    items: [
      { value: '140+', label: 'علامة أطلقناها', detail: 'من الشركات الناشئة إلى الشركات المدرجة' },
      { value: '9', label: 'دول عملنا فيها', detail: 'في الخليج والشام وشمال أفريقيا' },
      { value: '87%', label: 'عملاء يعودون إلينا', detail: 'لمشروع ثانٍ أو تعاون مستمر' },
    ],
  },
  team: {
    eyebrow: 'الفريق',
    heading: 'الأشخاص وراء الأعمال',
    body: 'مصممون واستراتيجيون من ذوي الخبرة يرافقون مشروعك من البداية إلى النهاية.',
    profileLabel: 'عرض الملف',
    members: [
      {
        name: 'لينا خوري',
        role: 'المؤسِّسة والمديرة الإبداعية',
        bio: 'خمسة عشر عاماً في بناء علامات لبنوك ومتاحف وشركات ناشئة.',
      },
      {
        name: 'كريم حداد',
        role: 'مدير الاستراتيجية',
        bio: 'يحوّل البحث وورش العمل إلى تموضع يمكن للفرق العمل به.',
      },
      {
        name: 'ريم صالح',
        role: 'مديرة التصميم',
        bio: 'تقود أنظمة الهوية والتفاصيل التي تجعلها تدوم.',
      },
      {
        name: 'طارق منصور',
        role: 'قائد التصميم الرقمي',
        bio: 'يصمم مواقع ومنتجات سريعة وسهلة الاستخدام وثنائية اللغة.',
      },
    ],
  },
  quotes: {
    eyebrow: 'عملاؤنا',
    heading: 'شراكات يتذكرها أصحابها',
    items: [
      {
        quote: 'وجدوا الفكرة الوحيدة التي جمعت منتجنا وثقافتنا وقصتنا معاً.',
        author: 'هالة بركات',
        role: 'مديرة التسويق',
        company: 'قمر باي',
      },
      {
        quote: 'عمل جريء وذكي تجارياً، وما زلنا بعد عامين نشعر أنه يشبهنا.',
        author: 'ماجد العتيبي',
        role: 'المؤسس',
        company: 'أفق للتطوير',
      },
      {
        quote: 'أخيراً صار موقعنا يُقرأ بالعربية بالجودة نفسها التي يُقرأ بها بالإنجليزية.',
        author: 'نادية فارس',
        role: 'المديرة',
        company: 'دارة الفنون',
      },
      {
        quote:
          'ارتفعت تقييمات السائقين في الشهر نفسه الذي أطلقنا فيه التطبيق الجديد. البحث استحق كل دقيقة.',
        author: 'سامي عودة',
        role: 'رئيس المنتج',
        company: 'واصل',
      },
    ],
  },
  journal: {
    eyebrow: 'المدوّنة',
    heading: 'ما نلاحظه في عالم العلامات',
    body: 'ملاحظات قصيرة عن العلامات والمنتجات والثقافة من حولها.',
    actionLabel: 'اقرأ المقال',
    posts: [
      {
        title: 'لماذا تحتاج العلامة ثنائية اللغة إلى صوتين لا إلى ترجمة',
        excerpt:
          'يسمع الجمهور العربي والإنجليزي العلامة بشكل مختلف. هكذا نكتب للاثنين دون أن تضيع الفكرة.',
        category: 'العلامة',
        author: 'لينا خوري',
        publishedLabel: '12 سبتمبر 2026',
        dateTime: '2026-09-12',
        readingTime: '6 دقائق قراءة',
      },
      {
        title: 'تصميم واجهات من اليمين إلى اليسار تبدو أصيلة',
        excerpt: 'عكس التخطيط هو الجزء السهل؛ الأيقونات والأرقام والحركة تحتاج قواعدها الخاصة.',
        category: 'المنتج',
        author: 'طارق منصور',
        publishedLabel: '28 أغسطس 2026',
        dateTime: '2026-08-28',
        readingTime: '8 دقائق قراءة',
      },
      {
        title: 'كيف يبدو الملخّص الجيد لمشروع',
        excerpt: 'خمسة أسئلة توفّر أسابيع في أي مشروع هوية، والميزانية ليست واحدة منها.',
        category: 'الممارسة',
        author: 'كريم حداد',
        publishedLabel: '9 أغسطس 2026',
        dateTime: '2026-08-09',
        readingTime: '4 دقائق قراءة',
      },
    ],
  },
  contact: {
    eyebrow: 'ابدأ مشروعك',
    heading: 'أخبرنا بما تريد تغييره',
    body: 'شاركنا أين أنتم اليوم وإلى أين تريدون الوصول، وسنرد خلال يومي عمل بالخطوات التالية.',
    address: 'شارع الرينبو 42، جبل عمّان، الأردن',
    availability: 'نستقبل مشاريع جديدة ابتداءً من نوفمبر 2026',
    formTitle: 'بعض التفاصيل تكفي',
    formBody: 'لا حاجة لملخّص مثالي؛ ابدأ بما تعرفه.',
    nameLabel: 'الاسم',
    emailLabel: 'البريد الإلكتروني',
    messageLabel: 'على ماذا تعملون؟',
    submitLabel: 'أرسل الرسالة',
  },
  footer: {
    tagline: 'استوديو هوية وتصميم رقمي في عمّان ودبي.',
    columns: [
      {
        title: 'الاستوديو',
        links: [
          { label: 'أعمالنا', href: '#work' },
          { label: 'منهجيتنا', href: '#process' },
          { label: 'الفريق', href: '#team' },
          { label: 'المدوّنة', href: '#journal' },
        ],
      },
      {
        title: 'تواصل',
        links: [
          { label: 'راسلنا', href: 'mailto:hello@example.com' },
          { label: 'زورونا في الاستوديو', href: '#contact' },
          { label: 'الوظائف', href: '#careers' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** agency photo index per case study, in COPY order. */
const WORK_PHOTOS = [3, 1, 2, 4, 5, 6] as const;
/** agency photo index per journal post. */
const POST_PHOTOS = [7, 8, 9] as const;
/** people photo index per team member. */
const TEAM_PHOTOS = [0, 7, 8, 15] as const;
const WORK_HREFS = ['#qamar-pay', '#darat-arts', '#ufuq', '#wasel', '#madrasati', '#sahab-cloud'];

export const agencyTemplate = defineTemplate({
  key: 'agency',
  category: 'agency',
  baseId: 'creative-agency',
  name: { en: 'Creative agency', ar: 'وكالة إبداعية' },
  description: {
    en: 'A studio site with case studies, process, team portraits, a journal and a project form.',
    ar: 'موقع استوديو بدراسات حالة ومنهجية عمل وصور الفريق ومدوّنة ونموذج لطلب مشروع.',
  },
  thumbnail: { topic: 'agency', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `agency-${lang}`;
    const heroPhoto = photo('agency', 0, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#work',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#process',
      emphasis: 'link',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'square',
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
          const image = photo('agency', WORK_PHOTOS[index] ?? -1, lang);
          return {
            ...item,
            imageSrc: image.src,
            imageAlt: image.alt,
            href: WORK_HREFS[index] ?? '#work',
          };
        }),
      ),
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('process', 'processSteps', {
      eyebrow: copy.process.eyebrow,
      heading: copy.process.heading,
      body: copy.process.body,
      steps: json(copy.process.steps),
      variant: 'cards',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
      tone: 'transparent',
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
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('team', 'team', {
      eyebrow: copy.team.eyebrow,
      heading: copy.team.heading,
      body: copy.team.body,
      profileLabel: copy.team.profileLabel,
      members: json(
        copy.team.members.map((member, index) => {
          const portrait = photo('people', TEAM_PHOTOS[index] ?? -1, lang);
          return { ...member, imageSrc: portrait.src, imageAlt: portrait.alt };
        }),
      ),
      variant: 'cards',
      columns: '4',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'wall',
      columns: '2',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('journal', 'blogGrid', {
      eyebrow: copy.journal.eyebrow,
      heading: copy.journal.heading,
      body: copy.journal.body,
      actionLabel: copy.journal.actionLabel,
      showImages: true,
      variant: 'featured',
      columns: '2',
      posts: json(
        copy.journal.posts.map((post, index) => {
          const image = photo('agency', POST_PHOTOS[index] ?? -1, lang);
          return {
            ...post,
            href: `#journal-${String(index + 1)}`,
            imageSrc: image.src,
            imageAlt: image.alt,
            featured: index === 0,
          };
        }),
      ),
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'hello@example.com',
      phone: '+962 6 555 0142',
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
