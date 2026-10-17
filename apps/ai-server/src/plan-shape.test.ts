import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { salvageJson } from './json-salvage';
import {
  PAGE_PLAN_ANSWER_SCHEMA,
  PAGE_PLAN_ARABIC_FAMILIES,
  PAGE_PLAN_DECK_ROWS,
  PAGE_PLAN_EXAMPLE,
  PAGE_PLAN_FALLBACK_ACCENTS,
  PAGE_PLAN_FALLBACK_BASE,
  PAGE_PLAN_KIT_IDS,
  PAGE_PLAN_LATIN_FAMILIES,
  PAGE_PLAN_PHOTO_TOPICS,
  PAGE_PLAN_SECTION_VARIANTS,
  PAGE_PLAN_SHADE_HEX,
  fillPlaceholderSample,
  isPlaceholderSample,
  pagePlanShapeCheck,
  planShapeCheck,
  repairPagePlanAnswer,
  resolvePagePlanColour,
} from './plan-shape';

const request = {
  version: 1,
  request: 'Fill the drinks section',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    templates: [],
    document: { schemaVersion: 1, rootId: 'root', nodes: [] },
    selection: [],
    commands: [
      {
        name: 'setProp',
        argsSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, key: { type: 'string' }, value: {} },
        },
      },
    ],
    outputContract: {
      version: 1,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rationale: { type: 'string' },
          commands: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { command: { type: 'string' }, args: {}, title: { type: 'string' } },
            },
          },
          followUp: { type: 'string' },
        },
      },
    },
    omissions: [],
  },
} as unknown as AiPlanWireRequest;

const tree = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h2', text: 'Drinks' }],
};

function planWith(command: Record<string, unknown>): unknown {
  return { rationale: 'r', commands: [command], followUp: 'f' };
}

describe('planShapeCheck', () => {
  const check = planShapeCheck(request);

  it('accepts a plan whose keys sit where the contract puts them', () => {
    expect(
      check(
        planWith({
          command: 'setProp',
          args: { id: 'a', key: 'tree', value: tree },
          title: 't',
        }),
      ),
    ).toBe(true);
  });

  it('refuses a command title that slid into its arguments', () => {
    expect(
      check(
        planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: tree, title: 't' } }),
      ),
    ).toBe(false);
  });

  it('refuses a plan-level key that slid into a command', () => {
    expect(
      check({
        rationale: 'r',
        commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 }, followUp: 'f' }],
      }),
    ).toBe(false);
  });

  it('refuses a tree node carrying a key from the plan above it', () => {
    const slid = { kind: 'root', children: [{ kind: 'element', tag: 'h2', title: 't' }] };
    expect(
      check(planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: slid } })),
    ).toBe(false);
  });

  it('refuses a node whose children hold a bare string', () => {
    const loose = { kind: 'root', children: ['title'] };
    expect(
      check(planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: loose } })),
    ).toBe(false);
  });

  it('refuses answers that are not plans at all', () => {
    expect(check([])).toBe(false);
    expect(check({ rationale: 'r' })).toBe(false);
    expect(check({ rationale: 'r', commands: [{ args: {} }] })).toBe(false);
  });

  it('admits any arguments for a command whose schema is open', () => {
    const open = planShapeCheck({
      ...request,
      context: { ...request.context, commands: [] },
    });
    expect(open(planWith({ command: 'insertNode', args: { anything: 1 } }))).toBe(true);
  });
});

