import { defineTemplate, footer, header, json, money, photo, type NavLink } from '../build';
import type { TemplateLang } from '../types';

/*
  Restaurant (`restaurant` / `restaurant-ar`) — agent-script DESIGN §B.3.

  header (Menu · About · Reservations · Visit) → centred hero with a wide
  table photo and "Book a table" → three signatures as a bento (featured +
  two small cards fill the 6- and 12-column mosaics) → the menu as a product
  grid of 12 photographed dishes priced with money(…, 'JOD') (12 fills 2, 3
  and 4 columns) → a 6-photo editorial gallery (featured 1st and 4th, so the
  2-column masonry has no hole) → guest reviews → visit details with a table
  request form → a private-dining banner over a dining-room photo → footer.

  «مطعم بيت الزيتون — عمّان»: a Levantine house on Rainbow Street, Amman.
*/

/** Dish photo index in TEMPLATE_PHOTOS.restaurant, per menu item. */
const DISH_PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** Menu prices in Jordanian dinars, per menu item. */
const DISH_PRICES = [3, 3, 4, 5, 18, 7, 14, 15, 5, 3, 4, 2] as const;
const DISH_HREFS = [
  '#menu-hummus',
  '#menu-falafel',
  '#menu-sambousek',
  '#menu-salad',
  '#menu-mixed-grill',
  '#menu-shawarma',
  '#menu-salmon',
  '#menu-beef',
  '#menu-rice',
  '#menu-muhallabia',
  '#menu-chocolate-cake',
  '#menu-lemon-mint',
] as const;
/** Gallery photo index; the 1st and 4th are featured (span two columns). */
const GALLERY_PHOTOS = [16, 18, 15, 14, 19, 17] as const;
const HERO_PHOTO = 0;
const PROMO_PHOTO = 13;
const PHONE = '+962 6 464 2210';
const PHONE_HREF = 'tel:+96264642210';

interface Dish {
  readonly name: string;
  readonly description: string;
  readonly badge?: string;
}

const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'small', emphasis: 'accent' },
] as const;

