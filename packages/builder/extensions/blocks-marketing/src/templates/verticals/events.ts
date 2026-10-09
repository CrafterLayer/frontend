import type { JsonValue } from '@craftkit/builder-schema';

import { defineTemplate, footer, header, json, money, photo, type NavLink } from '../build';
import type { TemplateLang } from '../types';

/*
  Event or conference (`events` / `events-ar`) — agent-script DESIGN §B.3.

  announcement (date · city) → header → centred hero over the main hall →
  three figures (speakers, sessions, days) → the agenda as process steps
  (Day 1 on the first row of three, Day 2 on the second) → four speakers with
  portraits → three ticket tiers (pricing + pricingPlan nodes, an action in
  every plan, prices via money(…, 'SAR')) → a 6-photo editorial gallery from
  last year → FAQ (2 × 3) → a "Get tickets" banner over the hall → footer.

  «ملتقى الرياض للتصميم», 18–19 November 2026.
*/

const HERO_PHOTO = 0;
const PROMO_PHOTO = 7;
/** Gallery photo index in TEMPLATE_PHOTOS.events; the 1st and 4th are featured. */
const GALLERY_PHOTOS = [1, 2, 3, 4, 5, 6] as const;
/** Speaker portraits in TEMPLATE_PHOTOS.portraits, per speaker. */
const SPEAKER_PHOTOS = [2, 3, 4, 5] as const;
const SPEAKER_HREFS = ['#session-dalia', '#session-majed', '#session-lina', '#session-tariq'];
/** Ticket prices in Saudi riyals, per tier. */
const TICKET_PRICES = [450, 750, 1500] as const;
const TICKET_KEYS = ['day', 'full', 'vip'] as const;
/** The tier the eye should land on. */
const FEATURED_TICKET = 1;

interface Ticket {
  readonly name: string;
  readonly perks: readonly string[];
  readonly action: string;
}

