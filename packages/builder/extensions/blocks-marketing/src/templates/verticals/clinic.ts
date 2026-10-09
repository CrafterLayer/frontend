import { defineTemplate, footer, header, json, photo, type NavLink } from '../build';
import type { TemplateLang } from '../types';

/*
  Dental clinic (`clinic` / `clinic-ar`) — agent-script DESIGN §B.3.

  header (Services · Doctors · Insurance · Book) → split hero with the
  treatment room → six services (fills 2 and 3 columns) → booking in three
  steps (one row of three) → four doctors with portraits → four figures →
  patient reviews (2 × 2) → FAQ with insurance and hours (2 × 3) → the
  appointment form → footer.

  «عيادات ابتسامة»: a family dental clinic in Al Olaya, Riyadh.
*/

const HERO_PHOTO = 0;
/** Doctor portraits, in member order: [topic, index]. */
const DOCTOR_PHOTOS: readonly (readonly [string, number])[] = [
  ['clinic', 1],
  ['people', 17],
  ['clinic', 2],
  ['clinic', 3],
];
const DOCTOR_HREFS = ['#doctor-faisal', '#doctor-noura', '#doctor-khalid', '#doctor-reem'];
const SERVICE_VALUES = [
  'checkup',
  'children',
  'orthodontics',
  'whitening',
  'implants',
  'emergency',
] as const;
const TIME_VALUES = ['morning', 'afternoon', 'evening'] as const;
const PHONE_HREF = 'tel:+966115124400';

