import type { AiPlanWireRequest } from '@craftkit/builder/wire';

/**
 * Whether a parsed answer has the SHAPE of a plan for this request — the
 * judge `salvageJson` hands its rebalanced candidates to.
 *
 * A run of closers rewritten to parse can still close one level too few or
 * too many, and the text after it then lands in the wrong object: a command's
 * `title` inside its `args`, a sibling node inside a node's props. Every such
 * candidate parses; almost none has keys where the request's own contract
 * puts them. So the check reads the contract the request carries — the plan
 * schema's properties, each command's argument schema — instead of restating
 * the plan format here, and adds one structural rule for trees: a node (an
 * object with `kind`) never carries a key that belongs to the plan above it.
 *
 * It judges shape, not validity. The plan's own validator, two layers later,
 * still decides whether the plan is allowed.
 */

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The property names a closed object schema admits, or undefined when it admits any. */
function closedKeys(schema: unknown): ReadonlySet<string> | undefined {
  if (!isRecord(schema) || schema['additionalProperties'] !== false) return undefined;
  const properties = schema['properties'];
  return isRecord(properties) ? new Set(Object.keys(properties)) : undefined;
}

function keysWithin(value: JsonRecord, allowed: ReadonlySet<string> | undefined): boolean {
  return allowed === undefined || Object.keys(value).every((key) => allowed.has(key));
}

/** Keys that live at the plan, command, and argument levels — never on a tree node. */
const PLAN_LEVEL_KEYS = new Set(['rationale', 'commands', 'followUp', 'command', 'args', 'title']);

/** Every object with a `kind` is a node; none may hold a key that belongs to the plan above it. */
function nodesStayInPlace(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...(current as unknown[]));
      continue;
    }
    if (!isRecord(current)) continue;
    if (typeof current['kind'] === 'string') {
      if (Object.keys(current).some((key) => PLAN_LEVEL_KEYS.has(key))) return false;
      const children = current['children'];
      if (children !== undefined && !Array.isArray(children)) return false;
      if (Array.isArray(children) && children.some((child) => !isRecord(child))) return false;
    }
    stack.push(...Object.values(current));
  }
  return true;
}

export function planShapeCheck(request: AiPlanWireRequest): (value: unknown) => boolean {
  const planSchema: unknown = request.context.outputContract?.schema;
  const planKeys = closedKeys(planSchema);
  const commandsSchema = isRecord(planSchema) ? planSchema['properties'] : undefined;
  const commandKeys = closedKeys(
    isRecord(commandsSchema) && isRecord(commandsSchema['commands'])
      ? commandsSchema['commands']['items']
      : undefined,
  );
  const argKeys = new Map<string, ReadonlySet<string> | undefined>(
    (request.context.commands ?? []).map((command) => [
      command.name,
      closedKeys(command.argsSchema),
    ]),
  );

  return (value: unknown): boolean => {
    if (!isRecord(value) || !keysWithin(value, planKeys)) return false;
    const commands = value['commands'];
    if (!Array.isArray(commands)) return false;
    for (const entry of commands as unknown[]) {
      if (!isRecord(entry) || !keysWithin(entry, commandKeys)) return false;
      const name = entry['command'];
      const args = entry['args'];
      if (typeof name !== 'string') return false;
      if (isRecord(args) && !keysWithin(args, argKeys.get(name))) return false;
      if (!nodesStayInPlace(args)) return false;
    }
    return true;
  };
}

// ── the page-plan task (2026-09-28) ─────────────────────────────────────────
/*
  A `task: 'page-plan'` request asks for a PAGE PLAN — the structured design of
  a whole page (packages/builder/ai/src/agent/page-plan/types.ts) — instead of
  kernel commands, on the same endpoint. The client's `validatePagePlan` is
  the only judge of whether a plan is GOOD; what lives here is the shape the
  model answers in, the values it may choose from, and the judge that keeps a
  repaired answer's keys where the contract puts them.

  The value lists below MIRROR builder-ai's own tables (photo topics, section
  variants, deck rows, verified faces). This app reaches the builder family
  only through `@craftkit/builder/wire`, which carries the plan wire and no
  page-plan tables, so they are copied — and plan-shape.test.ts reads each one
  against its source file, so a drift fails a test rather than a live build.
  They exist because a model that knows the legal values is right the first
  time: every refused plan costs a whole repair round, and speed is the
  owner's first priority.
*/

