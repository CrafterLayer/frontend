import {
  contrastRatio,
  parseHex,
  relativeLuminance,
  type JsonValue,
} from '@craftkit/builder-schema';

import {
  PHOTO_TOPIC_KEYWORDS,
  type PhotoOrientation,
  type PhotoTopic,
} from '../../context/providers/photo-catalog.data';
import { DIRECTION_DECK_ROWS, directionDeckImportUrl } from '../../skills/direction-deck';
import { SECTION_VARIANTS } from '../../skills/section-variants';
import { VERIFIED_FONT_FAMILIES } from '../../skills/verified-fonts';
import { MASKED_DIGITS } from './check-section';
import { expandCompactPagePlan } from './compact-plan';
import { authoredSection, checkPageShape, readPageDesign } from './design';
import { completeKitSlots } from './kit-slots';
import { defaultPlanKit, instantiatePlanKit, kitFitsRole, kitIdsForRole, planKit } from './kits';
import {
  businessKindOf,
  isLocalBusinessType,
  withBusinessType,
  withContactDetails,
  withHeroPhoto,
  withPageChrome,
} from './page-completion';
import {
  isRecord,
  readArray,
  readColour,
  readEnum,
  readFace,
  readOptionalText,
  readPlanSeo,
  readSlug,
  readText,
  readTextList,
  toSlug,
  verifiedFamilies,
  type Issues,
  type ReadFace,
} from './schema';
import {
  PAGE_PLAN_INTENTS,
  PAGE_PLAN_MAX_FACTS,
  PAGE_PLAN_MAX_IMAGES_PER_SECTION,
  PAGE_PLAN_MAX_NAV_ITEMS,
  PAGE_PLAN_MAX_SECTION_CLAIMS,
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  PAGE_PLAN_RADII,
  SECTION_ROLES,
  type PagePlan,
  type PagePlanFact,
  type PagePlanIssue,
  type PagePlanFont,
  type PagePlanLink,
  type PagePlanLocale,
  type PagePlanNavItem,
  type PagePlanTokens,
  type PagePlanValidationResult,
  type SectionContract,
  type SectionImage,
  type ValidatePagePlanOptions,
} from './types';

/** WCAG 2.2 AA for body text; every text pair of a plan is held to it. */
const AA = 4.5;

/** Languages written right to left; their pages are `rtl` whatever the candidate said. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);
/** Languages in Arabic script; their faces must carry Arabic glyphs. */
const ARABIC_SCRIPT_LANGUAGES = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ckb']);

const LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/u;
const PHOTO_TOPICS = Object.keys(PHOTO_TOPIC_KEYWORDS) as PhotoTopic[];
const ORIENTATIONS: readonly PhotoOrientation[] = ['landscape', 'portrait', 'square'];
/** The ratios a model reaches for, mapped onto the catalog's orientations. */
const RATIO_ORIENTATION: Readonly<Record<string, PhotoOrientation>> = {
  '16:9': 'landscape',
  '21:9': 'landscape',
  '3:2': 'landscape',
  '4:3': 'landscape',
  '1:1': 'square',
  '4:5': 'portrait',
  '3:4': 'portrait',
  '2:3': 'portrait',
  '9:16': 'portrait',
};
const VARIANT_IDS = SECTION_VARIANTS.map(({ id }) => id);
const DECK_ROW_IDS = DIRECTION_DECK_ROWS.map(({ id }) => id);

const COLOUR_ROLES = {
  bg: 'the page ground colour (bg)',
  surface: 'the card colour (surface)',
  ink: 'the ink colour (headings and body text)',
  muted: 'the muted colour (secondary text)',
  accent: 'the accent fill colour',
  onAccent: 'the colour of text on the accent fill (onAccent)',
  border: 'the border colour',
} as const;
type ColourRole = keyof typeof COLOUR_ROLES;

/** Every text pair the page renders, and what the text is used for. */
const TEXT_PAIRS: readonly (readonly [foreground: string, ground: string, use: string])[] = [
  ['ink', 'bg', 'body text'],
  ['ink', 'surface', 'body text on cards'],
  ['muted', 'bg', 'secondary text'],
  ['muted', 'surface', 'secondary text on cards'],
  ['onAccent', 'accent', 'a label on the accent fill'],
  ['accentInk', 'bg', 'accent-coloured text'],
  ['accentInk', 'surface', 'accent-coloured text on cards'],
];

