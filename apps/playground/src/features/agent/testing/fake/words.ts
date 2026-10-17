/**
 * The fake views' copy: the SPEC §3.4 dental clinic page (sections, requests, answers,
 * suggestions, the clarifying questions) in both locales.
 */
import type { ChangeLineView, DirectionView, Locale } from '../../model/view-types';

/* ── The SPEC's example page, in both locales ─────────────────────────────────── */

export interface Words {
  readonly sections: readonly string[];
  readonly request: string;
  readonly direction: DirectionView;
  readonly editRequest: string;
  readonly editChanges: readonly ChangeLineView[];
  readonly proposalRequest: string;
  readonly proposalChanges: readonly ChangeLineView[];
  readonly question: string;
  readonly answer: string;
  readonly steps: readonly string[];
  readonly queued: string;
  readonly facts: readonly { readonly sample: string; readonly section: number }[];
  readonly sessions: readonly string[];
  readonly understood: string;
  readonly enhanced: string;
  readonly enhanceChanges: readonly string[];
  readonly clarify: {
    readonly request: string;
    readonly understood: string;
    readonly questions: readonly {
      readonly text: string;
      readonly choices: readonly string[];
    }[];
  };
  readonly suggestions: readonly string[];
  readonly starters: readonly string[];
  readonly mentions: readonly string[];
}

export const SWATCHES: DirectionView['swatches'] = [
  { role: 'background', hex: '#fbfbfd' },
  { role: 'surface', hex: '#ffffff' },
  { role: 'text', hex: '#0e1116' },
  { role: 'accent', hex: '#0f766e' },
  { role: 'onAccent', hex: '#ffffff' },
];

export const WORDS: Readonly<Record<Locale, Words>> = {
  en: {
    sections: ['Header', 'Hero', 'Services', 'Why us', 'Doctors', 'Testimonials', 'FAQ', 'Contact'],
    request: 'A dental clinic page in Amman, WhatsApp booking',
    direction: {
      mood: 'Calm, clinical, teal',
      fonts: 'Reem Kufi / IBM Plex Sans Arabic',
      swatches: SWATCHES,
    },
    editRequest: 'Make the hero dark and add a WhatsApp button',
    editChanges: [
      { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
      { kind: 'added', label: 'Button', value: 'WhatsApp' },
    ],
    proposalRequest: 'Rename the FAQ heading to “Questions patients ask”',
    proposalChanges: [
      { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
    ],
    question: 'How do I change the font on this page?',
    answer:
      'Open Theme in the editor and pick a display face for headings. The body face sits right under it.',
    steps: [
      'Give the hero a deep navy background.',
      'Add a WhatsApp button beside “Book now”.',
      'Keep the heading and the photo as they are.',
    ],
    queued: 'Make the header sticky',
    facts: [
      { sample: '25 JD', section: 2 },
      { sample: 'Dr. Lina Haddad', section: 4 },
      { sample: 'Rated 4.9 by 212', section: 5 },
    ],
    sessions: [
      'Dental clinic, Amman',
      'Coffee roaster page',
      'CV for Lina',
      'Launch page, Rafeeq',
      'FAQ tweaks',
    ],
    understood: 'A page for a dental clinic in Amman, with booking on WhatsApp',
    enhanced:
      'Build a one-page site for a dental clinic in Amman: services, the doctors, patient reviews and WhatsApp booking.',
    enhanceChanges: ['Named what the page must show', 'Kept your city and booking channel'],
    clarify: {
      request: 'link this page inside it',
      understood: 'You want this page reachable from another page',
      questions: [
        { text: 'Which page should link here?', choices: ['Home', 'Services', 'Contact'] },
        {
          text: 'Where should the link sit?',
          choices: ['In the header', 'In the footer', 'As a button'],
        },
      ],
    },
    suggestions: ['Add a pricing section', 'Make the colours warmer', 'Add an English version'],
    starters: [
      'A dental clinic in Amman with WhatsApp booking',
      'A specialty café: menu, hours and map',
      'A small perfume shop on Instagram',
      'A yoga studio: classes and prices',
    ],
    mentions: ['Hero', 'Services', 'Social proof'],
  },
  ar: {
    sections: [
      'الترويسة',
      'الواجهة',
      'الخدمات',
      'لماذا نحن',
      'الأطباء',
      'آراء المرضى',
      'الأسئلة الشائعة',
      'التواصل',
    ],
    request: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
    direction: {
      mood: 'هادئ، طبّي، فيروزي',
      fonts: 'Reem Kufi / IBM Plex Sans Arabic',
      swatches: SWATCHES,
    },
    editRequest: 'خلّي الواجهة داكنة وزيد زر واتساب',
    editChanges: [
      { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
      { kind: 'added', label: 'زر', value: 'واتساب' },
    ],
    proposalRequest: 'غيّر عنوان الأسئلة الشائعة إلى «أسئلة يطرحها المرضى»',
    proposalChanges: [
      {
        kind: 'changed',
        label: 'العنوان',
        before: 'الأسئلة الشائعة',
        after: 'أسئلة يطرحها المرضى',
      },
    ],
    question: 'كيف أغيّر الخط في هذه الصفحة؟',
    answer: 'يُغيَّر الخط من لوحة «السمة» في المحرّر باختيار خط العناوين، وخط النص تحته مباشرة.',
    steps: [
      'جعل خلفية الواجهة كحلية داكنة.',
      'إضافة زر واتساب بجانب «احجز موعدًا».',
      'إبقاء العنوان والصورة كما هما.',
    ],
    queued: 'تثبيت الترويسة أعلى الصفحة',
    facts: [
      { sample: '25 دينارًا', section: 2 },
      { sample: 'د. لينا حداد', section: 4 },
      { sample: 'تقييم 4.9 من 212 مراجعًا', section: 5 },
    ],
    sessions: [
      'عيادة أسنان، عمّان',
      'صفحة محمصة قهوة',
      'سيرة ذاتية للينا',
      'صفحة إطلاق رفيق',
      'تعديلات الأسئلة الشائعة',
    ],
    understood: 'صفحة لعيادة أسنان في عمّان مع الحجز عبر واتساب',
    enhanced:
      'بناء صفحة واحدة لعيادة أسنان في عمّان تعرض الخدمات والأطباء وآراء المرضى، مع الحجز عبر واتساب.',
    enhanceChanges: ['تحديد ما يجب أن تعرضه الصفحة', 'إبقاء المدينة ووسيلة الحجز كما هما'],
    clarify: {
      request: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
      understood: 'الوصول إلى هذه الصفحة من صفحة أخرى',
      questions: [
        { text: 'أي صفحة يُضاف فيها الرابط؟', choices: ['الرئيسية', 'الخدمات', 'التواصل'] },
        { text: 'أين يوضع الرابط؟', choices: ['في الترويسة', 'في التذييل', 'كزر'] },
      ],
    },
    suggestions: ['إضافة قسم للأسعار', 'ألوان أدفأ للصفحة', 'إضافة نسخة إنجليزية'],
    starters: [
      'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
      'مقهى مختص في إربد: القائمة والدوام والموقع',
      'متجر عطور صغير يبيع عبر إنستغرام',
      'مكتب محاماة في رام الله: الخدمات والفريق',
    ],
    mentions: ['الواجهة', 'الخدمات', 'آراء المرضى'],
  },
};