/** `PhotoTopic` (context/providers/photo-catalog.data.ts): the subjects the catalog can answer. */
export const PAGE_PLAN_PHOTO_TOPICS = [
  'barber',
  'business',
  'cafe',
  'car',
  'charity',
  'city',
  'construction',
  'dental',
  'farm',
  'fashion',
  'gym',
  'hotel',
  'law',
  'medical',
  'perfume',
  'ramadan',
  'realestate',
  'restaurant',
  'sweets',
  'tech',
  'travel',
  'wedding',
] as const;

/** `SECTION_VARIANTS[].id` (skills/section-variants.ts): the named layouts a writer builds. */
export const PAGE_PLAN_SECTION_VARIANTS = [
  'split',
  'centered',
  'overlay',
  'frame',
  'editorial',
  'grid',
  'list',
  'bento',
  'sticky',
  'zigzag',
  'steps',
  'cards',
  'quote',
  'stats',
  'pricing',
  'menu',
  'product',
  'listing',
  'team',
  'gallery',
  'rail',
  'faq',
  'contact',
  'band',
  'cta-split',
  'footer',
] as const;

/** `DIRECTION_DECK_ROWS[].id` (skills/direction-deck.ts): the rows a look may start from. */
export const PAGE_PLAN_DECK_ROWS = [
  'cafe',
  'restaurant',
  'sweets',
  'dental',
  'medical',
  'law',
  'realestate',
  'gym',
  'beauty',
  'barber',
  'perfume',
  'wedding',
  'travel',
  'construction',
  'saas',
  'business',
  'education',
  'charity',
  'auto',
  'fashion',
  'farm',
] as const;

/** `VERIFIED_FONT_FAMILIES` with Arabic glyphs (skills/verified-fonts.ts), in its order. */
export const PAGE_PLAN_ARABIC_FAMILIES = [
  'Alexandria',
  'Almarai',
  'Amiri',
  'Aref Ruqaa',
  'Baloo Bhaijaan 2',
  'Beiruti',
  'Cairo',
  'Changa',
  'El Messiri',
  'Fustat',
  'IBM Plex Sans Arabic',
  'Lalezar',
  'Lemonada',
  'Markazi Text',
  'Noto Kufi Arabic',
  'Noto Naskh Arabic',
  'Noto Sans Arabic',
  'Readex Pro',
  'Reem Kufi',
  'Rubik',
  'Tajawal',
  'Vazirmatn',
] as const;

/** `VERIFIED_FONT_FAMILIES` without Arabic glyphs, in its order. */
export const PAGE_PLAN_LATIN_FAMILIES = [
  'Archivo',
  'Archivo Black',
  'Barlow',
  'Big Shoulders Display',
  'Bricolage Grotesque',
  'Cormorant Garamond',
  'DM Sans',
  'DM Serif Display',
  'Figtree',
  'Fraunces',
  'Geist',
  'Gloock',
  'IBM Plex Sans',
  'Instrument Sans',
  'Manrope',
  'Nunito Sans',
  'Outfit',
  'Sora',
  'Space Grotesk',
  'Syne',
  'Young Serif',
] as const;

// ── colours: every Tailwind shade name, resolved here (2026-09-28) ──────────
/*
  The client resolves a plan's shade names through its own palette
  (agent/page-plan/palette.ts), which holds only the shades the direction deck
  used when it was written — and a name outside it is a refused plan, which is
  a whole repair round. Measured live 2026-09-28 on cli:haiku: an Arabic
  wedding hall copied the deck's accent-ink yellow-800 (84 s, refused), an
  Arabic Dubai car dealer answered "accentInk":"red-400" even with the rules
  handing that shade over as hex (60 s, refused; 4 of 5 such plans complied),
  and an English dental plan wrote border "slate-100", a shade no row uses
  (121 s, refused). A rule the model must obey was the wrong fix for a
  translation code can do: every shade NAME below maps to exactly one hex, so
  `repairPagePlanAnswer` rewrites each colour token to it before the answer
  leaves this server, and the first answer validates.

  Tailwind v3's values, not v4's OKLCH: the deck's contrast was computed on v3
  hex (skills/page-power.test.ts) and the client stores the hex it resolves,
  so the colour of record is the one that was measured. Generated 2026-09-28
  from tailwindcss@3.4.19 lib/public/colors.js (22 families x 11 steps, plus
  white and black); plan-shape.test.ts holds it to page-power.test.ts's
  measured table and to every shade palette.ts names.
*/