const EN = {
  announcement: {
    label: 'Nov 18–19 · Riyadh',
    message:
      'Riyadh Design Forum 2026 at the King Abdullah Financial District. Early-bird prices end on October 31.',
    linkLabel: 'Get early-bird tickets',
  },
  brand: 'Riyadh Design Forum',
  nav: [
    { label: 'Programme', href: '#programme' },
    { label: 'Speakers', href: '#speakers' },
    { label: 'Tickets', href: '#tickets' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Register', href: '#tickets' },
  hero: {
    eyebrow: '18–19 November 2026 · Riyadh',
    heading: 'Two days on design that ships, in Arabic and English',
    body: "Talks, panels and hands-on workshops with the designers behind the region's most used products and public services.",
    trustLine: '40 speakers · 24 sessions · 6 hands-on workshops',
    primary: 'Book your seat',
    secondary: 'See the programme',
  },
  stats: {
    eyebrow: 'The forum in numbers',
    heading: 'A programme built for working designers',
    body: 'Every session is planned around real projects, and every talk is interpreted live in both languages.',
    items: [
      { value: '40', label: 'Speakers', detail: 'From 11 countries' },
      { value: '24', label: 'Sessions', detail: 'Talks, panels and workshops' },
      { value: '2', label: 'Days', detail: '18 and 19 November' },
    ],
  },
  agenda: {
    eyebrow: 'Programme',
    heading: 'Two days, six themes',
    body: 'Mornings are for talks and panels; afternoons are for workshops in small groups.',
    items: [
      {
        title: 'Opening keynote: Arabic-first product design',
        body: 'Why right to left is the starting point of a product, not a translation step at the end.',
        meta: 'Day 1 · 09:30',
      },
      {
        title: 'Panel: public services people enjoy using',
        body: 'Government and banking design leads on simplifying the forms everyone has to fill in.',
        meta: 'Day 1 · 11:30',
      },
      {
        title: 'Workshops: research sprints and type labs',
        body: 'Choose one of three small-group workshops led by practitioners.',
        meta: 'Day 1 · 14:00',
      },
      {
        title: 'Talk: design systems that survive growth',
        body: 'How product teams in the Gulf scale tokens and components across several brands.',
        meta: 'Day 2 · 09:30',
      },
      {
        title: 'Panel: designing with AI, responsibly',
        body: 'Where AI tools help, where they hurt, and how to keep people in charge of decisions.',
        meta: 'Day 2 · 11:30',
      },
      {
        title: 'Portfolio reviews and closing night',
        body: 'One-to-one portfolio reviews, then the community awards and the closing dinner.',
        meta: 'Day 2 · 15:00',
      },
    ],
  },
  speakers: {
    eyebrow: 'Speakers',
    heading: 'Learn from people who ship',
    body: 'Design leaders from banks, start-ups, studios and public services across the region.',
    profileLabel: 'See the session',
    members: [
      {
        name: 'Dalia Al-Rashed',
        role: 'Head of Design · Retail banking',
        bio: 'Led the redesign of a banking app used by eight million customers.',
      },
      {
        name: 'Majed Al-Otaibi',
        role: 'Design Director · Public services',
        bio: 'Builds the design system behind dozens of government services.',
      },
      {
        name: 'Lina Barakat',
        role: 'Principal Designer · Delivery app',
        bio: 'Researches how people order, pay and track deliveries in Arabic and English.',
      },
      {
        name: 'Tariq Nasr',
        role: 'Founder · Type studio',
        bio: 'Designs Arabic typefaces for screens, signage and brands.',
      },
    ],
  },
  tickets: {
    eyebrow: 'Tickets',
    heading: 'Choose your pass',
    body: 'Prices include VAT, lunch and live interpretation. Group discounts start at five tickets.',
    periodLabel: 'per person',
    badge: 'Best value',
    tiers: [
      {
        name: 'Day pass',
        perks: ['One day of talks and panels', 'Lunch and coffee', 'Session recordings'],
        action: 'Choose a day pass',
      },
      {
        name: 'Full pass',
        perks: [
          'Both days of talks and panels',
          'One workshop of your choice',
          'Lunch, coffee and the closing dinner',
        ],
        action: 'Choose the full pass',
      },
      {
        name: 'VIP pass',
        perks: [
          'Everything in the full pass',
          'Reserved front-row seating',
          'A portfolio review with a speaker',
        ],
        action: 'Choose the VIP pass',
      },
    ] as Ticket[],
  },
  gallery: {
    eyebrow: 'Last year',
    heading: 'Moments from the 2025 forum',
    body: 'More than 1,800 designers joined us for two days of talks, workshops and long conversations.',
    linkLabel: 'Open the photo',
    captions: [
      'The opening keynote in the main hall.',
      'A full house for the public services panel.',
      'Panellists on the round stage.',
      'A research sprint workshop.',
      'A community talk in the side hall.',
      'Sketching ideas in the type lab.',
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Before you book',
    items: [
      {
        question: 'Where is the forum held?',
        answer:
          'At the conference centre in the King Abdullah Financial District, Riyadh, with parking and a metro station nearby.',
      },
      {
        question: 'Are the sessions in Arabic or English?',
        answer:
          'Both. Every talk in the main hall has live interpretation, and workshops run in either language.',
      },
      {
        question: 'Can I change the name on my ticket?',
        answer:
          'Yes, free of charge until November 10. Send us the new name from the email address you booked with.',
      },
      {
        question: 'Are there student or group prices?',
        answer:
          'Students get 40% off with a valid ID, and groups of five or more get 15% off every pass.',
      },
      {
        question: 'Is lunch included?',
        answer:
          'Yes. Every pass includes lunch and coffee on the days it covers, with vegetarian options.',
      },
      {
        question: 'Can I get a refund?',
        answer:
          'Full refunds are available until October 31. After that, you can transfer your ticket to someone else.',
      },
    ],
  },
  promo: {
    label: 'Seats are limited',
    headline: 'Get your pass before the early-bird price ends',
    body: 'Save 20% on every pass until October 31. Workshops have 25 places each and fill up first.',
    primary: 'Get tickets',
    secondary: 'Book for a group',
  },
  footer: {
    tagline: 'Two days on Arabic-first product design, every November in Riyadh.',
    columns: [
      {
        title: 'Forum',
        links: [
          { label: 'Programme', href: '#programme' },
          { label: 'Speakers', href: '#speakers' },
          { label: 'Tickets', href: '#tickets' },
          { label: 'FAQ', href: '#faq' },
        ],
      },
      {
        title: 'Get involved',
        links: [
          { label: 'Speak at the forum', href: '#call-for-speakers' },
          { label: 'Partner with us', href: '#partners' },
          { label: 'Volunteer', href: '#volunteer' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Email us', href: 'mailto:hello@example.com' },
          { label: 'Press', href: '#press' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  announcement: {
    label: '18–19 نوفمبر · الرياض',
    message:
      'ملتقى الرياض للتصميم 2026 في مركز الملك عبدالله المالي. أسعار الحجز المبكر حتى 31 أكتوبر.',
    linkLabel: 'احجز بسعر مبكر',
  },
  brand: 'ملتقى الرياض للتصميم',
  nav: [
    { label: 'البرنامج', href: '#programme' },
    { label: 'المتحدثون', href: '#speakers' },
    { label: 'التذاكر', href: '#tickets' },
    { label: 'الأسئلة الشائعة', href: '#faq' },
  ],
  headerCta: { label: 'سجّل الآن', href: '#tickets' },
  hero: {
    eyebrow: '18–19 نوفمبر 2026 · الرياض',
    heading: 'يومان عن التصميم الذي يصل إلى الناس، بالعربية والإنجليزية',
    body: 'محاضرات وجلسات حوارية وورش عملية مع المصممين الذين يقفون خلف أكثر المنتجات والخدمات الحكومية استخداماً في المنطقة.',
    trustLine: '40 متحدثاً · 24 جلسة · 6 ورش عمل تطبيقية',
    primary: 'احجز مقعدك',
    secondary: 'اطّلع على البرنامج',
  },
  stats: {
    eyebrow: 'الملتقى بالأرقام',
    heading: 'برنامج مصمَّم للمصممين العاملين في الميدان',
    body: 'كل جلسة مبنية على مشاريع حقيقية، وكل محاضرة مترجمة فورياً إلى اللغتين.',
    items: [
      { value: '40', label: 'متحدثاً', detail: 'من 11 دولة' },
      { value: '24', label: 'جلسة', detail: 'محاضرات وحوارات وورش عمل' },
      { value: '2', label: 'يومان', detail: '18 و19 نوفمبر' },
    ],
  },
  agenda: {
    eyebrow: 'البرنامج',
    heading: 'يومان وستة محاور',
    body: 'الصباح للمحاضرات والجلسات الحوارية، وبعد الظهر لورش العمل في مجموعات صغيرة.',
    items: [
      {
        title: 'الكلمة الافتتاحية: تصميم المنتجات بالعربية أولاً',
        body: 'لماذا يكون الاتجاه من اليمين إلى اليسار نقطة بداية المنتج لا خطوة ترجمة في آخره.',
        meta: 'اليوم الأول · 9:30',
      },
      {
        title: 'جلسة حوارية: خدمات حكومية يستمتع الناس باستخدامها',
        body: 'قادة تصميم في القطاعين الحكومي والمصرفي يتحدثون عن تبسيط النماذج التي يملؤها الجميع.',
        meta: 'اليوم الأول · 11:30',
      },
      {
        title: 'ورش العمل: أبحاث سريعة ومختبرات الخط',
        body: 'اختر واحدة من ثلاث ورش في مجموعات صغيرة يقودها ممارسون.',
        meta: 'اليوم الأول · 14:00',
      },
      {
        title: 'محاضرة: أنظمة تصميم تصمد أمام النمو',
        body: 'كيف توسّع فرق المنتجات في الخليج الرموز والمكوّنات عبر علامات تجارية متعددة.',
        meta: 'اليوم الثاني · 9:30',
      },
      {
        title: 'جلسة حوارية: التصميم بالذكاء الاصطناعي بمسؤولية',
        body: 'أين تساعد أدوات الذكاء الاصطناعي وأين تضر، وكيف يبقى القرار بيد الإنسان.',
        meta: 'اليوم الثاني · 11:30',
      },
      {
        title: 'مراجعة ملفات الأعمال وحفل الختام',
        body: 'مراجعات فردية لملفات الأعمال، ثم جوائز المجتمع وعشاء الختام.',
        meta: 'اليوم الثاني · 15:00',
      },
    ],
  },
  speakers: {
    eyebrow: 'المتحدثون',
    heading: 'تعلّم ممن يطلقون منتجات حقيقية',
    body: 'قادة تصميم من البنوك والشركات الناشئة والاستوديوهات والخدمات الحكومية في المنطقة.',
    profileLabel: 'تفاصيل الجلسة',
    members: [
      {
        name: 'داليا الراشد',
        role: 'رئيسة التصميم · الخدمات المصرفية للأفراد',
        bio: 'قادت إعادة تصميم تطبيق مصرفي يستخدمه ثمانية ملايين عميل.',
      },
      {
        name: 'ماجد العتيبي',
        role: 'مدير التصميم · الخدمات الحكومية',
        bio: 'يبني نظام التصميم الذي تقوم عليه عشرات الخدمات الحكومية.',
      },
      {
        name: 'لينا بركات',
        role: 'مصممة رئيسية · تطبيق توصيل',
        bio: 'تبحث في كيف يطلب الناس ويدفعون ويتابعون طلباتهم بالعربية والإنجليزية.',
      },
      {
        name: 'طارق نصر',
        role: 'مؤسس · استوديو خطوط',
        bio: 'يصمّم خطوطاً عربية للشاشات واللافتات والعلامات التجارية.',
      },
    ],
  },
  tickets: {
    eyebrow: 'التذاكر',
    heading: 'اختر تذكرتك',
    body: 'الأسعار تشمل ضريبة القيمة المضافة والغداء والترجمة الفورية. تبدأ خصومات المجموعات من خمس تذاكر.',
    periodLabel: 'للشخص',
    badge: 'الأفضل قيمة',
    tiers: [
      {
        name: 'تذكرة يوم واحد',
        perks: ['يوم كامل من المحاضرات والجلسات', 'الغداء والقهوة', 'تسجيلات الجلسات'],
        action: 'اختر تذكرة اليوم',
      },
      {
        name: 'التذكرة الكاملة',
        perks: [
          'اليومان كاملان من المحاضرات والجلسات',
          'ورشة عمل من اختيارك',
          'الغداء والقهوة وعشاء الختام',
        ],
        action: 'اختر التذكرة الكاملة',
      },
      {
        name: 'تذكرة كبار الضيوف',
        perks: [
          'كل ما في التذكرة الكاملة',
          'مقاعد محجوزة في الصف الأول',
          'مراجعة ملف أعمالك مع أحد المتحدثين',
        ],
        action: 'اختر تذكرة كبار الضيوف',
      },
    ],
  },
  gallery: {
    eyebrow: 'من العام الماضي',
    heading: 'لحظات من ملتقى 2025',
    body: 'انضم إلينا أكثر من 1,800 مصمم في يومين من المحاضرات والورش والحوارات الطويلة.',
    linkLabel: 'افتح الصورة',
    captions: [
      'الكلمة الافتتاحية في القاعة الرئيسية.',
      'قاعة ممتلئة في جلسة الخدمات الحكومية.',
      'المتحاورون على المنصة الدائرية.',
      'ورشة أبحاث سريعة.',
      'محاضرة مجتمعية في القاعة الجانبية.',
      'رسم الأفكار في مختبر الخط.',
    ],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    heading: 'قبل أن تحجز',
    items: [
      {
        question: 'أين يُقام الملتقى؟',
        answer:
          'في مركز المؤتمرات بمركز الملك عبدالله المالي في الرياض، مع مواقف للسيارات ومحطة مترو قريبة.',
      },
      {
        question: 'هل الجلسات بالعربية أم بالإنجليزية؟',
        answer: 'باللغتين. كل محاضرات القاعة الرئيسية مترجمة فورياً، والورش متاحة بأي من اللغتين.',
      },
      {
        question: 'هل يمكنني تغيير الاسم على التذكرة؟',
        answer: 'نعم، مجاناً حتى 10 نوفمبر. أرسل لنا الاسم الجديد من البريد الإلكتروني الذي حجزت به.',
      },
      {
        question: 'هل توجد أسعار للطلاب أو المجموعات؟',
        answer:
          'يحصل الطلاب على خصم 40% ببطاقة جامعية سارية، وتحصل المجموعات من خمسة أشخاص فأكثر على خصم 15% على كل التذاكر.',
      },
      {
        question: 'هل الغداء مشمول؟',
        answer: 'نعم، تشمل كل تذكرة الغداء والقهوة في الأيام التي تغطيها، مع خيارات نباتية.',
      },
      {
        question: 'هل يمكنني استرداد ثمن التذكرة؟',
        answer: 'يُسترد المبلغ كاملاً حتى 31 أكتوبر، وبعدها يمكنك نقل تذكرتك إلى شخص آخر.',
      },
    ],
  },
  promo: {
    label: 'المقاعد محدودة',
    headline: 'احصل على تذكرتك قبل انتهاء سعر الحجز المبكر',
    body: 'وفّر 20% على كل التذاكر حتى 31 أكتوبر. لكل ورشة 25 مقعداً فقط، وهي أول ما ينفد.',
    primary: 'احصل على التذاكر',
    secondary: 'احجز لمجموعة',
  },
  footer: {
    tagline: 'يومان عن تصميم المنتجات بالعربية أولاً، كل نوفمبر في الرياض.',
    columns: [
      {
        title: 'الملتقى',
        links: [
          { label: 'البرنامج', href: '#programme' },
          { label: 'المتحدثون', href: '#speakers' },
          { label: 'التذاكر', href: '#tickets' },
          { label: 'الأسئلة الشائعة', href: '#faq' },
        ],
      },
      {
        title: 'شارك معنا',
        links: [
          { label: 'تحدّث في الملتقى', href: '#call-for-speakers' },
          { label: 'كن شريكاً', href: '#partners' },
          { label: 'تطوّع معنا', href: '#volunteer' },
        ],
      },
      {
        title: 'تواصل',
        links: [
          { label: 'راسلنا', href: 'mailto:hello@example.com' },
          { label: 'المركز الإعلامي', href: '#press' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** A bulleted rich-text list: one list item per perk. */
function perkList(perks: readonly string[]): JsonValue {
  return {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: perks.map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
    ],
  };
}

export const eventsTemplate = defineTemplate({
  key: 'events',
  category: 'events',
  baseId: 'events',
  name: { en: 'Event or conference', ar: 'فعالية أو مؤتمر' },
  description: {
    en: 'A two-day conference with a date bar, programme, speakers, ticket tiers, past photos and FAQ.',
    ar: 'مؤتمر ليومين بشريط التاريخ والبرنامج والمتحدثين وفئات التذاكر وصور سابقة والأسئلة الشائعة.',
  },
  thumbnail: { topic: 'events', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `events-${lang}`;
    const heroPhoto = photo('events', HERO_PHOTO, lang);
    const promoPhoto = photo('events', PROMO_PHOTO, lang);

    page.section('announcement', 'announcementBar', {
      label: copy.announcement.label,
      message: copy.announcement.message,
      linkLabel: copy.announcement.linkLabel,
      href: '#tickets',
      showLabel: true,
      showLink: true,
      emphasis: 'accent',
      layout: 'inline',
      density: 'compact',
      align: 'center',
      tone: 'transparent',
      spacing: 'none',
      width: 'wide',
    });

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#tickets',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#programme',
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
        variant: 'centered',
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'cards',
      columns: '3',
      headerLayout: 'split',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('programme', 'processSteps', {
      eyebrow: copy.agenda.eyebrow,
      heading: copy.agenda.heading,
      body: copy.agenda.body,
      steps: json(copy.agenda.items),
      variant: 'cards',
      layout: 'horizontal',
      columns: '3',
      showNumbers: false,
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('speakers', 'team', {
      eyebrow: copy.speakers.eyebrow,
      heading: copy.speakers.heading,
      body: copy.speakers.body,
      profileLabel: copy.speakers.profileLabel,
      members: json(
        copy.speakers.members.map((member, index) => {
          const portrait = photo('portraits', SPEAKER_PHOTOS[index] ?? -1, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: SPEAKER_HREFS[index] ?? '#speakers',
          };
        }),
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    const plans = copy.tickets.tiers.map((tier, index) => {
      const key = TICKET_KEYS[index] ?? `tier-${String(index + 1)}`;
      const featured = index === FEATURED_TICKET;
      const perks = page.add(`ticket-${key}-perks`, 'richText', {
        content: perkList(tier.perks),
      });
      const action = page.add(`ticket-${key}-cta`, 'cta', {
        label: tier.action,
        href: `#checkout-${key}`,
        emphasis: featured ? 'primary' : 'secondary',
        size: 'md',
        width: 'full',
      });
      return page.add(
        `ticket-${key}`,
        'pricingPlan',
        {
          name: tier.name,
          price: money(TICKET_PRICES[index] ?? 0, 'SAR', lang),
          period: 'once',
          periodLabel: copy.tickets.periodLabel,
          emphasis: featured ? 'featured' : 'normal',
          ...(featured ? { badge: copy.tickets.badge } : {}),
        },
        { default: [perks, action] },
      );
    });
    page.section(
      'tickets',
      'pricing',
      {
        eyebrow: copy.tickets.eyebrow,
        heading: copy.tickets.heading,
        body: copy.tickets.body,
        columns: 'auto',
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { default: plans },
    );

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('events', photoIndex, lang);
          return {
            src: image.src,
            alt: image.alt,
            caption: copy.gallery.captions[index],
            featured: index === 0 || index === 3,
          };
        }),
      ),
      layout: 'editorial',
      columns: '2',
      aspect: 'landscape',
      imageFit: 'cover',
      showCaptions: true,
      captionStyle: 'below',
      linkImages: false,
      linkLabel: copy.gallery.linkLabel,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'divided',
      openFirst: true,
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('get-tickets', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#tickets', emphasis: 'primary' },
        { label: copy.promo.secondary, href: 'mailto:groups@example.com', emphasis: 'secondary' },
      ],
      imageSrc: promoPhoto.src,
      imageAlt: promoPhoto.alt,
      showMedia: true,
      variant: 'media',
      panelStyle: 'inverse',
      mediaPosition: 'end',
      mediaAspect: 'wide',
      padding: 'spacious',
      radius: 'xl',
      align: 'center',
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
