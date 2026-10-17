import type { NavLink } from '../../build';
import type { PlanCopy } from '../../sections';

/* The English copy of the charity; ./copy-ar.ts has the same shape. */
export const EN = {
  announcement: {
    label: 'Ramadan appeal',
    message: "This Ramadan, 20 dinars puts a food basket on a family's table for a whole week.",
    linkLabel: 'Give a food basket',
  },
  brand: 'Ghiras Foundation',
  nav: [
    { label: 'Our work', href: '#work' },
    { label: 'Impact', href: '#impact' },
    { label: 'Stories', href: '#stories' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Donate', href: '#donate' },
  hero: {
    eyebrow: 'Registered charity · Amman, Jordan · Since 2009',
    heading: 'Turn your giving into food, schooling and work for families',
    body: 'Ghiras supports families across Jordan with food baskets, school sponsorships and small-business grants, delivered by volunteers who know each family by name.',
    trustLine:
      'Licensed by the Ministry of Social Development · Audited every year · Zakat paid to families in full',
    primary: 'Donate now',
    secondary: 'See where it goes',
  },
  impact: {
    eyebrow: 'Our impact in 2025',
    heading: 'Every dinar counted, every result reported',
    body: 'Figures from our 2025 annual report, reviewed by an independent auditor and published in full.',
    items: [
      { value: '48,000', label: 'Food baskets delivered', detail: 'To families in 9 governorates' },
      { value: '1,350', label: 'Students sponsored', detail: 'From first grade to university' },
      { value: '62,000', label: 'Olive trees planted', detail: 'With 410 farming families' },
      {
        value: '92%',
        label: 'Of every dinar spent on programmes',
        detail: 'The rest covers audits and administration',
      },
    ],
  },
  work: {
    eyebrow: 'Our work',
    heading: 'Four programmes, one goal: families who can stand on their own',
    body: 'We start with what a family needs today and stay until they no longer need us.',
    items: [
      {
        kicker: 'Food security',
        title: 'Food baskets and hot meals',
        body: 'Monthly baskets for families in need, and hot iftar meals throughout Ramadan.',
      },
      {
        kicker: 'Education',
        title: 'School and university sponsorship',
        body: 'Fees, books, uniforms and transport for children who would otherwise leave school.',
      },
      {
        kicker: 'Livelihoods',
        title: 'Olive trees and small businesses',
        body: 'Seedlings, training and small grants that turn a plot of land or a skill into an income.',
      },
      {
        kicker: 'Health',
        title: 'Mobile medical days',
        body: 'Free check-ups and medicines in villages far from a hospital, run with volunteer doctors.',
      },
    ],
  },
  how: {
    eyebrow: 'Where your money goes',
    heading: "From your donation to a family's door",
    body: 'You can follow every gift from the moment you make it to the moment it arrives.',
    steps: [
      {
        title: 'You give',
        body: 'Choose a programme or give where the need is greatest, once or every month.',
        meta: 'Today',
      },
      {
        title: 'We deliver',
        body: 'Volunteers deliver baskets, pay school fees or plant trees in the next distribution round.',
        meta: 'Within 30 days',
      },
      {
        title: 'You see the result',
        body: 'A short report with photos and figures, sent to you by email or WhatsApp.',
        meta: 'After delivery',
      },
    ],
  },
  donate: {
    eyebrow: 'Ways to give',
    heading: 'Choose what your gift does',
    body: 'Amounts in Jordanian dinars. Every gift gets an official receipt, and Zakat is kept apart and paid to eligible families in full.',
    badge: 'Changes a whole year',
    plans: [
      {
        name: 'Feed a family',
        periodLabel: 'one-time',
        perks: [
          'A food basket for a family of five',
          'Rice, lentils, oil, sugar and dates',
          'Delivered within 30 days',
        ],
        action: 'Give a basket',
      },
      {
        name: 'Sponsor a student',
        periodLabel: 'per month',
        perks: [
          'School fees, books and uniform',
          'Two progress reports a year',
          'A letter from your student',
        ],
        action: 'Become a sponsor',
      },
      {
        name: 'Plant olive trees',
        periodLabel: 'one-time',
        perks: [
          'Ten olive seedlings for a farming family',
          "Planted in your name or a loved one's",
          'A photo of your trees once planted',
        ],
        action: 'Plant ten trees',
      },
    ] as PlanCopy[],
  },
  stories: {
    eyebrow: 'From the field',
    heading: 'What your support looked like this year',
    body: 'Photos from our distribution rounds, olive groves and medical days across Jordan.',
    linkLabel: 'View the full photo',
    captions: [
      'Volunteers handing out food on a distribution day',
      'Olive groves planted with farming families in Ajloun',
      'Dates for the Ramadan food baskets',
      'A volunteer doctor at a mobile medical day',
      'Spring in a young olive grove',
      "Recording a patient's details at a medical day",
    ],
  },
  quotes: {
    eyebrow: 'Voices',
    heading: 'Donors, volunteers and families',
    items: [
      {
        quote:
          'I sponsor two students every month. Their report cards arrive with a short letter, and it is the best email I get all term.',
        author: 'Rana Kawar',
        role: 'Monthly donor since 2019',
      },
      {
        quote:
          'The basket came in the first week of Ramadan, when we had nothing left. The volunteers treated us like family.',
        author: 'Umm Ahmad',
        role: 'Mother of five, Zarqa',
      },
      {
        quote:
          'I volunteer at the medical days with colleagues from my clinic. The organisation is excellent, and patients are treated with dignity.',
        author: 'Dr. Suha Odeh',
        role: 'Volunteer doctor',
      },
      {
        quote: 'The twenty olive trees from Ghiras now give my family oil to sell every winter.',
        author: 'Abu Saleh',
        role: 'Farmer, Ajloun',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Giving with confidence',
    items: [
      {
        question: 'Can I pay my Zakat through Ghiras?',
        answer:
          'Yes. Zakat is kept in a separate account and paid in full to eligible families, with no administration taken from it.',
      },
      {
        question: 'Will I get a receipt?',
        answer:
          'Every donation receives an official receipt by email, and companies can request an annual statement.',
      },
      {
        question: 'How do you choose the families you help?',
        answer:
          'Social workers visit each family at home and review their situation every year, together with local committees.',
      },
      {
        question: 'Can I stop a monthly donation?',
        answer:
          'Of course. Pause or cancel from the link in any receipt, or call us and we will do it the same day.',
      },
      {
        question: 'Where can I see your accounts?',
        answer:
          'Our audited accounts and annual report are published every June and sent to anyone who asks.',
      },
      {
        question: 'How can I volunteer?',
        answer:
          'Join a distribution round, a planting day or a medical day. Sign up below and we will match you with a team.',
      },
    ],
  },
  volunteer: {
    label: 'Volunteer',
    headline: 'Give us a Saturday, plant a future',
    body: 'Join one of our planting, distribution or medical days. No experience needed: we train every volunteer and arrange transport from Amman.',
    primary: 'Join the volunteers',
    secondary: 'Give every month',
  },
  footer: {
    tagline:
      'A registered Jordanian charity supporting families with food, education and work since 2009.',
    columns: [
      {
        title: 'Programmes',
        links: [
          { label: 'Food baskets', href: '#work' },
          { label: 'Student sponsorship', href: '#work' },
          { label: 'Olive trees', href: '#work' },
          { label: 'Medical days', href: '#work' },
        ],
      },
      {
        title: 'Foundation',
        links: [
          { label: 'Our impact', href: '#impact' },
          { label: 'Annual report', href: '#impact' },
          { label: 'Volunteer', href: '#volunteer' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call us', href: 'tel:+96264612500' },
          { label: 'Email us', href: 'mailto:give@example.com' },
          { label: 'Donate', href: '#donate' },
        ],
      },
    ],
  },
};

export type NonprofitCopy = typeof EN;
