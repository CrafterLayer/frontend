import { describe, expect, it } from 'vitest';
import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { buildPrompt } from './prompt';
import { AUTHORED_PAGE_PLAN_EXAMPLE } from './free-design';
import {
  PAGE_PLAN_ANSWER_SCHEMA,
  PAGE_PLAN_DECK_ROWS,
  PAGE_PLAN_KIT_IDS,
  PAGE_PLAN_EXAMPLE,
  pagePlanShapeCheck,
  repairPagePlanAnswer,
} from './plan-shape';

const design = {
  kind: 'website',
  composition: 'bespoke',
  chrome: 'none',
  concept:
    'A dense botanical catalog: readable type, asymmetric specimen columns and quiet specimen labels.',
};

function authoredAnswer() {
  return {
    rationale: 'The catalog puts specimens before marketing chrome.',
    pagePlan: {
      ...PAGE_PLAN_EXAMPLE.pagePlan,
      design,
      sections: [
        {
          key: 'collection',
          role: 'hero',
          title: 'Field notes',
          layout: 'An asymmetric index that becomes a reading list on narrow screens.',
        },
      ],
      briefs: [
        { key: 'collection', purpose: 'Present the supplied specimens and their observations.' },
      ],
      primaryCta: { label: 'Collection', href: '#collection' },
    },
  };
}

function plannerRequest(request: string): AiPlanWireRequest {
  return {
    version: 1,
    task: 'page-plan',
    request,
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      templates: [],
      commands: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
      outputContract: { version: 1, schema: { type: 'object' } },
    },
  };
}

describe('free page design decoding and salvage', () => {
  it('accepts a single authored region without kits or chrome, wrapped and bare', () => {
    const answer = authoredAnswer();
    expect(pagePlanShapeCheck(answer)).toBe(true);
    expect(pagePlanShapeCheck(answer.pagePlan)).toBe(true);
    expect(pagePlanShapeCheck(PAGE_PLAN_EXAMPLE)).toBe(true);
  });

  it('retains a layout in a compact brief as well as an outline', () => {
    const answer = authoredAnswer();
    const plan = {
      ...answer.pagePlan,
      sections: [{ key: 'collection', role: 'hero', title: 'Field notes' }],
      briefs: [
        {
          ...answer.pagePlan.briefs[0],
          layout: 'Three columns collapsing to a single readable column.',
        },
      ],
    };
    expect(pagePlanShapeCheck(plan)).toBe(true);
    expect(repairPagePlanAnswer(plan)).toEqual({ value: plan, repairs: [] });
  });

  it.each([
    { kind: 'document' },
    { composition: 'template' },
    { chrome: 'forced' },
    { concept: '' },
    { concept: ' ' },
    { concept: 'x'.repeat(241) },
    { concept: { title: 'Misplaced object' } },
    { sections: [] },
  ])('rejects malformed or misplaced design fields: %j', (change) => {
    expect(
      pagePlanShapeCheck({ ...authoredAnswer().pagePlan, design: { ...design, ...change } }),
    ).toBe(false);
  });

  it('requires a complete design object when present, while accepting the 240-character boundary', () => {
    expect(pagePlanShapeCheck({ ...authoredAnswer().pagePlan, design: {} })).toBe(false);
    expect(
      pagePlanShapeCheck({
        ...authoredAnswer().pagePlan,
        design: { ...design, concept: 'x'.repeat(240) },
      }),
    ).toBe(true);
  });

  it.each(['', ' ', 'x'.repeat(241), { purpose: 'Wrong level' }])(
    'rejects invalid outline and brief layouts: %j',
    (layout) => {
      const plan = authoredAnswer().pagePlan;
      expect(pagePlanShapeCheck({ ...plan, sections: [{ ...plan.sections[0], layout }] })).toBe(
        false,
      );
      expect(pagePlanShapeCheck({ ...plan, briefs: [{ ...plan.briefs[0], layout }] })).toBe(false);
    },
  );

  it('rejects a section layout accidentally closed inside kit slots', () => {
    const plan = authoredAnswer().pagePlan;
    expect(
      pagePlanShapeCheck({
        ...plan,
        briefs: [{ ...plan.briefs[0], slots: { layout: 'Wrong level' } }],
      }),
    ).toBe(false);
  });

  it.each(['resume', 'portfolio'])(
    'does not fabricate redacted facts for %s while repairing palette notation',
    (kind) => {
      const input = {
        ...authoredAnswer().pagePlan,
        design: { ...design, kind },
        tokens: { ...PAGE_PLAN_EXAMPLE.pagePlan.tokens, bg: '#fff' },
        facts: [{ key: 'phone', sample: '+962 XXX XXXX' }],
        briefs: [
          {
            key: 'collection',
            purpose: 'Show supplied facts.',
            facts: [{ key: 'email', sample: 'xxxx@example.com' }],
          },
        ],
      };
      const { value, repairs } = repairPagePlanAnswer(input);
      expect(value).toMatchObject({
        tokens: { bg: '#ffffff' },
        facts: input.facts,
        briefs: input.briefs,
      });
      expect(repairs).toHaveLength(1);
      expect(repairs[0]).toContain('tokens.bg');
      expect(input.tokens.bg).toBe('#fff');
      // Missing values must be omitted or plainly labelled by the author, never guessed.
      expect(pagePlanShapeCheck(value)).toBe(false);
    },
  );

  it('keeps legacy sample repair for existing no-design plans', () => {
    const plan = {
      ...PAGE_PLAN_EXAMPLE.pagePlan,
      facts: [{ key: 'phone', sample: '+962 XXX XXXX' }],
    };
    expect(repairPagePlanAnswer(plan).repairs).toHaveLength(1);
  });

  it('places optional design before tokens and sections in the provider schema', () => {
    const schema = PAGE_PLAN_ANSWER_SCHEMA.properties.pagePlan;
    const keys = Object.keys(schema.properties);
    expect(keys.indexOf('design')).toBeLessThan(keys.indexOf('tokens'));
    expect(keys.indexOf('design')).toBeLessThan(keys.indexOf('sections'));
    expect(schema.required).not.toContain('design');
    expect(schema.properties.design.additionalProperties).toBe(false);
    expect(schema.properties.design.required).toEqual(['kind', 'composition', 'chrome', 'concept']);
    expect(schema.properties.design.properties.concept.description).toContain('240');
    expect(schema.properties.sections.items.properties.layout.description).toContain('240');
    expect(schema.properties.briefs.items.properties.layout).toEqual(
      schema.properties.sections.items.properties.layout,
    );
    expect(schema.properties.sections.items.required).not.toContain('layout');
  });
});

