import { defineTemplate, footer, header, json, photo, type NavLink } from './build';
import type { TemplateLang } from './types';

/*
  Professional services (`professional-services` / `professional-services-ar`)
  — DESIGN §B.3. A corporate law and advisory firm in Amman and Riyadh.

  header → split hero with a business photo (light tone: no offset dark band)
  → logo cloud → split content with a photo → process (4 steps) → stats with
  their own body → team (4 portraits) → testimonials (2 × 2 wall) → FAQ →
  consultation form → footer.
*/

const EN = {
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

const AR: typeof EN = {
  brand: 'ميزان للمحاماة',
  nav: [
    { label: 'خدماتنا', href: '#services' },
    { label: 'منهجيتنا', href: '#approach' },
    { label: 'الفريق', href: '#team' },
    { label: 'الأسئلة الشائعة', href: '#faq' },
  ],
  headerCta: { label: 'احجز استشارة', href: '#contact' },
  hero: {
    eyebrow: 'قانون الشركات والاستشارات · عمّان · الرياض',
    heading: 'استشارات قانونية واضحة للقرارات المهمة',
    body: 'نساعد المؤسسين والشركات العائلية والمستثمرين على تأسيس شركاتهم وتنميتها وحمايتها في الأردن والسعودية.',
    trustLine: 'مرخّصون في الأردن والسعودية · بالعربية والإنجليزية · سرية تامة',
    primary: 'تحدّث مع أحد الشركاء',
    secondary: 'تعرّف على خدماتنا',
  },
  logos: {
    eyebrow: 'يثق بنا',
    heading: 'نرافق الشركات من الترخيص الأول حتى التوسع الإقليمي',
    items: [
      { name: 'زيتونة للأغذية', descriptor: 'أغذية وتجزئة' },
      { name: 'بادية للخدمات اللوجستية', descriptor: 'خدمات لوجستية' },
      { name: 'أفق للتطوير', descriptor: 'تطوير عقاري' },
      { name: 'دانة الصحية', descriptor: 'رعاية صحية' },
      { name: 'أطلس للاستثمار', descriptor: 'استثمار' },
      { name: 'سحاب كلاود', descriptor: 'تقنية' },
    ],
  },
  content: {
    eyebrow: 'خدماتنا',
    heading: 'مكتب واحد للجانب القانوني من نموّك',
    body: 'من تأسيس الشركة إلى الصفقات العابرة للحدود، يتولى فريق صغير من الشركاء ملفاتك بنفسه ويشرح لك كل خيار بلغة واضحة.',
    highlights: [
      {
        title: 'تأسيس الشركات',
        body: 'التراخيص والهياكل واتفاقيات الشركاء، بشكل صحيح من المرة الأولى.',
      },
      { title: 'العقود والنزاعات', body: 'صياغة ومراجعة وتفاوض، مع دعم في التقاضي عند الحاجة.' },
      {
        title: 'الاستثمار والاستحواذ',
        body: 'العناية الواجبة ووثائق الصفقات للمستثمرين والبائعين والمشترين.',
      },
      { title: 'العمل والامتثال', body: 'سياسات وعقود وإجراءات تنظيمية تحمي فريقك.' },
    ],
    link: 'كل خدماتنا',
  },
  process: {
    eyebrow: 'منهجيتنا',
    heading: 'كيف يسير ملفك معنا',
    body: 'كل ملف يمرّ بأربع خطوات ثابتة، فتعرف دائماً ما الخطوة التالية وكم ستكلّف.',
    steps: [
      {
        meta: 'اليوم الأول',
        title: 'مكالمة أولى مجانية',
        body: 'مكالمة مدتها 30 دقيقة مع أحد الشركاء لفهم الملف وما يترتب عليه.',
      },
      {
        meta: 'الأسبوع الأول',
        title: 'عرض واضح',
        body: 'نطاق عمل مكتوب وجدول زمني وأتعاب ثابتة قبل بدء أي عمل.',
      },
      {
        meta: 'الأسابيع 2–6',
        title: 'عمل مركّز',
        body: 'صياغة وإجراءات وتفاوض، مع تحديث موجز كل أسبوع.',
      },
      {
        meta: 'بشكل مستمر',
        title: 'استشارات طويلة الأمد',
        body: 'اشتراكات للشركات التي تريد شريكاً متاحاً عند الحاجة.',
      },
    ],
  },
  stats: {
    eyebrow: 'سجلّنا',
    heading: 'خمسة عشر عاماً من الملفات المنجزة بعناية',
    body: 'أرقام من ملفاتنا منذ افتتاح المكتب في عمّان عام 2011 وفي الرياض عام 2019.',
    items: [
      { value: '1,200+', label: 'شركة أسسناها', detail: 'في الأردن والسعودية' },
      { value: '350', label: 'صفقة أغلقناها', detail: 'استثمارات واندماجات وتخارجات' },
      { value: '94%', label: 'نزاعات سُوّيت ودياً', detail: 'توفيراً للوقت والتكلفة على عملائنا' },
      { value: '9', label: 'شركاء ومستشارون', detail: 'في عمّان والرياض' },
    ],
  },
  team: {
    eyebrow: 'الفريق',
    heading: 'شركاء يتولّون عملك بأنفسهم',
    body: 'تتحدث مع الشخص الذي ينجز العمل فعلاً، بالعربية أو الإنجليزية، من أول مكالمة حتى التوقيع الأخير.',
    profileLabel: 'عرض الملف',
    members: [
      {
        name: 'د. أحمد المصري',
        role: 'الشريك المدير',
        bio: 'قانون الشركات والصفقات العابرة للحدود، بخبرة عشرين عاماً.',
      },
      {
        name: 'رانيا حداد',
        role: 'شريكة، النزاعات',
        bio: 'التقاضي التجاري والتحكيم أمام المراكز الإقليمية.',
      },
      {
        name: 'فيصل القحطاني',
        role: 'شريك، مكتب الرياض',
        bio: 'نظام الشركات السعودي والتراخيص والاستثمار الأجنبي.',
      },
      { name: 'ميس عودة', role: 'محامية أولى', bio: 'قانون العمل والامتثال وحماية البيانات.' },
    ],
  },
  quotes: {
    eyebrow: 'عملاؤنا',
    heading: 'شركات تثق بنا في قراراتها',
    items: [
      {
        quote: 'شرحوا لنا كل خيار بوضوح، والأتعاب الثابتة جنّبتنا أي مفاجآت.',
        author: 'خالد بركات',
        role: 'الرئيس التنفيذي',
        company: 'زيتونة للأغذية',
      },
      {
        quote: 'رافقنا ميزان في توسعنا إلى الرياض من الترخيص حتى أول موظف في أقل من ثلاثة أشهر.',
        author: 'لين العلي',
        role: 'مديرة العمليات',
        company: 'دانة الصحية',
      },
      {
        quote:
          'أُغلقت جولتنا الاستثمارية في موعدها لأن الأوراق كانت جاهزة قبل أن يطلبها المستثمرون.',
        author: 'عمر زيد',
        role: 'المؤسس',
        company: 'سحاب كلاود',
      },
      {
        quote: 'دقة وتكتّم وتواصل دائم، وهذا بالضبط ما تحتاجه الشركة العائلية.',
        author: 'سهير ناصر',
        role: 'عضو مجلس الإدارة',
        company: 'بادية للخدمات اللوجستية',
      },
    ],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    heading: 'قبل استشارتك الأولى',
    items: [
      {
        question: 'هل الاستشارة الأولى مجانية فعلاً؟',
        answer: 'نعم، المكالمة الأولى مجانية وسرية، وتقرر بعدها إن كنت تريد المتابعة.',
      },
      {
        question: 'كيف تُحدَّد الأتعاب؟',
        answer:
          'معظم الملفات بأتعاب ثابتة نتفق عليها كتابياً قبل البدء، أما النزاعات الطويلة فيمكن احتسابها شهرياً.',
      },
      {
        question: 'هل تعملون بالعربية والإنجليزية؟',
        answer: 'كل الشركاء يعملون باللغتين، ونصيغ عقوداً ثنائية اللغة عندما تتطلب الصفقة ذلك.',
      },
      {
        question: 'هل يمكنكم تمثيلنا في السعودية؟',
        answer:
          'نعم، مكتبنا في الرياض مرخّص لتقديم الاستشارات في نظام الشركات والتراخيص والاستثمار.',
      },
    ],
  },
  form: {
    eyebrow: 'استشارة',
    heading: 'احجز استشارة سرية',
    body: 'أخبرنا باختصار عن ملفك، وسيرد عليك أحد الشركاء خلال يومي عمل لترتيب مكالمة.',
    fields: {
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      topic: 'نوع الملف',
      topics: ['تأسيس شركة', 'عقود', 'نزاعات', 'استثمار', 'قضايا عمل'],
      message: 'كيف يمكننا المساعدة؟',
      consent: 'أوافق على استخدام بياناتي للرد على هذا الطلب فقط.',
    },
    submitLabel: 'اطلب استشارة',
    footerNote: 'تصل رسالتك مباشرة إلى أحد الشركاء وتبقى سرية.',
    successHint: 'شكراً لك، سيتواصل معك أحد الشركاء خلال يومي عمل.',
  },
  footer: {
    tagline: 'قانون الشركات والاستشارات في عمّان والرياض.',
    columns: [
      {
        title: 'خدماتنا',
        links: [
          { label: 'تأسيس الشركات', href: '#services' },
          { label: 'العقود', href: '#services' },
          { label: 'النزاعات', href: '#services' },
          { label: 'الاستثمار', href: '#services' },
        ],
      },
      {
        title: 'المكتب',
        links: [
          { label: 'منهجيتنا', href: '#approach' },
          { label: 'الفريق', href: '#team' },
          { label: 'الوظائف', href: '#careers' },
        ],
      },
      {
        title: 'تواصل',
        links: [
          { label: 'مكتب عمّان', href: '#amman' },
          { label: 'مكتب الرياض', href: '#riyadh' },
          { label: 'راسلنا', href: 'mailto:hello@example.com' },
        ],
      },
    ],
  },
};

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** people photo index per team member (the last is the catalog's portrait in hijab). */
const TEAM_PHOTOS = [1, 2, 3, 20] as const;
const TOPIC_VALUES = ['formation', 'contracts', 'disputes', 'investment', 'employment'] as const;

export const servicesTemplate = defineTemplate({
  key: 'services',
  category: 'services',
  baseId: 'professional-services',
  name: { en: 'Professional services', ar: 'خدمات مهنية' },
  description: {
    en: 'A law and advisory firm site with services, approach, partners and a consultation form.',
    ar: 'موقع مكتب محاماة واستشارات بالخدمات والمنهجية والشركاء ونموذج لحجز استشارة.',
  },
  thumbnail: { topic: 'services', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `services-${lang}`;
    const heroPhoto = photo('services', 0, lang);
    const contentPhoto = photo('services', 1, lang);
    const fields = copy.form.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#contact',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#services',
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'wide',
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

    page.section('logos', 'logoCloud', {
      eyebrow: copy.logos.eyebrow,
      heading: copy.logos.heading,
      items: json(copy.logos.items),
      variant: 'minimal',
      columns: '6',
      align: 'center',
      tone: 'transparent',
      spacing: 'md',
      width: 'wide',
    });

    page.section('content', 'content-section', {
      eyebrow: copy.content.eyebrow,
      heading: copy.content.heading,
      body: copy.content.body,
      highlights: json(copy.content.highlights),
      imageSrc: contentPhoto.src,
      imageAlt: contentPhoto.alt,
      mediaPosition: 'start',
      link: { label: copy.content.link, href: '#services' },
      layout: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('process', 'processSteps', {
      eyebrow: copy.process.eyebrow,
      heading: copy.process.heading,
      body: copy.process.body,
      steps: json(copy.process.steps),
      variant: 'minimal',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
      tone: 'light',
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
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('team', 'team', {
      eyebrow: copy.team.eyebrow,
      heading: copy.team.heading,
      body: copy.team.body,
      profileLabel: copy.team.profileLabel,
      members: json(
        copy.team.members.map((member, index) => {
          const portrait = photo('people', TEAM_PHOTOS[index] ?? -1, lang);
          return { ...member, imageSrc: portrait.src, imageAlt: portrait.alt };
        }),
      ),
      variant: 'cards',
      columns: '4',
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

    page.section('contact', 'formSection', {
      eyebrow: copy.form.eyebrow,
      heading: copy.form.heading,
      body: copy.form.body,
      fields: [
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
          id: 'email',
          name: 'email',
          type: 'email',
          label: fields.email,
          autoComplete: 'email',
          required: true,
          width: 'half',
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: fields.phone,
          autoComplete: 'tel',
          required: false,
          width: 'half',
        },
        {
          id: 'topic',
          name: 'topic',
          type: 'select',
          label: fields.topic,
          required: true,
          width: 'half',
          options: fields.topics.map((label, index) => ({
            label,
            value: TOPIC_VALUES[index] ?? `topic-${String(index + 1)}`,
          })),
        },
        {
          id: 'message',
          name: 'message',
          type: 'textarea',
          label: fields.message,
          required: true,
          width: 'full',
          rows: 5,
        },
        {
          id: 'consent',
          name: 'consent',
          type: 'checkbox',
          label: fields.consent,
          required: true,
          width: 'full',
        },
      ],
      submitLabel: copy.form.submitLabel,
      footerNote: copy.form.footerNote,
      successHint: copy.form.successHint,
      action: '/contact',
      method: 'post',
      variant: 'split',
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
