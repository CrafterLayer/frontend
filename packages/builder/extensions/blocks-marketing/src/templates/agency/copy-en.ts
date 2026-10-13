import type { NavLink } from '../build';

/* The English copy of agency; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
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

export type AgencyCopy = typeof EN;