/** Floored, never rounded: 4.496 must not print as a passing "4.50". */
function ratioText(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

function luminance(hex: string): number {
  const rgb = parseHex(hex);
  return rgb === undefined ? 0 : relativeLuminance(rgb);
}

function readsOn(foreground: string, ground: string): boolean {
  return (contrastRatio(foreground, ground) ?? 0) >= AA;
}

function hexOf(channels: { r: number; g: number; b: number }): string {
  const part = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(channels.r)}${part(channels.g)}${part(channels.b)}`;
}

/** `weight` of `towards` mixed into `from`, per sRGB channel. */
function mixTowards(from: string, towards: string, weight: number): string {
  const one = parseHex(from);
  const two = parseHex(towards);
  if (one === undefined || two === undefined) return from;
  return hexOf({
    r: one.r * (1 - weight) + two.r * weight,
    g: one.g * (1 - weight) + two.g * weight,
    b: one.b * (1 - weight) + two.b * weight,
  });
}

/** Black or white: whichever reads better on the worse of the grounds. */
function extremeFor(grounds: readonly string[]): string {
  const worst = (colour: string) =>
    Math.min(...grounds.map((ground) => contrastRatio(colour, ground) ?? 0));
  return worst('#000000') >= worst('#ffffff') ? '#000000' : '#ffffff';
}

/**
 * `colour` itself when it reads on every ground; else the least change
 * towards `towards` (5 % steps) that does; `undefined` when even `towards`
 * itself does not — then the miss stays an issue for the model.
 */
function readableOn(
  colour: string,
  grounds: readonly string[],
  towards: string,
): string | undefined {
  const reads = (candidate: string) => grounds.every((ground) => readsOn(candidate, ground));
  if (reads(colour)) return colour;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixTowards(colour, towards, step / 20);
    if (reads(candidate)) return candidate;
  }
  return undefined;
}

function contrastRepaired(
  role: 'ink' | 'muted',
  before: string,
  after: string,
  grounds: readonly [string, string],
): PagePlanIssue {
  const worst = Math.min(...grounds.map((ground) => contrastRatio(before, ground) ?? 0));
  return {
    path: `tokens.${role}`,
    message: `"${before}" → "${after}": ${role} read at ${ratioText(worst)}:1 on bg/surface; moved in code to ${String(AA)}:1.`,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function readLocale(value: unknown, issues: Issues): PagePlanLocale | undefined {
  if (!isRecord(value)) {
    issues.push({
      path: 'locale',
      message: 'Write locale as { "lang": "ar", "dir": "rtl" }, lang being the page language.',
    });
    return undefined;
  }
  const raw = value['lang'];
  const lang = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!LANG.test(lang)) {
    issues.push({
      path: 'locale.lang',
      message: 'Write the page language as a BCP 47 tag such as "ar" or "en".',
    });
    return undefined;
  }
  const primary = lang.split('-')[0] ?? lang;
  const stated = value['dir'] === 'rtl' || value['dir'] === 'ltr' ? value['dir'] : undefined;
  return { lang, dir: RTL_LANGUAGES.has(primary) ? 'rtl' : (stated ?? 'ltr') };
}

function importedFont(face: ReadFace): PagePlanFont {
  const shipped = VERIFIED_FONT_FAMILIES[face.family]?.weights ?? [];
  /*
    A one-weight face imports bare, as the deck's verified URLs do: the css2 form
    with an explicit weight was only ever fetched for multi-weight faces.
  */
  const url = directionDeckImportUrl([
    { family: face.family, weights: shipped.length === 1 ? [] : face.weights },
  ]);
  return { family: face.family, weights: face.weights, url };
}

interface TokenDraft {
  readonly colours: Partial<Record<ColourRole, string>>;
  readonly accentInk: string | undefined;
  readonly accentInkStated: boolean;
  readonly fontDisplay: ReadFace | undefined;
  readonly fontBody: ReadFace | undefined;
  readonly radius: PagePlanTokens['radius'] | undefined;
  readonly signature: string | undefined;
  readonly deckRowId: string | undefined;
}

function readTokens(value: unknown, issues: Issues): TokenDraft | undefined {
  if (!isRecord(value)) {
    issues.push({
      path: 'tokens',
      message:
        'Write tokens as an object with bg, surface, ink, muted, accent, onAccent, accentInk (optional), border, fontDisplay, fontBody, radius and signature.',
    });
    return undefined;
  }
  const colours: Partial<Record<ColourRole, string>> = {};
  for (const role of Object.keys(COLOUR_ROLES) as ColourRole[]) {
    const colour = readColour(value[role], `tokens.${role}`, issues, COLOUR_ROLES[role]);
    if (colour !== undefined) colours[role] = colour;
  }
  const rawInk = value['accentInk'];
  const accentInkStated = !(
    rawInk === undefined ||
    rawInk === null ||
    (typeof rawInk === 'string' && rawInk.trim() === '')
  );
  const accentInk = accentInkStated
    ? readColour(rawInk, 'tokens.accentInk', issues, 'the accent text colour (accentInk)')
    : undefined;
  const deckRowId = readOptionalText(
    value['deckRowId'],
    'tokens.deckRowId',
    issues,
    'deckRowId',
    40,
  );
  if (deckRowId !== undefined && !DECK_ROW_IDS.includes(deckRowId)) {
    issues.push({
      path: 'tokens.deckRowId',
      message: `Use a direction-deck row id (${DECK_ROW_IDS.join(', ')}) or omit deckRowId; "${deckRowId}" is not one.`,
    });
  }
  return {
    colours,
    accentInk,
    accentInkStated,
    fontDisplay: readFace(
      value['fontDisplay'],
      'tokens.fontDisplay',
      issues,
      'the display (heading) font',
    ),
    fontBody: readFace(value['fontBody'], 'tokens.fontBody', issues, 'the body font'),
    radius: readEnum(
      value['radius'],
      PAGE_PLAN_RADII,
      'tokens.radius',
      issues,
      'the corner radius',
    ),
    signature: readText(
      value['signature'],
      'tokens.signature',
      issues,
      'the signature (the one memorable move of this page, in a sentence)',
      200,
    ),
    deckRowId: deckRowId !== undefined && DECK_ROW_IDS.includes(deckRowId) ? deckRowId : undefined,
  };
}

/**
 * The finished token set, or `undefined` when a colour is missing. Contrast is
 * measured here, on the resolved hex, and `accentInk` is derived when absent:
 * the accent itself if it reads on both grounds, else the ink.
 */
function finishTokens(
  draft: TokenDraft,
  locale: PagePlanLocale | undefined,
  issues: Issues,
  warnings: PagePlanIssue[],
  repairContrast: boolean,
): PagePlanTokens | undefined {
  const { bg, surface, accent, onAccent, border } = draft.colours;
  let { ink, muted } = draft.colours;
  /*
    R-contrast (fix pass 2026-10-05): an ink or muted colour that misses 4.5:1
    is moved in code until it reads, never refused. The miss was the #1
    bottleneck of the 2026-09-30 baseline (an 18 s repair round) and again on
    2026-10-05 (muted #dc2626 on #fef2f2, 4.41:1: 22.5 s, and the streamed
    skeleton never started). Ink first, so muted can lean on the final ink.
  */
  if (repairContrast && bg !== undefined && surface !== undefined) {
    if (ink !== undefined) {
      const fixed = readableOn(ink, [bg, surface], extremeFor([bg, surface]));
      if (fixed !== undefined && fixed !== ink) {
        warnings.push(contrastRepaired('ink', ink, fixed, [bg, surface]));
        ink = fixed;
      }
    }
    if (muted !== undefined && ink !== undefined) {
      const towards = readsOn(ink, bg) && readsOn(ink, surface) ? ink : extremeFor([bg, surface]);
      const fixed = readableOn(muted, [bg, surface], towards);
      if (fixed !== undefined && fixed !== muted) {
        warnings.push(contrastRepaired('muted', muted, fixed, [bg, surface]));
        muted = fixed;
      }
    }
  }
  if (
    bg === undefined ||
    surface === undefined ||
    ink === undefined ||
    muted === undefined ||
    accent === undefined ||
    onAccent === undefined ||
    border === undefined ||
    (draft.accentInkStated && draft.accentInk === undefined)
  ) {
    return undefined;
  }
  const accentInk =
    draft.accentInk ?? (readsOn(accent, bg) && readsOn(accent, surface) ? accent : ink);
  const colours: Readonly<Record<string, string>> = {
    bg,
    surface,
    ink,
    muted,
    accent,
    onAccent,
    accentInk,
  };

  for (const [foreground, ground, use] of TEXT_PAIRS) {
    const fg = colours[foreground] ?? '';
    const bgHex = colours[ground] ?? '';
    const ratio = contrastRatio(fg, bgHex) ?? 0;
    if (ratio >= AA) continue;
    const direction = luminance(fg) <= luminance(bgHex) ? 'darker' : 'lighter';
    const escape =
      foreground === 'accentInk' ? ', or omit accentInk to use the ink colour for accent text' : '';
    issues.push({
      path: `tokens.${foreground}`,
      message: `${foreground} ${fg} on ${ground} ${bgHex} is ${ratioText(ratio)}:1; ${use} needs ${String(AA)}:1. Pick a ${direction} ${foreground}${escape}.`,
    });
  }

  const primary = locale?.lang.split('-')[0] ?? '';
  if (ARABIC_SCRIPT_LANGUAGES.has(primary)) {
    for (const [slot, face] of [
      ['fontDisplay', draft.fontDisplay],
      ['fontBody', draft.fontBody],
    ] as const) {
      if (face === undefined || VERIFIED_FONT_FAMILIES[face.family]?.arabic === true) continue;
      issues.push({
        path: `tokens.${slot}.family`,
        message: `${face.family} has no Arabic glyphs, so this page would render in a fallback face. Use an Arabic-capable family: ${verifiedFamilies(true).join(', ')}.`,
      });
    }
  }

  if (
    draft.fontDisplay === undefined ||
    draft.fontBody === undefined ||
    draft.radius === undefined ||
    draft.signature === undefined
  ) {
    return undefined;
  }
  return {
    bg,
    surface,
    ink,
    muted,
    accent,
    onAccent,
    accentInk,
    border,
    fontDisplay: importedFont(draft.fontDisplay),
    fontBody: importedFont(draft.fontBody),
    radius: draft.radius,
    signature: draft.signature,
    ...(draft.deckRowId === undefined ? {} : { deckRowId: draft.deckRowId }),
  };
}

function readImage(value: unknown, path: string, issues: Issues): SectionImage | undefined {
  if (!isRecord(value)) {
    issues.push({
      path,
      message:
        'Write each image as { "subject": <photo topic>, "aspect": "landscape", "alt": "…" }.',
    });
    return undefined;
  }
  const subject = readEnum(
    value['subject'],
    PHOTO_TOPICS,
    `${path}.subject`,
    issues,
    'the photo subject',
  );
  const rawAspect = value['aspect'];
  const aspect =
    typeof rawAspect === 'string' && Object.hasOwn(RATIO_ORIENTATION, rawAspect.trim())
      ? RATIO_ORIENTATION[rawAspect.trim()]
      : readEnum(rawAspect, ORIENTATIONS, `${path}.aspect`, issues, 'the image aspect');
  const alt = readText(
    value['alt'],
    `${path}.alt`,
    issues,
    'the alt text, in the page language',
    200,
  );
  if (subject === undefined || aspect === undefined || alt === undefined) return undefined;
  return { subject, aspect, alt };
}

function readSection(
  value: unknown,
  path: string,
  issues: Issues,
  warnings: PagePlanIssue[],
): SectionContract | undefined {
  if (!isRecord(value)) {
    issues.push({
      path,
      message:
        'Write each section as { "key", "role", "title", "anchorId", "purpose", "mustSay", "mustNotRepeat", "variant", "images" }.',
    });
    return undefined;
  }
  const key = readSlug(value['key'], `${path}.key`, issues, 'the section key');
  const role = readEnum(value['role'], SECTION_ROLES, `${path}.role`, issues, 'the section role');
  const title = readText(value['title'], `${path}.title`, issues, 'the section title', 80);
  const anchorId = readSlug(value['anchorId'], `${path}.anchorId`, issues, 'the section anchor id');
  const purpose = readText(
    value['purpose'],
    `${path}.purpose`,
    issues,
    "the section's purpose",
    400,
  );
  const claims = { maxItems: PAGE_PLAN_MAX_SECTION_CLAIMS, maxLength: 200 };
  const mustSay = readTextList(value['mustSay'], `${path}.mustSay`, issues, 'mustSay', claims);
  const mustNotRepeat = readTextList(
    value['mustNotRepeat'],
    `${path}.mustNotRepeat`,
    issues,
    'mustNotRepeat',
    claims,
  );
  const layout = readOptionalText(
    value['layout'],
    `${path}.layout`,
    issues,
    'the authored layout',
    240,
  );
  const written = readOptionalText(value['variant'], `${path}.variant`, issues, 'the variant', 40);
  const rawKit = value['kit'];
  let kit =
    typeof rawKit === 'string' && rawKit.trim() !== '' ? rawKit.trim().toLowerCase() : undefined;
  /*
    R-variant-kit (fix pass 2026-10-05): both T1 answers wrote kit ids as
    variants ("hero-centered", "features-bento"). A kit id IS a layout: it
    becomes the section's kit (when none was named) and its layout word.
  */
  let variant = written;
  const asKit =
    written === undefined || VARIANT_IDS.includes(written)
      ? undefined
      : planKit(written.toLowerCase());
  if (written !== undefined && asKit !== undefined) {
    kit ??= asKit.id;
    variant =
      asKit.variant !== undefined && VARIANT_IDS.includes(asKit.variant)
        ? asKit.variant
        : undefined;
    warnings.push({
      path: `${path}.variant`,
      message: `"${written}" → "${variant ?? '(none)'}": a kit id, not a layout word; it names the kit instead.`,
    });
  } else if (variant !== undefined && !VARIANT_IDS.includes(variant)) {
    // R-variant (DESIGN §4): an unknown layout is dropped, never refused — the
    // only plan repair of the 2026-09-30 baseline was `variant: "bar"` (18 s).
    warnings.push({
      path: `${path}.variant`,
      message: `"${variant}" → (none): not a section-variants layout id (${VARIANT_IDS.join(', ')}); it was dropped and the writer picks the layout.`,
    });
  }
  const rawSlots = value['slots'];
  const slots = isRecord(rawSlots) ? (rawSlots as Readonly<Record<string, JsonValue>>) : undefined;
  const images: SectionImage[] = [];
  readArray(value['images'], `${path}.images`, issues, 'images', {
    required: false,
    max: PAGE_PLAN_MAX_IMAGES_PER_SECTION,
  }).forEach((image, index) => {
    const read = readImage(image, `${path}.images[${String(index)}]`, issues);
    if (read !== undefined) images.push(read);
  });
  if (
    key === undefined ||
    role === undefined ||
    title === undefined ||
    anchorId === undefined ||
    purpose === undefined
  ) {
    return undefined;
  }
  return {
    key,
    role,
    title,
    anchorId,
    purpose,
    mustSay,
    mustNotRepeat,
    ...(layout === undefined ? {} : { layout }),
    ...(variant !== undefined && VARIANT_IDS.includes(variant) ? { variant } : {}),
    ...(images.length === 0 ? {} : { images }),
    ...(kit === undefined ? {} : { kit }),
    ...(slots === undefined ? {} : { slots }),
  };
}

/**
 * A section's kit, resolved (DESIGN §B, 2026-09-30) — by NORMALISING, never
 * refusing, because a kit only saves a writer work and a refusal would cost
 * a whole repair round:
 *
 * - the header and footer take no kit (code writes them from the plan);
 * - a named kit that does not exist or does not fit the role is dropped;
 * - no kit (or a dropped one) with a known variant → that variant's default
 *   kit, when it fits;
 * - slots are dry-run through the kit: slots that would not instantiate are
 *   dropped and the kit kept, so the section gets a writer instead.
 *
 * Every drop is recorded as a warning, phrased as what was done.
 */
function resolveKit(
  contract: SectionContract,
  path: string,
  locale: PagePlanLocale,
  warnings: PagePlanIssue[],
  primaryCta?: PagePlanLink,
  deriveFromVariant = true,
): SectionContract {
  const { kit: named, slots, ...rest } = contract;
  if (contract.role === 'header' || contract.role === 'footer') {
    if (named !== undefined || slots !== undefined) {
      warnings.push({
        path: `${path}.kit`,
        message: `The ${contract.role} is written from the plan's nav and facts; its kit and slots were dropped.`,
      });
    }
    return rest;
  }
  let kit = planKit(named);
  if (named !== undefined && (kit === undefined || !kitFitsRole(kit, contract.role))) {
    warnings.push({
      path: `${path}.kit`,
      message: `"${named}" is not a ${contract.role} kit (${kitIdsForRole(contract.role).join(', ')}); it was dropped${contract.variant === undefined ? '' : ` for the default kit of "${contract.variant}"`}.`,
    });
    kit = undefined;
  }
  if (deriveFromVariant) kit ??= defaultPlanKit(contract.variant, contract.role);
  if (kit === undefined) {
    if (slots !== undefined) {
      warnings.push({
        path: `${path}.slots`,
        message: 'Slots need a kit; this section has none, so they were dropped.',
      });
    }
    return rest;
  }
  if (slots === undefined) return { ...rest, kit: kit.id };
  const derived = withDerivedSlots(kit, slots, contract, path, warnings);
  // The rest code can decide (a required link, an unknown icon, a broken optional link) never costs a writer.
  const finished = completeKitSlots(kit, derived, {
    contract,
    ...(primaryCta === undefined ? {} : { primaryCta }),
  });
  for (const change of finished.changes) {
    warnings.push({ path: `${path}.slots`, message: `Kit "${kit.id}": ${change}.` });
  }
  const completed = finished.slots;
  const filled = instantiatePlanKit(kit, completed, contract, locale);
  if (!filled.ok) {
    warnings.push({
      path: `${path}.slots`,
      message: `The slots do not fill kit "${kit.id}" (${filled.error}); they were dropped and a writer fills the section.`,
    });
    return { ...rest, kit: kit.id };
  }
  return { ...rest, kit: kit.id, slots: completed };
}

