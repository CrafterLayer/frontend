import { defineTemplate, footer, header, json, money, photo, type NavLink } from '../build';
import type { TemplateLang } from '../types';

/*
  Real estate (`real-estate` / `real-estate-ar`) — agent-script DESIGN §B.3.

  header → centred hero over the Dubai skyline with "Browse listings" →
  six listings as a product grid (price via money(…, 'AED'); type, beds,
  baths and area in the description; fills 2 and 3 columns) → why us (2 × 2)
  → four figures → six interiors (fills 2 and 3 columns) → four agents with
  portraits → client reviews (2 × 2) → contact with a call-back form → footer.

  «منزل للعقارات»: a brokerage in Downtown Dubai.
*/

const HERO_PHOTO = 0;
/** Listing photo index in TEMPLATE_PHOTOS.realestate, per listing. */
const LISTING_PHOTOS = [1, 2, 3, 4, 5, 6] as const;
/** Asking prices in UAE dirhams, per listing. */
const LISTING_PRICES = [7_450_000, 3_100_000, 3_950_000, 6_800_000, 12_500_000, 1_350_000] as const;
/** The price before a reduction, where there was one. */
const ORIGINAL_PRICES: readonly (number | undefined)[] = [
  undefined,
  undefined,
  4_200_000,
  undefined,
  undefined,
  undefined,
];
const LISTING_HREFS = [
  '#listing-dubai-hills-villa',
  '#listing-downtown-apartment',
  '#listing-ranches-townhouse',
  '#listing-marina-penthouse',
  '#listing-jumeirah-villa',
  '#listing-business-bay-apartment',
] as const;
const GALLERY_PHOTOS = [7, 8, 9, 10, 11, 12] as const;
/** Agent portraits, in member order: [topic, index]. */
const AGENT_PHOTOS: readonly (readonly [string, number])[] = [
  ['portraits', 0],
  ['portraits', 1],
  ['people', 0],
  ['people', 1],
];
const AGENT_HREFS = ['#agent-yousef', '#agent-hala', '#agent-mariam', '#agent-karim'];

interface Listing {
  readonly name: string;
  readonly description: string;
  readonly badge?: string;
}

