import type { JsonValue } from '@craftkit/builder-schema';

import { channelIcon, pickCatalogPhoto } from './kit-slots';
import { defaultPlanKit, kitFitsRole, planKit } from './kits';
import type {
  PagePlanBusinessType,
  PagePlanFact,
  PagePlanIssue,
  PagePlanLink,
  PagePlanLocale,
  PagePlanNavItem,
  PagePlanSeo,
  SectionContract,
} from './types';

/*
  Page completions (quality pass 2026-10-05, measure-v2 runs): what a whole
  page always has, decided by CODE when the planner leaves it out, so a
  missing part never costs a repair round and never ships.

  - the English SaaS plan had no header: every full page gets a header (brand,
    menu, action) and a footer;
  - its footer showed the title cut off ("Project management software for
    teams…"): the brand is a short name, never a truncated sentence;
  - its SEO business was LocalBusiness: a software page is an Organization;
  - its hero had no photo while the catalog had one for the subject;
  - the Arabic booking section was a heading and a button: on a local
    business page it is the contact kit, filled with phone, WhatsApp, hours
    and address from the facts.
*/

// ── The brand ───────────────────────────────────────────────────────────────

const TITLE_SEPARATOR = /\s+[|·•—–:-]\s+/u;
const BRAND_MAX = 40;
/** A name runs at most this many words; a longer part is a tagline. */
const BRAND_WORDS_MAX = 4;
/** Fact keys that hold the business's own name. */
const BRAND_FACT =
  /^(?:(?:brand|company|business|site|shop|store|restaurant|cafe|clinic|firm|product|app|studio|salon)(?:-name)?|name)$/u;
/** Words a short name never ends on: "Project management software for" → "Project management software". */
const TRAILING_WORDS = new Set(
  'a an and the of for in on at to with by from your our that which is are — – - | في من على مع عن الى إلى و ل لـ ب التي الذي'.split(' '),
);

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/u).filter((word) => word !== '');
}

/** The first two to four words of a phrase, never ending on a joining word or punctuation. */
function leadingName(text: string): string {
  const words = wordsOf(text).slice(0, BRAND_WORDS_MAX - 1);
  while (words.length > 1) {
    const last = words.at(-1) ?? '';
    const bare = last.replace(/[,.;:!?،؛]+$/u, '').toLowerCase();
    if (TRAILING_WORDS.has(bare) || bare === '') {
      words.pop();
      continue;
    }
    break;
  }
  return words.join(' ').replace(/[,.;:!?،؛]+$/u, '');
}

/**
 * The business's short name (≤ 40 characters, ≤ 4 words), never a truncated
 * sentence: the plan's `brand`; else a fact that names the business
 * (`brand`, `company-name`, …); else the shortest part of a title split at an
 * SEO separator when that part is name-length ("Name | Tagline", "Tagline —
 * Name"); else the first words of the title, cut before a joining word.
 */
export function shortBrand(input: {
  readonly brand?: string;
  readonly title: string;
  readonly facts?: readonly Pick<PagePlanFact, 'key' | 'sample'>[];
}): string {
  const fits = (text: string | undefined): text is string =>
    text !== undefined &&
    text.trim() !== '' &&
    text.trim().length <= BRAND_MAX &&
    wordsOf(text).length <= BRAND_WORDS_MAX + 1;
  if (fits(input.brand)) return input.brand.trim();
  const fact = input.facts?.find(({ key, sample }) => BRAND_FACT.test(key) && fits(sample));
  if (fact !== undefined) return fact.sample.trim();
  const parts = input.title
    .split(TITLE_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length > 1) {
    const shortest = parts.reduce((best, part) =>
      wordsOf(part).length < wordsOf(best).length ? part : best,
    );
    if (fits(shortest) && wordsOf(shortest).length <= BRAND_WORDS_MAX) return shortest;
  }
  const lead = leadingName(parts[0] ?? input.title);
  return lead === '' ? input.title.trim().slice(0, BRAND_MAX) : lead.slice(0, BRAND_MAX);
}

// ── The SEO business type ───────────────────────────────────────────────────