const EN = {
  brand: 'Olive House',
  nav: [
    { label: 'Menu', href: '#menu' },
    { label: 'About', href: '#about' },
    { label: 'Reservations', href: '#reserve' },
    { label: 'Visit', href: '#visit' },
  ] as NavLink[],
  headerCta: { label: 'Reserve', href: '#reserve' },
  hero: {
    eyebrow: 'Levantine kitchen · Jabal Amman',
    heading: 'Levantine home cooking, slow and generous',
    body: 'Charcoal grills, mezze made every morning and bread from our own taboon oven, served at long tables meant for sharing.',
    trustLine: 'Open daily 12:00–23:30 · Terrace seating · Family tables for up to 14',
    primary: 'Book a table',
    secondary: 'See the menu',
  },
  signatures: {
    eyebrow: 'Our signatures',
    heading: 'Three reasons our regulars keep their Thursday table',
    body: 'Everything is cooked to order from Jordanian produce, and nothing on the menu is older than this morning.',
    items: [
      {
        kicker: 'From the charcoal grill',
        title: 'Mixed grill over olive wood',
        body: 'Lamb kofta, shish tawook and lamb chops grilled to order over olive wood, then rested on warm bread that soaks up every drop.',
        metric: 'Since 2009',
      },
      {
        kicker: 'Baked every hour',
        title: 'Taboon bread from our own oven',
        body: 'Dough rested overnight and baked in our stone taboon from noon until close.',
      },
      {
        kicker: 'Made each morning',
        title: 'Mezze from family recipes',
        body: 'Hummus, moutabal and muhammara made daily with olive oil pressed in Ajloun.',
      },
    ],
  },
  menu: {
    eyebrow: 'The menu',
    heading: 'Mezze, grills and something sweet',
    body: 'Prices in Jordanian dinars, service included. Ask us about vegetarian and gluten-free options.',
    actionLabel: 'Order for pickup',
    ratingPrefix: 'Rating',
    ratingSuffix: 'of 5',
    reviewCountLabel: 'guest reviews',
    dishes: [
      {
        name: 'Hummus with olive oil',
        description: 'Chickpeas whipped with tahini and lemon, finished with Ajloun olive oil.',
        badge: 'Vegan',
      },
      {
        name: 'Falafel plate',
        description: 'Six crisp falafel with tahini sauce, pickles and warm bread.',
      },
      {
        name: 'Cheese sambousek',
        description: 'Golden pastries filled with white cheese and parsley, served with green chilli.',
      },
      {
        name: 'Strawberry and white cheese salad',
        description: 'Seasonal leaves, strawberries and crumbled white cheese with a pomegranate dressing.',
        badge: 'New',
      },
      {
        name: 'Olive House mixed grill',
        description: 'Lamb kofta, shish tawook and lamb chops with grilled vegetables, for two.',
        badge: "Chef's pick",
      },
      {
        name: 'Chicken shawarma plate',
        description: 'Marinated chicken carved from the spit, with garlic sauce, fries and pickles.',
      },
      {
        name: 'Grilled salmon with greens',
        description: 'Salmon fillet with sumac, sautéed greens and lemon.',
      },
      {
        name: 'Sliced beef with herbs',
        description: 'Grilled beef with fresh herbs, chilli and a pomegranate glaze.',
      },
      {
        name: 'Spiced vegetable rice',
        description: 'Long-grain rice with seven spices, carrots and spring onions.',
      },
      {
        name: 'Strawberry muhallabia',
        description: 'Orange-blossom milk pudding topped with fresh strawberries.',
      },
      {
        name: 'Chocolate layer cake',
        description: 'Dark chocolate sponge layered with ganache, baked daily.',
      },
      {
        name: 'Lemon and mint',
        description: 'Fresh lemon blended with mint and crushed ice.',
      },
    ] as Dish[],
  },
  gallery: {
    eyebrow: 'Inside Olive House',
    heading: 'A kitchen you can watch and a room built for long dinners',
    body: 'Pull up a chair by the open grill, or take the quiet hall for a family celebration.',
    linkLabel: 'Open the photo',
    captions: [
      'The charcoal grill runs from noon until the last order.',
      'Kunafa dough, shredded fresh for every tray.',
      'Every plate is checked at the pass before it leaves.',
      'The garden hall seats 80 in natural light.',
      'Baklava layered by hand each afternoon.',
      'The quiet room for celebrations and business lunches.',
    ],
  },
  quotes: {
    eyebrow: 'Guests',
    heading: 'What our guests come back for',
    items: [
      {
        quote:
          "The mixed grill tastes like my grandmother's Friday lunch, and the bread arrives straight from the oven. We book every month.",
        author: 'Dana Khoury',
        role: 'Regular guest since 2015',
      },
      {
        quote:
          "We hosted forty people for my father's retirement. The team handled every detail and the kunafa was still warm.",
        author: 'Hani Mansour',
        role: 'Hosted a family dinner',
      },
      {
        quote: 'Honest prices, generous plates and a team that remembers how you take your coffee.',
        author: 'Lara Saleh',
        role: 'Weekly lunch guest',
      },
      {
        quote:
          'The best hummus in Amman, and I have tried most of them. The terrace on a summer evening is hard to beat.',
        author: 'Sami Odeh',
        role: 'Food writer',
      },
    ],
  },
  contact: {
    eyebrow: 'Visit us',
    heading: 'Find us on Rainbow Street',
    body: 'Walk-ins are welcome at lunch. For dinner and groups of six or more, send a request and we confirm within the hour.',
    address: 'Rainbow Street 34, Jabal Amman, Amman 11181, Jordan',
    availability: 'Daily 12:00–23:30 · Friday from 13:00',
    formTitle: 'Request a table',
    formBody: 'Tell us the date, the time and how many guests are coming.',
    nameLabel: 'Your name',
    emailLabel: 'Email',
    messageLabel: 'Date, time and guests',
    submitLabel: 'Send request',
  },
  promo: {
    label: 'Private dining',
    headline: 'Book the family table for up to 14 guests',
    body: `Set menus from ${money(22, 'JOD', 'en')} per person, with a dedicated host and a dessert table for birthdays and engagements.`,
    primary: 'Reserve your evening',
    secondary: 'Call the restaurant',
  },
  footer: {
    tagline: 'Levantine home cooking on Rainbow Street, Amman, since 2009.',
    columns: [
      {
        title: 'Restaurant',
        links: [
          { label: 'Menu', href: '#menu' },
          { label: 'Our story', href: '#about' },
          { label: 'Private dining', href: '#private' },
          { label: 'Gift cards', href: '#gifts' },
        ],
      },
      {
        title: 'Visit',
        links: [
          { label: 'Reservations', href: '#reserve' },
          { label: 'Location', href: '#visit' },
          { label: 'Opening hours', href: '#hours' },
        ],
      },
      {
        title: 'Follow',
        links: [
          { label: 'Instagram', href: '#instagram' },
          { label: 'Facebook', href: '#facebook' },
        ],
      },
    ],
  },
};

