import {
  PHOTO_CATALOG,
  SECTION_KITS,
  instantiateKit,
  readPageKit,
  writePageKit,
  type LibrarySectionEntry,
  type SectionKit,
  type SectionKitSlot,
} from '@craftkit/builder';

import { SECTION_COPY, libraryMoney, type CopyRecord, type CopyValue, type Lang } from './library-sections.copy';

export { libraryMoney };

/*
  The Library's Sections tab (agent-script DESIGN §B.5, library-playground).

  Every section kit the agent builds from, offered to the person too, filled
  once through the SAME `instantiateKit` the agent's kit tools use — so a
  dropped section is exactly what the agent would have produced.

  What changed (audit §B.6):
  - Placeholders know their SLOT NAME and the kit's subject: a brand reads as
    a brand, a price as a price, a person has a name and a role, a question
    ends in a question mark — in English or Arabic, never "Feature 0". The
    copy lives in library-sections.copy.ts; anything it does not cover falls
    back to a name-aware placeholder numbered from 1.
  - List counts fill the layout (COUNTS): the photo mosaic's 4-column grid
    holds its 2×2 lead plus four tiles (5), the lead-card grid's 3-column grid
    holds its 2×2 card plus two (2), the bento holds its photo plus two (2).
  - Photos are real, verified catalog photos (PHOTO_CATALOG) chosen for the
    kit, and never repeated inside one kit.
  - Every entry carries its PAGE KIT: the `ck-*` classes and `--ck-*` tokens
    the markup is written in. The Library installs it on the page root in the
    same transaction as the section (once per page), and draws the thumbnail
    with it, so neither is unstyled any more.
*/

/** The page plan's fence: a page whose `pageCss` holds it already has the kit. */
export const PAGE_KIT_MARKER = '.ck-page-plan{';

/**
 * The default page kit for a language, written by the SAME function the page
 * skeleton writes it with. `hasHeader` is on so a header kit's sticky host
 * works whichever section is inserted first.
 */
export function libraryPageKit(lang: Lang): NonNullable<LibrarySectionEntry['pageKit']> {
  const { state } = readPageKit('', lang === 'ar');
  return {
    marker: PAGE_KIT_MARKER,
    css: writePageKit('', { ...state, hasHeader: true }, { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }),
  };
}

// ── Kit subjects, counts and photos ──────────────────────────────────────────

/** Which copy a kit reads (several kits share one subject). */
export function kitSubject(id: string): string {
  if (id.startsWith('header-')) return 'header';
  if (id.startsWith('footer-')) return 'footer';
  if (id.startsWith('hero-')) return 'hero';
  if (id.startsWith('features-') || id === 'content-zigzag') return 'features';
  if (id === 'content-story') return 'story';
  if (id.startsWith('steps-')) return 'steps';
  if (id.startsWith('testimonial')) return 'testimonials';
  if (id.startsWith('stats-')) return 'stats';
  if (id.startsWith('logos-')) return 'logos';
  if (id === 'pricing-table') return 'comparison';
  if (id.startsWith('pricing-')) return 'pricing';
  if (id.startsWith('menu-')) return 'menu';
  if (id.startsWith('products-')) return 'products';
  if (id.startsWith('listing-')) return 'listings';
  if (id.startsWith('team-')) return 'team';
  if (id === 'gallery-rail') return 'kitchen';
  if (id.startsWith('gallery-')) return 'gallery';
  if (id.startsWith('blog-')) return 'blog';
  if (id.startsWith('faq-')) return 'faq';
  if (id.startsWith('cta-')) return 'cta';
  if (id.startsWith('contact-')) return 'contact';
  return 'generic';
}

/**
 * Item counts that fill each layout (by kit id, then list slot). A list not
 * named here takes every item its copy has, capped at the slot's `max`.
 */
const COUNTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'header-bar': { nav: 4 },
  'header-notice': { nav: 4 },
  'footer-columns': { nav: 4, contact: 3 },
  'footer-cta': { nav: 4, contact: 3 },
  // md: 3 columns; the lead card spans 2×2, so two items close the grid with no hole.
  'features-lead': { items: 2 },
  'features-list': { items: 4 },
  // md: 3×2; the photo spans 2×2, two items fill the last column.
  'features-bento': { items: 2 },
  'features-sticky': { items: 4 },
  'features-cards': { items: 4 },
  'content-zigzag': { items: 3 },
  'steps-timeline': { items: 3 },
  'testimonials-cards': { items: 3 },
  'testimonials-wall': { items: 6 },
  'testimonial-quote': { items: 1 },
  'stats-row': { items: 4 },
  'stats-story': { items: 4 },
  'logos-row': { items: 6 },
  'pricing-tiers': { items: 3 },
  'pricing-duo': { items: 2 },
  'pricing-table': { plans: 3, rows: 5 },
  'menu-list': { items: 2 },
  'products-grid': { items: 4 },
  'listing-cards': { items: 3 },
  'team-grid': { items: 4 },
  'team-cards': { items: 3 },
  // 4 columns (2 on a phone); the first tile spans 2×2, four more close two rows.
  'gallery-mosaic': { items: 5 },
  'gallery-rail': { items: 6 },
  'blog-cards': { items: 3 },
  'blog-feature': { items: 4 },
  'faq-accordion': { items: 5 },
  'faq-split': { items: 4 },
  'contact-split': { channels: 3, hours: 3 },
  'contact-cards': { items: 4 },
};

/** The catalog topics a kit's photos come from when its copy names none (or names one already used). */
const ROLE_PHOTO_TOPICS: Readonly<Record<SectionKit['role'], readonly string[]>> = {
  header: ['business'],
  hero: ['business', 'city', 'tech'],
  features: ['tech', 'business', 'cafe'],
  proof: ['business', 'tech'],
  offer: ['perfume', 'fashion', 'realestate'],
  media: ['travel', 'restaurant', 'city', 'hotel'],
  closing: ['city', 'travel'],
  footer: ['city'],
};

interface Photo {
  readonly src: string;
  readonly alt: string;
}

/** One kit's photo picker: the named catalog photo, else the kit role's next unused one — never twice. */
function photoPicker(role: SectionKit['role'], lang: Lang): (id: string | undefined) => Photo {
  const used = new Set<string>();
  const take = (entry: (typeof PHOTO_CATALOG)[number]): Photo => {
    used.add(entry.id);
    return { src: entry.url, alt: entry.alt[lang] };
  };
  return (id) => {
    const named = id === undefined ? undefined : PHOTO_CATALOG.find((entry) => entry.id === id);
    if (id !== undefined && named === undefined) throw new Error(`library-sections: no catalog photo "${id}"`);
    if (named !== undefined && !used.has(named.id)) return take(named);
    const topics = ROLE_PHOTO_TOPICS[role];
    const next =
      PHOTO_CATALOG.find((entry) => topics.includes(entry.topic) && !used.has(entry.id)) ??
      PHOTO_CATALOG.find((entry) => !used.has(entry.id));
    if (next === undefined) throw new Error('library-sections: the photo catalog ran out');
    return take(next);
  };
}

// ── Name-aware placeholders (the fallback under the copy) ────────────────────

const WORDS: Readonly<Record<Lang, Readonly<Record<string, string>>>> = {
  en: {
    brand: 'Northwind',
    nav: 'Link',
    eyebrow: 'Section',
    title: 'A clear headline',
    lead: 'One sentence that says what this part of the page is for.',
    plan: 'Plan',
    period: '/month',
    action: 'Get started',
    name: 'Team member',
    role: 'Role',
    quote: 'A short sentence from a happy customer.',
    question: 'A question customers ask',
    answer: 'A short, plain answer to that question.',
    label: 'Label',
    date: '12 May 2026',
    address: '24 Rainbow Street, Amman',
    phone: '+962 6 555 0134',
    email: 'hello@northwind.co',
    step: 'Step',
    item: 'Item',
  },
  ar: {
    brand: 'سراج',
    nav: 'رابط',
    eyebrow: 'قسم',
    title: 'عنوان واضح',
    lead: 'جملة واحدة تشرح الغرض من هذا الجزء من الصفحة.',
    plan: 'باقة',
    period: '/شهريًا',
    action: 'ابدأ الآن',
    name: 'عضو الفريق',
    role: 'المنصب',
    quote: 'جملة قصيرة من عميل سعيد.',
    question: 'سؤال يطرحه العملاء',
    answer: 'إجابة قصيرة وواضحة عن هذا السؤال.',
    label: 'وصف',
    date: '12 مايو 2026',
    address: 'شارع الرينبو 24، عمّان',
    phone: '+962 6 555 0134',
    email: 'hello@siraj.jo',
    step: 'الخطوة',
    item: 'عنصر',
  },
};

