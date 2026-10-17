import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applyAiPlan } from '../plan/apply-plan';
import { parseTreeMarkup, serializeTreeMarkup } from '../plan/tree-markup';
import { AI_PLAN_WIRE_VERSION, estimateAiPlanWireRequestTokens } from '../provider/wire';
import {
  createAiSkillRegistry,
  createCraftkitAiSkillRegistry,
  type AiSkillPrepareOptions,
  type AiSkillRegistry,
} from '../skills';
import type { AiPlan, AiPlanProvider, AiProposeOptions, AssembledAiContext } from '../types';
import { runAiAgent } from './run-agent';
import type { AiAgentEvent, RunAiAgentOptions } from './types';

/*
  fast-edits (2026-09-28). The owner's «تغيير عنوان قسم التعليم والشهادات إلى
  مرحبا» showed "~11.3k tokens" and took 46 s. A small edit stated in full is
  now made with no model (source 'direct', 0 tokens); an edit the model must
  make sees its section whole and the rest of the page as an outline; an edit
  may run on the host's fast model; and the route the run reads reaches skill
  gating.
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'fast-edits-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

/** Body copy long enough that a section weighs what a real CV section does. */
const BODY =
  "<p class='text-base leading-relaxed text-slate-600'>أعمل على بناء واجهات سريعة وسهلة الاستخدام، وأهتم بالتفاصيل الصغيرة التي تصنع تجربة مريحة للمستخدم في كل شاشة.</p>";

const CV: readonly (readonly [string, string, string])[] = [
  ['hero', 'الرئيسية', `<section id='hero' class='py-24'><h1 class='text-5xl font-bold'>ريم خالد</h1><p class='text-lg'>مهندسة برمجيات</p>${BODY}</section>`],
  ['about', 'نبذة عني', `<section id='about' class='py-16'><h2 class='text-3xl font-bold'>نبذة عني</h2>${BODY}${BODY}</section>`],
  ['experience', 'الخبرات', `<section id='experience' class='py-16'><h2 class='text-3xl font-bold'>الخبرات العملية</h2><div><h3 class='text-xl'>مطورة واجهات في شركة نون</h3>${BODY}</div><div><h3 class='text-xl'>مطورة مبتدئة في شركة أرامكس</h3>${BODY}</div></section>`],
  ['education', 'التعليم والشهادات', `<section id='education' class='py-16'><h2 class='text-3xl font-bold'>التعليم والشهادات</h2><div><h3 class='text-xl'>بكالوريوس علوم الحاسوب</h3><p>الجامعة الأردنية</p></div></section>`],
  ['skills', 'المهارات', `<section id='skills' class='py-16'><h2 class='text-3xl font-bold'>المهارات</h2><ul><li>React</li><li>TypeScript</li><li>Node.js</li></ul>${BODY}</section>`],
  ['projects', 'المشاريع', `<section id='projects' class='py-16'><h2 class='text-3xl font-bold'>مشاريعي</h2>${BODY}${BODY}</section>`],
  ['testimonials', 'آراء العملاء', `<section id='testimonials' class='py-16'><h2 class='text-3xl font-bold'>آراء العملاء</h2>${BODY}${BODY}</section>`],
  ['languages', 'اللغات', `<section id='languages' class='py-16'><h2 class='text-3xl font-bold'>اللغات</h2><ul><li>العربية</li><li>الإنجليزية</li></ul></section>`],
  ['contact', 'التواصل', `<section id='contact' class='py-16'><h2 class='text-3xl font-bold'>تواصل معي</h2>${BODY}</section>`],
];

function cvDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'ريم خالد' }, slots: { default: CV.map(([id]) => id) } },
      ...Object.fromEntries(
        CV.map(([id, label, markup]) => [
          id,
          { id, type: 'customCode', props: { label, tree: parseTreeMarkup(markup) }, slots: {} },
        ]),
      ),
    },
  } as unknown as BuilderDocument;
}

function emptyDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: '' }, slots: { default: [] } } },
  } as unknown as BuilderDocument;
}

function kernelFor(document: BuilderDocument = cvDocument()): BuilderKernel {
  return createBuilder({
    document,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('fast-edits') },
  });
}

const OWNER = 'تغيير عنوان قسم التعليم والشهادات إلى مرحبا';

/** A clock that moves 5 ms per read, so elapsed time is visible. */
function steppingClock(): { now: () => number } {
  let now = 1_000;
  return {
    now: () => {
      now += 5;
      return now;
    },
  };
}

