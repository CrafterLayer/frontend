import type { NavLink } from '../../build';

interface Project {
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
}

/* The English copy of portfolio; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Rana Haddad',
  nav: [
    { label: 'Work', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Experience', href: '#experience' },
    { label: 'Contact', href: '#contact' },
  ] as NavLink[],
  headerCta: { label: 'Hire me', href: '#contact' },
  hero: {
    eyebrow: 'Product designer · Amman, working worldwide',
    heading: 'I design calm, bilingual products people trust',
    body: 'Nine years shaping banking, delivery and health apps for teams across the Gulf and the Levant, in Arabic and English from the first sketch.',
    trustLine: 'Open to new projects from November 2026',
    primary: 'See selected work',
    secondary: 'Download my CV',
  },
  about: {
    eyebrow: 'About',
    heading: 'Design that starts with the people who will use it',
    body: "I began as a visual designer in an Amman studio and moved into product design when I saw how much a clear screen could save someone's day. Today I lead research, interface and design-system work, and I make sure the Arabic version is designed, not just translated.",
    highlights: [
      {
        title: 'Research first',
        body: 'Interviews and usability tests come before pixels, so every decision has a reason.',
      },
      {
        title: 'Right to left by default',
        body: 'Layouts, type and icons are planned for both directions from day one.',
      },
      {
        title: 'Shipped, not just shown',
        body: 'I stay with engineering until the release is live and its impact is measured.',
      },
    ],
    link: 'Read my design principles',
  },
  stats: {
    eyebrow: 'In numbers',
    heading: 'A decade of shipping products people use every day',
    body: 'Counted across full-time roles and independent projects since 2016.',
    items: [
      { value: '9 yrs', label: 'In product design', detail: 'Since 2016' },
      { value: '40+', label: 'Products and features shipped', detail: 'Web and mobile' },
      { value: '18', label: 'Clients across the region', detail: 'From start-ups to banks' },
    ],
  },
  work: {
    eyebrow: 'Selected projects',
    heading: 'Recent work, from first research to launch',
    body: 'A few projects I can share in public. More case studies are available on request.',
    actionLabel: 'Read the case study',
    items: [
      {
        category: 'Mobile app · Fintech',
        title: 'Qamar Pay wallet redesign',
        summary:
          'Rebuilt onboarding and payments for a digital wallet used by 1.2 million people, in Arabic and English.',
        metrics: [
          { label: 'Onboarding completion', value: '+38%' },
          { label: 'Support tickets', value: '−24%' },
        ],
      },
      {
        category: 'Design system · Logistics',
        title: 'Nakhla design system',
        summary:
          'A bilingual component library and design tokens shared by four product teams on two platforms.',
        metrics: [
          { label: 'Components', value: '120' },
          { label: 'Design-to-build time', value: '−30%' },
        ],
      },
      {
        category: 'Dashboard · Banking',
        title: 'Small-business banking dashboard',
        summary:
          'Turned twelve reports into one daily view of cash flow, invoices and payroll for business owners.',
        metrics: [{ label: 'Daily active users', value: '3×' }],
      },
      {
        category: 'Brand identity · Hospitality',
        title: 'Identity for a Riyadh speciality café',
        summary:
          'A bilingual logotype, menu system and signage for a speciality café with three branches.',
        metrics: [{ label: 'Branches', value: '3' }],
      },
      {
        category: 'Research · Health',
        title: 'Dana Health patient journey',
        summary:
          'Mapped the patient journey across clinics and the app, then redesigned booking and reminders.',
        metrics: [{ label: 'Missed appointments', value: '−19%' }],
      },
      {
        category: 'Web app · Delivery',
        title: 'Wasel fleet operations console',
        summary: 'A live map and dispatch console for operators who manage 900 couriers every day.',
        metrics: [{ label: 'Dispatch time', value: '−22%' }],
      },
    ] as Project[],
  },
  experience: {
    eyebrow: 'Experience',
    heading: 'Where I have worked',
    body: 'Ten years across studios, scale-ups and independent practice.',
    items: [
      {
        title: 'Lead product designer · Qamar Pay',
        body: 'Lead five designers across payments, cards and onboarding, and own the design system.',
        meta: '2023 — now',
      },
      {
        title: 'Senior product designer · Nakhla',
        body: 'Designed the shipper app and the operations console, and built the first bilingual design system.',
        meta: '2020 — 2023',
      },
      {
        title: 'Product designer · Wasel',
        body: 'Worked on the courier and customer apps, from research to release, at a fast-growing delivery start-up.',
        meta: '2018 — 2020',
      },
      {
        title: 'Visual designer · Studio Sahab',
        body: 'Brand and web projects for cultural and hospitality clients in Amman.',
        meta: '2016 — 2018',
      },
    ],
  },
  skills: {
    eyebrow: 'Skills',
    heading: 'What I bring to a team',
    body: 'The parts of the work I enjoy most and do best.',
    items: [
      {
        title: 'Product strategy',
        body: 'Framing the problem, setting goals and choosing what not to build.',
      },
      {
        title: 'User research',
        body: 'Interviews, usability tests and journey maps the whole team can use.',
      },
      {
        title: 'Interface design',
        body: 'Clear, accessible screens for web and mobile, in light and dark.',
      },
      {
        title: 'Design systems',
        body: 'Tokens, components and documentation that scale across teams.',
      },
      {
        title: 'Arabic typography',
        body: 'Type pairing, line length and numerals that read naturally right to left.',
      },
      {
        title: 'Prototyping',
        body: 'Interactive prototypes to test ideas with real users before any code.',
      },
    ],
  },
  quotes: {
    eyebrow: 'Kind words',
    heading: 'What colleagues and clients say',
    items: [
      {
        quote:
          'Rana asks the questions nobody else thinks to ask, and the product is better for it every single time.',
        author: 'Omar Khalil',
        role: 'VP Engineering',
        company: 'Nakhla',
      },
      {
        quote:
          'Our Arabic app finally feels native. Customers noticed within a week and our ratings went up.',
        author: 'Sara Al-Mutairi',
        role: 'Head of Product',
        company: 'Qamar Pay',
      },
      {
        quote:
          'She turned a messy brief into a clear plan in two workshops, then delivered ahead of schedule.',
        author: 'Yousef Nasser',
        role: 'Founder',
        company: 'Dana Health',
      },
      {
        quote:
          'The design system Rana built is still the backbone of everything we ship, three years later.',
        author: 'Maha Al-Zahrani',
        role: 'Design Manager',
        company: 'Wasel',
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    heading: "Let's build something useful together",
    body: 'Tell me about your product and timeline. I take on two projects at a time, so each gets my full attention.',
    address: 'Amman, Jordan · Working with teams worldwide',
    availability: 'Replies within two working days',
    formTitle: 'Start a project',
    formBody: 'A few lines about the product, the team and the deadline are enough.',
    nameLabel: 'Your name',
    emailLabel: 'Email address',
    messageLabel: 'About your project',
    submitLabel: 'Send message',
  },
  footer: {
    tagline: 'Product designer in Amman, designing in Arabic and English.',
    columns: [
      {
        title: 'Work',
        links: [
          { label: 'Selected projects', href: '#work' },
          { label: 'Experience', href: '#experience' },
          { label: 'Skills', href: '#skills' },
        ],
      },
      {
        title: 'Elsewhere',
        links: [
          { label: 'LinkedIn', href: '#linkedin' },
          { label: 'Behance', href: '#behance' },
          { label: 'Dribbble', href: '#dribbble' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Email me', href: 'mailto:hello@example.com' },
          { label: 'Download CV', href: '#cv' },
        ],
      },
    ],
  },
};

export type PortfolioCopy = typeof EN;