/** The word family a slot name belongs to (the DESIGN §B.5 name list). */
function family(name: string): string {
  if (name === 'brand') return 'brand';
  if (name.startsWith('nav')) return 'nav';
  if (name === 'eyebrow') return 'eyebrow';
  if (/^(title|heading|caption|feature|highlight)$/u.test(name)) return 'title';
  if (/^(lead|body|description|text|note|notice|meta|copyright)$/u.test(name)) return 'lead';
  if (name === 'price') return 'price';
  if (name === 'plan') return 'plan';
  if (name === 'period') return 'period';
  if (/^(cta|cta2|action|map)$/u.test(name) || name.endsWith('_link')) return 'action';
  if (name === 'name') return 'name';
  if (name === 'role') return 'role';
  if (name === 'quote') return 'quote';
  if (name === 'q' || name === 'question') return 'question';
  if (name === 'a' || name === 'answer') return 'answer';
  if (name === 'stat' || name === 'value') return 'stat';
  if (name === 'label' || name === 'day' || name === 'time') return 'label';
  if (name === 'step') return 'step';
  if (/^(date|address|phone|email|href|initials)$/u.test(name)) return name;
  return 'item';
}

/** A placeholder for a slot the copy does not cover: by its name, numbered from 1 inside a list. */
export function namedPlaceholder(name: string, lang: Lang, index: number): string {
  const words = WORDS[lang];
  const numbered = (word: string | undefined) =>
    index > 0 ? `${word ?? words['item'] ?? ''} ${String(index)}` : (word ?? words['item'] ?? '');
  switch (family(name)) {
    case 'price':
      return libraryMoney(19 * Math.max(1, index), lang);
    case 'stat':
      return `${String(10 * Math.max(1, index))}+`;
    case 'href':
      return `#section-${String(Math.max(1, index))}`;
    case 'initials':
      return lang === 'ar' ? 'س ج' : 'NW';
    case 'phone':
      return words['phone'] ?? '';
    case 'email':
      return words['email'] ?? '';
    case 'period':
      return words['period'] ?? '';
    case 'brand':
      return words['brand'] ?? '';
    case 'question':
      return lang === 'ar' ? `${numbered(words['question'])}؟` : `${numbered(words['question'])}?`;
    default:
      return numbered(words[family(name)]);
  }
}

// ── Filling a kit ────────────────────────────────────────────────────────────

function isLink(value: CopyValue | undefined): value is { readonly label: string; readonly href: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'href' in value;
}

interface FillContext {
  readonly lang: Lang;
  readonly photo: (id: string | undefined) => Photo;
}

const ICONS = ['star', 'zap', 'shield-check', 'heart', 'globe', 'users', 'mail', 'clock'] as const;

/**
 * Slot values for one record (the kit's top level, or one list item):
 * the copy's value when it gives one; a name-aware placeholder for a required
 * slot it does not; nothing for an optional slot it leaves out (or sets null).
 */
function fillRecord(
  slots: Readonly<Record<string, SectionKitSlot>>,
  copy: CopyRecord | undefined,
  context: FillContext,
  index: number,
  counts: Readonly<Record<string, number>> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, slot] of Object.entries(slots)) {
    const given = copy?.[name];
    if (given === null) continue;
    const required = slot.required === true;
    switch (slot.kind) {
      case 'list': {
        const pool = Array.isArray(given) ? (given as readonly CopyRecord[]) : [];
        if (pool.length === 0 && !required) break;
        const wanted = counts?.[name] ?? Math.max(1, pool.length);
        const count = Math.max(1, Math.min(wanted, slot.max ?? wanted));
        out[name] = Array.from({ length: count }, (_unused, at) =>
          fillRecord(slot.item ?? {}, pool[at], context, at + 1, undefined),
        );
        break;
      }
      case 'text':
        if (typeof given === 'string') out[name] = given;
        else if (required) out[name] = namedPlaceholder(name, context.lang, index);
        break;
      case 'icon':
        if (typeof given === 'string') out[name] = given;
        else if (required) out[name] = ICONS[(Math.max(1, index) - 1) % ICONS.length];
        break;
      case 'link':
        if (isLink(given)) out[name] = { label: given.label, href: given.href };
        else if (required) out[name] = { label: namedPlaceholder(name, context.lang, index), href: '#contact' };
        break;
      case 'image':
        if (typeof given === 'string' || required) out[name] = context.photo(typeof given === 'string' ? given : undefined);
        break;
    }
  }
  return out;
}

