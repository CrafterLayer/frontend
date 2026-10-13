import type { NavLink } from '../../build';

export interface Room {
  readonly name: string;
  /** "size · guests · view · feature": four parts, the size always first. */
  readonly description: string;
  readonly badge?: string;
}

/* The English copy of the beach resort; ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Marjan Bay Resort',
  nav: [
    { label: 'Rooms', href: '#rooms' },
    { label: 'Experiences', href: '#experiences' },
    { label: 'Dining', href: '#dining' },
    { label: 'Location', href: '#location' },
  ] as NavLink[],
  headerCta: { label: 'Book your stay', href: '#book' },
  hero: {
    eyebrow: 'Beach resort · South Beach, Aqaba · Red Sea',
    heading: 'Wake up to the Red Sea, with Petra and Wadi Rum a drive away',
    body: 'A family-run beach resort with 96 rooms and villas, a coral reef at the end of the jetty and guided days out to the wonders of southern Jordan.',
    trustLine:
      'Private beach and reef · Breakfast included · Free cancellation up to 48 hours before arrival',
    primary: 'Check availability',
    secondary: 'Explore the rooms',
  },
  rooms: {
    eyebrow: 'Rooms and villas',
    heading: 'Find the room that fits your stay',
    body: 'Every room has a balcony or terrace and breakfast for two. Prices are per night in Jordanian dinars, before tax.',
    actionLabel: 'See room details',
    ratingPrefix: 'Guest rating',
    ratingSuffix: 'of 5',
    reviewCountLabel: 'guest reviews',
    items: [
      {
        name: 'Garden room',
        description: '32 m² · 2 guests · Garden view · Glass doors to a private patio',
      },
      {
        name: 'Sea-view junior suite',
        description: '45 m² · 3 guests · Sea view · A lounge with tall windows',
        badge: 'Most booked',
      },
      {
        name: 'Spa suite',
        description: '52 m² · 2 guests · Sea view · A freestanding stone bathtub',
        badge: 'Book direct and save',
      },
      {
        name: 'Family suite',
        description: '68 m² · 5 guests · Pool view · Two bedrooms and a lounge',
      },
      {
        name: 'Two-level pool suite',
        description: '85 m² · 4 guests · Pool view · Glass walls and a plunge pool',
        badge: 'New',
      },
      {
        name: 'Private pool villa',
        description: '140 m² · 6 guests · Sea view · A private pool and butler service',
      },
    ] as Room[],
  },
  amenities: {
    eyebrow: 'At the resort',
    heading: 'Everything for a slow, easy holiday',
    body: 'Most of it is included in your stay; the rest can be booked at the front desk or by message.',
    items: [
      {
        kicker: 'Beach',
        title: 'Private beach and house reef',
        body: 'Snorkel straight from our jetty over one of the healthiest coral reefs in the Red Sea.',
      },
      {
        kicker: 'Pools',
        title: 'Two pools, one for adults only',
        body: 'A heated family pool with a shallow end, and a quiet infinity pool facing the sea.',
      },
      {
        kicker: 'Wellness',
        title: 'Spa and hammam',
        body: 'A traditional hammam, massages with Dead Sea salts and a fully equipped gym.',
      },
      {
        kicker: 'Diving',
        title: 'Dive centre',
        body: 'Try-dives, certified courses and boat trips to the Cedar Pride wreck.',
      },
      {
        kicker: 'Families',
        title: "Kids' club",
        body: 'Supervised activities every day from 9:00 to 18:00, for children aged four to twelve.',
      },
      {
        kicker: 'Transfers',
        title: 'Airport and border transfers',
        body: 'Pick-up from King Hussein International Airport and the Wadi Araba crossing.',
      },
    ],
  },
  experiences: {
    eyebrow: 'Experiences',
    heading: 'Beyond the beach: Petra, Wadi Rum and the reef',
    body: 'Our guides plan every day out, with transport, entry tickets and lunch arranged before you leave.',
    linkLabel: 'Open the full photo',
    captions: [
      'The Treasury in Petra · two hours by road',
      'Sunset in Wadi Rum · a jeep tour and dinner at a desert camp',
      'The climb to the Monastery at Petra · 800 steps',
      'Afternoons by the infinity pool',
      'The Royal Tombs on a guided walk',
      'A cooking class with our chefs',
    ],
  },
  dining: {
    eyebrow: 'Dining',
    heading: 'Three restaurants, one view of the sea',
    body: 'Breakfast on the terrace, fish grilled on the beach and Jordanian classics such as mansaf and sayadieh in our dining room, cooked with produce from the Jordan Valley. Every restaurant is halal.',
    highlights: [
      { title: 'The Terrace', body: 'A breakfast buffet and all-day dining facing the sea.' },
      { title: 'Samak on the beach', body: 'The catch of the day, grilled to order at sunset.' },
      { title: 'Al Diwan', body: 'Jordanian home cooking, with live oud on Thursday nights.' },
    ],
    link: 'See the menus',
  },
  quotes: {
    eyebrow: 'Guest reviews',
    heading: 'What guests write after their stay',
    items: [
      {
        quote:
          'The reef starts ten metres from the beach. Our children snorkelled every morning and still talk about the turtle.',
        author: 'Hind Al-Rashid',
        role: 'Family stay, Riyadh',
      },
      {
        quote:
          'The Petra day trip was perfectly organised: an early start, a brilliant guide and back in time for dinner by the sea.',
        author: 'James Whitfield',
        role: 'Couple’s stay, London',
      },
      {
        quote: 'Spotless rooms, kind staff and the best breakfast we had anywhere in Jordan.',
        author: 'Mahmoud Saeed',
        role: 'Business trip, Cairo',
      },
      {
        quote:
          "We booked the pool villa for my parents' anniversary, and the team decorated it with flowers without being asked.",
        author: 'Leen Haddadin',
        role: 'Family celebration, Amman',
      },
    ],
  },
  location: {
    eyebrow: 'Location',
    heading: 'On the quiet south coast of Aqaba',
    body: 'Fifteen minutes from the airport and the town centre, an hour from Wadi Rum and two hours from Petra.',
    address: 'South Beach Road, Tala Bay, Aqaba 77110, Jordan',
    addressLabel: 'Find us',
    mapsLabel: 'Get directions',
    mapTitle: 'Map of Marjan Bay Resort in Aqaba',
    hoursLabel: 'Arrivals and departures',
    hours: [
      { days: 'Check-in', time: 'From 15:00' },
      { days: 'Check-out', time: 'Until 12:00' },
      { days: 'Front desk', time: 'Open 24 hours' },
      { days: 'Dive centre', time: 'Daily, 8:00 to 17:00' },
    ],
    hoursNote: 'Early check-in and late check-out on request, when rooms are available.',
    contactLabel: 'Reservations',
    phoneLabel: 'Call reservations',
    emailLabel: 'Email the resort',
    whatsappLabel: 'Message us on WhatsApp',
    whatsappMessage: 'Hello, I would like to ask about a stay at Marjan Bay Resort.',
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Good to know before you arrive',
    items: [
      {
        question: 'Is breakfast included?',
        answer:
          'Yes. Breakfast for two comes with every room, and for four in family suites and villas.',
      },
      {
        question: 'Can you arrange a day trip to Petra?',
        answer:
          'Yes. Our guides run trips to Petra and Wadi Rum every day, with transport, tickets and lunch. Book at least a day ahead.',
      },
      {
        question: 'Do I need a visa for Jordan?',
        answer:
          'Many nationalities can get a visa on arrival at Aqaba airport. Our team can check yours before you travel.',
      },
      {
        question: 'Is the resort good for children?',
        answer:
          "Very. There is a shallow family pool, a kids' club, babysitting on request and connecting rooms.",
      },
      {
        question: 'What is your cancellation policy?',
        answer:
          'Cancel free of charge up to 48 hours before arrival. After that, the first night is charged.',
      },
      {
        question: 'Is there parking?',
        answer: 'Parking is free for guests, with electric car chargers by the main entrance.',
      },
    ],
  },
  book: {
    label: 'Book direct',
    headline: 'Stay four nights, pay for three',
    body: 'Book on our website or by phone and the fourth night is on us, with a free upgrade whenever one is available.',
    primary: 'Claim the fourth night free',
    secondary: 'Speak to reservations',
  },
  footer: {
    tagline: 'A family-run beach resort on the Red Sea in Aqaba, Jordan.',
    columns: [
      {
        title: 'Stay',
        links: [
          { label: 'Rooms and villas', href: '#rooms' },
          { label: 'Offers', href: '#book' },
          { label: 'Gift vouchers', href: '#book' },
        ],
      },
      {
        title: 'Discover',
        links: [
          { label: 'Experiences', href: '#experiences' },
          { label: 'Dining', href: '#dining' },
          { label: 'Location', href: '#location' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call the resort', href: 'tel:+96232094400' },
          { label: 'Email us', href: 'mailto:stay@example.com' },
          { label: 'Find us', href: '#location' },
        ],
      },
    ],
  },
};

export type HotelCopy = typeof EN;