const EN = {
  brand: 'Manzil Properties',
  nav: [
    { label: 'Listings', href: '#listings' },
    { label: 'Why us', href: '#why' },
    { label: 'Agents', href: '#agents' },
    { label: 'Contact', href: '#contact' },
  ] as NavLink[],
  headerCta: { label: 'Book a viewing', href: '#contact' },
  hero: {
    eyebrow: 'Homes for sale in Dubai · Verified listings',
    heading: 'Find a home in Dubai that fits the way you live',
    body: 'Villas, townhouses and apartments checked by our own agents, with honest prices and every document ready before you visit.',
    trustLine: 'Licensed agents · 1,200+ homes sold · Service in Arabic and English',
    primary: 'Browse listings',
    secondary: 'Value my home',
  },
  listings: {
    eyebrow: 'Featured listings',
    heading: 'Homes on the market this week',
    body: 'Every listing is visited, photographed and priced by our team. Prices in UAE dirhams.',
    actionLabel: 'View details',
    ratingPrefix: 'Rating',
    ratingSuffix: 'of 5',
    reviewCountLabel: 'buyer reviews',
    items: [
      {
        name: 'Pool villa in Dubai Hills Estate',
        description: 'Villa · 5 beds · 6 baths · 6,200 sq ft · Private pool and garden',
        badge: 'New',
      },
      {
        name: 'Two-bedroom apartment in Downtown Dubai',
        description: 'Apartment · 2 beds · 3 baths · 1,450 sq ft · Burj Khalifa view',
      },
      {
        name: 'Corner townhouse in Arabian Ranches',
        description: 'Townhouse · 4 beds · 4 baths · 3,100 sq ft · Close to schools',
        badge: 'Price reduced',
      },
      {
        name: 'Duplex penthouse in Dubai Marina',
        description: 'Penthouse · 3 beds · 4 baths · 3,800 sq ft · Rooftop terrace',
        badge: 'Exclusive',
      },
      {
        name: 'Family villa in Jumeirah',
        description: 'Villa · 6 beds · 7 baths · 8,000 sq ft · Five minutes from the beach',
      },
      {
        name: 'One-bedroom apartment in Business Bay',
        description: 'Apartment · 1 bed · 2 baths · 820 sq ft · Canal view',
        badge: 'Ready to move in',
      },
    ] as Listing[],
  },
  why: {
    eyebrow: 'Why Manzil',
    heading: 'Buying a home should feel certain, not stressful',
    body: 'One adviser stays with you from the first viewing to the day you get your keys.',
    items: [
      {
        kicker: 'Verified',
        title: 'Every listing checked in person',
        body: 'We visit, measure and photograph each home ourselves, so what you see is what you get.',
      },
      {
        kicker: 'Transparent',
        title: 'Clear prices and fees',
        body: 'Service charges, transfer fees and our commission are written down before you make an offer.',
      },
      {
        kicker: 'Finance',
        title: 'Mortgage help included',
        body: 'We compare offers from leading banks and handle the paperwork with you.',
      },
      {
        kicker: 'Aftercare',
        title: 'Support after you move in',
        body: 'From utilities to maintenance contacts, we help you settle into your new home.',
      },
    ],
  },
  stats: {
    eyebrow: 'Our track record',
    heading: 'Fifteen years helping families move home in Dubai',
    body: 'Figures from completed sales and verified client reviews since 2011.',
    items: [
      { value: '1,200+', label: 'Homes sold', detail: 'Villas, townhouses and apartments' },
      { value: '38 days', label: 'Average time to sell', detail: 'Across all our listings' },
      { value: '4.9/5', label: 'Client rating', detail: 'From 860 verified reviews' },
      { value: '24', label: 'Licensed advisers', detail: 'Arabic and English speaking' },
    ],
  },
  gallery: {
    eyebrow: 'Inside our homes',
    heading: 'Light, space and finishes you can feel',
    body: 'A look inside homes we have listed this season.',
    linkLabel: 'Open the photo',
    captions: [
      'Living room with floor-to-ceiling windows, Dubai Hills',
      'Kitchen with an island and built-in appliances, Arabian Ranches',
      'Main bedroom opening onto the garden, Jumeirah',
      'Bathroom with a freestanding tub, Dubai Marina',
      'Dining area in a bright bay window, Downtown Dubai',
      'Family lounge with a long sofa, Business Bay',
    ],
  },
  agents: {
    eyebrow: 'Our advisers',
    heading: 'Advisers who know every street',
    body: 'Licensed, bilingual and focused on the areas they live in.',
    profileLabel: 'Contact adviser',
    members: [
      {
        name: 'Yousef Al-Marzouqi',
        role: 'Senior adviser · Dubai Hills',
        bio: 'Twelve years selling family villas in Dubai Hills and Arabian Ranches.',
      },
      {
        name: 'Hala Saeed',
        role: 'Adviser · Downtown and Business Bay',
        bio: 'Helps first-time buyers find apartments with strong rental returns.',
      },
      {
        name: 'Mariam Al-Suwaidi',
        role: 'Head of sales',
        bio: 'Leads the team and handles off-plan purchases with developers.',
      },
      {
        name: 'Karim Fares',
        role: 'Adviser · Dubai Marina and Jumeirah',
        bio: 'Specialist in waterfront homes and penthouses.',
      },
    ],
  },
  quotes: {
    eyebrow: 'Clients',
    heading: 'Families who found their home with us',
    items: [
      {
        quote:
          'Yousef found our villa before it reached the portals, and handled the bank and the transfer in three weeks.',
        author: 'Ahmed and Layla Al-Hashimi',
        role: 'Bought in Dubai Hills',
      },
      {
        quote:
          'As a first-time buyer I had a hundred questions. Hala answered every one, in Arabic, without rushing me.',
        author: 'Noor Abdullah',
        role: 'Bought in Business Bay',
      },
      {
        quote:
          'They sold our townhouse in thirty days at the price they promised. Clear advice from start to finish.',
        author: 'Fahad Al-Mansoori',
        role: 'Sold in Arabian Ranches',
      },
      {
        quote: 'Honest about which homes were overpriced. That honesty saved us a lot of money.',
        author: 'Rania Khalaf',
        role: 'Bought in Jumeirah',
      },
    ],
  },
  contact: {
    eyebrow: 'Talk to us',
    heading: 'Book a viewing or a free valuation',
    body: 'Tell us what you are looking for, or what you would like to sell. An adviser calls you back the same day.',
    address: 'Office 1204, Sheikh Mohammed bin Rashid Boulevard, Downtown Dubai, UAE',
    availability: 'Saturday to Thursday, 9:00–19:00',
    formTitle: 'Request a call back',
    formBody: 'Share the area, the budget and the number of bedrooms you have in mind.',
    nameLabel: 'Full name',
    emailLabel: 'Email address',
    messageLabel: 'What are you looking for?',
    submitLabel: 'Request a call',
  },
  footer: {
    tagline: 'Homes for sale across Dubai, with licensed advisers who speak your language.',
    columns: [
      {
        title: 'Buy',
        links: [
          { label: 'Villas', href: '#listings' },
          { label: 'Townhouses', href: '#listings' },
          { label: 'Apartments', href: '#listings' },
          { label: 'Off-plan', href: '#off-plan' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Why us', href: '#why' },
          { label: 'Our advisers', href: '#agents' },
          { label: 'Careers', href: '#careers' },
        ],
      },
      {
        title: 'Help',
        links: [
          { label: 'Mortgage guide', href: '#mortgage' },
          { label: 'Sell your home', href: '#contact' },
          { label: 'Contact', href: '#contact' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'منزل للعقارات',
  nav: [
    { label: 'العقارات', href: '#listings' },
    { label: 'لماذا نحن', href: '#why' },
    { label: 'المستشارون', href: '#agents' },
    { label: 'تواصل', href: '#contact' },
  ],
  headerCta: { label: 'احجز معاينة', href: '#contact' },
  hero: {
    eyebrow: 'منازل للبيع في دبي · عقارات موثّقة',
    heading: 'منزلك في دبي، على مقاس حياتك',
    body: 'فلل ومنازل متلاصقة وشقق يعاينها مستشارونا بأنفسهم، بأسعار واضحة وكل الأوراق جاهزة قبل زيارتك.',
    trustLine: 'مستشارون مرخّصون · أكثر من 1,200 منزل مُباع · خدمة بالعربية والإنجليزية',
    primary: 'تصفّح العقارات',
    secondary: 'قيّم منزلك',
  },
  listings: {
    eyebrow: 'عقارات مختارة',
    heading: 'منازل معروضة للبيع هذا الأسبوع',
    body: 'كل عقار نعاينه ونصوّره ونسعّره بأنفسنا. الأسعار بالدرهم الإماراتي.',
    actionLabel: 'عرض التفاصيل',
    ratingPrefix: 'التقييم',
    ratingSuffix: 'من 5',
    reviewCountLabel: 'تقييمات المشترين',
    items: [
      {
        name: 'فيلا بمسبح في دبي هيلز استيت',
        description: 'فيلا · 5 غرف نوم · 6 حمّامات · 6,200 قدم مربع · مسبح وحديقة خاصة',
        badge: 'جديد',
      },
      {
        name: 'شقة بغرفتي نوم في وسط مدينة دبي',
        description: 'شقة · غرفتا نوم · 3 حمّامات · 1,450 قدماً مربعاً · إطلالة على برج خليفة',
      },
      {
        name: 'منزل متلاصق على زاوية في المرابع العربية',
        description: 'منزل متلاصق · 4 غرف نوم · 4 حمّامات · 3,100 قدم مربع · قرب المدارس',
        badge: 'سعر مخفّض',
      },
      {
        name: 'بنتهاوس من طابقين في دبي مارينا',
        description: 'بنتهاوس · 3 غرف نوم · 4 حمّامات · 3,800 قدم مربع · تراس على السطح',
        badge: 'حصري',
      },
      {
        name: 'فيلا عائلية في جميرا',
        description: 'فيلا · 6 غرف نوم · 7 حمّامات · 8,000 قدم مربع · خمس دقائق من الشاطئ',
      },
      {
        name: 'شقة بغرفة نوم في الخليج التجاري',
        description: 'شقة · غرفة نوم · حمّامان · 820 قدماً مربعاً · إطلالة على القناة',
        badge: 'جاهزة للسكن',
      },
    ],
  },
  why: {
    eyebrow: 'لماذا منزل',
    heading: 'شراء المنزل قرار يجب أن يكون مطمئناً لا مرهقاً',
    body: 'مستشار واحد يرافقك من أول معاينة حتى يوم استلام المفاتيح.',
    items: [
      {
        kicker: 'موثّق',
        title: 'كل عقار نعاينه بأنفسنا',
        body: 'نزور كل منزل ونقيسه ونصوّره بأنفسنا، فما تراه هو ما ستجده.',
      },
      {
        kicker: 'شفافية',
        title: 'أسعار ورسوم واضحة',
        body: 'رسوم الخدمة والتسجيل وعمولتنا مكتوبة أمامك قبل أن تقدّم عرضك.',
      },
      {
        kicker: 'التمويل',
        title: 'مساعدة في التمويل العقاري',
        body: 'نقارن عروض البنوك الكبرى وننجز الأوراق معك خطوة بخطوة.',
      },
      {
        kicker: 'ما بعد البيع',
        title: 'دعم بعد الانتقال',
        body: 'من توصيل الخدمات إلى أرقام الصيانة، نساعدك على الاستقرار في بيتك الجديد.',
      },
    ],
  },
  stats: {
    eyebrow: 'سجلّنا',
    heading: 'خمسة عشر عاماً نساعد العائلات على الانتقال إلى منازلها في دبي',
    body: 'أرقام من صفقات البيع المكتملة وتقييمات العملاء الموثّقة منذ 2011.',
    items: [
      { value: '1,200+', label: 'منزل مُباع', detail: 'فلل ومنازل متلاصقة وشقق' },
      { value: '38 يوماً', label: 'متوسط مدة البيع', detail: 'لجميع عقاراتنا' },
      { value: '4.9/5', label: 'تقييم العملاء', detail: 'من 860 تقييماً موثّقاً' },
      { value: '24', label: 'مستشاراً مرخّصاً', detail: 'يتحدثون العربية والإنجليزية' },
    ],
  },
  gallery: {
    eyebrow: 'من داخل منازلنا',
    heading: 'ضوء ومساحة وتشطيبات تلمس جودتها',
    body: 'نظرة إلى داخل منازل عرضناها هذا الموسم.',
    linkLabel: 'افتح الصورة',
    captions: [
      'صالة معيشة بنوافذ ممتدة حتى السقف، دبي هيلز',
      'مطبخ بجزيرة وأجهزة مدمجة، المرابع العربية',
      'غرفة النوم الرئيسية تطل على الحديقة، جميرا',
      'حمّام بحوض استحمام مستقل، دبي مارينا',
      'ركن طعام في نافذة بارزة مضيئة، وسط مدينة دبي',
      'صالة عائلية بأريكة طويلة، الخليج التجاري',
    ],
  },
  agents: {
    eyebrow: 'مستشارونا',
    heading: 'مستشارون يعرفون كل شارع',
    body: 'مرخّصون ويتحدثون اللغتين، ويتخصص كل منهم في الأحياء التي يسكنها.',
    profileLabel: 'تواصل مع المستشار',
    members: [
      {
        name: 'يوسف المرزوقي',
        role: 'مستشار أول · دبي هيلز',
        bio: 'اثنا عشر عاماً في بيع الفلل العائلية في دبي هيلز والمرابع العربية.',
      },
      {
        name: 'هالة سعيد',
        role: 'مستشارة · وسط المدينة والخليج التجاري',
        bio: 'تساعد من يشترون لأول مرة على اختيار شقق بعائد إيجاري جيد.',
      },
      {
        name: 'مريم السويدي',
        role: 'مديرة المبيعات',
        bio: 'تقود الفريق وتتولى صفقات الشراء على الخريطة مع المطوّرين.',
      },
      {
        name: 'كريم فارس',
        role: 'مستشار · دبي مارينا وجميرا',
        bio: 'متخصص في المنازل المطلة على البحر وشقق البنتهاوس.',
      },
    ],
  },
  quotes: {
    eyebrow: 'عملاؤنا',
    heading: 'عائلات وجدت منزلها معنا',
    items: [
      {
        quote:
          'وجد لنا يوسف الفيلا قبل أن تُعرض على المواقع، وأنهى إجراءات البنك ونقل الملكية في ثلاثة أسابيع.',
        author: 'أحمد وليلى الهاشمي',
        role: 'اشتريا في دبي هيلز',
      },
      {
        quote: 'كنت أشتري لأول مرة ولديّ مئة سؤال، فأجابت هالة عنها كلها بالعربية ومن دون استعجال.',
        author: 'نور عبدالله',
        role: 'اشترت في الخليج التجاري',
      },
      {
        quote:
          'باعوا منزلنا في ثلاثين يوماً بالسعر الذي وعدوا به، ونصائحهم واضحة من البداية حتى النهاية.',
        author: 'فهد المنصوري',
        role: 'باع في المرابع العربية',
      },
      {
        quote: 'كانوا صريحين في تحديد المنازل المبالغ في أسعارها، وهذه الصراحة وفّرت علينا الكثير.',
        author: 'رانيا خلف',
        role: 'اشترت في جميرا',
      },
    ],
  },
  contact: {
    eyebrow: 'تحدث إلينا',
    heading: 'احجز معاينة أو تقييماً مجانياً لمنزلك',
    body: 'أخبرنا عمّا تبحث عنه أو ما تريد بيعه، ويتصل بك أحد مستشارينا في اليوم نفسه.',
    address: 'مكتب 1204، بوليفارد الشيخ محمد بن راشد، وسط مدينة دبي، الإمارات',
    availability: 'من السبت إلى الخميس، 9:00–19:00',
    formTitle: 'اطلب اتصالاً',
    formBody: 'شاركنا المنطقة والميزانية وعدد غرف النوم التي تفكر بها.',
    nameLabel: 'الاسم الكامل',
    emailLabel: 'البريد الإلكتروني',
    messageLabel: 'عمّ تبحث؟',
    submitLabel: 'اطلب مكالمة',
  },
  footer: {
    tagline: 'منازل للبيع في أنحاء دبي، مع مستشارين مرخّصين يتحدثون لغتك.',
    columns: [
      {
        title: 'اشترِ',
        links: [
          { label: 'فلل', href: '#listings' },
          { label: 'منازل متلاصقة', href: '#listings' },
          { label: 'شقق', href: '#listings' },
          { label: 'على الخريطة', href: '#off-plan' },
        ],
      },
      {
        title: 'الشركة',
        links: [
          { label: 'لماذا نحن', href: '#why' },
          { label: 'مستشارونا', href: '#agents' },
          { label: 'الوظائف', href: '#careers' },
        ],
      },
      {
        title: 'مساعدة',
        links: [
          { label: 'دليل التمويل العقاري', href: '#mortgage' },
          { label: 'بِع منزلك', href: '#contact' },
          { label: 'تواصل معنا', href: '#contact' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const realEstateTemplate = defineTemplate({
  key: 'realestate',
  category: 'realestate',
  baseId: 'real-estate',
  name: { en: 'Real estate', ar: 'عقارات' },
  description: {
    en: 'A property site with verified listings, reasons to choose you, interiors, advisers and a viewing request form.',
    ar: 'موقع عقاري بعقارات موثّقة وأسباب لاختيارك وصور من الداخل والمستشارين ونموذج طلب معاينة.',
  },
  thumbnail: { topic: 'realestate', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `realestate-${lang}`;
    const heroPhoto = photo('realestate', HERO_PHOTO, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#listings',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#contact',
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

    page.section('listings', 'productGrid', {
      eyebrow: copy.listings.eyebrow,
      heading: copy.listings.heading,
      body: copy.listings.body,
      actionLabel: copy.listings.actionLabel,
      showRatings: false,
      ratingPrefix: copy.listings.ratingPrefix,
      ratingSuffix: copy.listings.ratingSuffix,
      reviewCountLabel: copy.listings.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.listings.items.map((item, index) => {
          const image = photo('realestate', LISTING_PHOTOS[index] ?? -1, lang);
          const original = ORIGINAL_PRICES[index];
          return {
            ...item,
            price: money(LISTING_PRICES[index] ?? 0, 'AED', lang),
            ...(original === undefined ? {} : { originalPrice: money(original, 'AED', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: LISTING_HREFS[index] ?? '#listings',
          };
        }),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('why', 'features', {
      eyebrow: copy.why.eyebrow,
      heading: copy.why.heading,
      body: copy.why.body,
      items: json(copy.why.items),
      columns: '2',
      variant: 'bordered',
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
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('realestate', photoIndex, lang);
          return { src: image.src, alt: image.alt, caption: copy.gallery.captions[index] };
        }),
      ),
      layout: 'grid',
      columns: '3',
      aspect: 'landscape',
      imageFit: 'cover',
      showCaptions: true,
      captionStyle: 'below',
      linkImages: false,
      linkLabel: copy.gallery.linkLabel,
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('agents', 'team', {
      eyebrow: copy.agents.eyebrow,
      heading: copy.agents.heading,
      body: copy.agents.body,
      profileLabel: copy.agents.profileLabel,
      members: json(
        copy.agents.members.map((member, index) => {
          const [topic, photoIndex] = AGENT_PHOTOS[index] ?? ['portraits', -1];
          const portrait = photo(topic, photoIndex, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: AGENT_HREFS[index] ?? '#agents',
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
      email: 'homes@example.com',
      phone: '+971 4 555 0177',
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/viewings',
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
