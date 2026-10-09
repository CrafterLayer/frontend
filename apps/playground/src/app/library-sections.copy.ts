/*
  The words and photos the Library's section kits are filled with
  (agent-script DESIGN §B.5). One record per SUBJECT (several kits share one),
  keyed by the kits' own slot names; a list slot holds its items in order.

  - English pages carry no Arabic letters; Arabic pages are written for the
    market (Amman, JOD, local names), with Latin letters only in an email
    address or a URL.
  - Prices go through `libraryMoney`: `$29` / `29 د.أ`.
  - `image` names a PHOTO_CATALOG id (verified, with alt text in both
    languages); the filler never shows one photo twice in a kit.
  - People shown with a portrait are matched to it by what the photo shows
    (its catalog alt), e.g. «طبيبة» / «مبرمج».
  - `null` leaves an optional slot empty on purpose (one "Most popular"
    badge, not three).
  - No string repeats inside one subject, so no kit shows the same words twice.
*/

export type Lang = 'en' | 'ar';

export interface LinkCopy {
  readonly label: string;
  readonly href: string;
}

export type CopyValue = string | null | LinkCopy | readonly CopyRecord[];

export type CopyRecord = Readonly<Record<string, CopyValue>>;

/** A price in the page's language: `$29` / `29 د.أ` (Latin digits, grouped). */
export function libraryMoney(amount: number, lang: Lang): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const [whole = '0', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  const value = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return lang === 'ar' ? `${value} د.أ` : `$${value}`;
}

const en = (amount: number) => libraryMoney(amount, 'en');
const ar = (amount: number) => libraryMoney(amount, 'ar');

const EMAIL_EN = 'hello@northwind.co';
const EMAIL_AR = 'hello@siraj.jo';
const PHONE = '+962 6 555 0134';
const TEL = 'tel:+96265550134';
const MAP = 'https://maps.google.com/?q=Rainbow+Street+Amman';