const AR: typeof EN = {
  brand: 'بيت الزيتون',
  nav: [
    { label: 'القائمة', href: '#menu' },
    { label: 'قصتنا', href: '#about' },
    { label: 'الحجوزات', href: '#reserve' },
    { label: 'زورونا', href: '#visit' },
  ],
  headerCta: { label: 'احجز', href: '#reserve' },
  hero: {
    eyebrow: 'مطبخ شامي · جبل عمّان',
    heading: 'أكل بيتي شامي، مطبوخ على مهل وبكرم',
    body: 'مشاوي على الفحم، ومقبلات تُحضَّر كل صباح، وخبز طازج من فرن الطابون، على موائد طويلة صُمّمت للّمّة.',
    trustLine: 'مفتوح يومياً 12:00–23:30 · جلسات على التراس · طاولات عائلية حتى 14 شخصاً',
    primary: 'احجز طاولتك',
    secondary: 'تصفّح القائمة',
  },
  signatures: {
    eyebrow: 'أطباقنا المميزة',
    heading: 'ثلاثة أسباب تجعل زبائننا يحجزون طاولة الخميس كل أسبوع',
    body: 'كل طبق يُطهى عند الطلب من خيرات الأردن، ولا شيء في قائمتنا أقدم من صباح اليوم.',
    items: [
      {
        kicker: 'من شوّاية الفحم',
        title: 'مشاوي مشكّلة على حطب الزيتون',
        body: 'كفتة وشيش طاووق وريش غنم تُشوى عند الطلب على حطب الزيتون، ثم تُقدَّم على خبز ساخن يتشرّب كل نكهتها.',
        metric: 'منذ 2009',
      },
      {
        kicker: 'يُخبز كل ساعة',
        title: 'خبز الطابون من فرننا',
        body: 'عجين يرتاح ليلة كاملة ويُخبز في فرن الطابون الحجري من الظهر حتى الإغلاق.',
      },
      {
        kicker: 'يُحضَّر كل صباح',
        title: 'مقبلات من وصفات العائلة',
        body: 'حمّص ومتبّل ومحمّرة تُحضَّر يومياً بزيت زيتون معصور في عجلون.',
      },
    ],
  },
  menu: {
    eyebrow: 'القائمة',
    heading: 'مقبلات ومشاوي وشيء حلو للختام',
    body: 'الأسعار بالدينار الأردني وتشمل الخدمة. اسألونا عن الخيارات النباتية والخالية من الغلوتين.',
    actionLabel: 'اطلب للاستلام',
    ratingPrefix: 'التقييم',
    ratingSuffix: 'من 5',
    reviewCountLabel: 'تقييمات الضيوف',
    dishes: [
      {
        name: 'حمّص بزيت الزيتون',
        description: 'حمّص مهروس بالطحينة والليمون، يُزيَّن بزيت زيتون عجلون.',
        badge: 'نباتي',
      },
      {
        name: 'صحن فلافل',
        description: 'ست حبات فلافل مقرمشة مع صلصة الطحينة والمخللات والخبز الساخن.',
      },
      {
        name: 'سمبوسك بالجبنة',
        description: 'معجنات ذهبية محشوة بالجبنة البيضاء والبقدونس، تُقدَّم مع الفلفل الأخضر.',
      },
      {
        name: 'سلطة الفراولة والجبنة البيضاء',
        description: 'أوراق خضراء موسمية وفراولة وجبنة بيضاء مفتتة مع صلصة دبس الرمان.',
        badge: 'جديد',
      },
      {
        name: 'مشاوي بيت الزيتون المشكّلة',
        description: 'كفتة وشيش طاووق وريش غنم مع خضار مشوية، تكفي شخصين.',
        badge: 'اختيار الشيف',
      },
      {
        name: 'صحن شاورما دجاج',
        description: 'دجاج متبّل يُقطَّع من السيخ، مع الثومية والبطاطا المقلية والمخللات.',
      },
      {
        name: 'سلمون مشوي مع الخضار',
        description: 'فيليه سلمون بالسماق مع خضار ورقية مشوّحة وليمون.',
      },
      {
        name: 'شرائح لحم بالأعشاب',
        description: 'لحم بقري مشوي مع أعشاب طازجة وفلفل حار وصلصة دبس الرمان.',
      },
      {
        name: 'أرز بالخضار والبهارات',
        description: 'أرز طويل الحبة بالبهارات السبع والجزر والبصل الأخضر.',
      },
      {
        name: 'مهلبية بالفراولة',
        description: 'مهلبية بماء الزهر تعلوها الفراولة الطازجة.',
      },
      {
        name: 'كعكة الشوكولاتة',
        description: 'كيك شوكولاتة داكنة بطبقات من الغاناش، تُخبز يومياً.',
      },
      {
        name: 'ليمون ونعناع',
        description: 'عصير ليمون طازج مع النعناع والثلج المجروش.',
      },
    ],
  },
  gallery: {
    eyebrow: 'من داخل بيت الزيتون',
    heading: 'مطبخ مفتوح أمامك، وصالة صُمّمت للسهرات الطويلة',
    body: 'اجلس قرب الشوّاية المكشوفة، أو احجز الصالة الهادئة لمناسبات العائلة.',
    linkLabel: 'افتح الصورة',
    captions: [
      'شوّاية الفحم تعمل من الظهر حتى آخر طلب.',
      'عجينة الكنافة تُبشر طازجة لكل صينية.',
      'كل طبق يُراجَع قبل أن يخرج من المطبخ.',
      'صالة الحديقة تتسع لثمانين ضيفاً في ضوء النهار.',
      'البقلاوة تُرصّ باليد كل عصر.',
      'الصالة الهادئة للمناسبات وغداء العمل.',
    ],
  },
  quotes: {
    eyebrow: 'ضيوفنا',
    heading: 'لماذا يعود إلينا ضيوفنا',
    items: [
      {
        quote:
          'المشاوي المشكّلة طعمها مثل غداء الجمعة عند جدتي، والخبز يصل من الفرن مباشرة. نحجز كل شهر.',
        author: 'دانة خوري',
        role: 'ضيفة دائمة منذ 2015',
      },
      {
        quote:
          'استضفنا أربعين شخصاً بمناسبة تقاعد والدي، واهتم الفريق بكل التفاصيل، ووصلت الكنافة ساخنة.',
        author: 'هاني منصور',
        role: 'أقام عشاءً عائلياً',
      },
      {
        quote: 'أسعار معقولة وأطباق سخية، وفريق يتذكّر كيف تحب قهوتك.',
        author: 'لارا صالح',
        role: 'ضيفة غداء أسبوعية',
      },
      {
        quote: 'أطيب حمّص في عمّان، وقد جرّبت معظمها. والتراس في ليالي الصيف لا يُعلى عليه.',
        author: 'سامي عودة',
        role: 'كاتب طعام',
      },
    ],
  },
  contact: {
    eyebrow: 'زورونا',
    heading: 'تجدوننا في شارع الرينبو',
    body: 'نستقبل الضيوف دون حجز وقت الغداء. للعشاء وللمجموعات من ستة أشخاص فأكثر أرسلوا طلباً، ونؤكد خلال ساعة.',
    address: 'شارع الرينبو 34، جبل عمّان، عمّان 11181، الأردن',
    availability: 'يومياً 12:00–23:30 · الجمعة من 13:00',
    formTitle: 'اطلب حجز طاولة',
    formBody: 'أخبرونا بالتاريخ والوقت وعدد الضيوف.',
    nameLabel: 'الاسم',
    emailLabel: 'البريد الإلكتروني',
    messageLabel: 'التاريخ والوقت وعدد الضيوف',
    submitLabel: 'أرسل الطلب',
  },
  promo: {
    label: 'المناسبات الخاصة',
    headline: 'احجز طاولة العائلة لما يصل إلى 14 ضيفاً',
    body: `قوائم ثابتة تبدأ من ${money(22, 'JOD', 'ar')} للشخص، مع مضيف مخصّص وطاولة حلويات لأعياد الميلاد والخطوبات.`,
    primary: 'احجز سهرتك',
    secondary: 'اتصل بالمطعم',
  },
  footer: {
    tagline: 'أكل بيتي شامي في شارع الرينبو، عمّان، منذ 2009.',
    columns: [
      {
        title: 'المطعم',
        links: [
          { label: 'القائمة', href: '#menu' },
          { label: 'قصتنا', href: '#about' },
          { label: 'المناسبات الخاصة', href: '#private' },
          { label: 'بطاقات الهدايا', href: '#gifts' },
        ],
      },
      {
        title: 'الزيارة',
        links: [
          { label: 'الحجوزات', href: '#reserve' },
          { label: 'الموقع', href: '#visit' },
          { label: 'ساعات العمل', href: '#hours' },
        ],
      },
      {
        title: 'تابعونا',
        links: [
          { label: 'إنستغرام', href: '#instagram' },
          { label: 'فيسبوك', href: '#facebook' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const restaurantTemplate = defineTemplate({
  key: 'restaurant',
  category: 'restaurant',
  baseId: 'restaurant',
  name: { en: 'Restaurant', ar: 'مطعم' },
  description: {
    en: 'A Levantine restaurant with signature dishes, a priced photo menu, a gallery and table requests.',
    ar: 'مطعم شامي بأطباق مميزة وقائمة طعام مصوّرة بالأسعار ومعرض صور وطلب حجز طاولة.',
  },
  thumbnail: { topic: 'restaurant', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `restaurant-${lang}`;
    const heroPhoto = photo('restaurant', HERO_PHOTO, lang);
    const promoPhoto = photo('restaurant', PROMO_PHOTO, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#reserve',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#menu',
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

    page.section('signatures', 'bento-grid', {
      eyebrow: copy.signatures.eyebrow,
      heading: copy.signatures.heading,
      body: copy.signatures.body,
      layout: 'mosaic',
      items: json(
        copy.signatures.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] })),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('menu', 'productGrid', {
      eyebrow: copy.menu.eyebrow,
      heading: copy.menu.heading,
      body: copy.menu.body,
      actionLabel: copy.menu.actionLabel,
      showRatings: false,
      ratingPrefix: copy.menu.ratingPrefix,
      ratingSuffix: copy.menu.ratingSuffix,
      reviewCountLabel: copy.menu.reviewCountLabel,
      variant: 'grid',
      columns: '4',
      imageRatio: 'square',
      products: json(
        copy.menu.dishes.map((dish, index) => {
          const image = photo('restaurant', DISH_PHOTOS[index] ?? -1, lang);
          return {
            ...dish,
            price: money(DISH_PRICES[index] ?? 0, 'JOD', lang),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: DISH_HREFS[index] ?? '#menu',
          };
        }),
      ),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('restaurant', photoIndex, lang);
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

    page.section('visit', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'table@example.com',
      phone: PHONE,
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/reservations',
      method: 'post',
      variant: 'split',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('reserve', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#reserve', emphasis: 'primary' },
        { label: copy.promo.secondary, href: PHONE_HREF, emphasis: 'secondary' },
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
