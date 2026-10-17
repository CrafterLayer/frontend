import type { NavLink } from '../build';

/* The English copy of store; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
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

export type StoreCopy = typeof EN;