/*
  The page-plan task's answer (2026-09-28). The judge `salvageJson` hands its
  rebalanced candidates to on a `task: 'page-plan'` request: it knows where
  every key of a page plan lives, so a closer run rewritten to parse cannot
  quietly move a section into another section or a fact into the tokens.
*/
describe('pagePlanShapeCheck', () => {
  const answer = (): Record<string, unknown> => ({
    rationale: PAGE_PLAN_EXAMPLE.rationale,
    pagePlan: structuredClone(PAGE_PLAN_EXAMPLE.pagePlan),
  });

  it('accepts the documented page plan, wrapped as the task asks and as the wire carries it', () => {
    expect(pagePlanShapeCheck(answer())).toBe(true);
    expect(pagePlanShapeCheck({ version: 1, ...answer() })).toBe(true);
  });

  it('accepts a bare page plan from a model that forgot the wrapper', () => {
    expect(pagePlanShapeCheck(structuredClone(PAGE_PLAN_EXAMPLE.pagePlan))).toBe(true);
  });

  it('accepts a refusal, which is a whole answer on its own', () => {
    expect(pagePlanShapeCheck({ rationale: 'r', refusal: 'Not a page.' })).toBe(true);
    expect(pagePlanShapeCheck({ refusal: '' })).toBe(false);
  });

  it('rejects an ordinary commands plan — the answer to a different task', () => {
    expect(
      pagePlanShapeCheck({
        rationale: 'Added a hero.',
        commands: [{ command: 'insertNode', args: {} }],
      }),
    ).toBe(false);
  });

  it('rejects answers that are not page plans at all', () => {
    expect(pagePlanShapeCheck([])).toBe(false);
    expect(pagePlanShapeCheck('plan')).toBe(false);
    expect(pagePlanShapeCheck({ rationale: 'r' })).toBe(false);
    expect(pagePlanShapeCheck({ rationale: 'r', pagePlan: [] })).toBe(false);
    expect(pagePlanShapeCheck({ rationale: 'r', pagePlan: { title: 'x' } })).toBe(false);
  });

  it('rejects a key that slid into the wrong object', () => {
    const slidIntoTokens = answer();
    const plan = slidIntoTokens['pagePlan'] as { tokens: Record<string, unknown> };
    plan.tokens['purpose'] = 'Say what the roastery is.';
    expect(pagePlanShapeCheck(slidIntoTokens)).toBe(false);

    const sectionsOf = (value: Record<string, unknown>): Record<string, unknown>[] =>
      (value['pagePlan'] as { sections: Record<string, unknown>[] }).sections;

    const factInSection = answer();
    const hero = sectionsOf(factInSection)[1] ?? {};
    hero['sample'] = 'JOD 1.50';
    expect(pagePlanShapeCheck(factInSection)).toBe(false);

    const sectionInSection = answer();
    const nested = sectionsOf(sectionInSection);
    const outer = nested[1] ?? {};
    outer['sections'] = [nested[2]];
    expect(pagePlanShapeCheck(sectionInSection)).toBe(false);

    const planKeyInWrapper = { ...answer(), facts: [] };
    expect(pagePlanShapeCheck(planKeyInWrapper)).toBe(false);
  });

  it('is the judge salvageJson restores a dropped brief closer under', () => {
    const good = JSON.stringify(answer());
    // The hero brief's own `}` dropped: its images close, then the next brief follows.
    const cut = good.indexOf('}]},{"key":"menu"') + 2;
    expect(cut).toBeGreaterThan(2);
    const written = `${good.slice(0, cut)}${good.slice(cut + 1)}`;
    expect(() => JSON.parse(written) as unknown).toThrow();

    const repaired = JSON.parse(salvageJson(written, pagePlanShapeCheck)) as unknown;

    expect(repaired).toEqual(answer());
  });
});

/*
  The server states the contract's value lists to the model so a plan is right
  the first time — a refused plan costs a whole repair round, and speed is the
  owner's first priority. They are MIRRORS of builder-ai's own tables, which
  this app cannot import (the wire door carries types and the plan wire only;
  asked of the editor's wire owner, 2026-09-28). So each mirror is read against
  its source here: a list that drifts fails this file, not a live build.
*/
describe('page-plan contract mirrors', () => {
  const AI_SRC = new URL('../../../packages/builder/ai/src/', import.meta.url);
  const source = (path: string): string => readFileSync(new URL(path, AI_SRC), 'utf8');

  it('names exactly the photo-catalog topics', () => {
    const text = source('context/providers/photo-catalog.data.ts');
    const start = text.indexOf('export type PhotoTopic =');
    const union = text.slice(start, text.indexOf(';', start));
    const topics = [...union.matchAll(/'([a-z]+)'/gu)].map((match) => match[1]);
    expect(topics.length).toBeGreaterThan(0);
    expect([...PAGE_PLAN_PHOTO_TOPICS]).toEqual(topics);
  });

  it('names exactly the section-variants ids', () => {
    const ids = [
      ...source('skills/section-variants.ts').matchAll(/^\s+id: '([a-z][a-z0-9-]*)'/gmu),
    ].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect([...PAGE_PLAN_SECTION_VARIANTS]).toEqual(ids);
  });

  it('names exactly the direction-deck rows', () => {
    const ids = [
      ...source('skills/direction-deck.ts').matchAll(/^\s+id: '([a-z][a-z0-9-]*)'/gmu),
    ].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect([...PAGE_PLAN_DECK_ROWS]).toEqual(ids);
  });

  /*
    The rules tell the model to copy a row's shades as written, and this
    server rewrites every shade name to its hex before the answer leaves
    (`repairPagePlanAnswer`). Measured live 2026-09-28, the names were the
    commonest refusal: yellow-800 and red-400 (deck shades the client's
    palette.ts lacked, re-inked at 07:58 after it was written at 07:44) and
    slate-100 (a shade no row uses). So the server's table must resolve every
    shade of every row, at the hex the deck's contrast was measured on, and
    must mean what the client's palette means for every name the palette has
    — checked either way, so the palette catching up can never turn this red.
  */
  const deckShades = (): ReadonlySet<string> => {
    const calls = [
      ...source('skills/direction-deck.ts').matchAll(/palette: palette\(([\s\S]*?)\n\s*\),/gu),
    ];
    expect(calls).toHaveLength(PAGE_PLAN_DECK_ROWS.length);
    return new Set(
      calls.flatMap(([, args = '']) =>
        [...args.replace(/\/\/.*$/gmu, '').matchAll(/'([^']*)'/gu)].flatMap(([, roles = '']) =>
          roles.split(' '),
        ),
      ),
    );
  };
  /** `'name': '#hex',` entries of a source file's table. */
  const hexTable = (path: string): ReadonlyMap<string, string> =>
    new Map(
      [...source(path).matchAll(/^ {2}(?:'([a-z]+-\d+)'|([a-z]+)): '(#[0-9a-f]{6})',$/gmu)].map(
        (match) => [match[1] ?? match[2] ?? '', match[3] ?? ''],
      ),
    );

  it("resolves every deck row's shade, at the hex its contrast was measured on", () => {
    const shades = deckShades();
    // page-power.test.ts holds the Tailwind v3 table the deck's contrast is computed on.
    const measured = hexTable('skills/page-power.test.ts');
    expect(shades.size).toBeGreaterThan(40);
    expect(measured.size).toBeGreaterThan(40);

    const unresolved = [...shades].filter(
      (shade) => !/^#[0-9a-f]{6}$/u.test(shade) && !PAGE_PLAN_SHADE_HEX.has(shade),
    );
    expect(unresolved).toEqual([]);
    for (const [shade, hex] of measured) expect(PAGE_PLAN_SHADE_HEX.get(shade)).toBe(hex);
  });

  it("means what the client's palette means, for every shade the palette names", () => {
    const named = hexTable('agent/page-plan/palette.ts');
    expect(named.get('white')).toBe('#ffffff');
    expect(named.size).toBeGreaterThan(40);

    const disagreeing = [...named].filter(([shade, hex]) => PAGE_PLAN_SHADE_HEX.get(shade) !== hex);
    expect(disagreeing).toEqual([]);
  });

  it('names exactly the verified font families, split by Arabic glyphs', () => {
    const faces = [
      ...source('skills/verified-fonts.ts').matchAll(
        /^ {2}(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*)):\s*\{\s*arabic:\s*(true|false)/gmu,
      ),
    ].map((match) => ({ family: match[1] ?? match[2], arabic: match[3] === 'true' }));
    expect(faces.length).toBeGreaterThan(0);
    expect([...PAGE_PLAN_ARABIC_FAMILIES]).toEqual(
      faces.filter((face) => face.arabic).map((face) => face.family),
    );
    expect([...PAGE_PLAN_LATIN_FAMILIES]).toEqual(
      faces.filter((face) => !face.arabic).map((face) => face.family),
    );
  });

  it('accepts a plan that names its brand — the header and footer show it', () => {
    const answer = {
      rationale: PAGE_PLAN_EXAMPLE.rationale,
      pagePlan: { ...structuredClone(PAGE_PLAN_EXAMPLE.pagePlan), brand: 'Cardamom Roasters' },
    };
    expect(pagePlanShapeCheck(answer)).toBe(true);
  });

  it("shows the model the wire's own documented example — the one the client's validator accepts", () => {
    const text = source('provider/wire.ts');
    const start = text.indexOf('BEGIN PAGE PLAN WIRE EXAMPLE');
    const end = text.indexOf('END PAGE PLAN WIRE EXAMPLE');
    const body = text
      .slice(text.indexOf('\n', start) + 1, text.lastIndexOf('\n', end))
      .split('\n')
      .map((line) => line.replace(/^\s*\*( |$)/u, ''))
      .join('\n');
    const documented = JSON.parse(body) as { rationale: string; pagePlan: unknown };

    expect(PAGE_PLAN_EXAMPLE).toEqual({
      rationale: documented.rationale,
      pagePlan: documented.pagePlan,
    });
  });
});

