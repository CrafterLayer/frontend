import type { NavLink } from '../../build';
import type { PersonCopy } from '../../sections';

export interface Course {
  readonly name: string;
  /** "length · schedule · level · what you build": four parts, always. */
  readonly description: string;
  readonly badge?: string;
}

/* The English copy of the online academy; ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Madar Academy',
  nav: [
    { label: 'Courses', href: '#courses' },
    { label: 'How it works', href: '#how' },
    { label: 'Mentors', href: '#mentors' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Apply now', href: '#apply' },
  hero: {
    eyebrow: 'Live online courses · Amman and online',
    heading: 'Learn the skills employers hire for, live with working mentors',
    body: 'Small evening classes in software, design and data, taught live by people who do the job every day. Build a real portfolio and graduate ready to apply.',
    trustLine: '12,400 graduates · Classes in Arabic and English · Pay in monthly instalments',
    primary: 'Browse courses',
    secondary: 'Book a free trial class',
  },
  logos: {
    eyebrow: 'Where graduates work',
    heading: 'Our graduates now build products at companies across the region',
    items: [
      { name: 'Rawaj Commerce', descriptor: 'E-commerce' },
      { name: 'Nuqta Pay', descriptor: 'Payments' },
      { name: 'Wasla', descriptor: 'Logistics' },
      { name: 'Shifa Digital', descriptor: 'Digital health' },
      { name: 'Bina Studio', descriptor: 'Product design' },
      { name: 'Daleel Maps', descriptor: 'Mobility' },
    ],
  },
  courses: {
    eyebrow: 'Courses',
    heading: 'Courses that start this term',
    body: 'Every course is taught live to groups of 20 at most, with recordings, a weekly mentor review and a final project. Prices in Jordanian dinars, payable in instalments.',
    actionLabel: 'View syllabus',
    ratingPrefix: 'Student rating',
    ratingSuffix: 'of 5',
    reviewCountLabel: 'graduate reviews',
    items: [
      {
        name: 'Full-stack web development',
        description: '16 weeks · Evenings, live · Beginner friendly · JavaScript, React and Node',
        badge: 'Most popular',
      },
      {
        name: 'UX and UI design',
        description:
          '12 weeks · Evenings, live · Beginner friendly · Research, wireframes and prototypes',
      },
      {
        name: 'Data analysis with Python',
        description:
          '10 weeks · Weekends, live · Some spreadsheet experience · From raw data to dashboards',
        badge: 'Early-bird price',
      },
      {
        name: 'Mobile app development',
        description:
          '14 weeks · Evenings, live · Some coding experience · Publish an app for iOS and Android',
      },
      {
        name: 'Digital marketing',
        description:
          '8 weeks · Evenings, live · Beginner friendly · Campaigns, analytics and content',
      },
      {
        name: 'Financial modelling',
        description:
          '6 weeks · Weekends, live · Finance background · Budgets, forecasts and valuation',
        badge: 'Starts soon',
      },
    ] as Course[],
  },
  how: {
    eyebrow: 'Your learning path',
    heading: 'From your first class to your first job offer',
    body: 'Every course follows the same four stages, with a mentor checking your work at each one.',
    steps: [
      {
        title: 'Try a class for free',
        body: 'Join any live lesson this week, meet the mentor and see whether the pace suits you.',
        meta: 'Before you enrol',
      },
      {
        title: 'Learn live, in small groups',
        body: 'Two or three evening classes a week, with recordings and exercises in between.',
        meta: 'Weeks 1–10',
      },
      {
        title: 'Build a real project',
        body: 'Work on a brief from a partner company and present it to a panel of mentors.',
        meta: 'Final weeks',
      },
      {
        title: 'Get career support',
        body: 'Portfolio and CV reviews, mock interviews and introductions to hiring partners.',
        meta: 'After graduation',
      },
    ],
  },
  outcomes: {
    eyebrow: 'Outcomes',
    heading: 'Results our graduates are proud of',
    body: 'Measured six months after graduation for the 2024 and 2025 cohorts, and checked by an independent auditor.',
    items: [
      {
        value: '87%',
        label: 'Working in their field within six months',
        detail: 'Of graduates who looked for a job',
      },
      { value: '12,400', label: 'Graduates since 2016', detail: 'From 31 cities' },
      { value: '4.8/5', label: 'Average course rating', detail: 'From 9,600 verified reviews' },
      { value: '140', label: 'Hiring partners', detail: 'Who interview our graduates first' },
    ],
  },
  mentors: {
    eyebrow: 'Mentors',
    heading: 'Taught by people who do the work every day',
    body: 'Every mentor works in the field they teach and reviews your projects with you one to one.',
    profileLabel: 'Meet the mentor',
    members: [
      {
        name: 'Omar Haddad',
        role: 'Lead mentor, web development',
        bio: 'Senior engineer at a regional payments company who has taught more than 900 students to code.',
      },
      {
        name: 'Dana Khoury',
        role: 'Mentor, UX and UI design',
        bio: 'Product designer for banking and health apps, with a soft spot for accessible design.',
      },
      {
        name: 'Yazan Al-Tamimi',
        role: 'Mentor, data analysis',
        bio: 'Data lead at a logistics start-up who turns messy spreadsheets into clear decisions.',
      },
      {
        name: 'Rania Saleh',
        role: 'Career coach',
        bio: 'A former recruiter who has helped hundreds of graduates prepare portfolios and interviews.',
      },
    ] as PersonCopy[],
  },
  quotes: {
    eyebrow: 'Graduates',
    heading: 'What our graduates say',
    items: [
      {
        quote:
          'I was teaching English and had never written a line of code. Sixteen weeks later I had three projects in my portfolio and two job offers.',
        author: 'Lina Abu Zaid',
        role: 'Front-end developer',
        company: 'Nuqta Pay',
      },
      {
        quote:
          'The mentors answered every question, even at eleven at night before a deadline. It felt like a team, not a course.',
        author: 'Hamza Odeh',
        role: 'UX designer',
        company: 'Bina Studio',
      },
      {
        quote:
          'I studied data analysis at weekends while working full time. My manager noticed the dashboards I built and promoted me.',
        author: 'Sara Al-Masri',
        role: 'Data analyst',
        company: 'Wasla',
      },
      {
        quote:
          'Paying in instalments made it possible. The career team rewrote my CV with me and set up my first interview.',
        author: 'Khaled Jaber',
        role: 'Mobile developer',
        company: 'Shifa Digital',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions to ask before you apply',
    items: [
      {
        question: 'Do I need any experience?',
        answer:
          'Not for most courses. Each one starts from the basics, and a short free assessment places you in the right group.',
      },
      {
        question: 'How much time do I need each week?',
        answer:
          'Plan for eight to ten hours: two or three live classes in the evening or at the weekend, plus practice.',
      },
      {
        question: 'Can I pay in instalments?',
        answer:
          'Yes. Split the fee into up to six monthly payments with no interest, or save 10% when you pay in full.',
      },
      {
        question: 'What happens if I miss a class?',
        answer:
          'Every class is recorded and shared the same night, and your mentor can go over anything you missed.',
      },
      {
        question: 'Will I get a certificate?',
        answer:
          'Yes. Graduates who complete the final project receive a certificate recognised by our 140 hiring partners.',
      },
      {
        question: 'Do you train company teams?',
        answer:
          'We run private cohorts for companies, with content adapted to your tools and goals. Ask us for a proposal.',
      },
    ],
  },
  apply: {
    eyebrow: 'Admissions',
    heading: 'Talk to an admissions adviser',
    body: 'Tell us which course interests you and when you can study. An adviser calls you within one working day to answer your questions and book a free trial class.',
    fields: {
      name: 'Full name',
      phone: 'Mobile number',
      email: 'Email',
      course: 'Course',
      start: 'When would you like to start?',
      starts: ['The next cohort, in January', 'The spring cohort, in March', 'I am not sure yet'],
      notes: 'Anything you would like us to know?',
      consent: 'I agree to be contacted about my application.',
    },
    submitLabel: 'Request a call back',
    footerNote: 'We use your details only to help with your application.',
    successHint: 'Thank you. An adviser will call you within one working day.',
  },
  footer: {
    tagline: 'Live courses in software, design and data, in Amman and online.',
    columns: [
      {
        title: 'Courses',
        links: [
          { label: 'Web development', href: '#courses' },
          { label: 'UX and UI design', href: '#courses' },
          { label: 'Data analysis', href: '#courses' },
          { label: 'All courses', href: '#courses' },
        ],
      },
      {
        title: 'Academy',
        links: [
          { label: 'How it works', href: '#how' },
          { label: 'Mentors', href: '#mentors' },
          { label: 'For companies', href: '#apply' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call admissions', href: 'tel:+96265509090' },
          { label: 'Email us', href: 'mailto:admissions@example.com' },
          { label: 'Book a trial class', href: '#apply' },
        ],
      },
    ],
  },
};

export type EducationCopy = typeof EN;