/** A kit's slot values in one language — exported for the tests. */
export function kitPlaceholders(kit: SectionKit, lang: Lang): Record<string, unknown> {
  const copy = SECTION_COPY[lang][kitSubject(kit.id)];
  return fillRecord(kit.slots, copy, { lang, photo: photoPicker(kit.role, lang) }, 0, COUNTS[kit.id]);
}

// ── Names ────────────────────────────────────────────────────────────────────

const ROLE_NAMES: Readonly<Record<SectionKit['role'], { readonly en: string; readonly ar: string }>> = {
  header: { en: 'Header', ar: 'الترويسة' },
  hero: { en: 'Hero', ar: 'الواجهة' },
  features: { en: 'Features', ar: 'المزايا' },
  proof: { en: 'Proof', ar: 'الثقة' },
  offer: { en: 'Offer', ar: 'العرض' },
  media: { en: 'Media', ar: 'الوسائط' },
  closing: { en: 'Closing', ar: 'الخاتمة' },
  footer: { en: 'Footer', ar: 'التذييل' },
};

/** Each kit's summary in Arabic (the kit's own summary is English). */
export const KIT_SUMMARY_AR: Readonly<Record<string, string>> = {
  'header-bar': 'شريط وقائمة للهاتف',
  'header-notice': 'شريط تنبيه ثم القائمة',
  'hero-centered': 'نص في المنتصف',
  'hero-split': 'صورة بجانب النص',
  'hero-overlay': 'صورة كاملة',
  'hero-frame': 'صورة في إطار',
  'hero-editorial': 'أسلوب المجلات',
  'features-lead': 'بطاقة رئيسية وشبكة',
  'features-list': 'قائمة بأيقونات',
  'features-bento': 'شبكة بنتو بصورة',
  'features-sticky': 'قائمة بعنوان ثابت',
  'features-cards': 'صورة وبطاقات أيقونات',
  'content-zigzag': 'صفوف متناوبة',
  'content-story': 'قصة وصورة طولية',
  'steps-timeline': 'خطوات مرقّمة',
  'testimonials-cards': 'بطاقات آراء',
  'testimonials-wall': 'جدار آراء',
  'testimonial-quote': 'اقتباس واحد كبير',
  'stats-row': 'صف أرقام',
  'stats-story': 'نص وبطاقات أرقام',
  'logos-row': 'صف الشعارات',
  'pricing-tiers': 'بطاقات الباقات',
  'pricing-duo': 'باقتان عريضتان',
  'pricing-table': 'جدول مقارنة',
  'menu-list': 'قائمة طعام بالأسعار',
  'products-grid': 'شبكة منتجات',
  'listing-cards': 'بطاقات عقارات',
  'team-grid': 'صور الفريق',
  'team-cards': 'الفريق مع نبذة',
  'gallery-mosaic': 'فسيفساء صور',
  'gallery-rail': 'شريط صور',
  'blog-cards': 'بطاقات مقالات',
  'blog-feature': 'مقال رئيسي',
  'faq-accordion': 'أسئلة شائعة',
  'faq-split': 'أسئلة بعنوان جانبي',
  'cta-band': 'شريط بلون التمييز',
  'cta-split': 'دعوة مع إجراء جانبي',
  'cta-card': 'بطاقة داكنة بصورة',
  'contact-split': 'ساعات العمل والخريطة',
  'contact-cards': 'بطاقات التواصل',
  'footer-columns': 'روابط وتواصل',
  'footer-cta': 'دعوة ثم روابط',
};

/** Every kit that fills cleanly, as a Library section in the editor's language, with its page kit. */
export function librarySections(lang: Lang): LibrarySectionEntry[] {
  const pageKit = libraryPageKit(lang);
  return SECTION_KITS.flatMap((kit): LibrarySectionEntry[] => {
    const filled = instantiateKit(kit, kitPlaceholders(kit, lang), {
      id: `section-${kit.id}`,
      heading: 'h2',
      locale: { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' },
    });
    if (!filled.ok) return [];
    const role = ROLE_NAMES[kit.role];
    return [
      {
        id: `kit-${kit.id}`,
        name: `${role.en} · ${kit.summary}`,
        nameAr: `${role.ar} · ${KIT_SUMMARY_AR[kit.id] ?? kit.summary}`,
        group: lang === 'ar' ? role.ar : role.en,
        tree: filled.tree as unknown as LibrarySectionEntry['tree'],
        ...(filled.css === '' ? {} : { css: filled.css }),
        pageKit,
      },
    ];
  });
}