describe('the page-plan answer schema', () => {
  it('constrains decoding to the wire shape, with the contract enums', () => {
    const schema = PAGE_PLAN_ANSWER_SCHEMA as {
      properties: Record<string, { properties?: Record<string, unknown> }>;
    };
    expect(Object.keys(schema.properties)).toEqual(['rationale', 'pagePlan', 'refusal']);
    const plan = schema.properties['pagePlan']?.properties ?? {};
    expect(Object.keys(plan)).toEqual([
      'intent',
      'locale',
      'title',
      // Quality pass 2026-10-05: the business's short name, shown by the header and footer.
      'brand',
      'description',
      'tokens',
      'primaryCta',
      'sections',
      // 2026-10-05: the compact plan's one brief per section. Top-level nav and
      // facts left the schema in the fix pass: listing them invited mixed answers.
      'briefs',
      // 2026-09-30: optional, what the page is found by.
      'seo',
    ]);
    const text = JSON.stringify(PAGE_PLAN_ANSWER_SCHEMA);
    expect(text).toContain('"cta-split"');
    expect(text).toContain('"realestate"');
    expect(text).toContain('"Markazi Text"');
  });

  it('uses only what the Messages API decodes: closed objects, no numeric or length bounds', () => {
    const forbidden = ['minLength', 'maxLength', 'minimum', 'maximum', 'pattern', 'oneOf'];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      for (const key of forbidden) expect(Object.keys(record)).not.toContain(key);
      if (record['type'] === 'object') expect(record['additionalProperties']).toBe(false);
      Object.values(record).forEach(walk);
    };
    walk(PAGE_PLAN_ANSWER_SCHEMA);
  });
});