/** Blank or absent: the planner did not fill it. */
function unfilled(value: JsonValue | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
  );
}

/**
 * The planner's slots with every REQUIRED slot code can derive from the
 * contract filled in (fix pass 2026-10-05): `title` from the section title,
 * `caption` from its purpose, `image` from its first image. English run: the
 * features-bento slots lacked a caption and the pricing and faq slots a
 * title, so ~2.5k characters of planned copy (and features' only image) were
 * dropped and three writers rewrote the sections. Each fill is a warning.
 */
function withDerivedSlots(
  kit: NonNullable<ReturnType<typeof planKit>>,
  slots: Readonly<Record<string, JsonValue>>,
  contract: SectionContract,
  path: string,
  warnings: PagePlanIssue[],
): Readonly<Record<string, JsonValue>> {
  const derived: Record<string, JsonValue> = {};
  const image = contract.images?.[0];
  for (const [name, slot] of Object.entries(kit.slots)) {
    if (slot.required !== true || !unfilled(slots[name])) continue;
    let value: JsonValue | undefined;
    if (slot.kind === 'text' && name === 'title') value = contract.title;
    // A caption is shown on the photo: a claim the page makes, never the brief's instruction
    // (measure-v3 run 1 printed "Show the core features that solve…" on the image).
    else if (slot.kind === 'text' && name === 'caption') {
      value = contract.mustSay[0] ?? image?.alt ?? contract.title;
    } else if (slot.kind === 'image' && image !== undefined) {
      value = { subject: image.subject, alt: image.alt };
    }
    if (value === undefined) continue;
    derived[name] = value;
    warnings.push({
      path: `${path}.slots.${name}`,
      message: `Kit "${kit.id}" needs "${name}"; it was filled from the section's ${slot.kind === 'image' ? 'first image' : name === 'title' ? 'title' : 'first claim (else its image alt, else its title)'}.`,
    });
  }
  return Object.keys(derived).length === 0 ? slots : { ...slots, ...derived };
}