/** Local trades, most specific first: a dental clinic is a Dentist before it is a clinic. */
const LOCAL_KINDS: readonly (readonly [PagePlanBusinessType, RegExp, readonly string[]])[] = [
  ['Dentist', /\b(?:dentists?|dental|orthodont\w*)\b/iu, ['أسنان', 'تقويم']],
  ['MedicalClinic', /\b(?:clinics?|medical|doctors?|physician|pediatric\w*|dermatolog\w*)\b/iu, ['عيادة', 'عيادات', 'طبيب', 'طبي', 'مركز صحي']],
  ['LegalService', /\b(?:law firm|lawyers?|attorneys?|legal|advocates?)\b/iu, ['محامي', 'محاماة', 'محاماه', 'قانوني', 'استشارات قانونية']],
  ['Bakery', /\b(?:bakery|bakeries|patisserie|pastry|pastries)\b/iu, ['مخبز', 'مخابز', 'معجنات', 'حلويات']],
  ['CafeOrCoffeeShop', /\b(?:caf[eé]s?|coffee|roaster(?:y|s)?|espresso)\b/iu, ['مقهى', 'قهوة', 'كافيه', 'كوفي', 'محمصة']],
  ['Restaurant', /\b(?:restaurants?|grill|bbq|barbecue|diner|bistro|eatery|steakhouse|pizzeria|kitchen)\b/iu, ['مطعم', 'مطاعم', 'مشاوي', 'مشويات', 'مأكولات', 'شاورما', 'منسف']],
  ['BeautySalon', /\b(?:salon|beauty|barbers?|barbershop|spa|nails?)\b/iu, ['صالون', 'تجميل', 'حلاق', 'سبا']],
  ['Store', /\b(?:shop|store|boutique|florist)\b/iu, ['متجر', 'محل', 'بوتيك']],
];

/** Software and online products: never a place a visitor walks into. Strong words win over a trade. */
const SOFTWARE_STRONG = {
  latin: /\b(?:saas|software|crm|erp|sdk|apis?|b2b|project[- ]management|devops)\b/iu,
  arabic: ['برمجيات', 'نظام إدارة', 'إدارة المشاريع'],
};
/** Words software pages use that a café's page may also say ("order in our app"): only without a trade. */
const SOFTWARE_WEAK = {
  latin: /\b(?:apps?|platform|startup|cloud|dashboard|plugin|subscription|online tool|workflows?|automation|analytics)\b/iu,
  arabic: ['برنامج', 'تطبيق', 'منصة', 'سحابي', 'سحابية'],
};

const LOCAL_TYPES: ReadonlySet<PagePlanBusinessType> = new Set([
  'Restaurant',
  'CafeOrCoffeeShop',
  'Bakery',
  'Dentist',
  'MedicalClinic',
  'LegalService',
  'Store',
  'BeautySalon',
  'LocalBusiness',
]);

/** Whether a business type is a place people visit or call (schema.org LocalBusiness and its kinds). */
export function isLocalBusinessType(type: PagePlanBusinessType | undefined): boolean {
  return type !== undefined && LOCAL_TYPES.has(type);
}

function mentions(text: string, latin: RegExp, arabic: readonly string[]): boolean {
  return latin.test(text) || arabic.some((word) => text.includes(word));
}

/**
 * The schema.org business type the page's own words support, or `undefined`
 * when they name no kind. Software, SaaS, apps and online products are an
 * `Organization` (the schema has no SoftwareApplication business; a Product
 * node comes from the page's priced content, `deriveSchemaKinds`); a local
 * trade is its LocalBusiness kind.
 */
export function businessKindOf(text: string): PagePlanBusinessType | undefined {
  const local = LOCAL_KINDS.find(([, latin, arabic]) => mentions(text, latin, arabic))?.[0];
  // "Restaurant booking software" is software; "a grill you order from in our app" is a restaurant.
  if (mentions(text, SOFTWARE_STRONG.latin, SOFTWARE_STRONG.arabic)) return 'Organization';
  if (local === undefined && mentions(text, SOFTWARE_WEAK.latin, SOFTWARE_WEAK.arabic)) {
    return 'Organization';
  }
  return local;
}

/**
 * The plan's SEO with a business type its words support: a SaaS page the
 * planner called LocalBusiness becomes an Organization; a generic
 * LocalBusiness whose words name a trade becomes that trade; a named type the
 * words do not contradict is kept. A warning says what changed.
 */
