import type { NavLink } from '../../build';

export const PHONE_HREF = 'tel:+966115124400';

/* The English copy of clinic; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Ibtisama Clinics',
  nav: [
    { label: 'Services', href: '#services' },
    { label: 'Doctors', href: '#doctors' },
    { label: 'Insurance', href: '#faq' },
    { label: 'Book', href: '#book' },
  ] as NavLink[],
  headerCta: { label: 'Book now', href: '#book' },
  hero: {
    eyebrow: 'Family and cosmetic dentistry · Riyadh, Al Olaya',
    heading: 'Gentle dental care for the whole family',
    body: 'Check-ups, braces, implants and whitening under one roof, with dentists who explain every step before they begin.',
    trustLine: 'Saturday to Thursday · Most insurance plans accepted · Same-week appointments',
    primary: 'Book an appointment',
    secondary: 'Call the clinic',
  },
  services: {
    eyebrow: 'Our services',
    heading: 'Everything your smile needs, in one clinic',
    body: "From a child's first visit to a full smile makeover, every treatment is planned with you and priced before it starts.",
    items: [
      {
        kicker: 'Prevention',
        title: 'Check-ups and cleaning',
        body: 'A thorough exam, digital X-rays and a professional clean in one relaxed visit.',
      },
      {
        kicker: 'Children',
        title: "Children's dentistry",
        body: 'Patient, playful care that helps children feel safe in the dental chair.',
      },
      {
        kicker: 'Orthodontics',
        title: 'Braces and clear aligners',
        body: 'Straighter teeth with metal, ceramic or clear aligners, planned from a 3D scan.',
      },
      {
        kicker: 'Cosmetic',
        title: 'Whitening and veneers',
        body: 'A brighter, natural-looking smile with in-clinic whitening or porcelain veneers.',
      },
      {
        kicker: 'Restorative',
        title: 'Implants and crowns',
        body: 'Replace missing teeth with implants and crowns that look and feel like your own.',
      },
      {
        kicker: 'Urgent care',
        title: 'Same-day emergencies',
        body: 'Toothache, a broken tooth or swelling? Call before noon and we will see you today.',
      },
    ],
  },
  steps: {
    eyebrow: 'How booking works',
    heading: 'Book your visit in three easy steps',
    body: 'No waiting on hold: choose a time online and we take care of the rest.',
    items: [
      {
        title: 'Choose a time',
        body: 'Pick the service and a time that suits you, morning or evening.',
        meta: 'Two minutes',
      },
      {
        title: 'Share your details',
        body: 'Tell us about any pain, earlier treatment and your insurance so we can prepare.',
        meta: 'Before you arrive',
      },
      {
        title: 'Meet your dentist',
        body: 'A full check and a clear treatment plan with prices, before anything begins.',
        meta: 'First visit, 45 min',
      },
    ],
  },
  doctors: {
    eyebrow: 'Our doctors',
    heading: 'Specialists who take time to listen',
    body: 'Every dentist at Ibtisama is board-certified and trained to care for nervous patients.',
    profileLabel: 'Read profile',
    members: [
      {
        name: 'Dr. Faisal Al-Harbi',
        role: 'Orthodontist',
        bio: 'Braces and clear aligners for teenagers and adults, with twelve years of practice in Riyadh.',
      },
      {
        name: 'Dr. Noura Al-Qahtani',
        role: 'Paediatric dentist',
        bio: 'Makes first visits calm and fun, and teaches children to look after their own teeth.',
      },
      {
        name: 'Dr. Khalid Al-Shehri',
        role: 'Implant surgeon',
        bio: 'Specialist in implants and full-mouth restoration, trained in Riyadh and Toronto.',
      },
      {
        name: 'Dr. Reem Al-Otaibi',
        role: 'Cosmetic dentist',
        bio: 'Whitening, veneers and smile design with a natural, understated finish.',
      },
    ],
  },
  stats: {
    eyebrow: 'Trusted in Riyadh',
    heading: 'Fifteen years of calm, careful dentistry',
    body: 'Figures from our patient records and verified online reviews, updated every quarter.',
    items: [
      { value: '15', label: 'Years caring for Riyadh families', detail: 'Founded in 2011' },
      { value: '28,000+', label: 'Patients treated', detail: 'Children and adults' },
      { value: '4.9/5', label: 'Average patient rating', detail: 'From 2,300 verified reviews' },
      { value: '9', label: 'Specialist dentists', detail: 'All board-certified' },
    ],
  },
  quotes: {
    eyebrow: 'Patients',
    heading: 'Kind words from our patients',
    items: [
      {
        quote:
          'My son used to cry at every dental visit. Dr. Noura turned it into a game, and now he asks when we can go back.',
        author: 'Abeer Al-Dosari',
        role: 'Mother of two',
      },
      {
        quote:
          'They showed me the treatment plan and the price before starting. No surprises, and the implant feels completely natural.',
        author: 'Mohammed Al-Ghamdi',
        role: 'Implant patient',
      },
      {
        quote:
          'I booked online late at night and was seen the next morning for a broken tooth. Fast and very professional.',
        author: 'Hessa Al-Mutlaq',
        role: 'Emergency visit',
      },
      {
        quote:
          'Eight months of clear aligners and nobody at work noticed. The result is better than I hoped for.',
        author: 'Turki Al-Anazi',
        role: 'Aligner patient',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions patients ask us',
    items: [
      {
        question: 'Which insurance plans do you accept?',
        answer:
          'We work directly with most major insurers in Saudi Arabia. Send us a photo of your card before your visit and we confirm your cover the same day.',
      },
      {
        question: 'What are your opening hours?',
        answer:
          'Saturday to Thursday, 9:00 to 21:00. Emergency appointments are available every day until noon.',
      },
      {
        question: 'When should my child first see a dentist?',
        answer:
          'By their first birthday, or when the first tooth appears. Early visits keep problems small and build good habits.',
      },
      {
        question: 'Do you offer payment plans?',
        answer:
          'Yes. Orthodontic and implant treatment can be split into interest-free monthly payments.',
      },
      {
        question: 'Will the treatment hurt?',
        answer:
          'We use modern numbing techniques and pause whenever you need. Tell us if you feel nervous and we will go at your pace.',
      },
      {
        question: 'How long is the first visit?',
        answer:
          'About 45 minutes, including an exam, X-rays if needed and a written plan with prices.',
      },
    ],
  },
  form: {
    eyebrow: 'Appointments',
    heading: 'Book an appointment',
    body: 'Choose a service and a preferred time. Our team confirms by phone or message within two working hours.',
    fields: {
      name: 'Full name',
      phone: 'Mobile number',
      email: 'Email',
      service: 'Service',
      services: [
        'Check-up and cleaning',
        "Children's dentistry",
        'Braces and aligners',
        'Whitening and veneers',
        'Implants and crowns',
        'Emergency',
      ],
      date: 'Preferred date',
      time: 'Preferred time',
      times: ['Morning (9:00–12:00)', 'Afternoon (12:00–17:00)', 'Evening (17:00–21:00)'],
      notes: 'Anything we should know?',
      consent: 'I agree to be contacted about this appointment.',
    },
    submitLabel: 'Request appointment',
    footerNote: 'Your details are used only to arrange your visit.',
    successHint: 'Thank you. We will confirm your appointment within two working hours.',
  },
  footer: {
    tagline: 'Family and cosmetic dentistry in Al Olaya, Riyadh.',
    columns: [
      {
        title: 'Services',
        links: [
          { label: 'Check-ups', href: '#services' },
          { label: 'Orthodontics', href: '#services' },
          { label: 'Implants', href: '#services' },
          { label: 'Whitening', href: '#services' },
        ],
      },
      {
        title: 'Clinic',
        links: [
          { label: 'Our doctors', href: '#doctors' },
          { label: 'Insurance', href: '#faq' },
          { label: 'Book a visit', href: '#book' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'Call us', href: PHONE_HREF },
          { label: 'Email us', href: 'mailto:care@example.com' },
          { label: 'Directions', href: '#map' },
        ],
      },
    ],
  },
};

export type ClinicCopy = typeof EN;