interface Call {
  readonly request: string;
  readonly context: AssembledAiContext;
  readonly live: (AiProposeOptions & { model?: string; effort?: string }) | undefined;
}

/** A provider that records every call and answers with `plan`. */
function recording(plan: (kernel: BuilderKernel) => AiPlan, kernel: BuilderKernel): {
  readonly provider: AiPlanProvider;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    provider: {
      propose: (request, context, live) => {
        calls.push({ request, context, live });
        return Promise.resolve(plan(kernel));
      },
    },
  };
}

/** A harmless model answer: retitle the education heading through setProp on its tree. */
function retitleEducation(kernel: BuilderKernel): AiPlan {
  const tree = kernel.getDocument().nodes['education']?.props['tree'];
  const markup = serializeTreeMarkup(tree) ?? '';
  return {
    rationale: 'Retitle the education section.',
    commands: [
      {
        command: 'setProp',
        args: {
          id: 'education',
          key: 'tree',
          value: parseTreeMarkup(markup.replace('>التعليم والشهادات</h2>', '>المؤهلات</h2>')),
        },
      },
    ],
  };
}

function options(
  kernel: BuilderKernel,
  provider: AiPlanProvider,
  extra: Partial<RunAiAgentOptions> = {},
): RunAiAgentOptions {
  return {
    runId: 'fast-edit',
    clock: steppingClock(),
    kernel,
    provider,
    request: OWNER,
    validationPorts: { clock: fixedClock(2), ids: seededIds('fast-edits-ports') },
    ...extra,
  };
}

const neverCalled: AiPlanProvider = {
  propose: () => Promise.reject(new Error('A direct edit must not ask the provider.')),
};

function educationMarkup(kernel: BuilderKernel): string {
  return serializeTreeMarkup(kernel.getDocument().nodes['education']?.props['tree']) ?? '';
}