export function withBusinessType(
  seo: PagePlanSeo | undefined,
  text: string,
  warnings: PagePlanIssue[],
  fillMissing = false,
): PagePlanSeo | undefined {
  if (seo === undefined) return undefined;
  const written = seo.businessType;
  const kind = businessKindOf(text);
  let next = written;
  if (kind === 'Organization' && isLocalBusinessType(written)) next = 'Organization';
  else if (
    kind !== undefined &&
    kind !== 'Organization' &&
    (written === 'LocalBusiness' || (written === undefined && fillMissing))
  ) {
    next = kind;
  }
  if (next === written) return seo;
  warnings.push({
    path: 'seo.businessType',
    message: `"${written ?? '(none)'}" → "${next ?? '(none)'}": the page's own words name ${next === 'Organization' ? 'software or an online product, not a place people visit' : `a ${next ?? ''}`}.`,
  });
  return next === undefined ? seo : { ...seo, businessType: next };
}

// ── Header, footer and the menu ─────────────────────────────────────────────

const CHROME_COPY: Readonly<
  Record<string, { readonly header: string; readonly footer: string }>
> = {
  ar: { header: 'رأس الصفحة', footer: 'التذييل' },
  en: { header: 'Header', footer: 'Footer' },
};

const NAV_LABEL_MAX = 24;
const NAV_DERIVED_MAX = 5;

function freeSlug(wanted: string, taken: ReadonlySet<string>): string {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; ; n += 1) {
    const next = `${wanted}-${String(n)}`;
    if (!taken.has(next)) return next;
  }
}

/** A section title as a menu label: whole when short, else its first words. */
function navLabel(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= NAV_LABEL_MAX) return trimmed;
  const lead = leadingName(trimmed);
  return lead.length <= NAV_LABEL_MAX ? lead : `${lead.slice(0, NAV_LABEL_MAX - 1).trimEnd()}…`;
}

/**
 * Every full page has a header first and a footer last (an appended plan has
 * neither — the page already does). Each is added when missing and room is
 * left under `maxSections`; code writes both from the plan, so neither costs
 * a writer. A page with a header and no menu gets one from its middle
 * sections' anchors; a page without a header has no menu.
 */
export function withPageChrome(input: {
  readonly sections: readonly SectionContract[];
  readonly nav: readonly PagePlanNavItem[];
  readonly locale: PagePlanLocale;
  readonly maxSections: number;
  readonly warnings: PagePlanIssue[];
}): { readonly sections: readonly SectionContract[]; readonly nav: readonly PagePlanNavItem[] } {
  const { locale, maxSections, warnings } = input;
  const copy = CHROME_COPY[locale.lang.split('-')[0] ?? ''] ?? CHROME_COPY['en'];
  let sections = [...input.sections];
  const taken = new Set(sections.flatMap(({ key, anchorId }) => [key, anchorId]));
  if (!sections.some(({ role }) => role === 'header') && sections.length < maxSections) {
    const key = freeSlug('header', taken);
    taken.add(key);
    sections = [
      {
        key,
        role: 'header',
        title: copy?.header ?? 'Header',
        anchorId: key,
        purpose: 'The brand, the menu and the page’s one action.',
        mustSay: [],
        mustNotRepeat: [],
      },
      ...sections,
    ];
    warnings.push({ path: 'sections', message: 'The plan had no header; one was added (brand, menu, action).' });
  }
  if (!sections.some(({ role }) => role === 'footer') && sections.length < maxSections) {
    const key = freeSlug('footer', taken);
    sections = [
      ...sections,
      {
        key,
        role: 'footer',
        title: copy?.footer ?? 'Footer',
        anchorId: key,
        purpose: 'The brand, the menu and the contact details.',
        mustSay: [],
        mustNotRepeat: [],
      },
    ];
    warnings.push({ path: 'sections', message: 'The plan had no footer; one was added.' });
  }
  const hasHeader = sections.some(({ role }) => role === 'header');
  let nav = input.nav;
  if (!hasHeader) nav = [];
  else if (nav.length === 0) {
    nav = sections
      .filter(({ role }) => role === 'band' || role === 'cta')
      .slice(0, NAV_DERIVED_MAX)
      .map(({ title, anchorId }) => ({ label: navLabel(title), anchorId }));
    if (nav.length > 0) {
      warnings.push({ path: 'nav', message: `The header had no menu; it links to ${String(nav.length)} sections.` });
    }
  }
  return { sections, nav };
}

