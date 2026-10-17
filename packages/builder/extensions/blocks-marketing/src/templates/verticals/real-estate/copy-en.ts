import type { NavLink } from '../../build';

interface Listing {
  readonly name: string;
  readonly description: string;
  readonly badge?: string;
}

/* The English copy of real-estate; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
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

export type RealEstateCopy = typeof EN;