function readHref(value: unknown, anchors: readonly string[], issues: Issues): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  const offer = `Point the CTA at a section (${anchors.map((anchor) => `#${anchor}`).join(', ')}) or at an https:, mailto: or tel: URL`;
  if (raw.startsWith('#')) {
    const anchor = toSlug(raw.slice(1));
    if (anchors.includes(anchor)) return `#${anchor}`;
    issues.push({ path: 'primaryCta.href', message: `${offer}; "${raw}" is none of them.` });
    return undefined;
  }
  if (
    /^https:\/\/[^\s/]+\S*$/iu.test(raw) ||
    /^mailto:\S+$/iu.test(raw) ||
    /^tel:\+?[\d\s().-]+$/iu.test(raw)
  ) {
    return raw;
  }
  issues.push({
    path: 'primaryCta.href',
    message: `${offer}${raw === '' ? '' : `; "${raw.slice(0, 60)}" is none of them`}.`,
  });
  return undefined;
}

// ── code repairs (DESIGN §4): what code can fix never costs a model round ────

/*
  R-xrun. RESTATED FROM apps/ai-server/src/plan-shape.ts
  (`PLACEHOLDER_RUN`, `SAMPLE_DIGITS`, `isPlaceholderSample`,
  `fillPlaceholderSample`): the two MUST stay identical, so a provisional
  contract read from the streamed draft equals the final one the server
  repaired. Both test files carry the same fixture table. A run is two or more
  X or three or more mask marks standing alone (never inside a word: `XXL`,
  `Louis XIV` and `Maxx` are values); it is filled in the sample's own format.
*/
const PLACEHOLDER_RUN = /(?<![\p{L}\p{N}])(?:[Xx]{2,}|[•*#_]{3,})(?![\p{L}\p{N}])/gu;
const SAMPLE_DIGITS = '2345678901';
const PLACEHOLDER_TEST = new RegExp(PLACEHOLDER_RUN.source, 'u');

function isPlaceholderSample(sample: string): boolean {
  return PLACEHOLDER_TEST.test(sample);
}

function fillPlaceholderSample(sample: string): string {
  const address = /@|:\/\/|^\s*www\./iu.test(sample);
  let next = 0;
  return sample.replace(PLACEHOLDER_RUN, (run: string, at: number) => {
    const before = sample[at - 1];
    const after = sample.slice(at + run.length);
    if (address && after.startsWith('@')) return 'info';
    if (address && (before === '@' || before === '.' || after.startsWith('.'))) return 'example';
    // One digit per mark; every mark the run can hold is a single code unit.
    return run.replace(/./gu, () => {
      const digit = SAMPLE_DIGITS[next % SAMPLE_DIGITS.length] ?? '0';
      next += 1;
      return digit;
    });
  });
}

/*
  R-masked. A planner that writes "+962 79 123 4567" or wa.me/962790000000
  hands every writer a number the checker then flags as a stand-in (baseline
  2026-09-30: one section repair, 10 s + a 13 s hold). The MATCHED digits are
  replaced in place, separators kept, digit by digit from MASK_FILL_DIGITS,
  restarting at its first digit for each run — so the same number written
  twice (a CTA link and a fact) becomes the same number twice:
  wa.me/962791234567 → wa.me/962794612750, "+962 79 123 4567" → "+962 79 461 2750".
*/
const MASK_FILL_DIGITS = '4612750389';
/** A digit run with phone separators, seven digits or more once the separators go. */
const DIGIT_RUN = /[+(]?[0-9][0-9 ().-]{5,}[0-9]/gu;
/** A link's number need not start like a phone: wa.me/962…, tel:962…. */
const LINK = /^(?:https?:|tel:|sms:|mailto:|\/\/)|wa\.me\//iu;

function fillMaskedRun(run: string): string {
  // The run is ASCII digits, separators and +( only (DIGIT_RUN), so code units are characters.
  const chars = run.split('');
  const positions = chars.flatMap((char, index) => (/[0-9]/u.test(char) ? [index] : []));
  // Bounded: the fill digits never form a masked run, so one pass per match suffices.
  for (let pass = 0; pass < 4; pass += 1) {
    const digits = positions.map((index) => chars[index]).join('');
    const match = MASKED_DIGITS.exec(digits);
    if (match === null) break;
    for (let offset = 0; offset < match[0].length; offset += 1) {
      const at = positions[match.index + offset];
      if (at !== undefined) chars[at] = MASK_FILL_DIGITS[offset % MASK_FILL_DIGITS.length] ?? '0';
    }
  }
  return chars.join('');
}

function repairMaskedDigits(text: string): string {
  const link = LINK.test(text.trim());
  return text.replace(DIGIT_RUN, (run: string) => {
    const digits = run.replace(/[^0-9]/gu, '');
    const phoneShaped = link || /^[+(0]/u.test(run);
    return phoneShaped && digits.length >= 7 && MASKED_DIGITS.test(digits)
      ? fillMaskedRun(run)
      : run;
  });
}

function repaired(path: string, before: string, after: string): PagePlanIssue {
  return { path, message: `"${before}" → "${after}" (filled in code; the owner replaces it).` };
}

/** Every string inside a kit's slots with its masked digit runs filled; each change is a warning. */
function repairSlots(value: JsonValue, path: string, warnings: PagePlanIssue[]): JsonValue {
  if (typeof value === 'string') {
    const after = repairMaskedDigits(value);
    if (after !== value) warnings.push(repaired(path, value, after));
    return after;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => repairSlots(item, `${path}[${String(index)}]`, warnings));
  }
  if (typeof value === 'object' && value !== null) {
    // fromEntries defines own properties, so a "__proto__" slot stays data.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        repairSlots(item, `${path}.${key}`, warnings),
      ]),
    );
  }
  return value;
}

