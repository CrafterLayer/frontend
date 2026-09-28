import { readFileSync } from 'node:fs';

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
  PAGE_PLAN_HEX_ONLY_SHADES,
  PAGE_PLAN_LATIN_FAMILIES,
  PAGE_PLAN_PHOTO_TOPICS,
  PAGE_PLAN_SECTION_VARIANTS,
  pagePlanShapeCheck,
  planShapeCheck,
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

  it('is the judge salvageJson restores a dropped section closer under', () => {
    const good = JSON.stringify(answer());
    // The hero section's own `}` dropped: its images close, then the next section follows.
    const cut = good.indexOf('},{"key":"menu"');
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
    The rules tell the model to copy a row's shades as written, because the
    client resolves the rows' names (agent/page-plan/palette.ts). That promise
    is only as true as the two files agree. Measured live 2026-09-28: the deck
    re-inked wedding (yellow-800) and auto (red-400) at 07:58, after the
    palette was written at 07:44. An Arabic wedding-hall plan (cli:haiku,
    84 s) copied yellow-800 as told, and validatePagePlan refused it. So every
    shade of every row must resolve there, or be one the rules hand over as
    hex. Checked either way, the test stays green when the palette catches up.
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
  const paletteHex = (): ReadonlyMap<string, string> =>
    new Map(
      [
        ...source('agent/page-plan/palette.ts').matchAll(
          /^ {2}(?:'([a-z]+-\d+)'|([a-z]+)): '(#[0-9a-f]{6})',$/gmu,
        ),
      ].map((match) => [match[1] ?? match[2] ?? '', match[3] ?? '']),
    );

  it("resolves every deck row's shade: by name on the client, or by the hex the rules give", () => {
    const shades = deckShades();
    const named = paletteHex();
    expect(shades.size).toBeGreaterThan(40);
    expect(named.get('white')).toBe('#ffffff');

    const unresolved = [...shades].filter(
      (shade) =>
        !/^#[0-9a-f]{6}$/u.test(shade) &&
        !named.has(shade) &&
        !Object.hasOwn(PAGE_PLAN_HEX_ONLY_SHADES, shade),
    );

    expect(unresolved).toEqual([]);
  });

  it('hands over as hex only a deck shade, at the value its contrast was measured on', () => {
    // page-power.test.ts holds the Tailwind v3 table the deck's contrast is computed on.
    const measured = source('skills/page-power.test.ts');
    const shades = deckShades();
    const named = paletteHex();

    for (const [shade, hex] of Object.entries(PAGE_PLAN_HEX_ONLY_SHADES)) {
      expect(shades.has(shade)).toBe(true);
      expect(measured).toContain(`'${shade}': '${hex}',`);
      // Once the client resolves it by name as well, both must mean one colour.
      expect(named.get(shade) ?? hex).toBe(hex);
    }
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
      'description',
      'tokens',
      'primaryCta',
      'nav',
      'sections',
      'facts',
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
