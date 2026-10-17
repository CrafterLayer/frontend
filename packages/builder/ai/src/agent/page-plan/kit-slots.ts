import { isLucideIconName, type JsonValue } from '@craftkit/builder-schema';

import { selectCatalogPhotos, type CatalogPhoto } from '../../context/providers/photo-catalog';
import type { PhotoOrientation } from '../../context/providers/photo-catalog.data';
import type { SectionKit, SectionKitSlot } from '../../section-kit';
import type { PagePlanLink, SectionContract, SectionRole } from './types';

/*
  Kit slots completed by CODE (quality pass 2026-10-05, measure-v2): every
  live run spent a whole repair round on `kit "features-bento" needs slot
  "caption"` (and once on cta-split's `cta`) — words the contract already
  holds. A slot code can derive is filled from the contract, an optional slot
  that would refuse the step is dropped, and only content no contract holds (a
  required list, a list item without its title) is left for the repair round.

  And photos (same pass): every image slot written as `{subject, alt}` was
  resolved per section, so the Arabic page showed the same restaurant photo in
  the hero and the features band. `pagePhotoPlan` assigns each contract image
  a DISTINCT catalog photo in page order, once per plan, and `fillSlotPhotos`
  writes those addresses into the slots.
*/

/** The same address policy as the kit instantiator's link and `href` slots (section-kit SAFE_HREF). */
const SAFE_HREF =
  /^(?:#[^\s'"<>]{1,120}|\/[^\s'"<>]{0,300}|https:\/\/[^\s'"<>]{1,500}|mailto:[^\s'"<>]{3,200}|tel:\+?[\d\s().-]{3,40})$/u;

/** The icon a required icon slot takes when the writer named none that exists. */
const FALLBACK_ICON = 'check';

type Slots = Readonly<Record<string, JsonValue>>;

function isRecord(value: unknown): value is Readonly<Record<string, JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Present as the kit instantiator counts it: blank strings, empty lists and empty objects are not. */
function present(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.values(value).some(present);
  return true;
}

/**
 * An address a writer almost wrote right, made safe: a space or Arabic text
 * in a query (`https://wa.me/962…?text=احجز طاولة`, measure-v3 run 2 — a
 * repair round), `wa.me/…` without its scheme, a bare phone number, http:.
 * `undefined` when it cannot be one.
 */
export function repairedHref(raw: string): string | undefined {
  let href = raw.trim();
  if (SAFE_HREF.test(href)) return href;
  if (/^(?:www\.)?wa\.me\//iu.test(href)) href = `https://${href.replace(/^www\./iu, '')}`;
  else if (/^\+?[\d\s().-]{7,}$/u.test(href)) href = `tel:${href.replace(/[^\d+]/gu, '')}`;
  else if (/^http:\/\//iu.test(href)) href = `https://${href.slice('http://'.length)}`;
  if (/^https:\/\//iu.test(href)) {
    try {
      href = encodeURI(decodeURI(href));
    } catch {
      href = encodeURI(href);
    }
  }
  return SAFE_HREF.test(href) ? href : undefined;
}

/** A link whose only fault is its address, with the address repaired; else undefined. */
function repairedLink(value: unknown): JsonValue | undefined {
  if (!isRecord(value) || typeof value['href'] !== 'string') return undefined;
  const label = value['label'];
  if (typeof label !== 'string' || label.trim() === '') return undefined;
  const href = repairedHref(value['href']);
  return href === undefined ? undefined : { ...value, href };
}

function safeLink(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const label = value['label'];
  const href = value['href'];
  return (
    typeof label === 'string' &&
    label.trim() !== '' &&
    typeof href === 'string' &&
    SAFE_HREF.test(href.trim())
  );
}

/** What a kit's slots may be completed from: the section's contract and the page's action. */
export interface KitSlotContext {
  readonly contract: Pick<SectionContract, 'title' | 'purpose' | 'mustSay' | 'images'> & {
    /** A hero or a cta must carry the page's action (the checker asks for it): code adds it. */
    readonly role?: SectionRole;
  };
  readonly primaryCta?: PagePlanLink;
  /** The page's title and description: where a required photo with no contract image comes from. */
  readonly pageBrief?: string;
}

/** The icon a contact channel takes for where it leads. */
export function channelIcon(href: string): string {
  if (href.startsWith('tel:')) return 'phone';
  if (/wa\.me|whatsapp/iu.test(href)) return 'message-circle';
  if (href.startsWith('mailto:')) return 'mail';
  return 'calendar';
}

function isAction(value: unknown, action: PagePlanLink): boolean {
  return (
    isRecord(value) &&
    typeof value['label'] === 'string' &&
    value['label'].trim() === action.label.trim() &&
    typeof value['href'] === 'string' &&
    value['href'].trim() === action.href.trim()
  );
}

/**
 * A hero's or cta's slots with the page's action on them: the measure-v2
 * Arabic booking section (contact-split) listed phone and WhatsApp but not
 * "احجز الآن", and the checker's "Add the page's action" cost a 6 s repair
 * round. An empty optional `cta` link takes it; else a list of links
 * (contact channels) gets it first. A section that already carries it, or a
 * kit with nowhere to put it, is left as is.
 */
function withAction(
  kit: SectionKit,
  slots: Record<string, JsonValue>,
  action: PagePlanLink,
  changes: string[],
): void {
  const entries = Object.entries(kit.slots);
  const carried = entries.some(([name, slot]) => {
    const value = slots[name];
    if (slot.kind === 'link') return isAction(value, action);
    return slot.kind === 'list' && Array.isArray(value) && value.some((item) => isAction(item, action));
  });
  if (carried) return;
  const link = entries.find(([name, slot]) => slot.kind === 'link' && name === 'cta');
  if (link !== undefined && !present(slots[link[0]])) {
    slots[link[0]] = { label: action.label, href: action.href };
    changes.push(`${link[0]} ← the primary action (a hero or cta carries it)`);
    return;
  }
  const list = entries.find(
    ([, slot]) =>
      slot.kind === 'list' &&
      slot.item?.['label'] !== undefined &&
      slot.item['href'] !== undefined,
  );
  if (list === undefined) return;
  const [name, slot] = list;
  const current = slots[name];
  const items: JsonValue[] = Array.isArray(current) ? [...current] : [];
  const entry: Record<string, JsonValue> = { label: action.label, href: action.href };
  if (slot.item?.['icon'] !== undefined) entry['icon'] = channelIcon(action.href);
  slots[name] = [entry, ...items].slice(0, slot.max ?? items.length + 1);
  changes.push(`${name} ← the primary action first (a hero or cta carries it)`);
}

export interface CompletedKitSlots {
  readonly slots: Slots;
  /** One line per change, phrased as what was done (`caption ← the first claim`). */
  readonly changes: readonly string[];
}

/** A required top-level text the contract can say: the title, a caption, a highlight. */
function derivedText(name: string, context: KitSlotContext): string | undefined {
  const { contract } = context;
  const claim = contract.mustSay.find((text) => text.trim() !== '');
  if (name === 'title') return contract.title;
  if (name === 'caption') return claim ?? contract.images?.[0]?.alt ?? contract.title;
  return claim ?? contract.purpose;
}

function derivedImage(context: KitSlotContext): JsonValue | undefined {
  const image = context.contract.images?.[0];
  if (image !== undefined) return { subject: image.subject, alt: image.alt };
  // A kit that needs a photo on a type-led contract (measure-v3 run 2: features-bento,
  // a repair round): the page's best catalog subject; `fillSlotPhotos` picks a free photo.
  if (context.pageBrief === undefined) return undefined;
  const photo = pickCatalogPhoto(`${context.pageBrief} ${context.contract.title}`, new Set());
  return photo === undefined ? undefined : { subject: photo.subject, alt: context.contract.title };
}

type Outcome = { readonly keep: true; readonly value: JsonValue } | { readonly keep: false };

/**
 * One list item completed against the item's fields: an invalid optional
 * field is dropped, a missing or unknown required icon becomes a plain one,
 * a missing or broken required link takes the page's action. An item missing
 * required WORDS cannot be completed (`keep: false`) — and then the whole
 * list is left as written, never thinned: measure-v3 run 1 dropped two of
 * three pricing tiers whose buttons said `href: "#"`.
 */
function completeItem(
  fields: Readonly<Record<string, SectionKitSlot>>,
  raw: JsonValue,
  action: PagePlanLink | undefined,
): Outcome {
  const names = Object.keys(fields);
  // A one-field item may be the bare value (`"features":["…"]`); the kit reads it as written.
  if (!isRecord(raw)) return names.length === 1 && present(raw) ? { keep: true, value: raw } : { keep: false };
  const out: Record<string, JsonValue> = { ...raw };
  let changed = false;
  for (const [name, field] of Object.entries(fields)) {
    const value = out[name];
    const required = field.required === true;
    const valid =
      present(value) &&
      (field.kind === 'icon'
        ? typeof value === 'string' && isLucideIconName(value.trim())
        : field.kind === 'link'
          ? safeLink(value)
          : field.kind === 'text'
            ? (typeof value === 'string' || typeof value === 'number') &&
              (name !== 'href' || SAFE_HREF.test(String(value).trim()))
            : true);
    if (valid) continue;
    // An address one step from right is repaired in place, the item's words kept.
    const fixed =
      field.kind === 'link'
        ? repairedLink(value)
        : field.kind === 'text' && name === 'href' && typeof value === 'string'
          ? repairedHref(value)
          : undefined;
    if (fixed !== undefined) {
      out[name] = fixed;
      changed = true;
      continue;
    }
    if (!required) {
      if (value !== undefined) {
        delete out[name];
        changed = true;
      }
      continue;
    }
    if (field.kind === 'icon') out[name] = FALLBACK_ICON;
    else if (field.kind === 'link' && action !== undefined) {
      // Keep the item's own words when it has them; only the address was broken.
      const label = isRecord(value) && typeof value['label'] === 'string' && value['label'].trim() !== '' ? value['label'] : action.label;
      out[name] = { label, href: action.href };
    } else return { keep: false };
    changed = true;
  }
  // Unchanged items stay the same objects, so an untouched list reads as untouched.
  return { keep: true, value: changed ? out : raw };
}

/**
 * A kit's slots with everything code can decide decided (DESIGN §4: what code
 * can fix never costs a model round). Pure; never throws. Unknown slot names
 * are left as written (the kit ignores them).
 *
 * - a missing required text: `title` ← the section title, `caption` ← the
 *   first must-say claim (else the first image's alt, else the title), any
 *   other ← the first claim, else the purpose;
 * - a missing or broken required link ← the page's primary action;
 * - a missing required image ← the contract's first image;
 * - a missing or unknown required icon ← "check"; an unknown optional icon,
 *   a broken optional link and a non-text optional text are dropped;
 * - list items are completed the same way (a broken item link takes the
 *   action's address); a list with an item missing its words, and a missing
 *   required list, are left as written — the repair round asks for content.
 */
export function completeKitSlots(
  kit: SectionKit,
  slots: Slots,
  context: KitSlotContext,
): CompletedKitSlots {
  const out: Record<string, JsonValue> = { ...slots };
  const changes: string[] = [];
  for (const [name, slot] of Object.entries(kit.slots)) {
    const value = out[name];
    const required = slot.required === true;
    if (!present(value)) {
      if (!required) continue;
      let filled: JsonValue | undefined;
      if (slot.kind === 'text') filled = derivedText(name, context);
      else if (slot.kind === 'link' && context.primaryCta !== undefined) {
        filled = { label: context.primaryCta.label, href: context.primaryCta.href };
      } else if (slot.kind === 'image') filled = derivedImage(context);
      else if (slot.kind === 'icon') filled = FALLBACK_ICON;
      if (filled === undefined) continue;
      out[name] = filled;
      changes.push(`${name} ← ${slot.kind === 'link' ? 'the primary action' : slot.kind === 'image' ? "the contract's first image" : slot.kind === 'icon' ? FALLBACK_ICON : 'the contract'}`);
      continue;
    }
    switch (slot.kind) {
      case 'text':
        if (typeof value === 'string' || typeof value === 'number') break;
        if (required) {
          out[name] = derivedText(name, context) ?? '';
          changes.push(`${name} ← the contract (it was not text)`);
        } else {
          delete out[name];
          changes.push(`${name} dropped (not text)`);
        }
        break;
      case 'icon':
        if (typeof value === 'string' && isLucideIconName(value.trim())) break;
        if (required) out[name] = FALLBACK_ICON;
        else delete out[name];
        changes.push(`${name} ${required ? `← ${FALLBACK_ICON}` : 'dropped'} (not a Lucide icon)`);
        break;
      case 'link': {
        if (safeLink(value)) break;
        const fixed = repairedLink(value);
        if (fixed !== undefined) {
          out[name] = fixed;
          changes.push(`${name}: its address repaired`);
          break;
        }
        if (required && context.primaryCta !== undefined) {
          out[name] = { label: context.primaryCta.label, href: context.primaryCta.href };
          changes.push(`${name} ← the primary action (the link was broken)`);
        } else if (!required) {
          delete out[name];
          changes.push(`${name} dropped (a broken link)`);
        }
        break;
      }
      case 'image':
        if (isRecord(value)) break;
        if (required && derivedImage(context) !== undefined) {
          out[name] = derivedImage(context) ?? null;
          changes.push(`${name} ← the contract's first image`);
        } else if (!required) {
          delete out[name];
          changes.push(`${name} dropped (not an image)`);
        }
        break;
      case 'list': {
        if (!Array.isArray(value)) {
          if (!required) {
            delete out[name];
            changes.push(`${name} dropped (not a list)`);
          }
          break;
        }
        const fields = slot.item ?? {};
        const outcomes = value.map((item) => completeItem(fields, item, context.primaryCta));
        // An item code cannot complete leaves the list as written: the repair round fills it whole.
        if (outcomes.some((outcome) => !outcome.keep)) break;
        const items = outcomes.flatMap((outcome) => (outcome.keep ? [outcome.value] : []));
        if (items.every((item, index) => item === value[index])) break;
        out[name] = items;
        changes.push(`${name}: items completed (icons, broken links, invalid optional fields)`);
        break;
      }
    }
  }
  const role = context.contract.role;
  if (context.primaryCta !== undefined && (role === 'hero' || role === 'cta')) {
    withAction(kit, out, context.primaryCta, changes);
  }
  return { slots: changes.length === 0 ? slots : out, changes };
}

// ── Photos: one catalog photo per contract image, never twice on a page ─────

export interface PagePhotoPlan {
  /** Section key → its photos, one per contract image it could match, in order. */
  readonly bySection: ReadonlyMap<string, readonly CatalogPhoto[]>;
  /** Every address the plan assigned. */
  readonly used: ReadonlySet<string>;
}

interface PhotoSection {
  readonly key: string;
  readonly images?: SectionContract['images'];
}

const PHOTO_PLANS = new WeakMap<object, PagePhotoPlan>();

/** The best photo for a brief that is not taken, preferring the asked orientation among the best. */
export function pickCatalogPhoto(
  brief: string,
  taken: ReadonlySet<string>,
  aspect?: PhotoOrientation,
): CatalogPhoto | undefined {
  const candidates = selectCatalogPhotos(brief, { exclude: (entry) => taken.has(entry.url) });
  const [best] = candidates;
  if (best === undefined || aspect === undefined) return best;
  // Within the best subject only: an orientation never buys a worse subject.
  return candidates.find((photo) => photo.subject === best.subject && photo.aspect === aspect) ?? best;
}

/**
 * Each contract image's catalog photo, assigned in page order so no address
 * repeats across sections. Deterministic for a plan (memoised on the frozen
 * plan object), so the skeleton, every writer and every rerun agree.
 */
export function pagePhotoPlan(plan: { readonly sections: readonly PhotoSection[] }): PagePhotoPlan {
  const known = PHOTO_PLANS.get(plan);
  if (known !== undefined) return known;
  const used = new Set<string>();
  const bySection = new Map<string, CatalogPhoto[]>();
  for (const section of plan.sections) {
    const photos: CatalogPhoto[] = [];
    for (const image of section.images ?? []) {
      const photo =
        pickCatalogPhoto(`${image.subject} ${image.alt}`, used, image.aspect) ??
        pickCatalogPhoto(image.subject, used, image.aspect);
      if (photo === undefined) continue;
      used.add(photo.url);
      photos.push(photo);
    }
    if (photos.length > 0) bySection.set(section.key, photos);
  }
  const result: PagePhotoPlan = { bySection, used };
  PHOTO_PLANS.set(plan, result);
  return result;
}

/**
 * The slots with every catalog image (`{subject, alt}`, no `src`) given its
 * assigned address: the section's own photos first, in order, then the best
 * free photo for the subject — never one another section shows. A `src` the
 * writer wrote (the person's own photo) is kept. Pure; never throws.
 */
export function fillSlotPhotos(
  kit: SectionKit,
  slots: Slots,
  sectionKey: string,
  photos: PagePhotoPlan,
  lang: string,
): Slots {
  const own = [...(photos.bySection.get(sectionKey) ?? [])];
  const ownUrls = new Set(own.map(({ url }) => url));
  // Taken: what OTHER sections show, and what this call already placed.
  const taken = new Set([...photos.used].filter((url) => !ownUrls.has(url)));
  const arabic = lang.toLowerCase().startsWith('ar');
  const state = { changed: false };
  const resolve = (value: JsonValue): JsonValue => {
    if (!isRecord(value)) return value;
    const src = value['src'];
    const subject = value['subject'];
    if (typeof src === 'string' && src.trim() !== '') return value;
    if (typeof subject !== 'string' || subject.trim() === '') return value;
    const alt = typeof value['alt'] === 'string' ? value['alt'].trim() : '';
    let photo = own.find(({ url }) => !taken.has(url));
    photo ??= pickCatalogPhoto(`${subject} ${alt}`, taken) ?? pickCatalogPhoto(subject, taken);
    if (photo === undefined) return value;
    taken.add(photo.url);
    state.changed = true;
    return { src: photo.url, alt: alt === '' ? (arabic ? photo.alt.ar : photo.alt.en) : alt };
  };
  const out: Record<string, JsonValue> = { ...slots };
  for (const [name, slot] of Object.entries(kit.slots)) {
    const value = out[name];
    if (value === undefined) continue;
    if (slot.kind === 'image') out[name] = resolve(value);
    else if (slot.kind === 'list' && Array.isArray(value)) {
      const imageFields = Object.entries(slot.item ?? {})
        .filter(([, field]) => field.kind === 'image')
        .map(([field]) => field);
      if (imageFields.length === 0) continue;
      out[name] = value.map((item) => {
        if (!isRecord(item)) return item;
        const next: Record<string, JsonValue> = { ...item };
        for (const field of imageFields) {
          const image = next[field];
          if (image !== undefined) next[field] = resolve(image);
        }
        return next;
      });
    }
  }
  return state.changed ? out : slots;
}
