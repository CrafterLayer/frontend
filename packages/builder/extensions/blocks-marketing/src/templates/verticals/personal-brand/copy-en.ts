import type { NavLink } from '../../build';
import type { PlanCopy } from '../../sections';

export interface Post {
  readonly title: string;
  readonly excerpt: string;
  readonly category: string;
  readonly publishedLabel: string;
  readonly readingTime: string;
}

/* The English copy of the coach's site; ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Sara Al Mansouri',
  nav: [
    { label: 'About', href: '#about' },
    { label: 'Programmes', href: '#programmes' },
    { label: 'Method', href: '#method' },
    { label: 'Insights', href: '#insights' },
  ] as NavLink[],
  headerCta: { label: 'Book a call', href: '#contact' },
  hero: {
    eyebrow: 'Leadership and career coach · Dubai',
    heading: 'Lead with clarity, and bring your team with you',
    body: 'I help managers and founders across the Gulf become the leaders their teams trust, through one-to-one coaching, leadership programmes and team workshops.',
    trustLine: 'Accredited executive coach · 600+ leaders coached · Sessions in Arabic and English',
    primary: 'Book a free discovery call',
    secondary: 'Explore programmes',
  },
  logos: {
    eyebrow: 'Trusted by leaders at',
    heading: 'Coaching leaders at banks, start-ups, hospitals and public-sector teams',
    items: [
      { name: 'Gulf Crescent Bank', descriptor: 'Banking' },
      { name: 'Rimal Ventures', descriptor: 'Venture capital' },
      { name: 'Noor Health', descriptor: 'Healthcare' },
      { name: 'Afaq Energy', descriptor: 'Energy' },
      { name: 'Sanad Digital', descriptor: 'Technology' },
      { name: 'Waha Hospitality', descriptor: 'Hospitality' },
    ],
  },
  about: {
    eyebrow: 'About Sara',
    heading: 'Fifteen years leading teams, eight years helping others lead theirs',
    body: 'I spent fifteen years in banking and technology, the last six running a team of 120 people across three countries, and I made most of the mistakes new leaders make. Since 2018 I have coached more than 600 managers and founders to avoid them, with a practical method built on real work rather than theory.',
    highlights: [
      {
        title: 'Accredited executive coach',
        body: 'Certified by an international coaching federation, with more than 2,500 coaching hours.',
      },
      {
        title: 'Former regional director',
        body: 'Led teams of up to 120 people in banking and technology across the Gulf.',
      },
      {
        title: 'Arabic and English',
        body: 'Coaching and workshops in both languages, in person in Dubai or online.',
      },
      {
        title: 'Speaker',
        body: 'Keynotes on leadership and on women in management at conferences across the region.',
      },
    ],
    link: 'Read my articles',
  },
  results: {
    eyebrow: 'Results',
    heading: 'What changes for the leaders I coach',
    body: 'From the follow-up survey every client receives six months after their programme ends.',
    items: [
      { value: '600+', label: 'Leaders coached since 2018', detail: 'In 14 countries' },
      {
        value: '78%',
        label: 'Promoted within 18 months',
        detail: 'Of leadership accelerator graduates',
      },
      {
        value: '9.4/10',
        label: 'Average client rating',
        detail: 'Across 420 completed programmes',
      },
    ],
  },
  programmes: {
    eyebrow: 'Programmes',
    heading: 'Ways to work together',
    body: 'Prices in UAE dirhams, before VAT. Companies can pay by invoice, and most clients start with a free discovery call.',
    badge: 'Most popular',
    plans: [
      {
        name: 'Clarity session',
        periodLabel: 'per session',
        perks: [
          'One 90-minute coaching session',
          'A written action plan afterwards',
          'Ideal before a big decision',
        ],
        action: 'Book a clarity session',
      },
      {
        name: 'Leadership accelerator',
        periodLabel: 'for three months',
        perks: [
          'Twelve one-to-one sessions',
          'A 360-degree feedback review',
          'Message support between sessions',
          'A personal leadership plan',
        ],
        action: 'Apply for the accelerator',
      },
      {
        name: 'Team workshop',
        periodLabel: 'per day',
        perks: [
          'A full-day workshop for up to 20 people',
          "Designed around your team's challenges",
          'A follow-up session a month later',
        ],
        action: 'Plan a team workshop',
      },
    ] as PlanCopy[],
  },
  method: {
    eyebrow: 'Method',
    heading: 'How coaching with me works',
    body: 'A clear structure, so every session builds on the last and you can see your own progress.',
    steps: [
      {
        title: 'Discovery call',
        body: 'Thirty minutes on where you are, where you want to be and whether we are a good fit.',
        meta: 'Free',
      },
      {
        title: 'Assessment',
        body: 'A 360-degree review with your manager and team, and a clear picture of your strengths.',
        meta: 'Weeks 1–2',
      },
      {
        title: 'Coaching sprints',
        body: 'Fortnightly sessions on real situations from your work, with practice in between.',
        meta: 'Weeks 3–10',
      },
      {
        title: 'Review and plan',
        body: 'We measure the change, then write the plan that keeps you growing on your own.',
        meta: 'Weeks 11–12',
      },
    ],
  },
  quotes: {
    eyebrow: 'Client stories',
    heading: 'In their own words',
    items: [
      {
        quote:
          "Sara helped me move from managing tasks to leading people. My team's engagement score rose by thirty points in a year.",
        author: 'Fatima Al Zarooni',
        role: 'Head of operations',
        company: 'Gulf Crescent Bank',
      },
      {
        quote:
          'The accelerator gave me the confidence to ask for the promotion, and the plan to deserve it.',
        author: 'Omar Barakat',
        role: 'Engineering director',
        company: 'Sanad Digital',
      },
      {
        quote:
          'Hers was the first workshop my team asked to repeat: practical, honest and never generic.',
        author: 'Dr. Layla Hamdan',
        role: 'Medical director',
        company: 'Noor Health',
      },
      {
        quote:
          'As a founder, I needed someone who would tell me the truth. Sara did, kindly and clearly.',
        author: 'Yousef Al Marri',
        role: 'Founder and CEO',
        company: 'Waha Hospitality',
      },
    ],
  },
  insights: {
    eyebrow: 'Insights',
    heading: 'Notes on leading well',
    body: 'Short, practical articles for managers, drawn from real coaching conversations.',
    actionLabel: 'Read the article',
    posts: [
      {
        title: 'Your first 90 days as a new manager',
        excerpt:
          'What to start, and what to stop, in your first three months leading the team you used to be part of.',
        category: 'New managers',
        publishedLabel: '2 October 2026',
        readingTime: '6 min read',
      },
      {
        title: 'How to give feedback people act on',
        excerpt:
          'A simple four-part structure that makes difficult conversations shorter, kinder and far more useful.',
        category: 'Communication',
        publishedLabel: '18 September 2026',
        readingTime: '5 min read',
      },
      {
        title: 'Leading across cultures in a Gulf team',
        excerpt:
          'Teams in the region often span twenty nationalities. Here is what changes when you lead them well.',
        category: 'Teams',
        publishedLabel: '4 September 2026',
        readingTime: '7 min read',
      },
    ] as Post[],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions before we start',
    items: [
      {
        question: 'Do you coach online or in person?',
        answer:
          'Both. Most clients meet me online, and clients in Dubai can choose sessions in person at my office in DIFC.',
      },
      {
        question: 'Is coaching confidential?',
        answer:
          'Completely. What we discuss stays between us, even when your company pays for the programme.',
      },
      {
        question: 'Can my company pay for coaching?',
        answer:
          'Yes. Many clients are sponsored by their employer. I send a proposal and invoice your company directly.',
      },
      {
        question: 'How is coaching different from training?',
        answer:
          'Training teaches a group the same skills. Coaching starts from your situation, your team and your goals.',
      },
      {
        question: 'What if we are not a good fit?',
        answer:
          'That is what the free discovery call is for. If I am not the right coach for you, I will recommend someone who is.',
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    heading: 'Start with a free discovery call',
    body: 'Tell me a little about your role and what you would like to change. I reply personally within two working days.',
    address: 'Gate Village, DIFC, Dubai',
    availability: 'Sessions Sunday to Thursday, 8:00 to 18:00 Gulf time',
    formTitle: 'Book your discovery call',
    formBody: 'Thirty minutes, free and with no obligation.',
    nameLabel: 'Your name',
    emailLabel: 'Email address',
    messageLabel: 'What would you like to work on?',
    submitLabel: 'Request my call',
  },
  footer: {
    tagline: 'Leadership and career coaching for managers and founders across the Gulf.',
    columns: [
      {
        title: 'Work with me',
        links: [
          { label: 'Coaching programmes', href: '#programmes' },
          { label: 'Team workshops', href: '#programmes' },
          { label: 'Speaking', href: '#about' },
        ],
      },
      {
        title: 'Read',
        links: [
          { label: 'Insights', href: '#insights' },
          { label: 'Client stories', href: '#quotes' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Email me', href: 'mailto:hello@example.com' },
          { label: 'Call me', href: 'tel:+971505550172' },
          { label: 'Book a discovery call', href: '#contact' },
        ],
      },
    ],
  },
};

export type PersonalBrandCopy = typeof EN;
