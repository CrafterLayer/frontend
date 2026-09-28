import { contrastRatio, parseHex, relativeLuminance } from '@craftkit/builder-schema';

import {
  PHOTO_TOPIC_KEYWORDS,
  type PhotoOrientation,
  type PhotoTopic,
} from '../../context/providers/photo-catalog.data';
import { DIRECTION_DECK_ROWS, directionDeckImportUrl } from '../../skills/direction-deck';
import { SECTION_VARIANTS } from '../../skills/section-variants';
import { VERIFIED_FONT_FAMILIES } from '../../skills/verified-fonts';
import {
  isRecord,
  readArray,
  readColour,
  readEnum,
  readFace,
  readOptionalText,
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
  type PagePlanFont,
  type PagePlanIntent,
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
): PagePlanTokens | undefined {
  const { bg, surface, ink, muted, accent, onAccent, border } = draft.colours;
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

function readSection(value: unknown, path: string, issues: Issues): SectionContract | undefined {
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
  const variant = readOptionalText(value['variant'], `${path}.variant`, issues, 'the variant', 40);
  if (variant !== undefined && !VARIANT_IDS.includes(variant)) {
    issues.push({
      path: `${path}.variant`,
      message: `Use a section-variants layout id (${VARIANT_IDS.join(', ')}) or omit variant; "${variant}" is not one.`,
    });
  }
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
    ...(variant !== undefined && VARIANT_IDS.includes(variant) ? { variant } : {}),
    ...(images.length === 0 ? {} : { images }),
  };
}

/** Header first, hero right after it, footer last; append adds bands only. */
function checkShape(
  sections: readonly (SectionContract | undefined)[],
  intent: PagePlanIntent | undefined,
  issues: Issues,
): void {
  let heroes = 0;
  const last = sections.length - 1;
  sections.forEach((section, index) => {
    if (section === undefined) return;
    const path = `sections[${String(index)}].role`;
    const { role } = section;
    if (intent === 'append' && (role === 'header' || role === 'hero' || role === 'footer')) {
      issues.push({
        path,
        message: `An appended plan adds sections to a page that already has its header, hero and footer; make this ${role} a band or a cta.`,
      });
      return;
    }
    if (role === 'header' && index !== 0) {
      issues.push({
        path,
        message: 'A header comes first: move it to the top of the list, or make it a band.',
      });
    }
    if (role === 'footer' && index !== last) {
      issues.push({
        path,
        message: 'A footer comes last: move it to the end of the list, or make it a band.',
      });
    }
    if (role === 'hero') {
      heroes += 1;
      if (heroes > 1) {
        issues.push({
          path,
          message:
            'A page has exactly one hero (it holds the page’s one h1); make this section a band.',
        });
      } else if (!(index === 0 || (index === 1 && sections[0]?.role === 'header'))) {
        issues.push({
          path,
          message: 'The hero opens the page: place it first, or right after the header.',
        });
      }
    }
  });
  if (intent !== undefined && intent !== 'append' && heroes === 0) {
    issues.push({
      path: 'sections',
      message:
        'Give the page exactly one section with role "hero" (its one h1), first or right after the header.',
    });
  }
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

/**
 * Turn a provider's page-plan answer into the `PagePlan` a build uses — or into
 * every reason it cannot be one, each phrased as the instruction that fixes it.
 *
 * Pure and synchronous; never throws on any input. Normalises what code can
 * decide (palette names → hex, slugs, derived `dir` and `accentInk`, font import
 * URLs, `16:9` → `landscape`) so a repair round is spent only on judgement.
 * Unknown fields are dropped. The result's plan is deeply frozen.
 *
 * Checked: field shapes and bounds; 2..`maxSections` sections; unique section
 * keys, anchors and fact keys; header first / one hero after it / footer last
 * (and no header, hero or footer when appending); nav, CTA and facts pointing at
 * sections that exist; variants, photo subjects and deck rows from their
 * libraries; verified faces with shipped weights, Arabic-capable on an
 * Arabic-script page; WCAG AA (4.5:1) on all seven text pairs.
 */
export function validatePagePlan(
  value: unknown,
  options: ValidatePagePlanOptions = {},
): PagePlanValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: '',
          message:
            'Answer with the page plan as one JSON object ({ "intent", "locale", "title", "description", "tokens", "primaryCta", "nav", "sections", "facts" }) and nothing around it.',
        },
      ]),
    };
  }
  const issues: Issues = [];
  const maxSections = Math.max(
    PAGE_PLAN_MIN_SECTIONS,
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
  if (Array.isArray(value['sections']) && rawSections.length < PAGE_PLAN_MIN_SECTIONS) {
    issues.push({
      path: 'sections',
      message: `Plan between ${String(PAGE_PLAN_MIN_SECTIONS)} and ${String(maxSections)} sections (it has ${String(rawSections.length)}).`,
    });
  } else if (rawSections.length > maxSections) {
    issues.push({
      path: 'sections',
      message: `Plan at most ${String(maxSections)} sections (it has ${String(rawSections.length)}); merge or drop the weakest.`,
    });
  }
  const read = rawSections.map((section, index) =>
    readSection(section, `sections[${String(index)}]`, issues),
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
  checkShape(read, intent, issues);

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
  readArray(value['facts'], 'facts', issues, 'facts', {
    required: false,
    max: PAGE_PLAN_MAX_FACTS,
  }).forEach((fact, index) => {
    const path = `facts[${String(index)}]`;
    if (!isRecord(fact)) {
      issues.push({ path, message: 'Write each fact as { "key", "sample", "section" }.' });
      return;
    }
    const key = readSlug(fact['key'], `${path}.key`, issues, 'the fact key');
    const sample = readText(fact['sample'], `${path}.sample`, issues, 'the sample value', 200);
    const section = readSlug(fact['section'], `${path}.section`, issues, 'the fact’s section key');
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

  const tokens = tokenDraft === undefined ? undefined : finishTokens(tokenDraft, locale, issues);

  if (issues.length > 0) return { ok: false, issues: Object.freeze(issues) };
  const sections = read.filter((section): section is SectionContract => section !== undefined);
  if (
    intent === undefined ||
    locale === undefined ||
    title === undefined ||
    description === undefined ||
    tokens === undefined ||
    primaryCta === undefined ||
    sections.length !== read.length
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
    intent,
    locale,
    title,
    description,
    tokens,
    primaryCta,
    nav,
    sections,
    facts,
  };
  return { ok: true, plan: deepFreeze(plan), issues: [] };
}