describe('free design reaches the actual planner prompt', () => {
  it('does not require a catalog block layout in the direct command-building lane', () => {
    const prompt = buildPrompt({
      ...plannerRequest('Compose an original exhibition page'),
      task: 'plan',
    });
    const rules = prompt.system.map(({ text }) => text).join('\n');
    expect(rules).toContain('Catalog availability does not prescribe the design');
    expect(rules).toContain('New pages have no mandatory section sequence');
    expect(rules).not.toContain('Prefer it for the thing it does');
  });

  it.each([
    'Build an unusual botanical catalog with ui ux pro max',
    'صمم سيرة ذاتية احترافية باللغة الفرنسية',
    'Crea un portafolio visual con diseño libre',
  ])('sends subject-specific authored composition instructions for %s', (request) => {
    const prompt = buildPrompt(plannerRequest(request));
    const rules = prompt.system.map(({ text }) => text).join('\n');
    expect(rules).toContain('Default new designs of EVERY kind to bespoke');
    expect(rules).toContain('1 to 12 in page order');
    expect(rules).toContain('one complete authored region is allowed');
    expect(rules).toContain('Bespoke composition omits kit, variant and slots everywhere');
    expect(rules).toContain('arbitrary supported semantic trees and scoped CSS');
    expect(rules).toContain('an explicit requested page language wins');
    expect(rules).toContain(
      'Never invent employers, education, achievements, metrics, names or contact details',
    );
    expect(rules).not.toContain('Add a colour or font key ONLY when the person named one');
    expect(rules).not.toContain(
      'A whole page (new-page or replace) has a header first and a footer last',
    );
    expect(rules).toContain('when free-code mode is enabled');
    expect(JSON.stringify(prompt.messages)).toContain(request);
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
    expect(Object.keys(items.properties)).toEqual([
      'key',
      'role',
      'title',
      'layout',
      'variant',
      'kit',
      'nav',
    ]);
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
      'layout',
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

describe('the page-plan prompt with kits and seo', () => {
  function planRequest(): AiPlanWireRequest {
    return plannerRequest('اعمل صفحة هبوط لمحمصة قهوة في عمّان');
  }

  it('names the kits, the slots rule and the seo fields in the frozen rules', () => {
    const rules = buildPrompt(planRequest()).system[0]?.text ?? '';
    expect(rules).toContain('- kit: optional in hybrid only');
    expect(rules).toContain('Omit kit AND variant for a custom section');
    for (const id of PAGE_PLAN_KIT_IDS) expect(rules).toContain(id);
    expect(rules).toContain('- slots (in a brief): ONLY for a short section');
    expect(rules).toContain('- seo: {"keyword","pageKind","businessType","slug"}');
    expect(rules).toContain(JSON.stringify(AUTHORED_PAGE_PLAN_EXAMPLE));
  });

  it('stays within its budget: the rules under 11,000 characters (8,340 before kits and seo; 9,932 compact)', () => {
    const rules = buildPrompt(planRequest()).system[0]?.text ?? '';
    expect(rules.length).toBeLessThan(11_000);
  });
});
