/** Bounded design intent shared by the page planner's prompt, decoder and salvage guard. */
export const FREE_DESIGN_TEACHING = `- design: {"kind","composition","chrome","concept"} BEFORE tokens/sections. kind: website | resume | portfolio; composition: bespoke | hybrid; chrome: standard | none. concept: 1–240 characters of subject-specific layout, type, density and signature detail. Review the direction against this brief in the same answer; no extra call.
- Default new designs of EVERY kind to bespoke. Hybrid is for requested template/reuse or a deliberately chosen optional kit. No mandatory section sequence; one authored region can contain the complete page and its one h1. Existing admitted libraries and JavaScript support interactions when free-code mode is enabled.
- Bespoke composition omits kit, variant and slots everywhere. layout: 1–240 characters for section geometry and responsive flow, in outline or matching brief. Writers use arbitrary supported semantic trees and scoped CSS. No new script or dependency permissions.
- Resume: normally bespoke/chrome none; readable chronology, dates, responsive flow and print breaks. Portfolio: project-led evidence. Neither requires a fixed column arrangement, stock photo, marketing chrome or sales CTA. Never invent employers, education, achievements, metrics, names or contact details. Preserve supplied facts; omit missing information or label it plainly in the page language. Required primaryCta may reference supplied contact or an actual section anchor.
- Respect explicit design choices. Decks suggest palettes, not mandatory structure. Vary composition, typography and density with the subject, not only accent color.`;

/** A small authored example, distinct from the legacy kit fixture retained in plan-shape. */
export const AUTHORED_PAGE_PLAN_EXAMPLE = {
  rationale: 'A compact botanical index with specimen-led hierarchy.',
  pagePlan: {
    intent: 'new-page',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Field notes',
    description: 'A botanical collection.',
    design: {
      kind: 'website',
      composition: 'bespoke',
      chrome: 'none',
      concept:
        'Asymmetric specimen index, quiet labels, readable sans type and dense observation rows.',
    },
    tokens: { deckRowId: 'farm', signature: 'Specimen silhouettes organize the index.' },
    primaryCta: { label: 'Collection', href: '#collection' },
    sections: [
      {
        key: 'collection',
        role: 'hero',
        title: 'Field notes',
        layout: 'Offset specimen columns become a single reading list on mobile.',
      },
    ],
    briefs: [{ key: 'collection', purpose: 'Show the supplied specimen observations.' }],
  },
} as const;

const DESIGN_KINDS = ['website', 'resume', 'portfolio'] as const;
const COMPOSITIONS = ['bespoke', 'hybrid'] as const;
const CHROME = ['standard', 'none'] as const;
const DESIGN_KEYS = new Set(['kind', 'composition', 'chrome', 'concept']);

/** Decoder bounds are descriptions; the shape guard and client enforce the actual limits. */
export const PAGE_DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'composition', 'chrome', 'concept'],
  properties: {
    kind: { type: 'string', enum: DESIGN_KINDS },
    composition: { type: 'string', enum: COMPOSITIONS },
    chrome: { type: 'string', enum: CHROME },
    concept: {
      type: 'string',
      description:
        '1–240 characters: subject-specific layout, typography, density and signature detail.',
    },
  },
} as const;

export const SECTION_LAYOUT_SCHEMA = {
  type: 'string',
  description:
    '1–240 characters: custom section geometry and responsive flow. Bespoke: omit kit, variant and slots.',
} as const;

export function boundedDesignText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pageDesignInPlace(value: unknown): boolean {
  if (value === undefined) return true;
  return (
    record(value) &&
    Object.keys(value).every((key) => DESIGN_KEYS.has(key)) &&
    DESIGN_KINDS.some((kind) => kind === value['kind']) &&
    COMPOSITIONS.some((composition) => composition === value['composition']) &&
    CHROME.some((chrome) => chrome === value['chrome']) &&
    boundedDesignText(value['concept'])
  );
}

/** Personal pages may contain supplied/redacted facts, never fabricated replacement samples. */
export function isPersonalDesign(value: unknown): boolean {
  return record(value) && (value['kind'] === 'resume' || value['kind'] === 'portfolio');
}