/**
 * Turn a provider's page-plan answer into the `PagePlan` a build uses — or into
 * every reason it cannot be one, each phrased as the instruction that fixes it.
 *
 * Pure and synchronous; never throws on any input. Normalises what code can
 * decide (palette names → hex, slugs, derived `dir` and `accentInk`, font import
 * URLs, `16:9` → `landscape`) so a repair round is spent only on judgement.
 * Unknown fields are dropped. The result's plan is deeply frozen.
 *
 * Reads the classic plan, the compact one (DESIGN §3, expanded first by
 * `expandCompactPagePlan`) and any mix. Repairs in code, each recorded as a
 * warning and never as an issue (DESIGN §4): an unknown variant is dropped, a
 * kit that does not fit is dropped, a fact sample's placeholder run is filled
 * (R-xrun, identical to the server's), and a masked digit run in a fact sample,
 * the CTA's address or a kit slot is filled in place (R-masked).
 *
 * Checked: field shapes and bounds; 2..`maxSections` sections; unique section
 * keys, anchors and fact keys; header first / one hero after it / footer last
 * (and no header, hero or footer when appending); nav, CTA and facts pointing at
 * sections that exist; photo subjects and deck rows from their libraries;
 * verified faces with shipped weights, Arabic-capable on an Arabic-script
 * page; WCAG AA (4.5:1) on all seven text pairs.
 */