// ── The hero's photo ────────────────────────────────────────────────────────

/** The hero kit a photo moves a type-only hero to. */
const HERO_PHOTO_KIT = 'hero-split';

/**
 * A hero with no image on a page whose words match a catalog subject gets the
 * best catalog photo for the page, and a hero kit that shows one. The person's
 * own photos (`hasOwnPhotos`) are the writer's business, not this.
 */
export function withHeroPhoto(
  section: SectionContract,
  page: { readonly brief: string; readonly locale: PagePlanLocale },
  path: string,
  warnings: PagePlanIssue[],
): SectionContract {
  if (section.role !== 'hero') return section;
  /*
    Decided from the plan's head and the hero's title ONLY — the same answer on
    the streamed outline (before any brief) and on the final plan, so the
    hero's kit never differs between the two (plan-draft reconcilePlans
    compares kits). A software page names no photo subject in its own words
    ("Project management made simple — Taskflow"), so its kind lends one.
  */
  const software = businessKindOf(page.brief) === 'Organization' ? ' software' : '';
  const photo = pickCatalogPhoto(`${page.brief} ${section.title}${software}`, new Set(), 'landscape');
  if (photo === undefined) return section;
  const named = planKit(section.kit);
  const kit =
    (named !== undefined && kitFitsRole(named, 'hero') ? named : undefined) ??
    defaultPlanKit(section.variant, 'hero');
  const showsPhoto = kit === undefined || Object.values(kit.slots).some(({ kind }) => kind === 'image');
  const hasImages = (section.images?.length ?? 0) > 0;
  if (hasImages && showsPhoto) return section;
  const arabic = page.locale.lang.toLowerCase().startsWith('ar');
  const image = { subject: photo.subject, aspect: 'landscape' as const, alt: arabic ? photo.alt.ar : photo.alt.en };
  warnings.push({
    path: `${path}.images`,
    message: `The hero ${hasImages ? 'had a photo its kit cannot show' : 'had no photo'}; it shows ${hasImages ? 'its photo' : `the catalog's "${photo.subject}" photo`}${showsPhoto ? '' : ` in kit "${HERO_PHOTO_KIT}" (was "${section.kit ?? ''}")`}.`,
  });
  return {
    ...section,
    ...(hasImages ? {} : { images: [image] }),
    ...(showsPhoto ? {} : { kit: HERO_PHOTO_KIT }),
  };
}

// ── The booking / contact section of a local business ──────────────────────

const CONTACT_KIT = 'contact-split';
/** Kits a contact section is moved FROM: a call to action with no room for details. */
const BARE_ACTION_KITS = new Set(['cta-band', 'cta-split', 'cta-card']);
const CONTACT_WORDS = {
  latin: /\b(?:book(?:ing)?|reserv\w*|contact|visit|find us|call us|hours|location|whatsapp)\b/iu,
  arabic: ['حجز', 'احجز', 'الحجز', 'تواصل', 'اتصل', 'زورونا', 'زيارة', 'موقعنا', 'العنوان', 'واتساب', 'ساعات'],
};
const FACT_ROLES = {
  whatsapp: /whats|wa-?me|(?:^|-)wa(?:-|$)|واتس/iu,
  phone: /phone|tel|mobile|call|هاتف|جوال|رقم/iu,
  hours: /hour|open|time|schedule|ساعات|دوام|مواعيد/iu,
  address: /address|location|addr|street|عنوان|موقع/iu,
};
const CHANNELS_MAX = 4;

const CONTACT_COPY: Readonly<Record<string, { readonly whatsapp: string; readonly hours: string }>> = {
  ar: { whatsapp: 'واتساب', hours: 'ساعات العمل' },
  en: { whatsapp: 'WhatsApp', hours: 'Opening hours' },
};

function digitsOf(text: string): string {
  return text
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/gu, '');
}


/**
 * A booking or contact section of a local business, as the contact kit filled
 * from the facts: the page's action first, then the phone (a `tel:` link) and
 * WhatsApp (`wa.me`), the opening hours and the address — so the section a
 * visitor scrolls to in order to book says how. Returned unchanged when the
 * page is not a local business, the section is not about booking or contact,
 * it already has a richer kit, or the facts hold no detail to show.
 */
