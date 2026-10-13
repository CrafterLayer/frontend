import type { NavLink } from '../../build';
import type { PersonCopy } from '../../sections';

/* The English copy of the law firm; ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Al Hashemi Advocates',
  nav: [
    { label: 'Practice areas', href: '#practice' },
    { label: 'Results', href: '#results' },
    { label: 'Attorneys', href: '#attorneys' },
    { label: 'FAQ', href: '#faq' },
  ] as NavLink[],
  headerCta: { label: 'Free consultation', href: '#consultation' },
  hero: {
    eyebrow: 'Advocates and legal consultants · Dubai · Abu Dhabi',
    heading: 'Strong representation when the outcome matters most',
    body: 'For more than twenty-five years we have represented companies and families before the UAE courts and in arbitration, with partners who handle each case themselves.',
    trustLine:
      'Rights of audience before all UAE courts · Arabic and English · Strictly confidential',
    primary: 'Book a confidential consultation',
    secondary: 'View practice areas',
  },
  about: {
    eyebrow: 'The firm',
    heading: 'A litigation firm that prepares every case as if it will go to trial',
    body: 'Founded in Dubai in 1998, Al Hashemi Advocates has grown to 34 lawyers without losing the habits of a small practice: a partner leads every matter, you get a straight answer about your chances, and you know what each step will cost before we take it.',
    highlights: [
      {
        title: 'Partner-led cases',
        body: 'The partner you meet at the first consultation stays responsible for your case until it closes.',
      },
      {
        title: 'Clear, fixed fees',
        body: 'A written fee proposal before we start, with fixed fees for most stages of a case.',
      },
      {
        title: 'Arabic and English',
        body: 'Pleadings drafted in Arabic for the courts, with English summaries for international clients.',
      },
      {
        title: 'Offices in two emirates',
        body: 'Teams in Dubai and Abu Dhabi, appearing before the federal and the local courts.',
      },
    ],
    link: 'Meet the partners',
  },
  practice: {
    eyebrow: 'Practice areas',
    heading: 'Where we can help',
    body: 'Six practice groups, each led by a partner with at least fifteen years before the UAE courts.',
    items: [
      {
        kicker: 'Business',
        title: 'Commercial litigation',
        body: 'Contract, partnership and shareholder disputes, from urgent injunctions to the Court of Cassation.',
      },
      {
        kicker: 'Arbitration',
        title: 'Arbitration and mediation',
        body: 'Representation in local and international arbitration, and enforcement of awards in the UAE.',
      },
      {
        kicker: 'Property',
        title: 'Real estate disputes',
        body: 'Delayed off-plan projects, service charges, tenancy cases and claims against developers.',
      },
      {
        kicker: 'Employment',
        title: 'Labour and employment',
        body: 'Claims for unpaid wages and end-of-service benefits, and advice to employers on terminations.',
      },
      {
        kicker: 'Family',
        title: 'Family and inheritance',
        body: 'Divorce, custody and the division of estates, handled discreetly and with care for the whole family.',
      },
      {
        kicker: 'Criminal',
        title: 'Criminal defence',
        body: 'Defence in cheque, fraud and cybercrime cases, from the first police summons to the final appeal.',
      },
    ],
  },
  results: {
    eyebrow: 'Case results',
    heading: 'Selected results for our clients',
    body: "A few recent outcomes, shared with our clients' permission. Every case is different, and past results do not guarantee a similar outcome.",
    items: [
      {
        kicker: 'Commercial litigation',
        title: 'Judgment upheld for a construction contractor',
        body: 'Recovered unpaid certified works and delay damages from a developer after a three-year dispute, upheld on appeal.',
        metric: 'AED 42 million',
      },
      {
        kicker: 'Arbitration',
        title: 'Award enforced against an overseas buyer',
        body: 'An international arbitration award recognised and enforced in Dubai within five months.',
        metric: 'AED 18.6 million',
      },
      {
        kicker: 'Real estate',
        title: 'Deposits returned to off-plan buyers',
        body: 'A group claim that returned every deposit after the project was cancelled.',
        metric: '140 families',
      },
      {
        kicker: 'Employment',
        title: 'End-of-service claim won in full',
        body: 'A senior engineer recovered every dirham of unpaid salary, benefits and notice pay.',
        metric: 'Won in 4 months',
      },
    ],
  },
  approach: {
    eyebrow: 'How we work',
    heading: 'What happens after you call us',
    body: 'A clear path from the first conversation to the final judgment, with a named partner at every step.',
    steps: [
      {
        title: 'Confidential consultation',
        body: 'Forty-five minutes with a partner to understand what happened and what you need.',
        meta: 'Within 48 hours',
      },
      {
        title: 'Case assessment',
        body: 'A written view of your position, your options and the likely cost of each one.',
        meta: 'Within a week',
      },
      {
        title: 'Representation',
        body: 'We draft, file and argue your case, and report on every hearing the same day.',
        meta: 'Throughout the case',
      },
      {
        title: 'Resolution and enforcement',
        body: 'A settlement, judgment or award, then the steps to collect what you are owed.',
        meta: 'Until you are paid',
      },
    ],
  },
  attorneys: {
    eyebrow: 'Attorneys',
    heading: 'The partners who will handle your case',
    body: 'Licensed advocates with rights of audience before the federal and the local courts.',
    profileLabel: 'Read full profile',
    members: [
      {
        name: 'Khalid Al Hashemi',
        role: 'Founding Partner, commercial litigation',
        bio: 'Has argued more than 600 commercial cases since founding the firm in 1998, including before the Federal Supreme Court.',
      },
      {
        name: 'Mariam Al Suwaidi',
        role: 'Partner, family and inheritance',
        bio: 'Leads family and estate matters with discretion, and mediates between relatives wherever a settlement is possible.',
      },
      {
        name: 'Tarek Mansour',
        role: 'Partner, arbitration',
        bio: 'A fellow of an international arbitration institute, acting in construction and energy disputes across the region.',
      },
      {
        name: 'Nadia Haddad',
        role: 'Partner, employment and real estate',
        bio: "Represents employees, employers and homeowners, and leads the firm's group claims against developers.",
      },
    ] as PersonCopy[],
  },
  quotes: {
    eyebrow: 'Client words',
    heading: 'Trusted when it mattered',
    items: [
      {
        quote:
          'They told us honestly that our case was strong but slow, and they were right on both counts. The judgment covered every dirham.',
        author: 'Managing director',
        role: 'Construction company, Dubai',
      },
      {
        quote:
          'Mariam handled my divorce and custody case with real kindness. My children were protected at every step.',
        author: 'A mother of three',
        role: 'Family case, Abu Dhabi',
      },
      {
        quote:
          'When our buyer refused to pay, the firm enforced the arbitration award in months, not years.',
        author: 'Finance director',
        role: 'Trading company, Dubai',
      },
      {
        quote:
          'I was owed eleven months of salary. Nadia took my case on a fixed fee and won it in full.',
        author: 'Senior engineer',
        role: 'Employment claim',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions clients ask before they call',
    items: [
      {
        question: 'Is the first consultation free?',
        answer:
          'The first 45-minute consultation is free for new clients. If we take the case, you receive a written fee proposal before any work begins.',
      },
      {
        question: 'How are your fees structured?',
        answer:
          'Most stages of a case have a fixed fee. For large commercial claims we can agree a lower fee plus a share of the amount recovered.',
      },
      {
        question: 'Is what I tell you confidential?',
        answer:
          'Yes. Everything you share is protected by legal privilege from the first conversation, whether or not you instruct us.',
      },
      {
        question: 'Can you take a case outside Dubai?',
        answer:
          'Yes. We appear before the federal courts and the courts of Dubai and Abu Dhabi, and work with trusted firms elsewhere in the region.',
      },
      {
        question: 'Do you work in English?',
        answer:
          'Pleadings before UAE courts are filed in Arabic, but we meet you, write to you and report in English or Arabic, as you prefer.',
      },
      {
        question: 'How long will my case take?',
        answer:
          'A first-instance judgment usually takes four to eight months. Your case assessment includes a realistic timetable.',
      },
    ],
  },
  consultation: {
    eyebrow: 'Consultation',
    heading: 'Request a confidential consultation',
    body: 'Tell us briefly what has happened. A partner reads every request and calls you back within one working day, and sending it creates no obligation.',
    fields: {
      name: 'Full name',
      phone: 'Mobile number',
      email: 'Email',
      matter: 'Type of matter',
      matters: [
        'Commercial dispute',
        'Arbitration',
        'Real estate',
        'Employment',
        'Family or inheritance',
        'Criminal defence',
      ],
      contact: 'How should we contact you?',
      contacts: ['Phone call', 'Email', 'WhatsApp message'],
      summary: 'What happened? Please do not attach confidential documents yet.',
      consent: 'I agree to be contacted about this enquiry.',
    },
    submitLabel: 'Send my request',
    footerNote: 'Your request is read only by our partners and is protected by legal privilege.',
    successHint: 'Thank you. A partner will call you within one working day.',
  },
  footer: {
    tagline: 'Advocates and legal consultants in Dubai and Abu Dhabi since 1998.',
    legal: '© 2026 Al Hashemi Advocates. Past results do not guarantee a similar outcome.',
    columns: [
      {
        title: 'Practice areas',
        links: [
          { label: 'Commercial litigation', href: '#practice' },
          { label: 'Arbitration', href: '#practice' },
          { label: 'Real estate', href: '#practice' },
          { label: 'Family', href: '#practice' },
        ],
      },
      {
        title: 'Firm',
        links: [
          { label: 'Case results', href: '#results' },
          { label: 'Attorneys', href: '#attorneys' },
          { label: 'FAQ', href: '#faq' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call the firm', href: 'tel:+97143300400' },
          { label: 'Email us', href: 'mailto:counsel@example.com' },
          { label: 'Book a consultation', href: '#consultation' },
        ],
      },
    ],
  },
};

export type LawFirmCopy = typeof EN;