export function validatePagePlan(
  candidate: unknown,
  options: ValidatePagePlanOptions = {},
): PagePlanValidationResult {
  // The compact answer (DESIGN §3) and any mix of it become the classic shape first.
  const expansion = expandCompactPagePlan(candidate);
  const value = expansion.value;
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: '',
          message:
            'Answer with the page plan as one JSON object and nothing around it: the compact form ({ "intent", "locale", "title", "description", "tokens": { "deckRowId", "signature" }, "primaryCta", "sections", "briefs", "seo" }) or the full one ({ "intent", "locale", "title", "description", "tokens", "primaryCta", "nav", "sections", "facts" }).',
        },
      ]),
    };
  }
  const issues: Issues = [];
  const warnings: PagePlanIssue[] = [...expansion.warnings];
  const design = readPageDesign(value['design'], issues, options.request);
  const bespoke = design?.composition === 'bespoke';
  const personal = design?.kind === 'resume' || design?.kind === 'portfolio';
  const minSections = bespoke ? 1 : PAGE_PLAN_MIN_SECTIONS;
  const maxSections = Math.max(
    minSections,
    Math.min(PAGE_PLAN_MAX_SECTIONS, Math.floor(options.maxSections ?? PAGE_PLAN_MAX_SECTIONS)),
  );

  const intent =
    options.intent ?? readEnum(value['intent'], PAGE_PLAN_INTENTS, 'intent', issues, 'intent');
  const locale = readLocale(value['locale'], issues);
  const title = readText(value['title'], 'title', issues, 'the page title', 120);
  const description = readText(
    value['description'],
    'description',
    issues,
    'the page description',
    300,
  );
  const tokenDraft = readTokens(value['tokens'], issues);

  const rawSections = readArray(value['sections'], 'sections', issues, 'sections', {
    required: true,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (Array.isArray(value['sections']) && rawSections.length < minSections) {
    issues.push({
      path: 'sections',
      message: `Plan between ${String(minSections)} and ${String(maxSections)} sections (it has ${String(rawSections.length)}).`,
    });
  } else if (rawSections.length > maxSections) {
    issues.push({
      path: 'sections',
      message: `Plan at most ${String(maxSections)} sections (it has ${String(rawSections.length)}); merge or drop the weakest.`,
    });
  }
  const read = rawSections.map((section, index) =>
    readSection(section, `sections[${String(index)}]`, issues, warnings),
  );

  const keys: string[] = [];
  const anchors: string[] = [];
  read.forEach((section, index) => {
    if (section === undefined) return;
    const path = `sections[${String(index)}]`;
    if (keys.includes(section.key)) {
      issues.push({
        path: `${path}.key`,
        message: `Give every section a unique key; "${section.key}" is already used.`,
      });
    }
    if (anchors.includes(section.anchorId)) {
      issues.push({
        path: `${path}.anchorId`,
        message: `Give every section a unique anchorId; "${section.anchorId}" is already used.`,
      });
    }
    keys.push(section.key);
    anchors.push(section.anchorId);
  });
  checkPageShape(read, intent, issues, bespoke);

  const nav: PagePlanNavItem[] = [];
  readArray(value['nav'], 'nav', issues, 'nav', {
    required: false,
    max: PAGE_PLAN_MAX_NAV_ITEMS,
  }).forEach((item, index) => {
    const path = `nav[${String(index)}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: 'Write each nav item as { "label", "anchorId" }.' });
      return;
    }
    const label = readText(item['label'], `${path}.label`, issues, 'the nav label', 40);
    const anchorId = readSlug(item['anchorId'], `${path}.anchorId`, issues, 'the nav anchorId');
    if (anchorId !== undefined && !anchors.includes(anchorId)) {
      issues.push({
        path: `${path}.anchorId`,
        message: `Link to a section's anchorId (${anchors.join(', ')}); "${anchorId}" is none of them.`,
      });
      return;
    }
    if (label !== undefined && anchorId !== undefined) nav.push({ label, anchorId });
  });

  let primaryCta: PagePlan['primaryCta'] | undefined;
  const rawCta = value['primaryCta'];
  if (isRecord(rawCta)) {
    const label = readText(rawCta['label'], 'primaryCta.label', issues, 'the CTA label', 40);
    const href = readHref(rawCta['href'], anchors, issues);
    if (label !== undefined && href !== undefined) primaryCta = { label, href };
  } else {
    issues.push({
      path: 'primaryCta',
      message:
        'Write primaryCta as { "label": "<the page’s one action>", "href": "#<a section anchorId>" }.',
    });
  }

  const facts: PagePlanFact[] = [];
  const factKeys: string[] = [];
  const rawFacts = readArray(value['facts'], 'facts', issues, 'facts', {
    required: false,
    max: PAGE_PLAN_MAX_FACTS,
  });
  /*
    A fact key in another script («سعر_شيش_لحم», live run 2026-10-05) is a
    label no visitor sees, yet it cost a 16 s plan repair round. It is
    renamed in code — the same written key always to the same `fact-<n>`, so
    a twin is still a twin — and a warning says so.
  */
  const renamedFactKeys = new Map<string, string>();
  const usedFactKeys = new Set(
    rawFacts.flatMap((fact) =>
      isRecord(fact) && typeof fact['key'] === 'string' ? [toSlug(fact['key'])] : [],
    ),
  );
  const factKeyOf = (raw: unknown, path: string): string | undefined => {
    if (typeof raw !== 'string' || raw.trim() === '')
      return readSlug(raw, path, issues, 'the fact key');
    const probe: Issues = [];
    const slug = readSlug(raw, path, probe, 'the fact key');
    if (slug !== undefined) return slug;
    let renamed = renamedFactKeys.get(raw.trim());
    if (renamed === undefined) {
      let n = renamedFactKeys.size + 1;
      while (usedFactKeys.has(`fact-${String(n)}`)) n += 1;
      renamed = `fact-${String(n)}`;
      usedFactKeys.add(renamed);
      renamedFactKeys.set(raw.trim(), renamed);
    }
    warnings.push({
      path,
      message: `The fact key "${raw.slice(0, 40)}" is not a Latin slug; it was renamed "${renamed}".`,
    });
    return renamed;
  };
  rawFacts.forEach((fact, index) => {
    const path = `facts[${String(index)}]`;
    if (!isRecord(fact)) {
      issues.push({ path, message: 'Write each fact as { "key", "sample", "section" }.' });
      return;
    }
    const key = factKeyOf(fact['key'], `${path}.key`);
    const sample = readText(fact['sample'], `${path}.sample`, issues, 'the sample value', 200);
    const section = readSlug(fact['section'], `${path}.section`, issues, 'the fact’s section key');
    // The same fact written twice says nothing new: dropped in code, never a repair round.
    const twin = key === undefined ? undefined : facts.find((earlier) => earlier.key === key);
    if (sample !== undefined && twin?.sample.trim() === sample.trim()) {
      warnings.push({
        path: `${path}.key`,
        message: `"${key ?? ''}" was written twice; the copy was dropped.`,
      });
      return;
    }
    if (key !== undefined && factKeys.includes(key)) {
      issues.push({
        path: `${path}.key`,
        message: `Give every fact a unique key; "${key}" is already used.`,
      });
    }
    if (section !== undefined && !keys.includes(section)) {
      issues.push({
        path: `${path}.section`,
        message: `Tie the fact to a section key (${keys.join(', ')}); "${section}" is none of them.`,
      });
      return;
    }
    if (key !== undefined) factKeys.push(key);
    if (key !== undefined && sample !== undefined && section !== undefined)
      facts.push({ key, sample, section });
  });

  // The brand is a nicety: one that does not fit is left out with a warning, never refused.
  const rawBrand = value['brand'];
  const brandText = typeof rawBrand === 'string' ? rawBrand.trim().replace(/\s+/gu, ' ') : '';
  const brand = brandText !== '' && brandText.length <= 40 ? brandText : undefined;
  if (brand === undefined && brandText !== '') {
    warnings.push({
      path: 'brand',
      message: `"${brandText.slice(0, 60)}" is longer than 40 characters; the name is read from the title.`,
    });
  }
  const tokens =
    tokenDraft === undefined
      ? undefined
      : finishTokens(tokenDraft, locale, issues, warnings, options.repairContrast !== false);
  const seo = readPlanSeo(value['seo'], locale?.lang, issues);

  if (issues.length > 0) return { ok: false, issues: Object.freeze(issues) };
  const complete = options.completePage === true && intent !== 'append';
  // R-xrun then R-masked on every sample; R-masked on the action's address.
  const repairedFacts = facts.map((fact, index) => {
    if (personal) return fact;
    const path = `facts[${String(index)}].sample`;
    const filled = isPlaceholderSample(fact.sample)
      ? fillPlaceholderSample(fact.sample)
      : fact.sample;
    const sample = repairMaskedDigits(filled);
    if (sample !== fact.sample) warnings.push(repaired(path, fact.sample, sample));
    return sample === fact.sample ? fact : { ...fact, sample };
  });
  if (!personal && primaryCta !== undefined) {
    const href = repairMaskedDigits(primaryCta.href);
    if (href !== primaryCta.href) {
      warnings.push(repaired('primaryCta.href', primaryCta.href, href));
      primaryCta = { ...primaryCta, href };
    }
  }
  // The business type the page's own words support (a SaaS page is never a LocalBusiness).
  const finalSeo = withBusinessType(
    seo,
    [title ?? '', description ?? '', seo?.keyword ?? ''].join(' '),
    warnings,
    complete,
  );
  /*
    What the completions below decide from is the plan's HEAD only (title and
    description), never the seo or the briefs that stream in after it: the
    provisional plan built at the outline must make the same kit choices as
    the final one, or the streamed build's outline no longer matches and every
    speculative writer is thrown away (plan-draft reconcilePlans).
  */
  const pageWords = [title ?? '', description ?? ''].join(' ');
  const local = isLocalBusinessType(businessKindOf(pageWords));
  const action = primaryCta;
  let sections: readonly SectionContract[] = read
    .filter((section): section is SectionContract => section !== undefined)
    .map((written, index) => {
      const path = `sections[${String(index)}]`;
      if (locale === undefined) return written;
      let section = written;
      /*
        The page's action is on every CTA by rule; "must not repeat" it
        contradicts that rule, and the checker then refused the pricing
        tiers' "Start free trial" buttons (measure-v3: a 7 s repair round).
      */
      const actionWords = action?.label.trim().toLowerCase();
      const kept = section.mustNotRepeat.filter(
        (claim) => claim.trim().toLowerCase() !== actionWords,
      );
      if (kept.length !== section.mustNotRepeat.length) {
        warnings.push({
          path: `${path}.mustNotRepeat`,
          message: `"${action?.label ?? ''}" is the page's action, which every call to action carries; it was dropped from mustNotRepeat.`,
        });
        section = { ...section, mustNotRepeat: kept };
      }
      if (bespoke) return authoredSection(section, issues, path);
      const pictured =
        complete && !personal
          ? withHeroPhoto(section, { brief: pageWords, locale }, path, warnings)
          : section;
      let resolved = resolveKit(pictured, path, locale, warnings, action);
      if (complete && action !== undefined) {
        const contact = withContactDetails(
          resolved,
          { local, facts: repairedFacts, primaryCta: action, locale },
          path,
          warnings,
        );
        const kit = planKit(contact.kit);
        // Only when the contact kit fills cleanly; otherwise the section stays as resolved.
        if (
          contact !== resolved &&
          kit !== undefined &&
          instantiatePlanKit(kit, contact.slots, contact, locale).ok
        ) {
          resolved = contact;
        }
      }
      if (resolved.slots === undefined) return resolved;
      const slots = repairSlots(resolved.slots, `${path}.slots`, warnings);
      return { ...resolved, slots: slots as Readonly<Record<string, JsonValue>> };
    });
  if (issues.length > 0) return { ok: false, issues: Object.freeze(issues) };
  let finalNav: readonly PagePlanNavItem[] = nav;
  if (
    complete &&
    design?.chrome !== 'none' &&
    !bespoke &&
    locale !== undefined &&
    sections.length === read.length
  ) {
    const chrome = withPageChrome({ sections, nav, locale, maxSections, warnings });
    sections = chrome.sections;
    finalNav = chrome.nav;
  }
  if (
    intent === undefined ||
    locale === undefined ||
    title === undefined ||
    description === undefined ||
    tokens === undefined ||
    primaryCta === undefined ||
    read.some((section) => section === undefined)
  ) {
    // Unreachable: every undefined above recorded an issue. Kept so a future reader cannot lie.
    return {
      ok: false,
      issues: Object.freeze([
        { path: '', message: 'The page plan is incomplete; answer with every field.' },
      ]),
    };
  }
  const plan: PagePlan = {
    ...(design === undefined ? {} : { design }),
    intent,
    locale,
    title,
    description,
    tokens,
    primaryCta,
    nav: finalNav,
    sections,
    facts: repairedFacts,
    ...(finalSeo === undefined ? {} : { seo: finalSeo }),
    ...(brand === undefined ? {} : { brand }),
  };
  return warnings.length === 0
    ? { ok: true, plan: deepFreeze(plan), issues: [] }
    : { ok: true, plan: deepFreeze(plan), issues: [], warnings: Object.freeze(warnings) };
}