describe('runAiAgent — zero-token direct edits', () => {
  it('Auto: applies the owner’s title change as one labelled transaction with no provider call', async () => {
    const kernel = kernelFor();
    const events: AiAgentEvent[] = [];
    const result = await runAiAgent(
      options(kernel, neverCalled, { apply: 'auto', onEvent: (event) => events.push(event) }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(result.directEdit).toMatchObject({
      summary: 'تغيير العنوان «التعليم والشهادات» إلى «مرحبا»',
      language: 'ar',
      target: { role: 'title', sectionId: 'education' },
    });
    expect(result.route?.kind).toBe('edit');
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.context.totalTokens).toBe(0);
    expect(educationMarkup(kernel)).toContain('>مرحبا</h2>');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('AI: تغيير العنوان «التعليم والشهادات» إلى «مرحبا»');

    expect(events.map(({ type }) => type)).toEqual([
      'run.started',
      'skills.resolving',
      'skills.resolved',
      'context.gathering',
      'context.ready',
      'plan.applying',
      'run.completed',
    ]);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'run.completed', status: 'applied', source: 'direct', tokens: 0 });
    expect(done?.elapsedMs).toBe(result.elapsedMs);
  });

  it('Ask: returns the direct edit as a proposal, writes nothing, and the proposal applies later', async () => {
    const kernel = kernelFor();
    const before = educationMarkup(kernel);
    const events: AiAgentEvent[] = [];
    const result = await runAiAgent(
      options(kernel, neverCalled, { apply: 'never', onEvent: (event) => events.push(event) }),
    );

    expect(result).toMatchObject({ status: 'proposed', source: 'direct', tokens: 0 });
    expect(result.applied).toBeUndefined();
    expect(educationMarkup(kernel)).toBe(before);
    expect(events.find(({ type }) => type === 'plan.proposed')).toMatchObject({ source: 'direct', tokens: 0 });

    applyAiPlan({
      kernel,
      proposal: result.proposal,
      validationPorts: { clock: fixedClock(3), ids: seededIds('later') },
    });
    expect(educationMarkup(kernel)).toContain('>مرحبا</h2>');
  });

  it('directEdits: false always asks the provider', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(options(kernel, provider, { directEdits: false }));

    expect(calls).toHaveLength(1);
    expect(result.source).toBe('model');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.directEdit).toBeUndefined();
  });

  it('a build’s own step never takes the direct path', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(options(kernel, provider, { runId: 'build-1/fill-4' }));

    expect(calls).toHaveLength(1);
    expect(result.source).toBe('model');
    expect(result.route).toBeUndefined();
  });

  /*
    Final test, 2026-09-28: a direct edit took 270–1,357 ms, most of it
    rebuilding and re-validating the whole page in a scratch kernel — twice
    on Auto, once in tryDirectEdit and again in applyAiPlan. A rehearsal is
    the one thing that reads the validation ports' clock (its transaction's
    stamp), so the reads count the rehearsals.
  */
  it('Auto rehearses a direct edit once, in the door', async () => {
    const kernel = kernelFor();
    let reads = 0;
    const clock = fixedClock(2);
    const result = await runAiAgent(
      options(kernel, neverCalled, {
        apply: 'auto',
        validationPorts: {
          clock: {
            now: () => {
              reads += 1;
              return clock.now();
            },
          },
          ids: seededIds('fast-edits-ports'),
        },
      }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct' });
    expect(reads).toBe(1);
  });

  it('a run whose composition checks more than the door keeps its own rehearsal', async () => {
    const kernel = kernelFor();
    let reads = 0;
    const clock = fixedClock(2);
    const result = await runAiAgent(
      options(kernel, neverCalled, {
        apply: 'auto',
        composition: { colourPolicy: 'tokens' },
        validationPorts: {
          clock: {
            now: () => {
              reads += 1;
              return clock.now();
            },
          },
          ids: seededIds('fast-edits-ports'),
        },
      }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct' });
    expect(reads).toBe(2);
  });

  it('Auto: plan.applying still comes before the write — the panel reads it as the "before"', async () => {
    const kernel = kernelFor();
    const original = kernel.getDocument();
    let atApplying: unknown;
    await runAiAgent(
      options(kernel, neverCalled, {
        apply: 'auto',
        onEvent: (event) => {
          if (event.type === 'plan.applying') atApplying = kernel.getDocument();
        },
      }),
    );

    expect(atApplying).toBe(original);
    expect(kernel.getDocument()).not.toBe(original);
  });

  it('Auto: a direct edit the door refuses falls back to the model with nothing written', async () => {
    const kernel = kernelFor();
    const before = educationMarkup(kernel);
    const events: AiAgentEvent[] = [];
    const { provider, calls } = recording(retitleEducation, kernel);

    await expect(
      runAiAgent(
        options(kernel, provider, {
          apply: 'auto',
          policy: { deniedCommands: ['setProp'] },
          onEvent: (event) => events.push(event),
        }),
      ),
    ).rejects.toThrow();

    expect(calls).toHaveLength(1);
    expect(educationMarkup(kernel)).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
    // The door refused it (tryDirectEdit left the rehearsal to it), then the model was asked.
    expect(events.some(({ type, source }) => type === 'plan.applying' && source === 'direct')).toBe(true);
    expect(events.some(({ type, source }) => type === 'run.completed' && source === 'direct')).toBe(false);
    expect(events.at(-1)?.type).toBe('run.failed');
  });

  /*
    Final test, 2026-09-28: «retitle it» with a block selected became a
    zero-token edit titling it "it", and «retitle @selected-hero» titled the
    hero "selected-hero" — the provider never saw the request, so the
    mention never reached it as the selection.
  */
  it.each([
    ['retitle it', ['education']],
    ['rename it', ['education']],
    ['retitle them', ['education']],
    ['retitle @education', ['education']],
    ['retitle @x', ['education']],
  ] as const)('a pronoun or a mention is never the new title: %s goes to the model', async (request, selection) => {
    const kernel = kernelFor();
    const before = educationMarkup(kernel);
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(options(kernel, provider, { request, selection }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.context.selection.ids).toEqual(['education']);
    expect(result.source).toBe('model');
    expect(result.directEdit).toBeUndefined();
    expect(educationMarkup(kernel)).toBe(before);
  });

  it('a pronoun still points at the selection when the new title is said', async () => {
    const kernel = kernelFor();
    const result = await runAiAgent(
      options(kernel, neverCalled, { request: 'call it Credentials', selection: ['education'], apply: 'auto' }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(educationMarkup(kernel)).toContain('>Credentials</h2>');
  });

  it('an edit the words do not pin to one element goes to the model', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(options(kernel, provider, { request: 'غير العنوان إلى مرحبا' }));

    expect(calls).toHaveLength(1);
    expect(result.source).toBe('model');
  });
});

describe('runAiAgent — target-scoped context for model edits', () => {
  const REQUEST = 'اجعل قسم التعليم والشهادات أكثر احترافية';

  it('shows the named section whole and every other section as one outline line', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(
      options(kernel, provider, {
        request: REQUEST,
        skillRegistry: createCraftkitAiSkillRegistry(),
        composition: { catalogMode: 'none' },
      }),
    );

    expect(result.focus).toEqual({ nodeIds: ['education'], kind: 'edit' });
    const context = calls[0]?.context;
    if (context === undefined) throw new Error('The provider was never asked.');
    expect(context.fragments.map(({ title }) => title)).toContain('Document focus');
    // No skill catalog on a focused edit: no server renders it.
    expect(context.skillCatalog).toBeUndefined();
    const nodes = new Map(context.document.nodes.map((node) => [node.id, node]));
    expect([...nodes.keys()].sort()).toEqual(['root', ...CV.map(([id]) => id)].sort());
    expect(nodes.get('education')?.props['tree']).toEqual(expect.stringContaining('<h2'));
    // An outline line is a name: the label, and a heading only where it says more.
    for (const [id, label] of CV.filter(([id]) => id !== 'education')) {
      expect(nodes.get(id)?.props['tree']).toBeUndefined();
      expect(nodes.get(id)?.props['label']).toBe(label);
      expect(nodes.get(id)?.slots).toEqual({});
    }
    expect(nodes.get('about')?.props['heading']).toBeUndefined();
    expect(nodes.get('experience')?.props['heading']).toBe('الخبرات العملية');
    // The reported tokens are the wire request's.
    expect(result.tokens).toBe(
      estimateAiPlanWireRequestTokens({
        version: AI_PLAN_WIRE_VERSION,
        request: REQUEST,
        context,
      }),
    );
  });

  it('keeps the whole page when the host chose how the document is shown', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(
      options(kernel, provider, { request: REQUEST, composition: { documentTreeMode: 'full' } }),
    );

    expect(result.focus).toBeUndefined();
    expect(calls[0]?.context.fragments.map(({ title }) => title)).not.toContain('Document focus');
  });

  /*
    Wire request tokens (estimateAiPlanWireRequestTokens), measured
    2026-09-28 on this fixture — a nine-section CV, the built-in skill
    registry, catalog 'none' as the remote panel runs — whole page → focused:

      «تغيير عنوان قسم التعليم والشهادات إلى مرحبا»   10,165 → 2,370
      «اجعل قسم المهارات أكثر احترافية»               10,162 → 2,399
      "make the contact section warmer and shorter"   10,321 → 2,539

    With the real customCode block (its 312-token description is the model's
    manual for writing a region, kept even on an edit) the same three are
    10,733 → 2,654, 10,730 → 2,683 and 10,889 → 2,822.

    The whole-page numbers already have the route gating skills (no cv-page
    playbook); the owner's live figure before any of this was 11,368. What
    remains is mostly the active skills (craft-manual 395 + arabic-rtl 531,
    or structure-recipes 685) and the eleven command schemas (~520). The
    owner's own sentence never reaches this path at all: it is a direct edit.

    2026-09-30: an unfocused call ships only the pinned skills' manifests, not
    the whole catalog (~5.2k tokens), so the whole-page figures are now about
    5,005 / 5,002 / 5,185 and the focused ones unchanged: a focused edit is
    under half of an unfocused one, not under a third.

    2026-09-30 (fix pass): the catalog states a props schema compactly
    (context/wire-schema.ts — no $schema, shared attribute schemas once), which
    shrinks the UNFOCUSED call to about 4,440 / 4,439 / 4,623 while the focused
    ones stay 2,370 / 2,399 / 2,539. The focused edit is still ~0.53-0.55 of
    it; the bound is 0.6 because the baseline got cheaper, not the edit dearer.
  */
  it.each([
    [OWNER, 2_500],
    ['اجعل قسم المهارات أكثر احترافية', 2_500],
    ['make the contact section warmer and shorter', 2_600],
  ] as const)('a focused edit stays within its budget and far under the whole page: %s', async (request, budget) => {
    const measure = async (focused: boolean): Promise<number> => {
      const kernel = kernelFor();
      const { provider } = recording(retitleEducation, kernel);
      const result = await runAiAgent(
        options(kernel, provider, {
          request,
          directEdits: false,
          skillRegistry: createCraftkitAiSkillRegistry(),
          composition: focused ? { catalogMode: 'none' } : { catalogMode: 'none', documentTreeMode: 'full' },
        }),
      );
      return result.tokens ?? Number.NaN;
    };
    const whole = await measure(false);
    const focused = await measure(true);

    expect(focused).toBeLessThanOrEqual(budget);
    expect(focused).toBeLessThan(whole * 0.6);
  });
});

describe('runAiAgent — the edit model', () => {
  it('asks for editModel and editEffort on an edit’s provider calls', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(
      options(kernel, provider, {
        request: 'اجعل قسم التعليم والشهادات أكثر احترافية',
        editModel: 'vendor/fast:free',
        editEffort: 'low',
      }),
    );

    expect(calls[0]?.live).toMatchObject({ model: 'vendor/fast:free', effort: 'low' });
    expect(result.model).toBe('vendor/fast:free');
  });

  it('keeps the configured model for a page build', async () => {
    const kernel = kernelFor(emptyDocument());
    const { provider, calls } = recording(
      () => ({
        rationale: 'Title the page.',
        commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'عيادة الابتسامة' } }],
      }),
      kernel,
    );
    const result = await runAiAgent(
      options(kernel, provider, {
        request: 'اعمل لي صفحة لعيادة أسنان في عمّان',
        editModel: 'vendor/fast:free',
      }),
    );

    expect(result.route?.kind).toBe('build-page');
    expect(calls[0]?.live?.model).toBeUndefined();
    expect(result.model).toBeUndefined();
  });
});

