import type { NavLink } from '../../build';

interface Ticket {
  readonly name: string;
  readonly perks: readonly string[];
  readonly action: string;
}

/* The English copy of events; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
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

export type EventsCopy = typeof EN;