/** The steps each family string below lists, in order. */
const TAILWIND_V3_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const TAILWIND_V3_FAMILIES: Readonly<Record<string, string>> = {
  slate: '#f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a #020617',
  gray: '#f9fafb #f3f4f6 #e5e7eb #d1d5db #9ca3af #6b7280 #4b5563 #374151 #1f2937 #111827 #030712',
  zinc: '#fafafa #f4f4f5 #e4e4e7 #d4d4d8 #a1a1aa #71717a #52525b #3f3f46 #27272a #18181b #09090b',
  neutral:
    '#fafafa #f5f5f5 #e5e5e5 #d4d4d4 #a3a3a3 #737373 #525252 #404040 #262626 #171717 #0a0a0a',
  stone: '#fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917 #0c0a09',
  red: '#fef2f2 #fee2e2 #fecaca #fca5a5 #f87171 #ef4444 #dc2626 #b91c1c #991b1b #7f1d1d #450a0a',
  orange: '#fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12 #431407',
  amber: '#fffbeb #fef3c7 #fde68a #fcd34d #fbbf24 #f59e0b #d97706 #b45309 #92400e #78350f #451a03',
  yellow: '#fefce8 #fef9c3 #fef08a #fde047 #facc15 #eab308 #ca8a04 #a16207 #854d0e #713f12 #422006',
  lime: '#f7fee7 #ecfccb #d9f99d #bef264 #a3e635 #84cc16 #65a30d #4d7c0f #3f6212 #365314 #1a2e05',
  green: '#f0fdf4 #dcfce7 #bbf7d0 #86efac #4ade80 #22c55e #16a34a #15803d #166534 #14532d #052e16',
  emerald:
    '#ecfdf5 #d1fae5 #a7f3d0 #6ee7b7 #34d399 #10b981 #059669 #047857 #065f46 #064e3b #022c22',
  teal: '#f0fdfa #ccfbf1 #99f6e4 #5eead4 #2dd4bf #14b8a6 #0d9488 #0f766e #115e59 #134e4a #042f2e',
  cyan: '#ecfeff #cffafe #a5f3fc #67e8f9 #22d3ee #06b6d4 #0891b2 #0e7490 #155e75 #164e63 #083344',
  sky: '#f0f9ff #e0f2fe #bae6fd #7dd3fc #38bdf8 #0ea5e9 #0284c7 #0369a1 #075985 #0c4a6e #082f49',
  blue: '#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #172554',
  indigo: '#eef2ff #e0e7ff #c7d2fe #a5b4fc #818cf8 #6366f1 #4f46e5 #4338ca #3730a3 #312e81 #1e1b4b',
  violet: '#f5f3ff #ede9fe #ddd6fe #c4b5fd #a78bfa #8b5cf6 #7c3aed #6d28d9 #5b21b6 #4c1d95 #2e1065',
  purple: '#faf5ff #f3e8ff #e9d5ff #d8b4fe #c084fc #a855f7 #9333ea #7e22ce #6b21a8 #581c87 #3b0764',
  fuchsia:
    '#fdf4ff #fae8ff #f5d0fe #f0abfc #e879f9 #d946ef #c026d3 #a21caf #86198f #701a75 #4a044e',
  pink: '#fdf2f8 #fce7f3 #fbcfe8 #f9a8d4 #f472b6 #ec4899 #db2777 #be185d #9d174d #831843 #500724',
  rose: '#fff1f2 #ffe4e6 #fecdd3 #fda4af #fb7185 #f43f5e #e11d48 #be123c #9f1239 #881337 #4c0519',
};