describe('runAiAgent — the route reaches skill gating', () => {
  const pageSkill = () =>
    createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'test.cv-page',
        name: 'CV page',
        description: 'A whole-page CV playbook.',
        version: '1.0.0',
        instructions: 'Lay out a full CV page.',
        activation: { mode: 'auto', keywords: ['التعليم'], intents: ['build-page', 'build-site'] },
      },
    ]);

  it('an edit routed against the page never loads a page-level playbook', async () => {
    const kernel = kernelFor();
    const { provider } = recording(retitleEducation, kernel);
    const result = await runAiAgent(
      options(kernel, provider, {
        request: 'اجعل قسم التعليم والشهادات أكثر احترافية',
        skillRegistry: pageSkill(),
      }),
    );

    expect(result.route?.kind).toBe('edit');
    expect(result.skills?.activations ?? []).toEqual([]);
  });

  it('the host’s route wins: a build-page intent loads it, and no direct edit is tried', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const result = await runAiAgent(
      options(kernel, provider, {
        skillRegistry: pageSkill(),
        intent: { kind: 'build-page', confidence: 1, reason: 'host', target: 'replace' },
      }),
    );

    expect(calls).toHaveLength(1);
    expect(result.route?.reason).toBe('host');
    expect(result.skills?.activations.map(({ id }) => id)).toEqual(['test.cv-page']);
  });
});

