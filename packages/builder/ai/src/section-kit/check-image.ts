import { safeCustomCodeUrl } from '@craftkit/builder-schema';

import { isArtSpec, resolveArtImage } from '../art-catalog/runtime';
import { selectCatalogPhotos } from '../context/providers/photo-catalog';
import { catalogEntryFor } from '../seo/alt-text';
import {
  clampText,
  cleanText,
  isRecord,
  slotShape,
  type CheckContext,
  type SlotCheck,
} from './slot-values';

/**
 * A kit's image slot, checked (DESIGN §B): an https photo address with its
 * alt, a catalog `subject` resolved to the nearest verified photo, or (art
 * catalog, 2026-10-14) an art spec in `src` — a named brand's logo, a
 * cartoon character, an illustration — resolved against the verified art
 * catalog with its alt in the page language. Split from instantiate.ts.
 */

/** An art spec in a slot: the catalog's address, the call's alt or the catalog's own. */
function checkArtImage(
  where: string,
  value: Record<string, unknown>,
  context: CheckContext,
): SlotCheck {
  const alt = typeof value['alt'] === 'string' ? cleanText(value['alt']) : undefined;
  const art = resolveArtImage(String(value['src']), { locale: context.lang, alt });
  if (!art.ok) return { ok: false, error: `slot "${where}": ${art.error}` };
  return { ok: true, value: { src: art.value.src, alt: clampText(art.value.alt, 180) } };
}

/** The catalog subject a photo falls back to when the one named matches nothing. */
const GENERIC_PHOTO_SUBJECT = 'business';

export function checkImage(where: string, value: unknown, context: CheckContext): SlotCheck {
  if (!isRecord(value)) {
    return { ok: false, error: `slot "${where}" is an image: ${slotShape({ kind: 'image' })}.` };
  }
  // art catalog (2026-10-14): a src such as 'logo:visa' or 'illustration:doctor' is resolved, alt optional.
  if (isArtSpec(value['src'])) return checkArtImage(where, value, context);
  let src = typeof value['src'] === 'string' ? value['src'].trim() : '';
  let alt = typeof value['alt'] === 'string' ? cleanText(value['alt']) : '';
  if (src === '' && typeof value['subject'] === 'string' && value['subject'].trim() !== '') {
    const subject = value['subject'];
    const pick = (brief: string) =>
      selectCatalogPhotos(brief, { exclude: (entry) => context.usedPhotos.has(entry.url) })[0];
    /*
      The nearest catalog photo, never a refusal (fix pass 2026-10-05): the
      subject, then the subject with its alt, then the generic business photo.
      "freelancer sending professional invoice on laptop" matched no topic,
      and the refusal cost the English features section a whole repair round
      while five finished sections below it waited to land.
    */
    const exact = pick(subject) ?? (alt === '' ? undefined : pick(`${subject} ${alt}`));
    const photo = exact ?? pick(GENERIC_PHOTO_SUBJECT);
    if (photo === undefined) {
      return {
        ok: false,
        error: `slot "${where}": no catalog photo matches subject "${subject}"; name a plainer subject (coffee, bakery, clinic, office, team) or give "src" from PHOTOS YOU MAY USE.`,
      };
    }
    src = photo.url;
    // A generic stand-in is described as what it shows, not as what was asked for.
    if (alt === '' || exact === undefined) {
      alt = context.lang.startsWith('ar') ? photo.alt.ar : photo.alt.en;
    }
  }
  /*
    A catalog photo is described by its own entry, written from the picture
    (walk 2026-10-08): a labneh bowl went out as «مائدة أرز وسلطات ومشاوي»
    because the writer's alt described the photo it hoped for.
  */
  const described = catalogEntryFor(src)?.alt;
  const own =
    described === undefined ? '' : context.lang.startsWith('ar') ? described.ar : described.en;
  if (own.trim() !== '') alt = cleanText(own);
  if (src === '') {
    return {
      ok: false,
      error: `slot "${where}" needs "src" (an https photo address) or "subject".`,
    };
  }
  if (!src.startsWith('https://') || safeCustomCodeUrl(src) === undefined) {
    return { ok: false, error: `slot "${where}": "src" must be an https:// address.` };
  }
  if (alt === '') {
    return {
      ok: false,
      error: `slot "${where}" needs "alt": say what the photo shows, in the page's language.`,
    };
  }
  context.usedPhotos.add(src);
  return { ok: true, value: { src, alt: clampText(alt, 180) } };
}