/** Every Tailwind v3 shade name (`stone-900`, `white`) → its lower-case `#rrggbb`. */
export const PAGE_PLAN_SHADE_HEX: ReadonlyMap<string, string> = new Map([
  ['white', '#ffffff'],
  ['black', '#000000'],
  ...Object.entries(TAILWIND_V3_FAMILIES).flatMap(([family, list]) =>
    list
      .split(' ')
      .map((hex, at): [string, string] => [`${family}-${String(TAILWIND_V3_STEPS[at])}`, hex]),
  ),
]);

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/u;
/** A utility prefix a model sometimes keeps on a shade (`text-red-400`): the colour is the same. */
const COLOUR_UTILITY_PREFIX =
  /^(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration)-/u;

/**
 * A plan colour as the lower-case `#rrggbb` it unambiguously means, or
 * undefined when it means nothing certain (an opacity modifier, a CSS name,
 * a shade Tailwind never had) — that is left for the client to name.
 */
export function resolvePagePlanColour(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (HEX_COLOUR.test(text)) {
    return text.length === 4
      ? `#${text.slice(1).replace(/./gu, (digit) => digit.repeat(2))}`
      : text;
  }
  return PAGE_PLAN_SHADE_HEX.get(text.replace(/\s+/gu, '-').replace(COLOUR_UTILITY_PREFIX, ''));
}

/** The tokens that hold a colour (agent/page-plan/types.ts). */
const COLOUR_TOKENS = [
  'bg',
  'surface',
  'ink',
  'muted',
  'accent',
  'onAccent',
  'accentInk',
  'border',
] as const;

/**
 * The colours a plan falls back to when no deck row applies — no row fits the
 * subject, or no deck was pinned — in hex, so the checked values reach the
 * page exactly as their contrast was computed here.
 *
 * Measured live 2026-09-28: with no deck in the context and only "keep
 * 4.5:1" to go on, cli:haiku chose muted, onAccent and accentInk between
 * 3.02:1 and 3.97:1 in both runs, so each plan cost a repair round. A base
 * whose every pair is checked (plan-shape.test.ts redoes the arithmetic) costs
 * none; the page keeps its character through the accent, the faces, the
 * layouts and the signature.
 */
export const PAGE_PLAN_FALLBACK_BASE = {
  bg: '#ffffff',
  surface: '#f5f5f4',
  ink: '#1c1917',
  muted: '#57534e',
  border: '#e7e5e4',
  onAccent: '#ffffff',
} as const;

/**
 * Accent fills for the base, each at 4.5:1 or more under white text AND as
 * text on both grounds (so accentInk may be omitted): Tailwind v3 -700s plus
 * stone-800, measured 4.51:1 (yellow-700 on the surface, the tightest) to
 * 15.16:1. Tints and -500s are left out on purpose: they are what failed.
 */
export const PAGE_PLAN_FALLBACK_ACCENTS = [
  '#c2410c',
  '#b45309',
  '#a16207',
  '#b91c1c',
  '#be123c',
  '#047857',
  '#15803d',
  '#0f766e',
  '#0e7490',
  '#0369a1',
  '#1d4ed8',
  '#292524',
] as const;

/**
 * The wire's own documented answer (provider/wire.ts, "BEGIN PAGE PLAN WIRE
 * EXAMPLE"), which the client's validator is tested to accept — so the one
 * example the model sees is one the door lets through. Shown minified in the
 * prompt; its values are a café's and the prompt says never to reuse them.
 */