/*
  Final test (2026-09-30): the first direct edit of a session took 422–534 ms,
  50–130 of them resolving skills a direct edit never reads. Skills reach a
  direct edit only through a command restriction, so while no restricting
  skill can activate, the edit is made before any skill is resolved.
*/
describe('runAiAgent — a direct edit resolves no skills', () => {
  const counting = (registry: AiSkillRegistry) => {
    let prepared = 0;
    return {
      registry: { ...registry, prepare: (prepare: AiSkillPrepareOptions) => ((prepared += 1), registry.prepare(prepare)) },
      prepared: () => prepared,
    };
  };

  it('never prepares the built-in skills for the owner’s title change', async () => {
    const kernel = kernelFor();
    const { registry, prepared } = counting(createCraftkitAiSkillRegistry());
    const events: AiAgentEvent[] = [];
    const result = await runAiAgent(
      options(kernel, neverCalled, { apply: 'auto', skillRegistry: registry, onEvent: (event) => events.push(event) }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(prepared()).toBe(0);
    expect(events.map(({ type }) => type)).toEqual([
      'run.started',
      'skills.resolving',
      'skills.resolved',
      'context.gathering',
      'context.ready',
      'plan.applying',
      'run.completed',
    ]);
    expect(events[2]).toMatchObject({ type: 'skills.resolved', activations: [], totalTokens: 0 });
  });

  it('still resolves skills first when one that narrows the policy can activate', async () => {
    const kernel = kernelFor();
    const before = educationMarkup(kernel);
    const { registry, prepared } = counting(
      createAiSkillRegistry([
        {
          schemaVersion: 1,
          id: 'test.structure-only',
          name: 'Structure only',
          description: 'Allows inserting nodes and nothing else.',
          version: '1.0.0',
          instructions: 'Only insert.',
          activation: { mode: 'always' },
          restrictToCommands: ['insertNode'],
        },
      ]),
    );
    const outcome = await runAiAgent(options(kernel, neverCalled, { apply: 'auto', skillRegistry: registry })).then(
      (result) => result.source,
      () => 'failed',
    );

    expect(prepared()).toBe(1);
    expect(outcome).not.toBe('direct');
    expect(educationMarkup(kernel)).toBe(before);
  });

  it('still resolves skills first when the host selects one by id', async () => {
    const kernel = kernelFor();
    const { registry, prepared } = counting(createCraftkitAiSkillRegistry());
    await runAiAgent(
      options(kernel, neverCalled, { skillRegistry: registry, selectedSkillIds: ['craftkit.plan-mode'] }),
    ).catch(() => undefined);

    expect(prepared()).toBe(1);
  });
});

/*
  Context meter (2026-10-12): `context.ready` says what the model path is about to send —
  its size against the budget, what of the conversation gave way to fit it, and which
  sections the model sees whole — so a host's chip never says "Whole page" for a run that
  saw one section.
*/
describe('runAiAgent — what context.ready reports', () => {
  const REQUEST = 'اجعل قسم التعليم والشهادات أكثر احترافية';
  const readyOf = (events: readonly AiAgentEvent[]) => {
    const ready = events.find((event) => event.type === 'context.ready');
    if (ready?.type !== 'context.ready') throw new Error('No context.ready was emitted.');
    return ready;
  };

  it('reports the request against its budget and the one section it shows whole', async () => {
    const kernel = kernelFor();
    const { provider } = recording(retitleEducation, kernel);
    const events: AiAgentEvent[] = [];
    const result = await runAiAgent(
      options(kernel, provider, { request: REQUEST, onEvent: (event) => events.push(event) }),
    );
    const ready = readyOf(events);

    expect(ready.requestTokens).toBe(result.tokens);
    expect(ready.maxTokens).toBe(64_000);
    expect(ready.historyTrimmed).toBeUndefined();
    expect(ready.focus).toEqual({
      kind: 'edit',
      whole: [{ id: 'education', type: 'customCode', name: 'التعليم والشهادات' }],
      outlined: CV.length - 1,
    });
  });

  it('reports no focus when the whole page is shown, and the host’s own budget', async () => {
    const kernel = kernelFor();
    const { provider } = recording(retitleEducation, kernel);
    const events: AiAgentEvent[] = [];
    await runAiAgent(
      options(kernel, provider, {
        request: REQUEST,
        composition: { documentTreeMode: 'full' },
        policy: { maxContextTokens: 50_000 },
        onEvent: (event) => events.push(event),
      }),
    );
    const ready = readyOf(events);

    expect(ready.focus).toBeUndefined();
    expect(ready.maxTokens).toBe(50_000);
    expect(ready.requestTokens).toBeGreaterThan(0);
  });

  it('reports no request size for a direct edit, which sends nothing', async () => {
    const events: AiAgentEvent[] = [];
    await runAiAgent(options(kernelFor(), neverCalled, { onEvent: (event) => events.push(event) }));
    const ready = readyOf(events);

    expect(ready).toMatchObject({ source: 'direct', tokens: 0 });
    expect(ready.requestTokens).toBeUndefined();
    expect(ready.focus).toBeUndefined();
  });

  it('drops the oldest exchange to fit the budget, and says so', async () => {
    const kernel = kernelFor();
    const { provider, calls } = recording(retitleEducation, kernel);
    const events: AiAgentEvent[] = [];
    const history = [
      { role: 'user' as const, text: `the old brief ${'x'.repeat(40_000)}` },
      { role: 'assistant' as const, text: `the old answer ${'y'.repeat(40_000)}` },
      { role: 'user' as const, text: 'make the hero shorter' },
      { role: 'assistant' as const, text: 'Shortened the hero.' },
    ];
    const result = await runAiAgent(
      options(kernel, provider, {
        request: REQUEST,
        history,
        policy: { maxContextTokens: 10_000 },
        onEvent: (event) => events.push(event),
      }),
    );
    const ready = readyOf(events);

    expect(result.source).toBe('model');
    expect(calls[0]?.live?.history).toEqual(history.slice(2));
    expect(ready.historyTrimmed).toEqual({ dropped: 2, capped: 0 });
    expect(ready.requestTokens).toBeLessThanOrEqual(10_000);
  });
});
