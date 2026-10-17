import type { NavLink } from '../../build';
import type { PersonCopy, PlanCopy } from '../../sections';

/* The English copy of the fitness studio; ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Azm Fitness Studio',
  nav: [
    { label: 'Programmes', href: '#programmes' },
    { label: 'Coaches', href: '#coaches' },
    { label: 'Membership', href: '#membership' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Free trial', href: '#trial' },
  hero: {
    eyebrow: 'Strength and conditioning · Al Rawdah, Jeddah',
    heading: 'Get stronger with coaches who know your name',
    body: 'Small-group classes and one-to-one coaching in a studio built for real progress: proper technique, a plan that adapts to you and no queue for the racks.',
    trustLine: 'Groups of eight at most · Women-only and men-only floors · Open 5:30 to 23:00',
    primary: 'Claim your free week',
    secondary: 'See membership plans',
  },
  numbers: {
    eyebrow: 'The studio in numbers',
    heading: 'A busy studio that still feels personal',
    body: 'Figures from our booking system over the last twelve months.',
    items: [
      { value: '1,800', label: 'Active members', detail: 'Across both floors' },
      { value: '12', label: 'Certified coaches', detail: 'Strength, rehab and nutrition' },
      { value: '42', label: 'Classes every week', detail: 'From 5:30 in the morning' },
      { value: '4.9/5', label: 'Member rating', detail: 'From 1,100 verified reviews' },
    ],
  },
  programmes: {
    eyebrow: 'Programmes',
    heading: 'Training for every goal, coached properly',
    body: 'Choose one programme or combine them. Your coach reviews the plan with you every four weeks.',
    items: [
      {
        kicker: 'One to one',
        title: 'Personal training',
        body: 'A coach and a programme built around your body, your goals and your diary, with progress measured every month.',
        metric: '3 sessions a week',
      },
      {
        kicker: 'Small group',
        title: 'Strength classes',
        body: 'Barbell and kettlebell training in groups of eight, with a technique check on every lift.',
        metric: 'Eight people at most',
      },
      {
        kicker: 'Conditioning',
        title: 'Intervals and circuits',
        body: 'Forty-five minutes of intervals that build fitness without wrecking the rest of your week.',
        metric: '45 minutes',
      },
      {
        kicker: 'Recovery',
        title: 'Mobility and recovery',
        body: 'Stretching, mobility work and sports massage, so you keep training without pain.',
        metric: 'Every evening',
      },
    ],
  },
  start: {
    eyebrow: 'Getting started',
    heading: 'Your first week, step by step',
    body: 'There is no contract to sign on day one. Train with us for a week, then decide.',
    steps: [
      {
        title: 'Book a free assessment',
        body: 'Thirty minutes with a coach to talk through your goals, injuries and how you like to train.',
        meta: 'Day 1',
      },
      {
        title: 'Get your plan',
        body: 'A written programme for your first four weeks, with the classes that fit it.',
        meta: 'Day 2',
      },
      {
        title: 'Train and track',
        body: 'Log every session in the app and watch your strength numbers climb.',
        meta: 'Every week',
      },
    ],
  },
  coaches: {
    eyebrow: 'Coaches',
    heading: 'Coaches who train you, not just watch you',
    body: 'Every coach holds an international certification and specialises in one area, so you always learn from an expert.',
    profileLabel: 'See their classes',
    members: [
      {
        name: 'Faris Al-Ghamdi',
        role: 'Head coach, strength',
        bio: 'A former national weightlifting squad member with fourteen years of coaching behind him.',
      },
      {
        name: 'Huda Bakr',
        role: "Coach, women's floor",
        bio: 'Specialises in strength training for women and in fitness before and after pregnancy.',
      },
      {
        name: 'Majed Al-Harthy',
        role: 'Coach, conditioning',
        bio: 'Runs the interval classes and prepares members for their first running races.',
      },
      {
        name: 'Lama Sindi',
        role: 'Physiotherapist',
        bio: 'Helps members train around injuries and leads the mobility and recovery programme.',
      },
    ] as PersonCopy[],
  },
  membership: {
    eyebrow: 'Membership',
    heading: 'Simple plans, no joining fee',
    body: 'Prices in Saudi riyals, VAT included. Freeze your membership for up to a month a year.',
    badge: 'Most chosen',
    plans: [
      {
        name: 'Flex',
        periodLabel: 'per month',
        perks: ['8 classes a month', 'Open gym at off-peak times', 'A body scan every quarter'],
        action: 'Start with Flex',
      },
      {
        name: 'Unlimited',
        periodLabel: 'per month',
        perks: [
          'Unlimited classes',
          'Open gym all day',
          'A monthly check-in with a coach',
          'Towel and locker included',
        ],
        action: 'Go unlimited',
      },
      {
        name: 'Personal coaching',
        periodLabel: 'per month',
        perks: [
          '12 one-to-one sessions a month',
          'A nutrition plan with weekly check-ins',
          'Unlimited classes included',
        ],
        action: 'Book a personal coach',
      },
    ] as PlanCopy[],
  },
  quotes: {
    eyebrow: 'Members',
    heading: 'Members who stayed for the results',
    items: [
      {
        quote:
          'I had never lifted a barbell. A year later I deadlift more than my body weight and my back pain has gone.',
        author: 'Reem Al-Zahrani',
        role: 'Member since 2024',
      },
      {
        quote:
          'The coaches remember your numbers and your injuries. It feels like a team, not a gym.',
        author: 'Abdullah Fallatah',
        role: 'Strength classes',
      },
      {
        quote:
          "The women-only floor made it easy to start. Huda's classes are hard, kind and never boring.",
        author: 'Nouf Al-Qurashi',
        role: "Women's floor",
      },
      {
        quote:
          'Personal training fitted around my hospital shifts, and I lost 14 kilos in six months.',
        author: 'Dr. Waleed Hamdan',
        role: 'Personal training',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Before your first session',
    items: [
      {
        question: 'Is the first week really free?',
        answer:
          'Yes. Seven days of classes and open gym, with an assessment. No card needed and nothing to cancel afterwards.',
      },
      {
        question: 'Do you have women-only training?',
        answer:
          'Yes. The upper floor is women-only all day, with its own coaches, changing rooms and entrance.',
      },
      {
        question: 'I am a complete beginner. Is that a problem?',
        answer:
          'Not at all. Most members started as beginners, and every exercise in class has an easier version.',
      },
      {
        question: 'Can I freeze my membership?',
        answer: 'You can freeze it for up to 30 days a year, for travel, illness or Ramadan.',
      },
      {
        question: 'Is there parking?',
        answer: 'Members park free inside the building, with a covered entrance to the studio.',
      },
      {
        question: 'What are your hours in Ramadan?',
        answer:
          'From 13:00 to 16:00 and from 21:00 to 2:00. The timetable is published a week before the month starts.',
      },
    ],
  },
  trial: {
    label: 'Free trial week',
    headline: 'Your first week is on us',
    body: 'Seven days of classes, open gym and a full assessment with a coach. No card, no contract and no pressure.',
    primary: 'Book my free week',
    secondary: 'Call the studio',
  },
  footer: {
    tagline: 'A strength and conditioning studio in Al Rawdah, Jeddah.',
    columns: [
      {
        title: 'Train',
        links: [
          { label: 'Personal training', href: '#programmes' },
          { label: 'Strength classes', href: '#programmes' },
          { label: 'Intervals', href: '#programmes' },
          { label: 'Mobility', href: '#programmes' },
        ],
      },
      {
        title: 'Studio',
        links: [
          { label: 'Coaches', href: '#coaches' },
          { label: 'Membership', href: '#membership' },
          { label: 'FAQ', href: '#faq' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call us', href: 'tel:+966122345600' },
          { label: 'Email us', href: 'mailto:coach@example.com' },
          { label: 'Directions', href: '#trial' },
        ],
      },
    ],
  },
};

export type FitnessCopy = typeof EN;