export const PAGE_PLAN_EXAMPLE = {
  rationale: 'A warm, type-led roastery page: burnt orange on pale lime, Fraunces headings.',
  pagePlan: {
    intent: 'new-page',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Cardamom Roasters — specialty coffee in Amman',
    description: 'Small-batch coffee roasted every morning in Amman, delivered fresh.',
    tokens: {
      bg: '#f7fee7',
      surface: '#ffffff',
      ink: '#022c22',
      muted: '#065f46',
      accent: '#c2410c',
      onAccent: '#ffffff',
      accentInk: '#c2410c',
      border: '#d9f99d',
      fontDisplay: { family: 'Fraunces', weights: [600, 700] },
      fontBody: { family: 'Instrument Sans', weights: [400, 500] },
      radius: 'xl',
      signature: 'The brand name at text-8xl, faint behind the menu.',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'Order beans', href: '#order' },
    nav: [
      { label: 'Menu', anchorId: 'menu' },
      { label: 'Order', anchorId: 'order' },
    ],
    sections: [
      {
        key: 'header',
        role: 'header',
        title: 'Header',
        anchorId: 'top',
        purpose: 'Brand and navigation.',
      },
      {
        key: 'hero',
        role: 'hero',
        title: 'Roasted this morning',
        anchorId: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['Roasted daily in Amman'],
        mustNotRepeat: [],
        variant: 'split',
        images: [{ subject: 'cafe', aspect: 'landscape', alt: 'Freshly roasted coffee beans' }],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'Menu',
        anchorId: 'menu',
        purpose: 'The drinks and beans, with prices.',
        mustSay: [],
        mustNotRepeat: ['Roasted daily in Amman'],
        variant: 'menu',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'Order',
        anchorId: 'order',
        purpose: 'One clear way to order.',
        variant: 'cta-split',
      },
      {
        key: 'footer',
        role: 'footer',
        title: 'Footer',
        anchorId: 'footer',
        purpose: 'Address, hours and contact.',
        variant: 'footer',
      },
    ],
    facts: [
      { key: 'phone', sample: '+962 7 9000 0000', section: 'order' },
      { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
    ],
  },
} as const;

// Where every key of a page-plan answer lives (agent/page-plan/types.ts).
const ANSWER_KEYS = new Set(['version', 'rationale', 'pagePlan']);
const REFUSAL_KEYS = new Set(['version', 'rationale', 'refusal']);
const PAGE_PLAN_KEYS = new Set([
  'intent',
  'locale',
  'title',
  'description',
  'tokens',
  'primaryCta',
  'nav',
  'sections',
  'facts',
]);
/** A bare plan may still carry the rationale the wrapper would have held. */
const BARE_PLAN_KEYS = new Set([...PAGE_PLAN_KEYS, 'rationale']);
const TOKEN_KEYS = new Set([
  'bg',
  'surface',
  'ink',
  'muted',
  'accent',
  'onAccent',
  'accentInk',
  'border',
  'fontDisplay',
  'fontBody',
  'radius',
  'signature',
  'deckRowId',
]);
const FONT_KEYS = new Set(['family', 'weights', 'url']);
const LOCALE_KEYS = new Set(['lang', 'dir']);
const LINK_KEYS = new Set(['label', 'href']);
const NAV_KEYS = new Set(['label', 'anchorId']);
const SECTION_KEYS = new Set([
  'key',
  'role',
  'title',
  'anchorId',
  'purpose',
  'mustSay',
  'mustNotRepeat',
  'variant',
  'images',
]);
const IMAGE_KEYS = new Set(['subject', 'aspect', 'alt']);
const FACT_KEYS = new Set(['key', 'sample', 'section']);

/** An optional object whose keys all belong there. */
function objectWithin(value: unknown, allowed: ReadonlySet<string>): boolean {
  return value === undefined || (isRecord(value) && keysWithin(value, allowed));
}

/** An optional list of objects whose keys all belong there. */
function listWithin(value: unknown, allowed: ReadonlySet<string>): boolean {
  if (value === undefined) return true;
  return (
    Array.isArray(value) && value.every((entry) => isRecord(entry) && keysWithin(entry, allowed))
  );
}

/** Only strings: a claim list that swallowed an object was closed in the wrong place. */
function textsOnly(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  );
}

function sectionInPlace(value: unknown): boolean {
  if (!isRecord(value) || !keysWithin(value, SECTION_KEYS)) return false;
  return (
    textsOnly(value['mustSay']) &&
    textsOnly(value['mustNotRepeat']) &&
    listWithin(value['images'], IMAGE_KEYS)
  );
}

