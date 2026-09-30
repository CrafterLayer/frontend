import { PHOTO_CATALOG_ENTRIES, type PhotoCatalogEntry, type PhotoTopic } from '../context/providers/photo-catalog.data';

/**
 * Alt text a machine can write honestly.
 *
 * A catalog photo was LOOKED AT when it entered the catalog, and its entry
 * carries a description of what is actually in the picture in both languages;
 * that is the best alt text there is. Any other image is described by what the
 * page says about it — the section it sits in — which is weaker but true.
 * Nothing here invents what a picture shows.
 */

/** The catalog's subjects in words, per language: the fallback when an entry has no alt. */
export const PHOTO_TOPIC_LABELS: Readonly<Record<PhotoTopic, { readonly ar: string; readonly en: string }>> = {
  barber: { ar: 'صالون حلاقة', en: 'Barbershop' },
  business: { ar: 'فريق عمل في مكتب', en: 'Business team at work' },
  cafe: { ar: 'مقهى وقهوة مختصة', en: 'Café and specialty coffee' },
  car: { ar: 'معرض سيارات', en: 'Car showroom' },
  charity: { ar: 'عمل خيري وتطوع', en: 'Charity and volunteering' },
  city: { ar: 'أفق المدينة', en: 'City skyline' },
  construction: { ar: 'موقع إنشاءات', en: 'Construction site' },
  dental: { ar: 'عيادة أسنان', en: 'Dental clinic' },
  farm: { ar: 'مزرعة', en: 'Farm' },
  fashion: { ar: 'أزياء', en: 'Fashion' },
  gym: { ar: 'نادٍ رياضي', en: 'Gym' },
  hotel: { ar: 'فندق', en: 'Hotel' },
  law: { ar: 'مكتب محاماة', en: 'Law office' },
  medical: { ar: 'رعاية طبية', en: 'Medical care' },
  perfume: { ar: 'عطور', en: 'Perfume' },
  ramadan: { ar: 'أجواء رمضان', en: 'Ramadan atmosphere' },
  realestate: { ar: 'عقار سكني', en: 'Residential property' },
  restaurant: { ar: 'مطعم وأطباق', en: 'Restaurant dishes' },
  sweets: { ar: 'حلويات', en: 'Sweets' },
  tech: { ar: 'تقنية', en: 'Technology' },
  travel: { ar: 'سفر', en: 'Travel' },
  wedding: { ar: 'حفل زفاف', en: 'Wedding' },
};

/** Host + path, lower-cased host, `&amp;` read as `&`: the same key the catalog guard uses. */
function photoKey(url: string): string | undefined {
  const match = /^https:\/\/([^/?#\s'"]+)(\/[^?#\s'"]*)/u.exec(url.replaceAll('&amp;', '&').trim());
  if (match === null) return undefined;
  return `${(match[1] ?? '').toLowerCase()}${match[2] ?? ''}`;
}

const BY_KEY: ReadonlyMap<string, PhotoCatalogEntry> = new Map(
  PHOTO_CATALOG_ENTRIES.flatMap((entry) => {
    const key = photoKey(entry.url);
    return key === undefined ? [] : [[key, entry] as const];
  }),
);

/** The catalog entry an image address points at, however its query was written. */
export function catalogEntryFor(src: string): PhotoCatalogEntry | undefined {
  const key = photoKey(src);
  return key === undefined ? undefined : BY_KEY.get(key);
}

function isArabicLang(lang: string): boolean {
  return lang.trim().toLowerCase().split(/[-_]/u)[0] === 'ar';
}

const MAX_ALT = 125;

function clampAlt(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  if (flat.length <= MAX_ALT) return flat;
  const cut = flat.slice(0, MAX_ALT);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).trim();
}

export interface AltImage {
  readonly src: string;
  /** A catalog topic the caller already knows, when the src is not a catalog address. */
  readonly topic?: PhotoTopic;
}

/**
 * Alt text for an image, in the page's language, never empty.
 *
 * Order: the catalog entry's own description (it was written from the
 * picture) → the topic label, with the section heading when there is one → the
 * section heading → a plain word for "image" so the attribute is never blank
 * (a blank alt tells assistive tech the picture is decoration, which a caller
 * that asked for alt text did not mean).
 */
export function altFor(image: AltImage, sectionHeading: string, lang: string): string {
  const arabic = isArabicLang(lang);
  const heading = sectionHeading.replace(/\s+/gu, ' ').trim();
  const entry = catalogEntryFor(image.src);
  if (entry !== undefined) {
    const described = arabic ? entry.alt.ar : entry.alt.en;
    if (described.trim() !== '') return clampAlt(described);
  }
  const topic = entry?.topic ?? image.topic;
  if (topic !== undefined) {
    const label = arabic ? PHOTO_TOPIC_LABELS[topic].ar : PHOTO_TOPIC_LABELS[topic].en;
    return clampAlt(heading === '' ? label : `${label} — ${heading}`);
  }
  if (heading !== '') return clampAlt(arabic ? `صورة: ${heading}` : `Image: ${heading}`);
  return arabic ? 'صورة' : 'Image';
}
