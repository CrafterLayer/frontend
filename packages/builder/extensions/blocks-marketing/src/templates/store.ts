import { defineTemplate, footer, header, json, money, photo, type NavLink } from './build';
import type { TemplateLang } from './types';

/*
  Store (`commerce-launch` / `commerce-launch-ar`) — DESIGN §B.3.

  A perfume house in Riyadh. announcement → header → split hero with a
  product photo → product grid (6 products, every one photographed, 3 × 2 with
  no featured blank) → features (6 service promises, 3 × 2) → promo banner
  with a DIFFERENT photo from the hero → reviews (2 × 2) → FAQ → newsletter →
  footer. Prices come from `money(…, 'SAR', lang)`: `SAR 380` / `380 ر.س`.
*/

const PRICES = [380, 290, 320, 650, 145, 260] as const;
const ORIGINAL_PRICES: Readonly<Record<number, number>> = { 2: 360 };
const RATINGS = [4.9, 4.7, 4.8, 4.9, 4.8, 4.7] as const;
const REVIEWS = [214, 132, 98, 61, 77, 143] as const;
const PRODUCT_HREFS = [
  '#amber-nights',
  '#saffron-musk',
  '#taif-rose',
  '#pure-oud-oil',
  '#bakhoor-candle',
  '#white-oud',
];