function planInPlace(plan: JsonRecord, allowed: ReadonlySet<string>): boolean {
  const { tokens, sections } = plan;
  return (
    keysWithin(plan, allowed) &&
    isRecord(tokens) &&
    keysWithin(tokens, TOKEN_KEYS) &&
    objectWithin(tokens['fontDisplay'], FONT_KEYS) &&
    objectWithin(tokens['fontBody'], FONT_KEYS) &&
    Array.isArray(sections) &&
    sections.every(sectionInPlace) &&
    objectWithin(plan['locale'], LOCALE_KEYS) &&
    objectWithin(plan['primaryCta'], LINK_KEYS) &&
    listWithin(plan['nav'], NAV_KEYS) &&
    listWithin(plan['facts'], FACT_KEYS)
  );
}

// ── the facts ledger's samples (2026-09-28) ─────────────────────────────────
/*
  A fact's sample is what the section writers put on the page. Measured live
  2026-09-28 on cli:haiku: 4 of 5 Dubai plans across two verify rounds wrote
  the phone as "+971 4 XXX XXXX" or "+971 4 XXXX XXXX" (saved answers under
  scratchpad/verify-ew2/server: out-auto-en, r2-out-auto-ar, r2-out-auto-en-3,
  r2-author-auto), while every Amman plan wrote real-looking digits — and the
  page's placeholder check knew brackets, mustaches and lorem, not X runs, so
  "+971 4 XXX XXXX" shipped. The rules now ask for a complete sample; the
  shape check refuses an X run; and `repairPagePlanAnswer` fills one in code,
  keeping the page's own format — a whole model round to invent seven digits
  would be the slowest possible repair.
*/

/**
 * A run a model writes INSTEAD of a value: two or more X (`XXX`, `xxxx`) or
 * three or more mask marks (`•••`, `***`, `###`, `___`), standing alone —
 * never inside a word, so `XXL`, `Louis XIV` and `Maxx` are values.
 */