/** Build the provider schema from the server vocabulary without coupling to its module. */
export function createPagePlanAnswerSchema(vocabulary: {
  readonly PAGE_PLAN_ARABIC_FAMILIES: readonly string[];
  readonly PAGE_PLAN_LATIN_FAMILIES: readonly string[];
  readonly PAGE_PLAN_PHOTO_TOPICS: readonly string[];
  readonly PAGE_PLAN_DECK_ROWS: readonly string[];
  readonly PAGE_PLAN_SECTION_VARIANTS: readonly string[];
  readonly PAGE_PLAN_KIT_IDS: readonly string[];
  readonly PAGE_PLAN_SEO_KINDS: readonly string[];
  readonly PAGE_PLAN_BUSINESS_TYPES: readonly string[];
}) {
  const {
    PAGE_PLAN_ARABIC_FAMILIES,
    PAGE_PLAN_LATIN_FAMILIES,
    PAGE_PLAN_PHOTO_TOPICS,
    PAGE_PLAN_DECK_ROWS,
    PAGE_PLAN_SECTION_VARIANTS,
    PAGE_PLAN_KIT_IDS,
    PAGE_PLAN_SEO_KINDS,
    PAGE_PLAN_BUSINESS_TYPES,
  } = vocabulary;
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

  /** A section's or a brief's photos: catalog topics only. */
  const images = {
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
  } as const;

  /** A kit's slots; open, because every kit names its own. */
  const slots = {
    description:
      "The kit's slots, only for a short section (stats, logos, a cta, a faq of 6 or fewer).",
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
   *
   * It admits BOTH shapes the client reads (2026-10-05, speed DESIGN §3): the
   * compact plan the rules ask for — tokens by deck row, an outline of
   * `{key, role, title, variant, nav}`, one brief per section — and the classic
   * one, every field written out. Properties are listed in the contract's ORDER
   * (rationale; intent, locale, title, description, design, tokens, primaryCta, nav,
   * sections, briefs, facts, seo), which is the order a decoder writes them in
   * and the order the client streams them in.
   */
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rationale'],
    properties: {
      rationale: text,
      pagePlan: {
        type: 'object',
        additionalProperties: false,
        required: ['intent', 'locale', 'title', 'description', 'tokens', 'primaryCta', 'sections'],
        properties: {
          intent: { type: 'string', enum: ['new-page', 'replace', 'append'] },
          locale: {
            type: 'object',
            additionalProperties: false,
            required: ['lang', 'dir'],
            properties: { lang: text, dir: { type: 'string', enum: ['rtl', 'ltr'] } },
          },
          title: text,
          brand: {
            type: 'string',
            description: "The business's own short name, 1-4 words; never the title.",
          },
          description: text,
          design: PAGE_DESIGN_SCHEMA,
          // A deck is optional; explicit tokens can author the subject's own visual direction.
          tokens: {
            type: 'object',
            additionalProperties: false,
            required: ['signature'],
            description:
              'Choose an optional deckRowId or a complete custom palette and verified fonts. signature describes the design concept.',
            properties: {
              deckRowId: { type: 'string', enum: [...PAGE_PLAN_DECK_ROWS] },
              signature: text,
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
            },
          },
          primaryCta: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'href'],
            properties: { label: text, href: text },
          },
          /*
          The OUTLINE only (fix pass 2026-10-05). The classic contract fields
          and the top-level nav and facts are gone from the schema: the
          client still reads them, but listing them invited a mixed answer —
          the Arabic T1 wrote every fact twice (on the sections and in the
          briefs) and was refused twice for duplicate keys, and both answers
          ran 1.5-2.3x over the length target.
        */
          sections: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'role', 'title'],
              properties: {
                key: text,
                role: { type: 'string', enum: ['header', 'hero', 'band', 'cta', 'footer'] },
                title: text,
                layout: SECTION_LAYOUT_SCHEMA,
                variant: {
                  type: 'string',
                  enum: [...PAGE_PLAN_SECTION_VARIANTS],
                  description:
                    'A layout word from this list, never a kit id (a kit id goes in kit).',
                },
                kit: { type: 'string', enum: [...PAGE_PLAN_KIT_IDS] },
                nav: {
                  type: 'string',
                  description: 'The menu label, on a section the menu links to.',
                },
              },
            },
          },
          // One per section but the header, in page order; facts inside the section that shows them.
          briefs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'purpose'],
              properties: {
                key: text,
                purpose: text,
                layout: SECTION_LAYOUT_SCHEMA,
                mustSay: texts,
                mustNotRepeat: texts,
                images,
                slots,
                facts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['key', 'sample'],
                    properties: { key: text, sample: text },
                  },
                },
              },
            },
          },
          seo: {
            type: 'object',
            additionalProperties: false,
            required: ['keyword', 'pageKind'],
            properties: {
              keyword: text,
              pageKind: { type: 'string', enum: [...PAGE_PLAN_SEO_KINDS] },
              businessType: { type: 'string', enum: [...PAGE_PLAN_BUSINESS_TYPES] },
              slug: text,
            },
          },
        },
      },
      refusal: text,
    },
  } as const;
}
