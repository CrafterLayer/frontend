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

/**
 * Deck shades the client's palette (agent/page-plan/palette.ts) does not
 * resolve by name, with the Tailwind v3 hex the deck's contrast was measured
 * on (skills/page-power.test.ts). The rules hand these over as hex, and a hex
 * colour is accepted everywhere.
 *
 * Measured 2026-09-28: the deck re-inked wedding (accent-ink yellow-800) and
 * auto (accent-ink red-400) at 07:58. The palette had been written at 07:44,
 * so it names 71 of the deck's 73 shades. An Arabic wedding-hall plan
 * (cli:haiku, 84 s) copied yellow-800 as the rules said, and
 * validatePagePlan refused it; that is a whole repair round (~80 s) for
 * every wedding or auto page. The palette is the contract owner's file (asked
 * the same day). Once it names them, this map is redundant but harmless.
 * plan-shape.test.ts only fails if a deck shade resolves nowhere, or if the
 * two sides name different colours.
 */
export const PAGE_PLAN_HEX_ONLY_SHADES: Readonly<Record<string, string>> = Object.freeze({
  'yellow-800': '#854d0e',
  'red-400': '#f87171',
});

/**
 * The colours a plan falls back to when no deck row applies — no row fits the
 * subject, or no deck was pinned — in hex, because only the rows' own shade
 * names resolve on the client (its palette is the deck's shades, 73 entries).
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

/**
 * Whether a parsed answer has the SHAPE of a page-plan answer: the wrapper
 * (`{rationale, pagePlan}`, `version` allowed, as the wire carries it), a
 * bare plan from a model that forgot the wrapper, or a refusal. A commands
 * plan is none of them. Shape only, as `planShapeCheck` is: every key where
 * the contract puts it, tokens and sections present, no object closed a level
 * early — `validatePagePlan` on the client still decides whether the plan is
 * any good.
 *
 * Measured 2026-09-28 on the documented plan: across 228 single defects
 * (a closer dropped, doubled or swapped; a comma dropped; a key's quote lost)
 * and 17 cut-offs, salvage restored the same answers with and without this
 * judge — a page plan is shallow, so the first repair that parses is already
 * the right one, unlike a deep commands tree. What it adds is the refusal:
 * a repair that parses with a key in the wrong object is never preferred.
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
      keysWithin(value, ANSWER_KEYS) && isRecord(wrapped) && planInPlace(wrapped, PAGE_PLAN_KEYS)
    );
  }
  return planInPlace(value, BARE_PLAN_KEYS);
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