const EN = {
  brand: 'Bayt Al Oud',
  announcement: {
    label: 'Free delivery',
    message: 'Free delivery across Saudi Arabia this month, and gift wrapping on every order.',
    linkLabel: 'Shop gifts',
  },
  nav: [
    { label: 'Shop', href: '#shop' },
    { label: 'Gifts', href: '#gifts' },
    { label: 'Our story', href: '#story' },
    { label: 'Help', href: '#help' },
  ] as NavLink[],
  headerCta: { label: 'Shop now', href: '#shop' },
  hero: {
    eyebrow: 'Perfumes made in Riyadh',
    heading: 'Oud, amber and rose, blended for every day',
    body: 'Small-batch perfumes and oils made with Cambodian oud, Taif rose and Omani frankincense. Every bottle is filled by hand in our Riyadh atelier.',
    trustLine: 'Free samples · Easy returns · Cash on delivery',
    primary: 'Explore the collection',
    secondary: 'Read our story',
  },
  products: {
    eyebrow: 'Best sellers',
    heading: 'Signature scents',
    body: 'Six perfumes and oils our customers come back for, from deep oud to soft rose.',
    actionLabel: 'Add to bag',
    ratingPrefix: 'Rated',
    ratingSuffix: 'out of 5',
    reviewCountLabel: 'reviews',
    items: [
      {
        name: 'Amber Nights Eau de Parfum',
        description: 'Warm amber, vanilla and a trace of oud for evenings out. 100 ml.',
        badge: 'Best seller',
      },
      {
        name: 'Saffron Musk',
        description: 'Bright saffron over clean white musk, light enough for the office. 75 ml.',
      },
      {
        name: 'Taif Rose',
        description: 'Fresh Taif rose with pink pepper and soft woods. 75 ml.',
        badge: 'Limited batch',
      },
      {
        name: 'Pure Oud Oil',
        description: 'Concentrated oud oil in a 12 ml dropper, alcohol-free and long-lasting.',
      },
      {
        name: 'Bakhoor Candle',
        description: 'A slow-burning candle with notes of bakhoor, sandalwood and cardamom.',
      },
      {
        name: 'White Oud',
        description: 'A clean, modern oud with bergamot and cedar for every day. 50 ml.',
      },
    ] as { name: string; description: string; badge?: string }[],
  },
  features: {
    eyebrow: 'Why shop with us',
    heading: 'Made carefully, delivered quickly',
    body: 'Everything you need to choose a fragrance online with confidence.',
    items: [
      {
        title: 'Delivery in 2 days',
        body: 'Free across the Kingdom on orders over SAR 300, and same day in Riyadh.',
      },
      {
        title: 'Free samples',
        body: 'Choose two 2 ml samples with every order to try at home first.',
      },
      {
        title: '30-day returns',
        body: 'Changed your mind? Return unopened bottles within the month for a full refund.',
      },
      {
        title: 'Authentic ingredients',
        body: 'Every oil is traceable to its source, and every batch is tested in our atelier.',
      },
      {
        title: 'Gift wrapping',
        body: 'Wrapped by hand with a handwritten card, at no extra cost.',
      },
      {
        title: 'Secure payment',
        body: 'Pay by mada, credit card or cash on delivery.',
      },
    ],
  },
  promo: {
    label: 'Gift sets',
    headline: 'Give a scent they will remember',
    body: 'Our new gift sets pair a perfume with a matching oil and candle, wrapped and ready for Eid, weddings and new homes.',
    primary: 'Shop gift sets',
    secondary: 'Build your own set',
  },
  quotes: {
    eyebrow: 'Reviews',
    heading: 'Loved by customers across the Kingdom',
    items: [
      {
        quote:
          'Amber Nights is the only perfume people stop me to ask about, and it lasts all day.',
        author: 'Noura A.',
        role: 'Verified buyer · Riyadh',
      },
      {
        quote: 'The oud oil is the real thing. One drop is enough for the whole evening.',
        author: 'Faisal M.',
        role: 'Verified buyer · Jeddah',
      },
      {
        quote: 'Ordered at night, delivered the next afternoon and beautifully wrapped as a gift.',
        author: 'Huda K.',
        role: 'Verified buyer · Dammam',
      },
      {
        quote: 'The samples helped me choose without guessing. Taif Rose is now my everyday scent.',
        author: 'Reem S.',
        role: 'Verified buyer · Khobar',
      },
    ],
  },
  faq: {
    eyebrow: 'Help',
    heading: 'Orders, delivery and returns',
    items: [
      {
        question: 'How long does delivery take?',
        answer:
          'Orders reach most cities in the Kingdom within two working days. Riyadh orders placed before 2 pm arrive the same day.',
      },
      {
        question: 'Can I return a perfume?',
        answer:
          'Unopened bottles can be returned within a month of delivery. Opened bottles are exchanged if there is a fault.',
      },
      {
        question: 'Are your perfumes alcohol-free?',
        answer:
          'Our oils are alcohol-free. Our eaux de parfum use perfumer’s alcohol, as listed on each product page.',
      },
      {
        question: 'Do you ship outside Saudi Arabia?',
        answer:
          'We deliver across the Gulf countries. Duties and delivery times are shown at checkout.',
      },
    ],
  },
  newsletter: {
    eyebrow: 'Newsletter',
    heading: 'New blends and private sales, first',
    body: 'Join our list for early access to limited batches and seasonal gift sets.',
    emailLabel: 'Email address',
    placeholder: 'name@example.com',
    buttonLabel: 'Join the list',
    privacy: 'One email a month at most. Unsubscribe anytime.',
  },
  footer: {
    tagline: 'Small-batch perfumes and oils, made in Riyadh.',
    columns: [
      {
        title: 'Shop',
        links: [
          { label: 'Perfumes', href: '#perfumes' },
          { label: 'Oils', href: '#oils' },
          { label: 'Candles', href: '#candles' },
          { label: 'Gift sets', href: '#gifts' },
        ],
      },
      {
        title: 'Help',
        links: [
          { label: 'Delivery', href: '#delivery' },
          { label: 'Returns', href: '#returns' },
          { label: 'Contact us', href: '#contact' },
        ],
      },
      {
        title: 'Bayt Al Oud',
        links: [
          { label: 'Our story', href: '#story' },
          { label: 'Atelier visits', href: '#atelier' },
          { label: 'Careers', href: '#careers' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'بيت العود',
  announcement: {
    label: 'توصيل مجاني',
    message: 'توصيل مجاني لكل مدن المملكة هذا الشهر، وتغليف هدايا مع كل طلب.',
    linkLabel: 'تسوّق الهدايا',
  },
  nav: [
    { label: 'المتجر', href: '#shop' },
    { label: 'الهدايا', href: '#gifts' },
    { label: 'قصتنا', href: '#story' },
    { label: 'المساعدة', href: '#help' },
  ],
  headerCta: { label: 'تسوّق الآن', href: '#shop' },
  hero: {
    eyebrow: 'عطور تُصنع في الرياض',
    heading: 'عود وعنبر وورد، ممزوجة لكل يوم',
    body: 'عطور ودهون بكميات صغيرة من العود الكمبودي وورد الطائف واللبان العُماني، تُعبّأ كل زجاجة يدوياً في مشغلنا بالرياض.',
    trustLine: 'عينات مجانية · إرجاع سهل · الدفع عند الاستلام',
    primary: 'اكتشف المجموعة',
    secondary: 'اقرأ قصتنا',
  },
  products: {
    eyebrow: 'الأكثر مبيعاً',
    heading: 'عطورنا المميزة',
    body: 'ستة عطور ودهون يعود إليها عملاؤنا، من العود العميق إلى الورد الناعم.',
    actionLabel: 'أضف إلى السلة',
    ratingPrefix: 'التقييم',
    ratingSuffix: 'من 5',
    reviewCountLabel: 'تقييماً',
    items: [
      {
        name: 'ليالي العنبر — ماء عطر',
        description: 'عنبر دافئ وفانيلا ولمسة عود لأمسياتك. 100 مل.',
        badge: 'الأكثر مبيعاً',
      },
      {
        name: 'مسك الزعفران',
        description: 'زعفران مشرق فوق مسك أبيض نظيف، خفيف بما يكفي للعمل. 75 مل.',
      },
      {
        name: 'ورد الطائف',
        description: 'ورد طائفي منعش مع الفلفل الوردي والأخشاب الناعمة. 75 مل.',
        badge: 'كمية محدودة',
      },
      {
        name: 'دهن العود الصافي',
        description: 'دهن عود مركّز في قارورة بقطّارة سعة 12 مل، خالٍ من الكحول ويدوم طويلاً.',
      },
      {
        name: 'شمعة البخور',
        description: 'شمعة بطيئة الاحتراق بنفحات البخور وخشب الصندل والهيل.',
      },
      {
        name: 'العود الأبيض',
        description: 'عود عصري نظيف مع البرغموت والأرز للاستخدام اليومي. 50 مل.',
      },
    ],
  },
  features: {
    eyebrow: 'لماذا تتسوق معنا',
    heading: 'صُنعت بعناية، وتصلك بسرعة',
    body: 'كل ما تحتاجه لتختار عطرك عبر الإنترنت بثقة.',
    items: [
      {
        title: 'توصيل خلال يومين',
        body: 'مجاني في كل المملكة للطلبات فوق 300 ر.س، وفي اليوم نفسه داخل الرياض.',
      },
      { title: 'عينات مجانية', body: 'اختر عينتين بحجم 2 مل مع كل طلب لتجربهما في البيت أولاً.' },
      {
        title: 'إرجاع خلال 30 يوماً',
        body: 'غيّرت رأيك؟ أعد الزجاجات غير المفتوحة خلال شهر واسترد المبلغ كاملاً.',
      },
      {
        title: 'مكونات أصلية',
        body: 'كل دهن معروف المصدر، وكل دفعة تُختبر في مشغلنا قبل أن تصلك.',
      },
      { title: 'تغليف الهدايا', body: 'نغلّف طلبك يدوياً مع بطاقة بخط اليد، دون تكلفة إضافية.' },
      { title: 'دفع آمن', body: 'ادفع ببطاقة مدى أو البطاقة الائتمانية أو نقداً عند الاستلام.' },
    ],
  },
  promo: {
    label: 'أطقم الهدايا',
    headline: 'أهدِ عطراً لا يُنسى',
    body: 'أطقم الهدايا الجديدة تجمع عطراً مع دهن وشمعة متناسقة، مغلّفة وجاهزة للعيد والأعراس والبيوت الجديدة.',
    primary: 'تسوّق أطقم الهدايا',
    secondary: 'صمّم طقمك بنفسك',
  },
  quotes: {
    eyebrow: 'آراء العملاء',
    heading: 'يحبه عملاؤنا في كل أنحاء المملكة',
    items: [
      {
        quote:
          'ليالي العنبر هو العطر الوحيد الذي يوقفني الناس ليسألوا عنه، وثباته يدوم طوال اليوم.',
        author: 'نورة ع.',
        role: 'مشترية موثّقة · الرياض',
      },
      {
        quote: 'دهن العود أصلي فعلاً، وقطرة واحدة تكفي السهرة كلها.',
        author: 'فيصل م.',
        role: 'مشترٍ موثّق · جدة',
      },
      {
        quote: 'طلبت في الليل ووصلني عصر اليوم التالي، مغلّفاً كهدية بشكل جميل.',
        author: 'هدى ك.',
        role: 'مشترية موثّقة · الدمام',
      },
      {
        quote: 'العينات ساعدتني أختار دون تخمين، وصار ورد الطائف عطري اليومي.',
        author: 'ريم س.',
        role: 'مشترية موثّقة · الخبر',
      },
    ],
  },
  faq: {
    eyebrow: 'المساعدة',
    heading: 'الطلبات والتوصيل والإرجاع',
    items: [
      {
        question: 'كم يستغرق التوصيل؟',
        answer:
          'تصل الطلبات إلى معظم مدن المملكة خلال يومي عمل، وطلبات الرياض قبل الثانية ظهراً تصل في اليوم نفسه.',
      },
      {
        question: 'هل يمكنني إرجاع العطر؟',
        answer:
          'يمكن إرجاع الزجاجات غير المفتوحة خلال شهر من الاستلام، ونستبدل الزجاجة المفتوحة إذا كان فيها عيب.',
      },
      {
        question: 'هل عطوركم خالية من الكحول؟',
        answer:
          'الدهون العطرية خالية من الكحول، أما ماء العطر ففيه كحول العطور، وذلك مذكور في صفحة كل منتج.',
      },
      {
        question: 'هل تشحنون خارج السعودية؟',
        answer: 'نوصل إلى كل دول الخليج، وتظهر الرسوم ومدة التوصيل عند إتمام الطلب.',
      },
    ],
  },
  newsletter: {
    eyebrow: 'النشرة البريدية',
    heading: 'خلطات جديدة وعروض خاصة، قبل الجميع',
    body: 'انضم إلى قائمتنا لتصلك الدفعات المحدودة وأطقم الهدايا الموسمية أولاً.',
    emailLabel: 'البريد الإلكتروني',
    placeholder: 'name@example.com',
    buttonLabel: 'انضم إلى القائمة',
    privacy: 'رسالة واحدة في الشهر على الأكثر، وإلغاء الاشتراك متى شئت.',
  },
  footer: {
    tagline: 'عطور ودهون بكميات صغيرة، تُصنع في الرياض.',
    columns: [
      {
        title: 'المتجر',
        links: [
          { label: 'العطور', href: '#perfumes' },
          { label: 'الدهون', href: '#oils' },
          { label: 'الشموع', href: '#candles' },
          { label: 'أطقم الهدايا', href: '#gifts' },
        ],
      },
      {
        title: 'المساعدة',
        links: [
          { label: 'التوصيل', href: '#delivery' },
          { label: 'الإرجاع', href: '#returns' },
          { label: 'تواصل معنا', href: '#contact' },
        ],
      },
      {
        title: 'عن بيت العود',
        links: [
          { label: 'قصتنا', href: '#story' },
          { label: 'زيارة المشغل', href: '#atelier' },
          { label: 'الوظائف', href: '#careers' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** store photo index per product (the hero is #0 and the promo #7; neither repeats). */
const PRODUCT_PHOTOS = [1, 2, 3, 4, 5, 6] as const;

export const storeTemplate = defineTemplate({
  key: 'store',
  category: 'store',
  baseId: 'commerce-launch',
  name: { en: 'Perfume store', ar: 'متجر عطور' },
  description: {
    en: 'A fragrance shop with best sellers, delivery promises, gift sets, reviews and help.',
    ar: 'متجر عطور بالأكثر مبيعاً ومزايا التوصيل وأطقم الهدايا وآراء العملاء والمساعدة.',
  },
  thumbnail: { topic: 'store', index: 0 },
  surfaces: ['site', 'store'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `store-${lang}`;
    const heroPhoto = photo('store', 0, lang);
    const promoPhoto = photo('store', 7, lang);

    page.section('announcement', 'announcementBar', {
      label: copy.announcement.label,
      message: copy.announcement.message,
      linkLabel: copy.announcement.linkLabel,
      href: '#gifts',
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
      href: '#shop',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#story',
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
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('products', 'productGrid', {
      eyebrow: copy.products.eyebrow,
      heading: copy.products.heading,
      body: copy.products.body,
      actionLabel: copy.products.actionLabel,
      showRatings: true,
      ratingPrefix: copy.products.ratingPrefix,
      ratingSuffix: copy.products.ratingSuffix,
      reviewCountLabel: copy.products.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.products.items.map((item, index) => {
          const image = photo('store', PRODUCT_PHOTOS[index] ?? -1, lang);
          const original = ORIGINAL_PRICES[index];
          return {
            ...item,
            price: money(PRICES[index] ?? 0, 'SAR', lang),
            ...(original === undefined ? {} : { originalPrice: money(original, 'SAR', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: PRODUCT_HREFS[index] ?? '#shop',
            rating: RATINGS[index],
            reviewCount: REVIEWS[index],
          };
        }),
      ),
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('features', 'features', {
      eyebrow: copy.features.eyebrow,
      heading: copy.features.heading,
      body: copy.features.body,
      items: json(copy.features.items),
      columns: '3',
      variant: 'bordered',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('promo', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#gifts', emphasis: 'primary' },
        { label: copy.promo.secondary, href: '#build-a-set', emphasis: 'secondary' },
      ],
      imageSrc: promoPhoto.src,
      imageAlt: promoPhoto.alt,
      showMedia: true,
      variant: 'split',
      panelStyle: 'inverse',
      mediaPosition: 'end',
      mediaAspect: 'square',
      padding: 'spacious',
      radius: 'xl',
      align: 'start',
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

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'divided',
      tone: 'transparent',
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
      variant: 'card',
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