const EN = {
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
        answer: 'Yes. Orthodontic and implant treatment can be split into interest-free monthly payments.',
      },
      {
        question: 'Will the treatment hurt?',
        answer:
          'We use modern numbing techniques and pause whenever you need. Tell us if you feel nervous and we will go at your pace.',
      },
      {
        question: 'How long is the first visit?',
        answer: 'About 45 minutes, including an exam, X-rays if needed and a written plan with prices.',
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

const AR: typeof EN = {
  brand: 'عيادات ابتسامة',
  nav: [
    { label: 'خدماتنا', href: '#services' },
    { label: 'أطباؤنا', href: '#doctors' },
    { label: 'التأمين', href: '#faq' },
    { label: 'الحجز', href: '#book' },
  ],
  headerCta: { label: 'احجز الآن', href: '#book' },
  hero: {
    eyebrow: 'طب أسنان العائلة والتجميل · الرياض، حي العليا',
    heading: 'رعاية لطيفة لأسنان العائلة كلها',
    body: 'فحوصات وتقويم وزراعة وتبييض تحت سقف واحد، مع أطباء يشرحون لك كل خطوة قبل أن يبدؤوا.',
    trustLine: 'من السبت إلى الخميس · نقبل معظم شركات التأمين · مواعيد خلال الأسبوع نفسه',
    primary: 'احجز موعدك',
    secondary: 'اتصل بالعيادة',
  },
  services: {
    eyebrow: 'خدماتنا',
    heading: 'كل ما تحتاجه ابتسامتك في عيادة واحدة',
    body: 'من أول زيارة لطفلك إلى تجميل الابتسامة بالكامل، نخطط كل علاج معك ونوضح تكلفته قبل البدء.',
    items: [
      {
        kicker: 'الوقاية',
        title: 'الفحص والتنظيف',
        body: 'فحص شامل وأشعة رقمية وتنظيف احترافي في زيارة واحدة مريحة.',
      },
      {
        kicker: 'الأطفال',
        title: 'طب أسنان الأطفال',
        body: 'رعاية صبورة ومرحة تجعل الطفل يشعر بالأمان على كرسي الأسنان.',
      },
      {
        kicker: 'التقويم',
        title: 'التقويم والمصففات الشفافة',
        body: 'أسنان مستقيمة بتقويم معدني أو خزفي أو مصففات شفافة، بخطة مبنية على مسح ثلاثي الأبعاد.',
      },
      {
        kicker: 'التجميل',
        title: 'التبييض والقشور الخزفية',
        body: 'ابتسامة أكثر إشراقاً وطبيعية بالتبييض في العيادة أو بالقشور الخزفية.',
      },
      {
        kicker: 'الترميم',
        title: 'الزراعة والتيجان',
        body: 'عوّض الأسنان المفقودة بزراعات وتيجان تبدو وتعمل كأسنانك الطبيعية.',
      },
      {
        kicker: 'الطوارئ',
        title: 'حالات طارئة في اليوم نفسه',
        body: 'ألم أو سن مكسور أو تورّم؟ اتصل قبل الظهر ونستقبلك اليوم.',
      },
    ],
  },
  steps: {
    eyebrow: 'طريقة الحجز',
    heading: 'احجز زيارتك في ثلاث خطوات سهلة',
    body: 'بلا انتظار على الهاتف: اختر موعدك عبر الإنترنت ونتولى نحن الباقي.',
    items: [
      {
        title: 'اختر الموعد',
        body: 'حدّد الخدمة والوقت المناسب لك، صباحاً أو مساءً.',
        meta: 'دقيقتان فقط',
      },
      {
        title: 'شاركنا بياناتك',
        body: 'أخبرنا عن أي ألم أو علاج سابق وعن تأمينك لنستعد لزيارتك.',
        meta: 'قبل وصولك',
      },
      {
        title: 'قابل طبيبك',
        body: 'فحص كامل وخطة علاج واضحة بالأسعار قبل أي إجراء.',
        meta: 'الزيارة الأولى 45 دقيقة',
      },
    ],
  },
  doctors: {
    eyebrow: 'أطباؤنا',
    heading: 'أخصائيون يمنحونك وقتاً للإصغاء',
    body: 'جميع أطباء ابتسامة حاصلون على البورد ومدرّبون على رعاية من يقلقون من علاج الأسنان.',
    profileLabel: 'الملف الشخصي',
    members: [
      {
        name: 'د. فيصل الحربي',
        role: 'أخصائي تقويم الأسنان',
        bio: 'تقويم ومصففات شفافة للمراهقين والبالغين، باثني عشر عاماً من الخبرة في الرياض.',
      },
      {
        name: 'د. نورة القحطاني',
        role: 'طبيبة أسنان الأطفال',
        bio: 'تجعل الزيارة الأولى هادئة وممتعة، وتعلّم الأطفال العناية بأسنانهم.',
      },
      {
        name: 'د. خالد الشهري',
        role: 'جرّاح زراعة الأسنان',
        bio: 'متخصص في الزراعة وترميم الفم الكامل، تدرّب في الرياض وتورنتو.',
      },
      {
        name: 'د. ريم العتيبي',
        role: 'طبيبة تجميل الأسنان',
        bio: 'تبييض وقشور خزفية وتصميم ابتسامة بلمسة طبيعية هادئة.',
      },
    ],
  },
  stats: {
    eyebrow: 'ثقة أهل الرياض',
    heading: 'خمسة عشر عاماً من طب أسنان هادئ ودقيق',
    body: 'أرقام من سجلات مرضانا وتقييمات موثّقة على الإنترنت، تُحدَّث كل ربع سنة.',
    items: [
      { value: '15', label: 'عاماً في خدمة عائلات الرياض', detail: 'تأسست العيادة عام 2011' },
      { value: '28,000+', label: 'مريض عولجوا لدينا', detail: 'أطفال وبالغون' },
      { value: '4.9/5', label: 'متوسط تقييم المرضى', detail: 'من 2,300 تقييم موثّق' },
      { value: '9', label: 'أطباء أسنان أخصائيون', detail: 'جميعهم حاصلون على البورد' },
    ],
  },
  quotes: {
    eyebrow: 'مرضانا',
    heading: 'كلمات طيبة من مرضانا',
    items: [
      {
        quote:
          'كان ابني يبكي في كل زيارة لطبيب الأسنان، فحوّلتها د. نورة إلى لعبة، والآن يسأل متى نعود.',
        author: 'عبير الدوسري',
        role: 'أم لطفلين',
      },
      {
        quote: 'عرضوا عليّ خطة العلاج والسعر قبل البدء. لا مفاجآت، والزرعة طبيعية تماماً.',
        author: 'محمد الغامدي',
        role: 'مريض زراعة',
      },
      {
        quote:
          'حجزت ليلاً عبر الإنترنت واستقبلوني صباح اليوم التالي بسبب سن مكسور. سرعة واحترافية عالية.',
        author: 'حصة المطلق',
        role: 'زيارة طارئة',
      },
      {
        quote: 'ثمانية أشهر من المصففات الشفافة ولم يلاحظ أحد في العمل. النتيجة أفضل مما توقعت.',
        author: 'تركي العنزي',
        role: 'مريض تقويم شفاف',
      },
    ],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    heading: 'أسئلة يطرحها علينا المرضى',
    items: [
      {
        question: 'ما شركات التأمين التي تتعاملون معها؟',
        answer:
          'نتعامل مباشرة مع معظم شركات التأمين الكبرى في المملكة. أرسل لنا صورة بطاقتك قبل الزيارة ونؤكد لك التغطية في اليوم نفسه.',
      },
      {
        question: 'ما ساعات العمل؟',
        answer:
          'من السبت إلى الخميس، من 9 صباحاً حتى 9 مساءً، ومواعيد الطوارئ متاحة يومياً حتى الظهر.',
      },
      {
        question: 'متى يزور طفلي طبيب الأسنان أول مرة؟',
        answer:
          'عند إتمامه عامه الأول أو عند ظهور أول سن. الزيارات المبكرة تُبقي المشكلات صغيرة وتبني عادات جيدة.',
      },
      {
        question: 'هل تتوفر خطط تقسيط؟',
        answer: 'نعم، يمكن تقسيط علاج التقويم والزراعة على دفعات شهرية بلا فوائد.',
      },
      {
        question: 'هل العلاج مؤلم؟',
        answer: 'نستخدم أحدث طرق التخدير ونتوقف كلما احتجت. أخبرنا إن كنت قلقاً وسنمضي على راحتك.',
      },
      {
        question: 'كم تستغرق الزيارة الأولى؟',
        answer: 'نحو 45 دقيقة، تشمل الفحص والأشعة عند الحاجة وخطة مكتوبة بالأسعار.',
      },
    ],
  },
  form: {
    eyebrow: 'المواعيد',
    heading: 'احجز موعداً',
    body: 'اختر الخدمة والوقت المفضّل، ويؤكد فريقنا موعدك باتصال أو رسالة خلال ساعتي عمل.',
    fields: {
      name: 'الاسم الكامل',
      phone: 'رقم الجوال',
      email: 'البريد الإلكتروني',
      service: 'الخدمة',
      services: [
        'الفحص والتنظيف',
        'طب أسنان الأطفال',
        'التقويم والمصففات',
        'التبييض والقشور',
        'الزراعة والتيجان',
        'حالة طارئة',
      ],
      date: 'التاريخ المفضّل',
      time: 'الوقت المفضّل',
      times: ['صباحاً (9:00–12:00)', 'ظهراً (12:00–17:00)', 'مساءً (17:00–21:00)'],
      notes: 'هل هناك ما يجب أن نعرفه؟',
      consent: 'أوافق على التواصل معي بخصوص هذا الموعد.',
    },
    submitLabel: 'اطلب الموعد',
    footerNote: 'نستخدم بياناتك لترتيب زيارتك فقط.',
    successHint: 'شكراً لك. سنؤكد موعدك خلال ساعتي عمل.',
  },
  footer: {
    tagline: 'طب أسنان العائلة والتجميل في حي العليا بالرياض.',
    columns: [
      {
        title: 'الخدمات',
        links: [
          { label: 'الفحص والتنظيف', href: '#services' },
          { label: 'التقويم', href: '#services' },
          { label: 'الزراعة', href: '#services' },
          { label: 'التبييض', href: '#services' },
        ],
      },
      {
        title: 'العيادة',
        links: [
          { label: 'أطباؤنا', href: '#doctors' },
          { label: 'التأمين', href: '#faq' },
          { label: 'احجز زيارة', href: '#book' },
        ],
      },
      {
        title: 'تواصل معنا',
        links: [
          { label: 'اتصل بنا', href: PHONE_HREF },
          { label: 'راسلنا', href: 'mailto:care@example.com' },
          { label: 'الاتجاهات', href: '#map' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const clinicTemplate = defineTemplate({
  key: 'clinic',
  category: 'clinic',
  baseId: 'clinic',
  name: { en: 'Dental clinic', ar: 'عيادة أسنان' },
  description: {
    en: 'A family dental clinic with services, booking steps, doctor profiles, insurance FAQ and an appointment form.',
    ar: 'عيادة أسنان عائلية بالخدمات وخطوات الحجز وملفات الأطباء وأسئلة التأمين ونموذج حجز موعد.',
  },
  thumbnail: { topic: 'clinic', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `clinic-${lang}`;
    const heroPhoto = photo('clinic', HERO_PHOTO, lang);
    const fields = copy.form.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#book',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: PHONE_HREF,
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'square',
      radius: 'md',
      width: 'full',
      align: 'center',
    });
    page.section(
      'hero',
      'hero',
      {
        variant: 'split',
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('services', 'features', {
      eyebrow: copy.services.eyebrow,
      heading: copy.services.heading,
      body: copy.services.body,
      items: json(copy.services.items),
      columns: '3',
      variant: 'cards',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('steps', 'processSteps', {
      eyebrow: copy.steps.eyebrow,
      heading: copy.steps.heading,
      body: copy.steps.body,
      steps: json(copy.steps.items),
      variant: 'cards',
      layout: 'horizontal',
      columns: '3',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('doctors', 'team', {
      eyebrow: copy.doctors.eyebrow,
      heading: copy.doctors.heading,
      body: copy.doctors.body,
      profileLabel: copy.doctors.profileLabel,
      members: json(
        copy.doctors.members.map((member, index) => {
          const [topic, photoIndex] = DOCTOR_PHOTOS[index] ?? ['clinic', -1];
          const portrait = photo(topic, photoIndex, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: DOCTOR_HREFS[index] ?? '#doctors',
          };
        }),
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'cards',
      columns: '4',
      headerLayout: 'split',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'wall',
      columns: '2',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'cards',
      openFirst: true,
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('book', 'formSection', {
      eyebrow: copy.form.eyebrow,
      heading: copy.form.heading,
      body: copy.form.body,
      fields: json([
        {
          id: 'name',
          name: 'name',
          type: 'text',
          label: fields.name,
          autoComplete: 'name',
          required: true,
          width: 'half',
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: fields.phone,
          autoComplete: 'tel',
          required: true,
          width: 'half',
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: fields.email,
          autoComplete: 'email',
          required: false,
          width: 'half',
        },
        {
          id: 'service',
          name: 'service',
          type: 'select',
          label: fields.service,
          required: true,
          width: 'half',
          options: fields.services.map((label, index) => ({
            label,
            value: SERVICE_VALUES[index] ?? `service-${String(index + 1)}`,
          })),
        },
        {
          id: 'date',
          name: 'date',
          type: 'date',
          label: fields.date,
          required: true,
          width: 'half',
        },
        {
          id: 'time',
          name: 'time',
          type: 'select',
          label: fields.time,
          required: true,
          width: 'half',
          options: fields.times.map((label, index) => ({
            label,
            value: TIME_VALUES[index] ?? `time-${String(index + 1)}`,
          })),
        },
        {
          id: 'notes',
          name: 'notes',
          type: 'textarea',
          label: fields.notes,
          required: false,
          width: 'full',
          rows: 4,
        },
        {
          id: 'consent',
          name: 'consent',
          type: 'checkbox',
          label: fields.consent,
          required: true,
          width: 'full',
        },
      ]),
      submitLabel: copy.form.submitLabel,
      footerNote: copy.form.footerNote,
      successHint: copy.form.successHint,
      action: '/appointments',
      method: 'post',
      variant: 'split',
      controlDensity: 'comfortable',
      controlRadius: 'large',
      buttonVariant: 'solid',
      buttonWidth: 'auto',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.place(
      footer(
        { prefix, brand: copy.brand, tagline: copy.footer.tagline, columns: copy.footer.columns },
        lang,
      ),
    );
  },
});