const ENGLISH: Readonly<Record<string, CopyRecord>> = {
  header: {
    brand: 'Northwind',
    nav_label: 'Main menu',
    nav: [
      { label: 'Product', href: '#product' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Customers', href: '#customers' },
      { label: 'Contact', href: '#contact' },
    ],
    cta: { label: 'Start free', href: '#pricing' },
    notice: 'New: book a demo and get your first month free.',
    notice_link: { label: 'Book a demo', href: '#contact' },
  },
  hero: {
    eyebrow: 'Website builder for growing teams',
    title: 'Launch a site your customers trust',
    lead: 'Pick a section, write your words and publish in minutes. Every page works in English and Arabic, on every screen.',
    cta: { label: 'Start free', href: '#pricing' },
    cta2: { label: 'See examples', href: '#gallery' },
    note: 'No credit card needed',
    image: 'pexels-8154928',
  },
  features: {
    eyebrow: 'Why teams switch',
    title: 'Everything a modern site needs',
    lead: 'Fast pages, clear words and tools that stay out of your way.',
    highlight: 'One editor for every page, in both languages, with nothing to install.',
    caption: 'Built with the people who use it every day',
    cta: { label: 'Explore features', href: '#features' },
    image: 'pexels-8938271',
    items: [
      {
        icon: 'zap',
        title: 'Fast by default',
        text: 'Pages load in under a second on a phone.',
        image: 'pexels-4625615',
      },
      {
        icon: 'languages',
        title: 'Arabic and English',
        text: 'Right-to-left layouts mirror themselves; nothing to rebuild.',
        image: 'pexels-7988086',
      },
      {
        icon: 'shield-check',
        title: 'Secure hosting',
        text: 'Free SSL and daily security updates on every plan.',
        image: 'pexels-29516134',
      },
      { icon: 'chart-line', title: 'Real-time analytics', text: 'See which pages bring visitors and which ones convert.' },
      { icon: 'users', title: 'Team roles', text: 'Invite editors and reviewers with the right access.' },
      { icon: 'globe', title: 'Your own domain', text: 'Connect your own address in a few clicks.' },
      { icon: 'database-backup', title: 'Automatic backups', text: 'Every change is saved, and one click restores it.' },
      { icon: 'headset', title: 'Friendly support', text: 'Talk to a person, in Arabic or English, seven days a week.' },
    ],
  },
  story: {
    eyebrow: 'Our story',
    title: 'Made in Amman, used across the region',
    lead: 'We started with one café that needed its menu online.',
    body: 'Today thousands of shops, clinics and studios publish with us. We still build every feature the same way: next to the people who use it, in their language, until it feels obvious.',
    image: 'pexels-30446269',
    cta: { label: 'Read our story', href: '#story' },
    cta2: { label: 'Meet the team', href: '#team' },
  },
  steps: {
    eyebrow: 'How it works',
    title: 'Live in three steps',
    lead: 'From a blank page to a published site in one afternoon.',
    items: [
      { step: 'Step 1', title: 'Choose a template', text: 'Start from a page made for your kind of business.' },
      { step: 'Step 2', title: 'Write your words', text: 'Change any text in place; the layout keeps up on every screen.' },
      { step: 'Step 3', title: 'Publish', text: 'Go live on your own domain with one click, and edit any time.' },
    ],
  },
  testimonials: {
    eyebrow: 'Customer stories',
    title: 'Loved by teams across the region',
    lead: 'Owners, doctors and designers on what changed after launch.',
    items: [
      {
        quote: 'Our menu went online in an afternoon, and bookings doubled in the first month.',
        name: 'Rana Khoury',
        role: 'Owner, Olive & Thyme café',
        initials: 'RK',
      },
      {
        quote: 'Patients book from their phones now. The front desk finally has time to breathe.',
        name: 'Sami Odeh',
        role: 'Founder, Odeh Dental',
        initials: 'SO',
      },
      {
        quote: 'We publish every tour in English and Arabic from one page. Nothing gets out of date.',
        name: 'Nour Haddad',
        role: 'Marketing lead, Petra Tours',
        initials: 'NH',
      },
      {
        quote: 'Listings with real photos and prices. Calls from the site grew every week.',
        name: 'Tariq Mansour',
        role: 'CEO, Mansour Realty',
        initials: 'TM',
      },
      {
        quote: 'I hand clients a site they can edit themselves, and they never break it.',
        name: 'Dana Saleh',
        role: 'Designer, Studio Dana',
        initials: 'DS',
      },
      {
        quote: 'Clear pages, fast answers. New clients tell us they chose us after reading the site.',
        name: 'Faris Qasem',
        role: 'Partner, Qasem Law',
        initials: 'FQ',
      },
    ],
  },
  stats: {
    eyebrow: 'By the numbers',
    title: 'Results our customers measure',
    lead: 'Numbers from sites published with us over the last twelve months.',
    items: [
      { value: '12,000+', label: 'Sites published' },
      { value: '99.9%', label: 'Uptime this year' },
      { value: '4.9/5', label: 'Average customer rating' },
      { value: '2 min', label: 'Median support reply' },
    ],
  },
  logos: {
    eyebrow: 'Trusted by',
    title: 'Teams that publish with us',
    lead: 'Shops, clinics and studios from Amman to Dubai.',
    items: [
      { name: 'Olive & Thyme' },
      { name: 'Petra Tours' },
      { name: 'Mansour Realty' },
      { name: 'Odeh Dental' },
      { name: 'Studio Dana' },
      { name: 'Qasem Law' },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Simple plans that grow with you',
    lead: 'Every plan includes hosting, SSL and pages in both languages.',
    items: [
      {
        name: 'Starter',
        price: en(9),
        period: '/month',
        text: 'For a first site and a single owner.',
        badge: null,
        features: [
          { text: 'One website' },
          { text: 'Free SSL certificate' },
          { text: 'Arabic and English pages' },
          { text: 'Email support' },
        ],
        cta: { label: 'Start with Starter', href: '#signup' },
      },
      {
        name: 'Business',
        price: en(29),
        period: '/month',
        text: 'For a growing business with bookings and a team.',
        badge: 'Most popular',
        features: [
          { text: 'Five websites' },
          { text: 'Custom domains' },
          { text: 'Online booking and forms' },
          { text: 'Priority support' },
        ],
        cta: { label: 'Choose Business', href: '#signup' },
      },
      {
        name: 'Agency',
        price: en(79),
        period: '/month',
        text: 'For studios that build sites for their clients.',
        badge: null,
        features: [
          { text: 'Unlimited websites' },
          { text: 'Client roles and approvals' },
          { text: 'White-label editor' },
          { text: 'A dedicated manager' },
        ],
        cta: { label: 'Talk to sales', href: '#contact' },
      },
    ],
  },
  comparison: {
    eyebrow: 'Compare plans',
    title: 'Find the plan that fits',
    lead: 'Every plan can be changed or cancelled at any time.',
    plans: [
      { name: 'Starter', price: en(9) },
      { name: 'Business', price: en(29) },
      { name: 'Agency', price: en(79) },
    ],
    rows: [
      { feature: 'Websites', values: [{ value: '1' }, { value: '5' }, { value: 'Unlimited' }] },
      { feature: 'Custom domain', values: [{ value: '—' }, { value: 'Included' }, { value: 'Included' }] },
      { feature: 'Online booking', values: [{ value: '—' }, { value: 'Included' }, { value: 'Included' }] },
      { feature: 'Team members', values: [{ value: '1' }, { value: '5' }, { value: 'Unlimited' }] },
      { feature: 'Support', values: [{ value: 'Email' }, { value: 'Priority' }, { value: 'Dedicated manager' }] },
    ],
  },
  menu: {
    eyebrow: 'Our menu',
    title: 'Cooked fresh every morning',
    lead: 'Family recipes, local olive oil and bread from the oven next door.',
    items: [
      {
        title: 'Breakfast',
        entries: [
          { name: "Labneh and za'atar", price: en(4.5), text: 'Strained yoghurt, olive oil, warm bread.' },
          { name: 'Foul medames', price: en(3.75), text: 'Slow-cooked fava beans with lemon and cumin.' },
          { name: 'Cheese manakish', price: en(3.25), text: 'Akkawi cheese baked on fresh dough.' },
          { name: 'Shakshuka', price: en(5.5), text: 'Eggs in a spiced tomato and pepper sauce.' },
        ],
      },
      {
        title: 'Mains',
        entries: [
          { name: 'Mansaf', price: en(12), text: 'Lamb in jameed sauce over rice and shrak bread.' },
          { name: 'Maqluba', price: en(9.5), text: 'Upside-down rice with chicken and fried aubergine.' },
          { name: 'Musakhan', price: en(8.75), text: 'Roast chicken, sumac and onions on taboon bread.' },
          { name: 'Grilled halloumi', price: en(7.25), text: 'With tomatoes, mint and a squeeze of lemon.' },
        ],
      },
    ],
  },
  products: {
    eyebrow: 'New arrivals',
    title: 'Fragrances for every evening',
    lead: 'Small batches, blended by hand and bottled in Amman.',
    items: [
      { image: 'pexels-30618765', title: 'Oud Royale', price: en(85), badge: 'New' },
      { image: 'pexels-1961792', title: 'Amber Mist', price: en(64), badge: null },
      { image: 'pexels-4925718', title: 'Cedar Box', price: en(72), badge: 'Best seller' },
      { image: 'pexels-16038070', title: 'Clear Glass', price: en(58), badge: null },
    ],
  },
  listings: {
    eyebrow: 'Featured homes',
    title: 'Homes ready to move into',
    lead: 'Hand-picked villas with photos, prices and floor areas up front.',
    items: [
      {
        image: 'pexels-8134745',
        price: en(420000),
        title: 'Villa with a private pool, Dabouq',
        facts: [
          { icon: 'bed-double', text: '4 beds' },
          { icon: 'bath', text: '3 baths' },
          { icon: 'ruler', text: '380 m²' },
        ],
      },
      {
        image: 'pexels-8134750',
        price: en(365000),
        title: 'Garden house, Abdoun',
        facts: [
          { icon: 'bed-double', text: '3 bedrooms' },
          { icon: 'bath', text: '2 bathrooms' },
          { icon: 'ruler', text: '240 m²' },
        ],
      },
      {
        image: 'pexels-29453302',
        price: en(512000),
        title: 'Modern villa, Dead Sea road',
        facts: [
          { icon: 'bed-double', text: '5 beds' },
          { icon: 'bath', text: '4 baths' },
          { icon: 'ruler', text: '460 m²' },
        ],
      },
    ],
  },
  team: {
    eyebrow: 'Our team',
    title: 'The people behind your site',
    lead: 'A small team in Amman that answers every message itself.',
    items: [
      {
        name: 'Layla Haddad',
        role: 'Founder and CEO',
        text: 'Ran a design studio for ten years before building the editor she wished she had.',
        initials: 'LH',
        image: 'pexels-10347162',
      },
      {
        name: 'Omar Nasser',
        role: 'Head of engineering',
        text: 'Keeps every page fast and every right-to-left layout correct.',
        initials: 'ON',
        image: 'pexels-12899156',
      },
      {
        name: 'Karim Saleh',
        role: 'Legal counsel',
        text: 'Makes sure privacy, contracts and invoices are clear for every customer.',
        initials: 'KS',
        image: 'pexels-7876191',
      },
      {
        name: 'Yousef Amr',
        role: 'Product engineer',
        text: 'Builds the tools our customers ask for most, one week at a time.',
        initials: 'YA',
        image: 'pexels-16129728',
      },
    ],
  },
  gallery: {
    eyebrow: 'Gallery',
    title: 'Places worth the trip',
    lead: 'A few favourites from our guests this season.',
    items: [
      { image: 'pexels-18717341', caption: 'The Treasury, Petra' },
      { image: 'pexels-28086996', caption: 'Wadi Rum at golden hour' },
      { image: 'pexels-720254', caption: 'Royal tombs' },
      { image: 'pexels-23124407', caption: 'Ad-Deir monastery' },
      { image: 'pexels-261327', caption: 'Sunset by the sea' },
      { image: 'pexels-189296', caption: 'Poolside afternoons' },
    ],
  },
  kitchen: {
    eyebrow: 'From our kitchen',
    title: 'Made fresh, served to share',
    lead: 'What leaves the kitchen on a busy Friday.',
    items: [
      { image: 'pexels-27556261', caption: 'Hummus and mezze' },
      { image: 'pexels-8585881', caption: 'Dishes for the table' },
      { image: 'pexels-21856018', caption: 'Falafel platter' },
      { image: 'pexels-15029824', caption: 'Rice, salads and grills' },
      { image: 'pexels-8290047', caption: 'Baklava, layered by hand' },
      { image: 'pexels-8289911', caption: 'Kunafa dough' },
    ],
  },
  blog: {
    eyebrow: 'Journal',
    title: 'Notes from the team',
    lead: 'Short guides on writing, speed and selling online.',
    items: [
      {
        image: 'pexels-34804003',
        title: 'Five fixes that make a page load faster',
        text: 'Small changes to photos and fonts that cut seconds from every visit.',
        meta: 'Guide · 6 min read',
        href: '#post-1',
      },
      {
        image: 'pexels-8154794',
        title: 'How to write a homepage people finish reading',
        text: 'Lead with the problem, show the proof, ask for one thing.',
        meta: 'Writing · 4 min read',
        href: '#post-2',
      },
      {
        image: 'pexels-6205779',
        title: 'What a café taught us about menus online',
        text: 'Prices, photos and opening hours: the three things guests look for first.',
        meta: 'Story · 5 min read',
        href: '#post-3',
      },
      {
        image: 'pexels-19756845',
        title: 'Taking a tour company from paper to bookings',
        text: 'How Petra Tours moved every trip online in two weeks.',
        meta: 'Case study · 7 min read',
        href: '#post-4',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered',
    lead: 'Still unsure? Our team replies within the hour.',
    cta: { label: 'Ask us anything', href: '#contact' },
    items: [
      {
        q: 'Do I need to know how to code?',
        a: 'No. You choose sections, write your words and publish. Developers can add custom code when they want to.',
      },
      {
        q: 'Can my site be in Arabic and English?',
        a: 'Yes. Every page can have both languages, and right-to-left layouts mirror automatically.',
      },
      {
        q: 'Can I use my own domain?',
        a: 'Yes, on the Business and Agency plans. We set up the SSL certificate for you.',
      },
      {
        q: 'What happens if I cancel?',
        a: 'Your site stays online until the end of the month, and you can export every page.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Every plan starts with fourteen days free, no credit card needed.',
      },
    ],
  },
  cta: {
    eyebrow: 'Ready when you are',
    title: 'Publish your first page today',
    lead: 'Start free, pick a template and go live before dinner.',
    cta: { label: 'Start free', href: '#pricing' },
    cta2: { label: 'Talk to us', href: '#contact' },
    image: 'pexels-13256066',
  },
  contact: {
    eyebrow: 'Visit us',
    title: 'Come say hello',
    lead: 'Drop by the studio, call or send a message. We reply the same day.',
    channels: [
      { icon: 'phone', label: 'Call us', href: TEL },
      { icon: 'mail', label: 'Email', href: `mailto:${EMAIL_EN}` },
      { icon: 'message-circle', label: 'WhatsApp', href: 'https://wa.me/96265550134' },
    ],
    hours: [
      { day: 'Sunday to Thursday', time: '9:00 – 18:00' },
      { day: 'Saturday', time: '10:00 – 14:00' },
      { day: 'Friday', time: 'Closed' },
    ],
    address: '24 Rainbow Street, Amman',
    map: { label: 'Open in Maps', href: MAP },
    items: [
      { icon: 'mail', title: 'Write to us', text: EMAIL_EN, href: `mailto:${EMAIL_EN}` },
      { icon: 'phone', title: 'Call the studio', text: PHONE, href: TEL },
      { icon: 'map-pin', title: 'Our office', text: 'Rainbow Street, Amman' },
      { icon: 'clock', title: 'Opening hours', text: 'Sun to Thu, 9:00 – 18:00' },
    ],
  },
  footer: {
    brand: 'Northwind',
    text: 'Websites for shops, clinics and studios, in Arabic and English.',
    nav_label: 'Footer',
    nav: [
      { label: 'About', href: '#about' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Journal', href: '#journal' },
      { label: 'Contact', href: '#contact' },
    ],
    contact: [
      { icon: 'mail', text: EMAIL_EN, href: `mailto:${EMAIL_EN}` },
      { icon: 'phone', text: PHONE, href: TEL },
      { icon: 'map-pin', text: '24 Rainbow Street, Amman' },
    ],
    copyright: '© 2026 Northwind. All rights reserved.',
    title: 'Ready to build your site?',
    cta: { label: 'Start free', href: '#pricing' },
    cta2: { label: 'Book a demo', href: '#contact' },
  },
};

const ARABIC: Readonly<Record<string, CopyRecord>> = {
  header: {
    brand: 'سراج',
    nav_label: 'القائمة الرئيسية',
    nav: [
      { label: 'المنتج', href: '#product' },
      { label: 'الأسعار', href: '#pricing' },
      { label: 'العملاء', href: '#customers' },
      { label: 'تواصل معنا', href: '#contact' },
    ],
    cta: { label: 'ابدأ مجانًا', href: '#pricing' },
    notice: 'جديد: احجز عرضًا تجريبيًا واحصل على الشهر الأول مجانًا.',
    notice_link: { label: 'احجز عرضًا', href: '#contact' },
  },
  hero: {
    eyebrow: 'منشئ مواقع للفرق النامية',
    title: 'أطلق موقعًا يثق به عملاؤك',
    lead: 'اختر قسمًا واكتب كلماتك وانشر خلال دقائق. كل صفحة تعمل بالعربية والإنجليزية وعلى كل الشاشات.',
    cta: { label: 'ابدأ مجانًا', href: '#pricing' },
    cta2: { label: 'شاهد أمثلة', href: '#gallery' },
    note: 'لا حاجة إلى بطاقة ائتمان',
    image: 'pexels-8154928',
  },
  features: {
    eyebrow: 'لماذا تختارنا الفرق',
    title: 'كل ما يحتاجه موقع عصري',
    lead: 'صفحات سريعة وكلمات واضحة وأدوات لا تعترض طريقك.',
    highlight: 'محرّر واحد لكل صفحاتك، باللغتين، دون أي تثبيت.',
    caption: 'صُمّم مع من يستخدمونه كل يوم',
    cta: { label: 'استكشف المزايا', href: '#features' },
    image: 'pexels-8938271',
    items: [
      {
        icon: 'zap',
        title: 'سريع منذ البداية',
        text: 'تُحمَّل الصفحات في أقل من ثانية على الهاتف.',
        image: 'pexels-4625615',
      },
      {
        icon: 'languages',
        title: 'عربي وإنجليزي',
        text: 'التخطيطات من اليمين إلى اليسار تنعكس وحدها دون إعادة بناء.',
        image: 'pexels-7988086',
      },
      {
        icon: 'shield-check',
        title: 'استضافة آمنة',
        text: 'شهادة أمان مجانية وتحديثات يومية في كل الباقات.',
        image: 'pexels-29516134',
      },
      { icon: 'chart-line', title: 'تحليلات لحظية', text: 'اعرف أي الصفحات تجلب الزوار وأيها تحقق المبيعات.' },
      { icon: 'users', title: 'أدوار للفريق', text: 'ادعُ المحررين والمراجعين بالصلاحيات المناسبة.' },
      { icon: 'globe', title: 'نطاقك الخاص', text: 'اربط عنوانك الخاص ببضع نقرات.' },
      { icon: 'database-backup', title: 'نسخ احتياطي تلقائي', text: 'كل تعديل محفوظ، ونقرة واحدة تعيده.' },
      { icon: 'headset', title: 'دعم قريب منك', text: 'تحدّث مع شخص حقيقي بالعربية أو الإنجليزية طوال الأسبوع.' },
    ],
  },
  story: {
    eyebrow: 'قصتنا',
    title: 'صُنع في عمّان ويُستخدم في المنطقة كلها',
    lead: 'بدأنا بمقهى واحد احتاج أن تكون قائمته على الإنترنت.',
    body: 'اليوم تنشر معنا آلاف المتاجر والعيادات والاستوديوهات. وما زلنا نبني كل ميزة بالطريقة نفسها: بجانب من يستخدمها، وبلغته، حتى تصبح بديهية.',
    image: 'pexels-30446269',
    cta: { label: 'اقرأ قصتنا', href: '#story' },
    cta2: { label: 'تعرّف على الفريق', href: '#team' },
  },
  steps: {
    eyebrow: 'كيف يعمل',
    title: 'موقعك جاهز في ثلاث خطوات',
    lead: 'من صفحة فارغة إلى موقع منشور في ظهيرة واحدة.',
    items: [
      { step: 'الخطوة 1', title: 'اختر قالبًا', text: 'ابدأ من صفحة صُمّمت لنوع عملك.' },
      { step: 'الخطوة 2', title: 'اكتب كلماتك', text: 'عدّل أي نص في مكانه، والتصميم يواكبك على كل شاشة.' },
      { step: 'الخطوة 3', title: 'انشر', text: 'انطلق على نطاقك الخاص بنقرة واحدة، وعدّل متى شئت.' },
    ],
  },
  testimonials: {
    eyebrow: 'قصص عملائنا',
    title: 'فرق في المنطقة كلها تحب العمل معنا',
    lead: 'أصحاب مطاعم وأطباء ومصممون عن الفرق بعد الإطلاق.',
    items: [
      {
        quote: 'أصبحت قائمتنا على الإنترنت في ظهيرة واحدة، وتضاعفت الحجوزات في الشهر الأول.',
        name: 'رنا خوري',
        role: 'صاحبة مقهى زيت وزعتر',
        initials: 'ر خ',
      },
      {
        quote: 'المرضى يحجزون من هواتفهم الآن، وصار لدى الاستقبال وقت ليتنفس.',
        name: 'سامي عودة',
        role: 'مؤسس عيادات عودة',
        initials: 'س ع',
      },
      {
        quote: 'ننشر كل رحلة بالعربية والإنجليزية من صفحة واحدة، ولا شيء يتقادم.',
        name: 'نور حدّاد',
        role: 'مديرة التسويق، رحلات البترا',
        initials: 'ن ح',
      },
      {
        quote: 'عروض بصور حقيقية وأسعار واضحة، والاتصالات من الموقع تزيد كل أسبوع.',
        name: 'طارق منصور',
        role: 'المدير التنفيذي، منصور للعقارات',
        initials: 'ط م',
      },
      {
        quote: 'أسلّم عملائي موقعًا يعدّلونه بأنفسهم، ولا يكسرونه أبدًا.',
        name: 'دانة صالح',
        role: 'مصممة، استوديو دانة',
        initials: 'د ص',
      },
      {
        quote: 'صفحات واضحة وردود سريعة. عملاؤنا الجدد يقولون إنهم اختارونا بعد قراءة الموقع.',
        name: 'فارس قاسم',
        role: 'شريك، مكتب قاسم للمحاماة',
        initials: 'ف ق',
      },
    ],
  },
  stats: {
    eyebrow: 'بالأرقام',
    title: 'نتائج يقيسها عملاؤنا',
    lead: 'أرقام من مواقع نُشرت معنا خلال الأشهر الاثني عشر الماضية.',
    items: [
      { value: '12,000+', label: 'موقع منشور' },
      { value: '99.9%', label: 'جاهزية الخدمة هذا العام' },
      { value: '4.9/5', label: 'متوسط تقييم العملاء' },
      { value: '2 د', label: 'متوسط زمن الرد على الدعم' },
    ],
  },
  logos: {
    eyebrow: 'يثق بنا',
    title: 'فرق تنشر مواقعها معنا',
    lead: 'متاجر وعيادات واستوديوهات من عمّان إلى دبي.',
    items: [
      { name: 'زيت وزعتر' },
      { name: 'رحلات البترا' },
      { name: 'منصور للعقارات' },
      { name: 'عيادات عودة' },
      { name: 'استوديو دانة' },
      { name: 'قاسم للمحاماة' },
    ],
  },
  pricing: {
    eyebrow: 'الأسعار',
    title: 'باقات بسيطة تكبر معك',
    lead: 'كل باقة تشمل الاستضافة وشهادة الأمان والصفحات باللغتين.',
    items: [
      {
        name: 'الأساسية',
        price: ar(9),
        period: '/شهريًا',
        text: 'لموقعك الأول ومالك واحد.',
        badge: null,
        features: [
          { text: 'موقع واحد' },
          { text: 'شهادة أمان مجانية' },
          { text: 'صفحات بالعربية والإنجليزية' },
          { text: 'دعم عبر البريد' },
        ],
        cta: { label: 'ابدأ بالأساسية', href: '#signup' },
      },
      {
        name: 'الأعمال',
        price: ar(29),
        period: '/شهريًا',
        text: 'لعمل ينمو، مع حجوزات وفريق.',
        badge: 'الأكثر طلبًا',
        features: [
          { text: 'خمسة مواقع' },
          { text: 'نطاقات خاصة' },
          { text: 'حجز ونماذج عبر الإنترنت' },
          { text: 'دعم بأولوية' },
        ],
        cta: { label: 'اختر باقة الأعمال', href: '#signup' },
      },
      {
        name: 'الوكالات',
        price: ar(79),
        period: '/شهريًا',
        text: 'للاستوديوهات التي تبني مواقع لعملائها.',
        badge: null,
        features: [
          { text: 'مواقع بلا حدود' },
          { text: 'أدوار وموافقات للعملاء' },
          { text: 'محرّر باسم علامتك' },
          { text: 'مدير حساب مخصص' },
        ],
        cta: { label: 'تحدّث مع المبيعات', href: '#contact' },
      },
    ],
  },
  comparison: {
    eyebrow: 'قارن الباقات',
    title: 'اعثر على الباقة المناسبة',
    lead: 'يمكنك تغيير أي باقة أو إلغاؤها في أي وقت.',
    plans: [
      { name: 'الأساسية', price: ar(9) },
      { name: 'الأعمال', price: ar(29) },
      { name: 'الوكالات', price: ar(79) },
    ],
    rows: [
      { feature: 'المواقع', values: [{ value: '1' }, { value: '5' }, { value: 'بلا حدود' }] },
      { feature: 'نطاق خاص', values: [{ value: '—' }, { value: 'مشمول' }, { value: 'مشمول' }] },
      { feature: 'الحجز عبر الإنترنت', values: [{ value: '—' }, { value: 'مشمول' }, { value: 'مشمول' }] },
      { feature: 'أعضاء الفريق', values: [{ value: '1' }, { value: '5' }, { value: 'بلا حدود' }] },
      { feature: 'الدعم', values: [{ value: 'البريد' }, { value: 'بأولوية' }, { value: 'مدير مخصص' }] },
    ],
  },
  menu: {
    eyebrow: 'قائمتنا',
    title: 'طبخ طازج كل صباح',
    lead: 'وصفات العائلة وزيت زيتون بلدي وخبز من الفرن المجاور.',
    items: [
      {
        title: 'الفطور',
        entries: [
          { name: 'لبنة وزعتر', price: ar(4.5), text: 'لبنة مصفّاة مع زيت الزيتون وخبز ساخن.' },
          { name: 'فول مدمّس', price: ar(3.75), text: 'فول مطبوخ على مهل مع الليمون والكمون.' },
          { name: 'مناقيش جبنة', price: ar(3.25), text: 'جبنة عكاوي مخبوزة على عجين طازج.' },
          { name: 'شكشوكة', price: ar(5.5), text: 'بيض في صلصة طماطم وفلفل متبّلة.' },
        ],
      },
      {
        title: 'الأطباق الرئيسية',
        entries: [
          { name: 'منسف', price: ar(12), text: 'لحم بلدي باللبن الجميد على الأرز وخبز الشراك.' },
          { name: 'مقلوبة', price: ar(9.5), text: 'أرز مقلوب بالدجاج والباذنجان المقلي.' },
          { name: 'مسخّن', price: ar(8.75), text: 'دجاج محمّر بالسماق والبصل على خبز الطابون.' },
          { name: 'حلوم مشوي', price: ar(7.25), text: 'مع الطماطم والنعناع وعصرة ليمون.' },
        ],
      },
    ],
  },
  products: {
    eyebrow: 'وصل حديثًا',
    title: 'عطور لكل أمسية',
    lead: 'دفعات صغيرة تُمزج يدويًا وتُعبّأ في عمّان.',
    items: [
      { image: 'pexels-30618765', title: 'عود رويال', price: ar(85), badge: 'جديد' },
      { image: 'pexels-1961792', title: 'ضباب العنبر', price: ar(64), badge: null },
      { image: 'pexels-4925718', title: 'صندوق الأرز', price: ar(72), badge: 'الأكثر مبيعًا' },
      { image: 'pexels-16038070', title: 'زجاج صافٍ', price: ar(58), badge: null },
    ],
  },
  listings: {
    eyebrow: 'عقارات مختارة',
    title: 'بيوت جاهزة للسكن',
    lead: 'فلل مختارة بعناية، بالصور والأسعار والمساحات من البداية.',
    items: [
      {
        image: 'pexels-8134745',
        price: ar(420000),
        title: 'فيلا بمسبح خاص، دابوق',
        facts: [
          { icon: 'bed-double', text: '4 غرف نوم' },
          { icon: 'bath', text: '3 حمّامات' },
          { icon: 'ruler', text: '380 م²' },
        ],
      },
      {
        image: 'pexels-8134750',
        price: ar(365000),
        title: 'بيت بحديقة، عبدون',
        facts: [
          { icon: 'bed-double', text: '3 غرف' },
          { icon: 'bath', text: 'حمّامان' },
          { icon: 'ruler', text: '240 م²' },
        ],
      },
      {
        image: 'pexels-29453302',
        price: ar(512000),
        title: 'فيلا حديثة، طريق البحر الميت',
        facts: [
          { icon: 'bed-double', text: '5 غرف نوم' },
          { icon: 'bath', text: '4 حمّامات' },
          { icon: 'ruler', text: '460 م²' },
        ],
      },
    ],
  },
  team: {
    eyebrow: 'فريقنا',
    title: 'الأشخاص وراء موقعك',
    lead: 'فريق صغير في عمّان يرد على كل رسالة بنفسه.',
    items: [
      {
        name: 'ليلى حدّاد',
        role: 'المؤسِّسة والرئيسة التنفيذية',
        text: 'أدارت استوديو تصميم عشر سنوات قبل أن تبني المحرّر الذي تمنّته.',
        initials: 'ل ح',
        image: 'pexels-10347162',
      },
      {
        name: 'عمر ناصر',
        role: 'رئيس الهندسة',
        text: 'يحرص على أن تبقى كل صفحة سريعة وكل تخطيط عربي صحيحًا.',
        initials: 'ع ن',
        image: 'pexels-12899156',
      },
      {
        name: 'كريم صالح',
        role: 'المستشار القانوني',
        text: 'يتأكد من وضوح الخصوصية والعقود والفواتير لكل عميل.',
        initials: 'ك ص',
        image: 'pexels-7876191',
      },
      {
        name: 'يوسف عمرو',
        role: 'مهندس المنتج',
        text: 'يبني الأدوات التي يطلبها عملاؤنا أكثر، أسبوعًا بعد أسبوع.',
        initials: 'ي ع',
        image: 'pexels-16129728',
      },
    ],
  },
  gallery: {
    eyebrow: 'معرض الصور',
    title: 'أماكن تستحق الرحلة',
    lead: 'بعض الأماكن المفضلة لدى ضيوفنا هذا الموسم.',
    items: [
      { image: 'pexels-18717341', caption: 'الخزنة في البترا' },
      { image: 'pexels-28086996', caption: 'وادي رم وقت الغروب' },
      { image: 'pexels-720254', caption: 'المقابر الملكية' },
      { image: 'pexels-23124407', caption: 'دير البترا' },
      { image: 'pexels-261327', caption: 'غروب على البحر' },
      { image: 'pexels-189296', caption: 'ظهيرة بجانب المسبح' },
    ],
  },
  kitchen: {
    eyebrow: 'من مطبخنا',
    title: 'طازج ويُقدَّم للمشاركة',
    lead: 'ما يخرج من المطبخ في يوم جمعة مزدحم.',
    items: [
      { image: 'pexels-27556261', caption: 'حمّص ومقبلات' },
      { image: 'pexels-8585881', caption: 'أطباق للمائدة' },
      { image: 'pexels-21856018', caption: 'طبق فلافل' },
      { image: 'pexels-15029824', caption: 'أرز وسلطات ومشاوي' },
      { image: 'pexels-8290047', caption: 'بقلاوة تُرقّق يدويًا' },
      { image: 'pexels-8289911', caption: 'عجينة الكنافة' },
    ],
  },
  blog: {
    eyebrow: 'المدونة',
    title: 'ملاحظات من الفريق',
    lead: 'أدلة قصيرة عن الكتابة والسرعة والبيع عبر الإنترنت.',
    items: [
      {
        image: 'pexels-34804003',
        title: 'خمسة إصلاحات تجعل الصفحة أسرع',
        text: 'تغييرات صغيرة في الصور والخطوط توفّر ثواني في كل زيارة.',
        meta: 'دليل · 6 دقائق قراءة',
        href: '#post-1',
      },
      {
        image: 'pexels-8154794',
        title: 'كيف تكتب صفحة رئيسية يقرؤها الناس حتى النهاية',
        text: 'ابدأ بالمشكلة، واعرض الدليل، واطلب شيئًا واحدًا.',
        meta: 'كتابة · 4 دقائق قراءة',
        href: '#post-2',
      },
      {
        image: 'pexels-6205779',
        title: 'ما علّمنا إياه مقهى عن القوائم على الإنترنت',
        text: 'الأسعار والصور وساعات العمل: أول ما يبحث عنه الضيوف.',
        meta: 'قصة · 5 دقائق قراءة',
        href: '#post-3',
      },
      {
        image: 'pexels-19756845',
        title: 'من الورق إلى الحجز الإلكتروني لشركة رحلات',
        text: 'كيف نقلت رحلات البترا كل رحلاتها إلى الإنترنت في أسبوعين.',
        meta: 'دراسة حالة · 7 دقائق قراءة',
        href: '#post-4',
      },
    ],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    title: 'أسئلتكم وإجاباتنا',
    lead: 'ما زلت مترددًا؟ يرد فريقنا خلال ساعة.',
    cta: { label: 'اسألنا أي شيء', href: '#contact' },
    items: [
      {
        q: 'هل أحتاج إلى معرفة البرمجة؟',
        a: 'لا. تختار الأقسام وتكتب كلماتك ثم تنشر، ويمكن للمطوّرين إضافة شيفرة خاصة متى أرادوا.',
      },
      {
        q: 'هل يمكن أن يكون موقعي بالعربية والإنجليزية؟',
        a: 'نعم. لكل صفحة نسختان باللغتين، والتخطيط من اليمين إلى اليسار ينعكس تلقائيًا.',
      },
      {
        q: 'هل أستطيع استخدام نطاقي الخاص؟',
        a: 'نعم، في باقتي الأعمال والوكالات، ونجهّز لك شهادة الأمان.',
      },
      {
        q: 'ماذا يحدث إن ألغيت الاشتراك؟',
        a: 'يبقى موقعك منشورًا حتى نهاية الشهر، ويمكنك تصدير كل صفحاته.',
      },
      {
        q: 'هل توجد فترة تجربة مجانية؟',
        a: 'كل باقة تبدأ بأربعة عشر يومًا مجانًا، دون بطاقة ائتمان.',
      },
    ],
  },
  cta: {
    eyebrow: 'جاهزون متى كنت جاهزًا',
    title: 'انشر صفحتك الأولى اليوم',
    lead: 'ابدأ مجانًا واختر قالبًا وانطلق قبل العشاء.',
    cta: { label: 'ابدأ مجانًا', href: '#pricing' },
    cta2: { label: 'تحدّث معنا', href: '#contact' },
    image: 'pexels-13256066',
  },
  contact: {
    eyebrow: 'زورونا',
    title: 'تعال وسلّم علينا',
    lead: 'مرّ على الاستوديو أو اتصل أو أرسل رسالة، ونرد في اليوم نفسه.',
    channels: [
      { icon: 'phone', label: 'اتصل بنا', href: TEL },
      { icon: 'mail', label: 'البريد', href: `mailto:${EMAIL_AR}` },
      { icon: 'message-circle', label: 'واتساب', href: 'https://wa.me/96265550134' },
    ],
    hours: [
      { day: 'من الأحد إلى الخميس', time: '9:00 – 18:00' },
      { day: 'السبت', time: '10:00 – 14:00' },
      { day: 'الجمعة', time: 'مغلق' },
    ],
    address: 'شارع الرينبو 24، عمّان',
    map: { label: 'افتح في الخرائط', href: MAP },
    items: [
      { icon: 'mail', title: 'راسلنا', text: EMAIL_AR, href: `mailto:${EMAIL_AR}` },
      { icon: 'phone', title: 'اتصل بالاستوديو', text: PHONE, href: TEL },
      { icon: 'map-pin', title: 'مكتبنا', text: 'شارع الرينبو، عمّان' },
      { icon: 'clock', title: 'ساعات العمل', text: 'الأحد إلى الخميس، 9:00 – 18:00' },
    ],
  },
  footer: {
    brand: 'سراج',
    text: 'مواقع للمتاجر والعيادات والاستوديوهات، بالعربية والإنجليزية.',
    nav_label: 'روابط التذييل',
    nav: [
      { label: 'من نحن', href: '#about' },
      { label: 'الأسعار', href: '#pricing' },
      { label: 'المدونة', href: '#journal' },
      { label: 'تواصل معنا', href: '#contact' },
    ],
    contact: [
      { icon: 'mail', text: EMAIL_AR, href: `mailto:${EMAIL_AR}` },
      { icon: 'phone', text: PHONE, href: TEL },
      { icon: 'map-pin', text: 'شارع الرينبو 24، عمّان' },
    ],
    copyright: '© 2026 سراج. جميع الحقوق محفوظة.',
    title: 'جاهز لبناء موقعك؟',
    cta: { label: 'ابدأ مجانًا', href: '#pricing' },
    cta2: { label: 'احجز عرضًا', href: '#contact' },
  },
};

/** The copy per language, per subject (`kitSubject` in library-sections.ts). */
export const SECTION_COPY: Readonly<Record<Lang, Readonly<Record<string, CopyRecord>>>> = {
  en: ENGLISH,
  ar: ARABIC,
};
