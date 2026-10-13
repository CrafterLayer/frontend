import type { NavLink } from '../build';

/* The English copy of services; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Mizan Partners',
  nav: [
    { label: 'Services', href: '#services' },
    { label: 'Approach', href: '#approach' },
    { label: 'Team', href: '#team' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Book a consultation', href: '#contact' },
  hero: {
    eyebrow: 'Corporate law and advisory · Amman · Riyadh',
    heading: 'Clear legal advice for the decisions that matter',
    body: 'Mizan Partners helps founders, family businesses and investors set up, grow and protect their companies across Jordan and Saudi Arabia.',
    trustLine: 'Licensed in Jordan and Saudi Arabia · Arabic and English · Confidential',
    primary: 'Speak to a partner',
    secondary: 'Explore our services',
  },
  logos: {
    eyebrow: 'Trusted by',
    heading: 'Advising companies from their first licence to regional growth',
    items: [
      { name: 'Zaytouna Foods', descriptor: 'Food and retail' },
      { name: 'Badia Logistics', descriptor: 'Logistics' },
      { name: 'Ufuq Developments', descriptor: 'Real estate' },
      { name: 'Dana Health', descriptor: 'Healthcare' },
      { name: 'Atlas Ventures', descriptor: 'Investment' },
      { name: 'Sahab Cloud', descriptor: 'Technology' },
    ],
  },
  content: {
    eyebrow: 'Services',
    heading: 'One firm for the legal side of your growth',
    body: 'From company formation to cross-border deals, a small team of partners handles your matters personally and explains every option in plain language.',
    highlights: [
      {
        title: 'Company formation',
        body: 'Licences, structures and shareholder agreements set up right the first time.',
      },
      {
        title: 'Contracts and disputes',
        body: 'Drafting, review and negotiation, with litigation support when it is needed.',
      },
      {
        title: 'Investment and M&A',
        body: 'Due diligence and deal documents for investors, buyers and sellers.',
      },
      {
        title: 'Employment and compliance',
        body: 'Policies, contracts and regulatory filings that keep your team protected.',
      },
    ],
    link: 'See all services',
  },
  process: {
    eyebrow: 'Approach',
    heading: 'How a matter moves with us',
    body: 'Every engagement follows the same four steps, so you always know what happens next and what it will cost.',
    steps: [
      {
        meta: 'Day one',
        title: 'Free first call',
        body: 'A 30-minute call with a partner to understand the matter and what is at stake.',
      },
      {
        meta: 'First week',
        title: 'Clear proposal',
        body: 'A written scope, timeline and fixed fee before any work begins.',
      },
      {
        meta: 'Weeks 2–6',
        title: 'Focused work',
        body: 'Drafting, filings and negotiation, with a short update every week.',
      },
      {
        meta: 'Ongoing',
        title: 'Long-term counsel',
        body: 'Retainer options for companies that want a partner on call.',
      },
    ],
  },
  stats: {
    eyebrow: 'Track record',
    heading: 'Fifteen years of matters handled with care',
    body: 'Figures from our files since the firm opened in Amman in 2011 and in Riyadh in 2019.',
    items: [
      { value: '1,200+', label: 'Companies formed', detail: 'Across Jordan and Saudi Arabia' },
      { value: '350', label: 'Transactions closed', detail: 'Investments, mergers and exits' },
      {
        value: '94%',
        label: 'Disputes settled out of court',
        detail: 'Saving clients time and cost',
      },
      { value: '9', label: 'Partners and counsel', detail: 'Based in Amman and Riyadh' },
    ],
  },
  team: {
    eyebrow: 'Team',
    heading: 'Partners who handle your work themselves',
    body: 'You speak to the person doing the work, in Arabic or English, from the first call to the final signature.',
    profileLabel: 'View profile',
    members: [
      {
        name: 'Dr. Ahmad Al-Masri',
        role: 'Managing Partner',
        bio: 'Corporate law and cross-border transactions, with twenty years in practice.',
      },
      {
        name: 'Rania Haddad',
        role: 'Partner, Disputes',
        bio: 'Commercial litigation and arbitration before regional centres.',
      },
      {
        name: 'Faisal Al-Qahtani',
        role: 'Partner, Riyadh office',
        bio: 'Saudi company law, licensing and foreign investment.',
      },
      {
        name: 'Mais Odeh',
        role: 'Senior Associate',
        bio: 'Employment, compliance and data protection.',
      },
    ],
  },
  quotes: {
    eyebrow: 'Clients',
    heading: 'Companies that trust us with their decisions',
    items: [
      {
        quote: 'They explained every option clearly, and the fixed fee meant no surprises.',
        author: 'Khaled Barakat',
        role: 'Chief Executive',
        company: 'Zaytouna Foods',
      },
      {
        quote:
          'Mizan guided our expansion into Riyadh from the licence to our first hire in under three months.',
        author: 'Leen Al-Ali',
        role: 'Chief Operating Officer',
        company: 'Dana Health',
      },
      {
        quote:
          'Our investment round closed on time because the paperwork was ready before the investors asked.',
        author: 'Omar Zaid',
        role: 'Founder',
        company: 'Sahab Cloud',
      },
      {
        quote: 'Sharp, discreet and always reachable. Exactly what a family business needs.',
        author: 'Suhair Nasser',
        role: 'Board Member',
        company: 'Badia Logistics',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Before your first consultation',
    items: [
      {
        question: 'Is the first consultation really free?',
        answer:
          'Yes. The first call is free and confidential, and you decide afterwards whether to continue.',
      },
      {
        question: 'How are your fees set?',
        answer:
          'Most matters have a fixed fee agreed in writing before work starts. Long disputes can be billed monthly.',
      },
      {
        question: 'Do you work in Arabic and English?',
        answer:
          'Every partner works in both languages, and we draft bilingual contracts when a deal needs them.',
      },
      {
        question: 'Can you act for us in Saudi Arabia?',
        answer:
          'Yes. Our Riyadh office is licensed to advise on Saudi company law, licensing and investment.',
      },
    ],
  },
  form: {
    eyebrow: 'Consultation',
    heading: 'Book a confidential consultation',
    body: 'Tell us briefly about your matter. A partner will reply within two working days to arrange a call.',
    fields: {
      name: 'Full name',
      email: 'Email',
      phone: 'Phone',
      topic: 'Type of matter',
      topics: ['Company formation', 'Contracts', 'Disputes', 'Investment', 'Employment'],
      message: 'How can we help?',
      consent: 'I agree that my details are used only to reply to this enquiry.',
    },
    submitLabel: 'Request a consultation',
    footerNote: 'Your message goes directly to a partner and stays confidential.',
    successHint: 'Thank you. A partner will contact you within two working days.',
  },
  footer: {
    tagline: 'Corporate law and advisory in Amman and Riyadh.',
    columns: [
      {
        title: 'Services',
        links: [
          { label: 'Company formation', href: '#services' },
          { label: 'Contracts', href: '#services' },
          { label: 'Disputes', href: '#services' },
          { label: 'Investment', href: '#services' },
        ],
      },
      {
        title: 'Firm',
        links: [
          { label: 'Approach', href: '#approach' },
          { label: 'Team', href: '#team' },
          { label: 'Careers', href: '#careers' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Amman office', href: '#amman' },
          { label: 'Riyadh office', href: '#riyadh' },
          { label: 'Email us', href: 'mailto:hello@example.com' },
        ],
      },
    ],
  },
};

export type ServicesCopy = typeof EN;