const PLACEHOLDER_RUN = /(?<![\p{L}\p{N}])(?:[Xx]{2,}|[•*#_]{3,})(?![\p{L}\p{N}])/gu;

/** The digits a filled run takes, in turn: "+971 4 XXX XXXX" → "+971 4 234 5678". */
const SAMPLE_DIGITS = '2345678901';

/** `PLACEHOLDER_RUN` without the global flag, so testing carries no `lastIndex` between calls. */
const PLACEHOLDER_TEST = new RegExp(PLACEHOLDER_RUN.source, 'u');

/** Whether a fact's sample holds a placeholder run instead of a value. */
export function isPlaceholderSample(sample: string): boolean {
  return PLACEHOLDER_TEST.test(sample);
}

/**
 * The sample with every placeholder run filled, in the sample's own format:
 * in an email or web address a domain run (`info@xxxx.com`, `www.xxxx.ae`)
 * becomes `example` — the name reserved for exactly this (RFC 2606) — and a
 * mailbox run becomes `info`; every other run becomes digits, one per mark, so
 * a phone keeps its grouping and a price its decimals (`$XX.XX` → `$23.45`).
 */
export function fillPlaceholderSample(sample: string): string {
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

/** Whether any fact of a plan holds a placeholder sample. */
function hasPlaceholderFacts(plan: JsonRecord): boolean {
  const facts = plan['facts'];
  return (
    Array.isArray(facts) &&
    (facts as unknown[]).some(
      (fact) =>
        isRecord(fact) && typeof fact['sample'] === 'string' && isPlaceholderSample(fact['sample']),
    )
  );
}

/** Where a parsed answer keeps its plan: wrapped, bare, or nowhere (a refusal, a commands plan). */
function planOf(
  value: JsonRecord,
): { readonly plan: JsonRecord; readonly wrapped: boolean } | undefined {
  const wrapped = value['pagePlan'];
  if (isRecord(wrapped)) return { plan: wrapped, wrapped: true };
  const bare =
    wrapped === undefined &&
    value['refusal'] === undefined &&
    value['commands'] === undefined &&
    (isRecord(value['tokens']) || Array.isArray(value['facts']));
  return bare ? { plan: value, wrapped: false } : undefined;
}

/** A parsed answer after the repairs code can make without guessing, and what they were. */
export interface RepairedPagePlanAnswer {
  readonly value: unknown;
  /** One line per change, `path "before" → "after"`, for the server's log. Empty: untouched. */
  readonly repairs: readonly string[];
}

/**
 * The repairs a page-plan answer gets before it leaves this server — each one
 * a translation code decides without guessing, so none costs a model round:
 *
 * - every colour token written as a Tailwind shade name, a utility-prefixed
 *   shade or `#rgb` becomes the lower-case `#rrggbb` it means
 *   (`PAGE_PLAN_SHADE_HEX`); a value that means nothing certain is left for
 *   the client's validator to name;
 * - every fact sample holding a placeholder run is filled in its own format
 *   (`fillPlaceholderSample`).
 *
 * Total on any input — salvage hands it half-repaired candidates — and it
 * never mutates what it was given: a repaired answer is a copy.
 */
export function repairPagePlanAnswer(value: unknown): RepairedPagePlanAnswer {
  if (!isRecord(value)) return { value, repairs: [] };
  const found = planOf(value);
  if (found === undefined) return { value, repairs: [] };
  const repairs: string[] = [];
  const prefix = found.wrapped ? 'pagePlan.' : '';

  let tokens = found.plan['tokens'];
  if (isRecord(tokens)) {
    const next: Record<string, unknown> = { ...tokens };
    for (const key of COLOUR_TOKENS) {
      const written = next[key];
      if (typeof written !== 'string') continue;
      const resolved = resolvePagePlanColour(written);
      if (resolved === undefined || resolved === written) continue;
      next[key] = resolved;
      repairs.push(`${prefix}tokens.${key} "${written}" → "${resolved}"`);
    }
    tokens = next;
  }

  let facts = found.plan['facts'];
  if (Array.isArray(facts)) {
    facts = (facts as unknown[]).map((fact, index) => {
      if (!isRecord(fact) || typeof fact['sample'] !== 'string') return fact;
      const sample = fact['sample'];
      if (!isPlaceholderSample(sample)) return fact;
      const filled = fillPlaceholderSample(sample);
      repairs.push(`${prefix}facts[${String(index)}].sample "${sample}" → "${filled}"`);
      return { ...fact, sample: filled };
    });
  }

  if (repairs.length === 0) return { value, repairs };
  const plan = {
    ...found.plan,
    ...(tokens === undefined ? {} : { tokens }),
    ...(facts === undefined ? {} : { facts }),
  };
  return { value: found.wrapped ? { ...value, pagePlan: plan } : plan, repairs };
}

/**
 * Whether a parsed answer has the SHAPE of a page-plan answer: the wrapper
 * (`{rationale, pagePlan}`, `version` allowed, as the wire carries it), a
 * bare plan from a model that forgot the wrapper, or a refusal. A commands
 * plan is none of them. Shape only, as `planShapeCheck` is: every key where
 * the contract puts it, tokens and sections present, no object closed a level
 * early — plus one content rule, because it is the one the page cannot
 * survive: no fact sample is a placeholder run (see above). `validatePagePlan`
 * on the client still decides whether the plan is any good.
 *
 * Measured 2026-09-28 on the documented plan: across 228 single defects
 * (a closer dropped, doubled or swapped; a comma dropped; a key's quote lost)
 * and 17 cut-offs, salvage restored the same answers with and without this
 * judge — a page plan is shallow, so the first repair that parses is already
 * the right one, unlike a deep commands tree. What it adds is the refusal:
 * a repair that parses with a key in the wrong object is never preferred.
 * Salvage asks it of each candidate AFTER `repairPagePlanAnswer` (claude.ts),
 * so a placeholder the next step fills never makes a correct rebalance lose
 * to a wrong one.
 */
export function pagePlanShapeCheck(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const refusal = value['refusal'];
  if (refusal !== undefined) {
    return typeof refusal === 'string' && refusal.trim() !== '' && keysWithin(value, REFUSAL_KEYS);
  }
  const wrapped = value['pagePlan'];
  if (wrapped !== undefined) {
    return (
      keysWithin(value, ANSWER_KEYS) &&
      isRecord(wrapped) &&
      planInPlace(wrapped, PAGE_PLAN_KEYS) &&
      !hasPlaceholderFacts(wrapped)
    );
  }
  return planInPlace(value, BARE_PLAN_KEYS) && !hasPlaceholderFacts(value);
}

// ── the answer schema ────────────────────────────────────────────────────────

const text = { type: 'string' } as const;
const texts = { type: 'array', items: text } as const;
const colour = {
  type: 'string',
  description: '#rrggbb, or a Tailwind shade from the direction deck such as orange-700',
} as const;
const face = {
  type: 'object',
  additionalProperties: false,
  required: ['family', 'weights'],
  properties: {
    family: { type: 'string', enum: [...PAGE_PLAN_ARABIC_FAMILIES, ...PAGE_PLAN_LATIN_FAMILIES] },
    weights: { type: 'array', items: { type: 'integer' } },
  },
} as const;

/**
 * The JSON Schema a page-plan answer is decoded into — on the Messages API as
 * `output_config.format`, on OpenRouter as `response_format` where decoding is
 * trusted, and as text everywhere else (the CLI, free models).
 *
 * Written HERE, unlike the plan schema, which travels on the wire from the
 * package that validates it: the client assembles ONE context for both tasks,
 * so the context's `outputContract` is the commands plan's, and a page plan
 * decoded into it would be forced to carry `commands`. Deliberately looser
 * than `validatePagePlan` — no counts, lengths or contrast, which the
 * Messages API cannot decode anyway (SDK 0.122 transform-json-schema keeps
 * only minItems 0/1 and moves every other bound into a description) — and
 * tighter only in the enums, which are the values a model most often
 * invents. `refusal` stands in for `pagePlan` when a request cannot be a page.
 */
export const PAGE_PLAN_ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rationale'],
  properties: {
    rationale: text,
    pagePlan: {
      type: 'object',
      additionalProperties: false,
      required: [
        'intent',
        'locale',
        'title',
        'description',
        'tokens',
        'primaryCta',
        'nav',
        'sections',
        'facts',
      ],
      properties: {
        intent: { type: 'string', enum: ['new-page', 'replace', 'append'] },
        locale: {
          type: 'object',
          additionalProperties: false,
          required: ['lang', 'dir'],
          properties: { lang: text, dir: { type: 'string', enum: ['rtl', 'ltr'] } },
        },
        title: text,
        description: text,
        tokens: {
          type: 'object',
          additionalProperties: false,
          required: [
            'bg',
            'surface',
            'ink',
            'muted',
            'accent',
            'onAccent',
            'border',
            'fontDisplay',
            'fontBody',
            'radius',
            'signature',
          ],
          properties: {
            bg: colour,
            surface: colour,
            ink: colour,
            muted: colour,
            accent: colour,
            onAccent: colour,
            accentInk: colour,
            border: colour,
            fontDisplay: face,
            fontBody: face,
            radius: { type: 'string', enum: ['none', 'md', 'xl', 'full'] },
            signature: text,
            deckRowId: { type: 'string', enum: [...PAGE_PLAN_DECK_ROWS] },
          },
        },
        primaryCta: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'href'],
          properties: { label: text, href: text },
        },
        nav: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'anchorId'],
            properties: { label: text, anchorId: text },
          },
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'role', 'title', 'anchorId', 'purpose'],
            properties: {
              key: text,
              role: { type: 'string', enum: ['header', 'hero', 'band', 'cta', 'footer'] },
              title: text,
              anchorId: text,
              purpose: text,
              mustSay: texts,
              mustNotRepeat: texts,
              variant: { type: 'string', enum: [...PAGE_PLAN_SECTION_VARIANTS] },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['subject', 'aspect', 'alt'],
                  properties: {
                    subject: { type: 'string', enum: [...PAGE_PLAN_PHOTO_TOPICS] },
                    aspect: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
                    alt: text,
                  },
                },
              },
            },
          },
        },
        facts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'sample', 'section'],
            properties: { key: text, sample: text, section: text },
          },
        },
      },
    },
    refusal: text,
  },
} as const;