/*
  The base a plan falls back to when no deck row applies. It is only worth
  stating if it passes the client's contrast gate as written, so the gate's
  own arithmetic (WCAG 2.2 relative luminance, the 4.5:1 AA floor
  validatePagePlan holds every text pair to) is redone here on every pair.
*/
describe('the checked fallback base', () => {
  function luminance(hex: string): number {
    const channel = (at: number): number => {
      const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  }
  function contrast(foreground: string, ground: string): number {
    const [light, dark] = [luminance(foreground), luminance(ground)].sort((a, b) => b - a);
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
  }

  it('reads at 4.5:1 or more on every text pair, with every accent', () => {
    const { bg, surface, ink, muted, onAccent } = PAGE_PLAN_FALLBACK_BASE;
    for (const [foreground, ground] of [
      [ink, bg],
      [ink, surface],
      [muted, bg],
      [muted, surface],
    ] as const) {
      expect(contrast(foreground, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(PAGE_PLAN_FALLBACK_ACCENTS.length).toBeGreaterThan(0);
    for (const accent of PAGE_PLAN_FALLBACK_ACCENTS) {
      // The fill under white text, and — accentInk omitted — the accent as text on both grounds.
      expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/*
  Every Tailwind shade name, resolved on this server (2026-09-28): the names a
  deck row writes, a shade no row uses, a utility prefix left on, #rgb — each
  a refused plan and a whole repair round when the client met it first.
*/
describe('the shade table', () => {
  it('holds the whole Tailwind v3 palette: 22 families of 11 steps, plus white and black', () => {
    expect(PAGE_PLAN_SHADE_HEX.size).toBe(22 * 11 + 2);
    for (const [name, hex] of PAGE_PLAN_SHADE_HEX) {
      expect(name).toMatch(/^(?:white|black|[a-z]+-(?:50|[1-9]00|950))$/u);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/u);
    }
    // Spot checks against tailwindcss@3.4.19 lib/public/colors.js.
    expect(PAGE_PLAN_SHADE_HEX.get('slate-100')).toBe('#f1f5f9');
    expect(PAGE_PLAN_SHADE_HEX.get('indigo-600')).toBe('#4f46e5');
    expect(PAGE_PLAN_SHADE_HEX.get('rose-950')).toBe('#4c0519');
  });

  it('resolves a shade name, a prefixed shade and #rgb to the lower-case #rrggbb they mean', () => {
    expect(resolvePagePlanColour('red-400')).toBe('#f87171');
    expect(resolvePagePlanColour('yellow-800')).toBe('#854d0e');
    expect(resolvePagePlanColour('slate-100')).toBe('#f1f5f9');
    expect(resolvePagePlanColour(' Stone-900 ')).toBe('#1c1917');
    expect(resolvePagePlanColour('text-red-400')).toBe('#f87171');
    expect(resolvePagePlanColour('bg-white')).toBe('#ffffff');
    expect(resolvePagePlanColour('rose 50')).toBe('#fff1f2');
    expect(resolvePagePlanColour('#FFF')).toBe('#ffffff');
    expect(resolvePagePlanColour('#C2410C')).toBe('#c2410c');
  });

  it('leaves what means nothing certain for the client to name', () => {
    expect(resolvePagePlanColour('rose-50/80')).toBeUndefined();
    expect(resolvePagePlanColour('gold')).toBeUndefined();
    expect(resolvePagePlanColour('rose-450')).toBeUndefined();
    expect(resolvePagePlanColour('transparent')).toBeUndefined();
    expect(resolvePagePlanColour('#12345')).toBeUndefined();
  });
});

/*
  The facts ledger's samples (2026-09-28). The phones below are the ones the
  live Dubai plans wrote, from the answers saved under the verify round's
  scratchpad (verify-ew2/server): out-auto-en.json, r2-out-auto-ar.json,
  r2-out-auto-en-3.json and r2-author-auto.json — 4 of 5 Dubai plans. The
  values that must stay are from the same answers and the Amman ones.
*/
describe('placeholder samples', () => {
  const LIVE_PLACEHOLDERS = ['+971 4 XXX XXXX', '+971 4 XXXX XXXX'];
  const LIVE_VALUES = [
    '+962 79 8888 888',
    '+962 6 5000 1000',
    '+962 2 7250000',
    '+971 4 123 4567',
    'AED 150',
    'AED 89,000',
    '5,000+ vehicles',
    'Sun–Thu 7:00 AM–7:00 PM, Fri–Sat 8:00 AM–6:00 PM',
    'sales@premiummotors.ae',
    'info@luxurycars-dubai.ae',
    'دبي لوكس موتورز',
    '185,000 درهم',
    'تمويل من 3.99% سنوياً لمدة 60 شهراً',
    'BMW 750Li 2023',
    // The documented example's own phone, and values an X lives inside.
    '+962 7 9000 0000',
    'Size XXL',
    'Louis XIV',
    'Maxx Fitness',
    '2x faster',
    '#1 in Dubai',
  ];

  it('names every live X placeholder, and masks, as placeholders', () => {
    for (const sample of [
      ...LIVE_PLACEHOLDERS,
      'AED XXX',
      '$XX.XX',
      'info@xxxx.com',
      '050 ••• ••••',
    ]) {
      expect(isPlaceholderSample(sample), sample).toBe(true);
    }
  });

  it('leaves every real value alone', () => {
    for (const sample of LIVE_VALUES) expect(isPlaceholderSample(sample), sample).toBe(false);
  });

  it('fills a placeholder in the sample’s own format', () => {
    expect(fillPlaceholderSample('+971 4 XXX XXXX')).toBe('+971 4 234 5678');
    expect(fillPlaceholderSample('+971 4 XXXX XXXX')).toBe('+971 4 2345 6789');
    expect(fillPlaceholderSample('$XX.XX')).toBe('$23.45');
    expect(fillPlaceholderSample('AED XXX')).toBe('AED 234');
    expect(fillPlaceholderSample('050 ••• ••••')).toBe('050 234 5678');
    expect(fillPlaceholderSample('info@xxxx.com')).toBe('info@example.com');
    expect(fillPlaceholderSample('www.xxxx.ae')).toBe('www.example.ae');
    expect(fillPlaceholderSample('xxxx@gmail.com')).toBe('info@gmail.com');
    for (const sample of LIVE_PLACEHOLDERS) {
      expect(isPlaceholderSample(fillPlaceholderSample(sample))).toBe(false);
    }
  });
});

describe('repairPagePlanAnswer', () => {
  /** The documented plan, with what the live Dubai car dealer wrote (r2-dump 06-45-38). */
  const liveDealer = (): Record<string, unknown> => {
    const pagePlan = structuredClone(PAGE_PLAN_EXAMPLE.pagePlan) as unknown as Record<
      string,
      unknown
    >;
    pagePlan['tokens'] = {
      ...(pagePlan['tokens'] as Record<string, unknown>),
      bg: 'neutral-950',
      surface: 'neutral-900',
      ink: 'neutral-50',
      muted: 'neutral-400',
      accent: 'red-600',
      onAccent: 'white',
      accentInk: 'red-400',
      border: '#2a2a2a',
    };
    pagePlan['facts'] = [
      { key: 'phone', sample: '+971 4 XXX XXXX', section: 'order' },
      { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
    ];
    return { rationale: 'r', pagePlan };
  };

  it('rewrites every shade name to its hex and fills the placeholder, saying what it did', () => {
    const answer = liveDealer();
    const before = structuredClone(answer);

    const { value, repairs } = repairPagePlanAnswer(answer);

    const plan = (value as { pagePlan: { tokens: Record<string, unknown>; facts: unknown[] } })
      .pagePlan;
    expect(plan.tokens).toMatchObject({
      bg: '#0a0a0a',
      surface: '#171717',
      ink: '#fafafa',
      muted: '#a3a3a3',
      accent: '#dc2626',
      onAccent: '#ffffff',
      accentInk: '#f87171',
      border: '#2a2a2a',
    });
    expect(plan.facts).toEqual([
      { key: 'phone', sample: '+971 4 234 5678', section: 'order' },
      { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
    ]);
    expect(repairs).toContain('pagePlan.tokens.accentInk "red-400" → "#f87171"');
    expect(repairs).toContain('pagePlan.facts[0].sample "+971 4 XXX XXXX" → "+971 4 234 5678"');
    expect(repairs).not.toContain('pagePlan.tokens.border "#2a2a2a" → "#2a2a2a"');
    // A copy: salvage calls it on every candidate it weighs.
    expect(answer).toEqual(before);
  });

  it('turns a live placeholder answer the shape check refuses into one it accepts', () => {
    expect(pagePlanShapeCheck(liveDealer())).toBe(false);
    expect(pagePlanShapeCheck(repairPagePlanAnswer(liveDealer()).value)).toBe(true);
  });

  it('repairs a bare plan in place of the wrapper, and returns an answer with nothing to repair as it was', () => {
    const bare = (liveDealer() as { pagePlan: Record<string, unknown> }).pagePlan;
    const repaired = repairPagePlanAnswer(bare);
    expect((repaired.value as { tokens: { accentInk: string } }).tokens.accentInk).toBe('#f87171');
    expect(repaired.repairs[0]).toMatch(/^tokens\./u);

    const clean = { rationale: 'r', pagePlan: structuredClone(PAGE_PLAN_EXAMPLE.pagePlan) };
    const untouched = repairPagePlanAnswer(clean);
    expect(untouched.value).toBe(clean);
    expect(untouched.repairs).toEqual([]);
  });

  it('never touches a refusal, a commands plan or a non-object', () => {
    for (const value of [
      { rationale: 'r', refusal: 'Not a page.' },
      { rationale: 'r', commands: [{ command: 'setProp', args: {} }] },
      'text',
      null,
      [],
    ]) {
      expect(repairPagePlanAnswer(value)).toEqual({ value, repairs: [] });
    }
  });
});

describe('the placeholder rule in pagePlanShapeCheck', () => {
  it('refuses a fact sample that is an X placeholder, wrapped or bare', () => {
    const answer = {
      rationale: 'r',
      pagePlan: {
        ...structuredClone(PAGE_PLAN_EXAMPLE.pagePlan),
        facts: [{ key: 'phone', sample: '+971 4 XXXX XXXX', section: 'order' }],
      },
    };
    expect(pagePlanShapeCheck(answer)).toBe(false);
    expect(pagePlanShapeCheck(answer.pagePlan)).toBe(false);
  });

  it('still restores a dropped closer in an answer whose phone is a placeholder, judged after the repair', () => {
    const answer = {
      rationale: PAGE_PLAN_EXAMPLE.rationale,
      pagePlan: {
        ...structuredClone(PAGE_PLAN_EXAMPLE.pagePlan),
        facts: [{ key: 'phone', sample: '+971 4 XXX XXXX', section: 'order' }],
      },
    };
    const good = JSON.stringify(answer);
    const cut = good.indexOf('}]},{"key":"menu"') + 2;
    const written = `${good.slice(0, cut)}${good.slice(cut + 1)}`;

    const judged = (candidate: unknown): boolean =>
      pagePlanShapeCheck(repairPagePlanAnswer(candidate).value);

    expect(JSON.parse(salvageJson(written, judged))).toEqual(answer);
  });
});

// ── the section kit, SEO and tool steps (2026-09-30) ────────────────────────

describe('tool steps in a plan', () => {
  const check = planShapeCheck(request);

  it('accepts a {"command":"tool"} step, whose args the client expands', () => {
    expect(
      check(
        planWith({
          command: 'tool',
          args: {
            name: 'kit.section',
            input: {
              id: 'r-hero',
              kit: 'hero-split',
              slots: { title: 'قهوة تُحمّص كل صباح', cta: { label: 'اطلب', href: '#order' } },
            },
          },
          title: 'البطل',
        }),
      ),
    ).toBe(true);
    expect(check(planWith({ command: 'tool', args: { name: 'seo.fix', input: {} } }))).toBe(true);
  });

  it('still refuses a tool step whose title slid out of place, or a node that swallowed a plan key', () => {
    expect(
      check({
        rationale: 'r',
        commands: [{ command: 'tool', args: { name: 'nav.sync', input: {} }, followUp: 'f' }],
      }),
    ).toBe(false);
    expect(
      check(
        planWith({
          command: 'tool',
          args: { name: 'kit.insert', input: { kit: 'cta-band', slots: { kind: 'element', commands: [] } } },
        }),
      ),
    ).toBe(false);
  });
});

describe('the page plan with kits and seo', () => {
  const AI_SRC = new URL('../../../packages/builder/ai/src/', import.meta.url);

  it('names exactly the section kits builder-ai ships', () => {
    const kitsDir = new URL('section-kit/kits/', AI_SRC);
    const ids = readdirSync(kitsDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .flatMap((file) =>
        [...readFileSync(new URL(file, kitsDir), 'utf8').matchAll(/^ {4}id: '([a-z0-9-]+)'/gmu)].map(
          (match) => match[1] ?? '',
        ),
      )
      .sort();
    expect(ids.length).toBeGreaterThan(30);
    expect([...PAGE_PLAN_KIT_IDS]).toEqual(ids);
  });

  it('decodes kit, slots and seo, with the kit ids and page kinds as enums', () => {
    const plan = PAGE_PLAN_ANSWER_SCHEMA.properties.pagePlan;
    const section = plan.properties.sections.items.properties;
    expect(section.kit.enum).toEqual([...PAGE_PLAN_KIT_IDS]);
    // Slots live in the briefs (fix pass 2026-10-05), still an open object.
    expect(plan.properties.briefs.items.properties.slots).not.toHaveProperty('type');
    expect(plan.properties.seo.required).toEqual(['keyword', 'pageKind']);
    expect(plan.properties.seo.properties.pageKind.enum).toContain('home');
    expect(plan.properties.seo.properties.businessType.enum).toContain('CafeOrCoffeeShop');
    // Optional, both: a plan without them is still a plan.
    expect(plan.required).not.toContain('seo');
    expect(plan.properties.sections.items.required).not.toContain('kit');
  });

  it('accepts the documented plan with kits, slots and seo, and refuses a key closed inside slots', () => {
    expect(pagePlanShapeCheck(PAGE_PLAN_EXAMPLE)).toBe(true);
    const sections = PAGE_PLAN_EXAMPLE.pagePlan.sections;
    const slid = {
      ...PAGE_PLAN_EXAMPLE,
      pagePlan: {
        ...PAGE_PLAN_EXAMPLE.pagePlan,
        sections: sections.map((section, index) =>
          index === 3 ? { ...section, slots: { title: 'x', purpose: 'y' } } : section,
        ),
      },
    };
    expect(pagePlanShapeCheck(slid)).toBe(false);
    const strayKey = {
      ...PAGE_PLAN_EXAMPLE,
      pagePlan: { ...PAGE_PLAN_EXAMPLE.pagePlan, seo: { keyword: 'x', pageKind: 'home', tokens: {} } },
    };
    expect(pagePlanShapeCheck(strayKey)).toBe(false);
  });
});

// ── the compact, ordered plan (2026-10-05, speed DESIGN §3) ─────────────────
/*
  T1 now answers in the compact plan — tokens by deck row, an outline of
  {key, role, title, variant, nav}, one brief per section with its facts — and
  the client's validatePagePlan expands it. The judge must take it, the
  classic plan and a mix, and still refuse a key closed in the wrong object.
*/

/** The classic plan the compact one replaced: every field written out (wire example before 2026-10-05). */
const CLASSIC_PLAN = {
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
    { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand and navigation.' },
    {
      key: 'hero',
      role: 'hero',
      title: 'Roasted this morning',
      anchorId: 'hero',
      purpose: 'Say what the roastery is and invite the first order.',
      mustSay: ['Roasted daily in Amman'],
      mustNotRepeat: [],
      variant: 'split',
      kit: 'hero-split',
      images: [{ subject: 'cafe', aspect: 'landscape', alt: 'Freshly roasted coffee beans' }],
    },
    {
      key: 'order',
      role: 'cta',
      title: 'Order',
      anchorId: 'order',
      purpose: 'One clear way to order.',
      variant: 'cta-split',
      kit: 'cta-split',
      slots: { title: 'Fresh beans, delivered in Amman', cta: { label: 'Order beans', href: '#order' } },
    },
    { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Address.', variant: 'footer' },
  ],
  facts: [{ key: 'phone', sample: '+962 6 461 2750', section: 'footer' }],
  seo: { keyword: 'specialty coffee Amman', pageKind: 'home', slug: 'specialty-coffee-amman' },
};

describe('the compact page plan', () => {
  type Plan = Record<string, unknown> & {
    sections: Record<string, unknown>[];
    briefs: Record<string, unknown>[];
  };
  const compact = (): Plan => structuredClone(PAGE_PLAN_EXAMPLE.pagePlan) as unknown as Plan;
  const wrap = (pagePlan: unknown): Record<string, unknown> => ({ rationale: 'r', pagePlan });

  it('accepts the compact example, wrapped and bare, with tokens holding only deckRowId and signature', () => {
    expect(Object.keys(PAGE_PLAN_EXAMPLE.pagePlan.tokens)).toEqual(['deckRowId', 'signature']);
    expect(pagePlanShapeCheck(wrap(compact()))).toBe(true);
    expect(pagePlanShapeCheck(compact())).toBe(true);
  });

  it('still accepts a classic plan, and a mix of the two', () => {
    expect(pagePlanShapeCheck(wrap(structuredClone(CLASSIC_PLAN)))).toBe(true);
    const mixed = { ...structuredClone(CLASSIC_PLAN), briefs: compact().briefs };
    expect(pagePlanShapeCheck(wrap(mixed))).toBe(true);
  });

  it('accepts a brief that names its variant and kit, which the client merges into the section', () => {
    const plan = compact();
    plan.briefs[0] = { ...plan.briefs[0], variant: 'split', kit: 'hero-split' };
    expect(pagePlanShapeCheck(wrap(plan))).toBe(true);
  });

  it('refuses a brief key closed inside a section, and a section key closed inside a brief', () => {
    const factsInSection = compact();
    factsInSection.sections[1] = {
      ...factsInSection.sections[1],
      facts: [{ key: 'phone', sample: '+962 6 461 2750' }],
    };
    expect(pagePlanShapeCheck(wrap(factsInSection))).toBe(false);

    const roleInBrief = compact();
    roleInBrief.briefs[1] = { ...roleInBrief.briefs[1], role: 'band' };
    expect(pagePlanShapeCheck(wrap(roleInBrief))).toBe(false);

    const sectionInBriefs = compact();
    sectionInBriefs.briefs.push({ key: 'faq', role: 'band', title: 'FAQ' });
    expect(pagePlanShapeCheck(wrap(sectionInBriefs))).toBe(false);

    const briefInSections = compact();
    briefInSections.sections.push({ key: 'faq', purpose: 'Answers.', facts: [] });
    expect(pagePlanShapeCheck(wrap(briefInSections))).toBe(false);
  });

  it('refuses a brief without a key, a stray key in a brief fact, a nav that is not a label, briefs in the wrapper', () => {
    const keyless = compact();
    keyless.briefs[0] = { purpose: 'No key.' };
    expect(pagePlanShapeCheck(wrap(keyless))).toBe(false);

    const strayFactKey = compact();
    strayFactKey.briefs[3] = {
      ...strayFactKey.briefs[3],
      facts: [{ key: 'phone', sample: '+962 6 461 2750', purpose: 'x' }],
    };
    expect(pagePlanShapeCheck(wrap(strayFactKey))).toBe(false);

    const navObject = compact();
    navObject.sections[2] = { ...navObject.sections[2], nav: { label: 'Menu' } };
    expect(pagePlanShapeCheck(wrap(navObject))).toBe(false);

    const plan = compact();
    expect(pagePlanShapeCheck({ rationale: 'r', pagePlan: plan, briefs: plan.briefs })).toBe(false);

    const briefsNotAList = compact() as Record<string, unknown>;
    briefsNotAList['briefs'] = { hero: {} };
    expect(pagePlanShapeCheck(wrap(briefsNotAList))).toBe(false);
  });

  it("refuses an X placeholder inside a brief's facts, and the repair fills it and logs the brief path", () => {
    const plan = compact();
    plan.briefs[3] = {
      ...plan.briefs[3],
      facts: [
        { key: 'email', sample: 'info@roasters.jo' },
        { key: 'phone', sample: '+971 4 XXX XXXX' },
      ],
    };
    const answer = wrap(plan);
    const before = structuredClone(answer);
    expect(pagePlanShapeCheck(answer)).toBe(false);

    const { value, repairs } = repairPagePlanAnswer(answer);

    expect(repairs).toEqual(['pagePlan.briefs[3].facts[1].sample "+971 4 XXX XXXX" → "+971 4 234 5678"']);
    const repaired = (value as { pagePlan: Plan }).pagePlan;
    expect(repaired.briefs[3]?.['facts']).toEqual([
      { key: 'email', sample: 'info@roasters.jo' },
      { key: 'phone', sample: '+971 4 234 5678' },
    ]);
    // Briefs with nothing to fill are the very same objects; the input is never mutated.
    expect(repaired.briefs[0]).toBe(plan.briefs[0]);
    expect(answer).toEqual(before);
    expect(pagePlanShapeCheck(value)).toBe(true);
  });

  it('fills a bare compact plan in place, its path without the wrapper', () => {
    const plan = compact();
    plan.briefs[1] = { ...plan.briefs[1], facts: [{ key: 'price-espresso', sample: 'JOD XX.XX' }] };
    const { value, repairs } = repairPagePlanAnswer(plan);
    expect(repairs).toEqual(['briefs[1].facts[0].sample "JOD XX.XX" → "JOD 23.45"']);
    expect((value as Plan).briefs[1]?.['facts']).toEqual([
      { key: 'price-espresso', sample: 'JOD 23.45' },
    ]);
  });

  it('restores a dropped closer in a compact answer whose brief phone is a placeholder, judged after the repair', () => {
    const plan = compact();
    plan.briefs[3] = { ...plan.briefs[3], facts: [{ key: 'phone', sample: '+971 4 XXXX XXXX' }] };
    const answer = { rationale: PAGE_PLAN_EXAMPLE.rationale, pagePlan: plan };
    const good = JSON.stringify(answer);
    const cut = good.indexOf('}]},{"key":"menu"') + 2;
    const written = `${good.slice(0, cut)}${good.slice(cut + 1)}`;
    expect(() => JSON.parse(written) as unknown).toThrow();

    const judged = (candidate: unknown): boolean =>
      pagePlanShapeCheck(repairPagePlanAnswer(candidate).value);

    expect(JSON.parse(salvageJson(written, judged))).toEqual(answer);
  });
});

describe('the answer schema admits both shapes, in the contract order', () => {
  const plan = PAGE_PLAN_ANSWER_SCHEMA.properties.pagePlan;

  it('lists tokens deck row first, every colour, face and radius optional', () => {
    const tokens = plan.properties.tokens;
    expect(Object.keys(tokens.properties).slice(0, 2)).toEqual(['deckRowId', 'signature']);
    expect(tokens.required).toEqual(['signature']);
    expect(tokens.properties.deckRowId.enum).toEqual([...PAGE_PLAN_DECK_ROWS]);
  });

  it('lists the outline fields only — key, role and title required, nav a label', () => {
    const items = plan.properties.sections.items;
    // Fix pass 2026-10-05: no contract field on an outline section, so nothing invites a duplicate.
    expect(Object.keys(items.properties)).toEqual(['key', 'role', 'title', 'variant', 'kit', 'nav']);
    expect(items.required).toEqual(['key', 'role', 'title']);
    expect(items.properties.nav.type).toBe('string');
    expect(items.properties.variant.description).toMatch(/never a kit id/u);
    expect(plan.properties).not.toHaveProperty('nav');
    expect(plan.properties).not.toHaveProperty('facts');
  });

  it('decodes one brief per section with its facts', () => {
    const items = plan.properties.briefs.items;
    expect(Object.keys(items.properties)).toEqual([
      'key',
      'purpose',
      'mustSay',
      'mustNotRepeat',
      'images',
      'slots',
      'facts',
    ]);
    expect(items.required).toEqual(['key', 'purpose']);
    expect(Object.keys(items.properties.facts.items.properties)).toEqual(['key', 'sample']);
    expect(plan.required).toEqual([
      'intent',
      'locale',
      'title',
      'description',
      'tokens',
      'primaryCta',
      'sections',
    ]);
  });
});

/*
  R-xrun parity (DESIGN §4). The client restates `fillPlaceholderSample` in
  validatePagePlan (agent/page-plan) so a provisional contract equals the
  final one; the two must behave identically, so this table is copied
  VERBATIM into the client's test. Change one, change both.
*/
const R_XRUN_PARITY: [input: string, filled: string][] = [
  // phone
  ['+971 4 XXX XXXX', '+971 4 234 5678'],
  ['+971 4 XXXX XXXX', '+971 4 2345 6789'],
  ['050 ••• ••••', '050 234 5678'],
  ['+962 79 *** ####', '+962 79 234 5678'],
  ['+962 7 9XXX XXXX', '+962 7 9XXX 2345'],
  ['+962 6 461 2750', '+962 6 461 2750'],
  // price
  ['$XX.XX', '$23.45'],
  ['AED XXX', 'AED 234'],
  ['JOD XX.XX', 'JOD 23.45'],
  ['AED 1,XXX', 'AED 1,234'],
  ['٣٥ ريال XX', '٣٥ ريال 23'],
  // email
  ['info@xxxx.com', 'info@example.com'],
  ['xxxx@gmail.com', 'info@gmail.com'],
  ['xxx@xxxx.ae', 'info@example.ae'],
  // www
  ['www.xxxx.ae', 'www.example.ae'],
  ['https://xxxx.com/menu', 'https://example.com/menu'],
  ['www.example.com', 'www.example.com'],
  // values an X lives inside
  ['Size XXL', 'Size XXL'],
];

describe('R-xrun parity', () => {
  it.each(R_XRUN_PARITY)('fills %j as %j', (input, filled) => {
    expect(fillPlaceholderSample(input)).toBe(filled);
    expect(isPlaceholderSample(input)).toBe(input !== filled);
  });
});