export function withContactDetails(
  section: SectionContract,
  page: {
    readonly local: boolean;
    readonly facts: readonly PagePlanFact[];
    readonly primaryCta: PagePlanLink;
    readonly locale: PagePlanLocale;
  },
  path: string,
  warnings: PagePlanIssue[],
): SectionContract {
  if (!page.local || (section.role !== 'cta' && section.role !== 'band')) return section;
  if (section.kit !== undefined && !BARE_ACTION_KITS.has(section.kit)) return section;
  // The outline's words only (key, anchor, title): the brief's purpose streams in later.
  const words = [section.key.replace(/-/gu, ' '), section.anchorId.replace(/-/gu, ' '), section.title].join(' ');
  if (!mentions(words, CONTACT_WORDS.latin, CONTACT_WORDS.arabic)) return section;

  const copy = CONTACT_COPY[page.locale.lang.split('-')[0] ?? ''] ?? CONTACT_COPY['en'];
  const factOf = (role: keyof typeof FACT_ROLES): PagePlanFact | undefined =>
    page.facts.find(({ key }) => FACT_ROLES[role].test(key) && (role === 'phone' ? !FACT_ROLES.whatsapp.test(key) : true));
  const channels: { icon: string; label: string; href: string }[] = [
    { icon: channelIcon(page.primaryCta.href), label: page.primaryCta.label, href: page.primaryCta.href },
  ];
  const addChannel = (channel: { icon: string; label: string; href: string }): void => {
    if (channels.length < CHANNELS_MAX && !channels.some(({ href }) => href === channel.href)) channels.push(channel);
  };
  const phone = factOf('phone');
  const phoneDigits = phone === undefined ? '' : digitsOf(phone.sample);
  if (phone !== undefined && phoneDigits.length >= 7) {
    addChannel({ icon: 'phone', label: phone.sample.trim(), href: `tel:${phone.sample.trim().startsWith('+') ? '+' : ''}${phoneDigits}` });
  }
  const whatsapp = factOf('whatsapp');
  const waDigits = digitsOf(whatsapp?.sample ?? '') || (/wa\.me/iu.test(page.primaryCta.href) ? '' : phoneDigits);
  if (waDigits.length >= 7) {
    addChannel({ icon: 'message-circle', label: copy?.whatsapp ?? 'WhatsApp', href: `https://wa.me/${waDigits}` });
  }
  const hoursFact = factOf('hours');
  const hours: { day: string; time: string }[] = [];
  if (hoursFact !== undefined) {
    const sample = hoursFact.sample.trim();
    const split = /^(.{2,40}?)\s*[:：]\s+(.+)$/u.exec(sample);
    hours.push(split === null ? { day: copy?.hours ?? 'Opening hours', time: sample } : { day: split[1] ?? '', time: split[2] ?? '' });
  }
  const address = factOf('address')?.sample.trim();
  /*
    The kit is chosen from the outline alone, so the streamed outline and the
    final plan agree; the details are whatever the facts hold by then (none
    yet on the streamed outline, which the final plan's finish fills in).
  */

  const written = section.slots ?? {};
  const text = (name: string): string | undefined => {
    const value = written[name];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  };
  const lead = text('lead') ?? (section.mustSay.length > 0 ? section.mustSay.join(' · ') : undefined);
  const slots: Record<string, JsonValue> = {
    title: text('title') ?? section.title,
    ...(text('eyebrow') === undefined ? {} : { eyebrow: text('eyebrow') ?? '' }),
    ...(lead === undefined ? {} : { lead }),
    channels,
    ...(hours.length === 0 ? {} : { hours }),
    ...(address === undefined ? {} : { address }),
  };
  warnings.push({
    path: `${path}.kit`,
    message: `A local business's ${section.role === 'cta' ? 'booking' : 'contact'} section shows how to reach it: kit "${CONTACT_KIT}" (was "${section.kit ?? '(none)'}") filled with the action, ${[phone === undefined ? '' : 'phone', waDigits.length >= 7 ? 'WhatsApp' : '', hours.length > 0 ? 'hours' : '', address === undefined ? '' : 'address'].filter((part) => part !== '').join(', ')} from the facts.`,
  });
  return { ...section, kit: CONTACT_KIT, slots };
}
