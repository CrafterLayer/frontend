import { money, type NavLink } from '../build';

/* The English copy of saas; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Masar',
  nav: [
    { label: 'Product', href: '#product' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Customers', href: '#customers' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Start free', href: '#pricing' },
  hero: {
    eyebrow: 'Product planning for growing teams',
    heading: 'Plan, ship and learn in one calm workspace',
    body: 'Masar connects your roadmap, delivery and customer feedback, so every release traces back to a decision the whole team understands.',
    trustLine: 'Free for 14 days · No card needed · Arabic and English',
    primary: 'Create your workspace',
    secondary: 'Book a demo',
  },
  logos: {
    eyebrow: 'Trusted by product teams',
    heading: 'Teams from Riyadh to Amman run their releases on Masar',
    items: [
      { name: 'Qamar Pay', descriptor: 'Fintech' },
      { name: 'Nakhla', descriptor: 'Logistics' },
      { name: 'Sahab Cloud', descriptor: 'Infrastructure' },
      { name: 'Wasel', descriptor: 'Delivery' },
      { name: 'Dana Health', descriptor: 'Health tech' },
      { name: 'Rawaj', descriptor: 'E-commerce' },
    ],
  },
  bento: {
    eyebrow: 'Everything in one place',
    heading: 'A workspace that keeps the why beside the work',
    body: 'Roadmaps, specs, releases and feedback live together, so nobody rebuilds context before a decision.',
    items: [
      {
        kicker: 'Roadmaps',
        title: 'One living roadmap for every team',
        body: 'Link goals to the work that moves them and watch progress update itself as tasks close.',
        metric: '3.4× faster planning',
      },
      {
        kicker: 'Feedback',
        title: 'Customer voice, sorted',
        body: 'Bring requests from support, sales and interviews into one inbox and tie each to the right opportunity.',
      },
      {
        kicker: 'Releases',
        title: 'Release notes, ready',
        body: 'Every finished task becomes a clear release note your customers can read.',
      },
      {
        kicker: 'Insights',
        title: 'Measure what each release changed',
        body: 'Track adoption and outcomes per feature, then share one honest report with leadership.',
      },
    ],
  },
  stats: {
    eyebrow: 'Customer results',
    heading: 'Less status chasing, more shipped work',
    body: 'Averages from 120 product teams in their first six months on Masar.',
    items: [
      {
        value: '42%',
        label: 'Faster from idea to release',
        detail: 'Median across customer teams',
      },
      { value: '6 hrs', label: 'Saved by each lead every week', detail: 'Fewer status meetings' },
      {
        value: '3×',
        label: 'More feedback tied to work',
        detail: 'Requests linked to the roadmap',
      },
      { value: '99.95%', label: 'Uptime last year', detail: 'Hosted in the region' },
    ],
  },
  content: {
    eyebrow: 'How teams use it',
    heading: 'From a scattered backlog to a plan everyone can read',
    body: 'Start with the board your team already knows. Masar adds goals, owners and evidence around it, so planning sessions end with decisions instead of more questions.',
    highlights: [
      {
        title: 'A goal on every card',
        body: 'Each task shows the outcome it serves and who owns it.',
      },
      {
        title: 'Bilingual by design',
        body: 'Write in Arabic or English; the workspace mirrors right to left on its own.',
      },
      {
        title: 'Works with your tools',
        body: 'Sync code, design files and chat so updates arrive where people already work.',
      },
      {
        title: 'Reviews in minutes',
        body: 'A weekly digest shows what moved, what slipped and why.',
      },
    ],
    link: 'Take the product tour',
  },
  quotes: {
    eyebrow: 'Customers',
    heading: 'Product teams that plan with confidence',
    items: [
      {
        quote:
          'Our planning meeting went from three hours to forty minutes, and nobody leaves asking what we agreed.',
        author: 'Lina Haddad',
        role: 'Head of Product',
        company: 'Qamar Pay',
      },
      {
        quote:
          'We finally see which customer requests turned into shipped features. Sales stopped guessing.',
        author: 'Omar Khalil',
        role: 'VP Engineering',
        company: 'Nakhla',
      },
      {
        quote:
          'The Arabic interface is not an afterthought. Our whole operations team works in it every day.',
        author: 'Sara Al-Mutairi',
        role: 'Operations Director',
        company: 'Wasel',
      },
      {
        quote:
          'Release notes used to take a full day every sprint. Now they are ready before the demo.',
        author: 'Yousef Nasser',
        role: 'Product Manager',
        company: 'Rawaj',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    heading: 'Simple plans that grow with your team',
    body: 'Every plan includes unlimited projects and the full Arabic and English interface. Prices are per member, billed monthly.',
    featureLabel: 'What is included',
    scrollLabel: 'Plan comparison, scroll for more',
    includedLabel: 'Included',
    excludedLabel: 'Not included',
    plans: [
      {
        name: 'Starter',
        description: 'For small teams finding their rhythm',
        price: money(9, 'USD', 'en'),
        period: 'per member / month',
        actionLabel: 'Choose Starter',
        actionHref: '#signup-starter',
      },
      {
        name: 'Growth',
        description: 'For teams scaling quickly',
        price: money(19, 'USD', 'en'),
        period: 'per member / month',
        badge: 'Most popular',
        actionLabel: 'Choose Growth',
        actionHref: '#signup-growth',
        featured: true,
      },
      {
        name: 'Enterprise',
        description: 'For organisations with special requirements',
        price: 'Custom',
        actionLabel: 'Talk to sales',
        actionHref: '#sales',
      },
    ],
    rows: [
      { feature: 'Members', values: ['Up to 10', 'Up to 100', 'Unlimited'] },
      {
        feature: 'Roadmaps and boards',
        values: ['Included', 'Included', 'Included'],
        highlight: true,
      },
      { feature: 'Customer feedback inbox', values: ['—', 'Included', 'Included'] },
      { feature: 'Release notes and insights', values: ['—', 'Included', 'Included'] },
      { feature: 'Single sign-on and audit log', values: ['—', '—', 'Included'] },
      { feature: 'Support', values: ['Email', 'Priority chat', 'Dedicated manager'] },
    ],
    note: 'Prices in US dollars, excluding VAT. Change or cancel your plan at any time.',
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions before you start',
    items: [
      {
        question: 'Can we move our existing backlog?',
        answer:
          'Yes. Import from a spreadsheet or connect your current tracker, and Masar keeps owners, labels and history.',
      },
      {
        question: 'Is our data hosted in the region?',
        answer: 'Yes. Workspaces are hosted in Gulf data centres with encrypted daily backups.',
      },
      {
        question: 'Do guests need a paid seat?',
        answer:
          'No. Invite clients and partners as guests to the spaces they need, free on every plan.',
      },
      {
        question: 'Can we switch plans later?',
        answer:
          'Upgrade or downgrade at any time. Billing adjusts on your next invoice and nothing is lost.',
      },
    ],
  },
  newsletter: {
    eyebrow: 'Newsletter',
    heading: 'One useful product letter a month',
    body: 'Practical notes on planning, discovery and shipping, written by product leads in the region.',
    emailLabel: 'Work email',
    placeholder: 'name@company.com',
    buttonLabel: 'Subscribe',
    privacy: 'No spam. Unsubscribe in one click.',
  },
  footer: {
    tagline: 'Product planning for teams that ship in Arabic and English.',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Features', href: '#product' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Security', href: '#security' },
          { label: 'Changelog', href: '#changelog' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '#about' },
          { label: 'Careers', href: '#careers' },
          { label: 'Contact', href: '#contact' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Help centre', href: '#help' },
          { label: 'Guides', href: '#guides' },
          { label: 'Service status', href: '#status' },
        ],
      },
    ],
  },
};

export type SaasCopy = typeof EN;
