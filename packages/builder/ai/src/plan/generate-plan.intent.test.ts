import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { routeIntent } from '../intent';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import {
  generateAiPlan,
  prepareAiSkillsForGeneration,
  skillIntentForGeneration,
  type GenerateAiPlanOptions,
} from './generate-plan';
import { outlineAiPlan } from './outline-plan';

/*
  Page-level skills are gated by the request's intent (activation.intents),
  and production never said what the intent was: prepareAiSkillsForGeneration
  passed none, so the resolver routed every request as if on a BLANK page,
  where an edit with no change verb reads as a brief. Measured 2026-09-28 on
  the built-in registry: «رقم هاتف العيادة غلط» loaded clinic-page (3,205
  skill tokens), «سعر القهوة 3 دنانير مش 2» menu-page (3,138), "the wedding
  date is June 12 not June 10" occasion-page (2,724). Routed on the page they
  are about, they are edits: 1,073 / 1,073 / 464.
*/

const NullRender: BlockRenderComponent = () => null;

function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'intent-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({
              title: z.string().max(120).default(''),
              pageCss: customCss(20_000),
            }),
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
              label: z.string().max(80).default('Custom section'),
              tree: customCodeTree().default(emptyCustomCodeTree()),
              css: customCss(8_000),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
}

/** A page whose sections carry real words: a heading and a line, each. */
function page(sections: readonly (readonly [string, string])[]): BuilderDocument {
  const nodes: BuilderDocument['nodes'] = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Home' },
      slots: { default: sections.map((_section, index) => `s${String(index)}`) },
    },
  };
  sections.forEach(([label, line], index) => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          children: [
            { kind: 'element', tag: 'h2', text: label, children: [] },
            { kind: 'element', tag: 'p', text: line, children: [] },
          ],
        },
      ],
    } as unknown as JsonValue;
    nodes[`s${String(index)}`] = {
      id: `s${String(index)}`,
      type: 'customCode',
      props: { label, tree },
    };
  });
  return { schemaVersion: 1, surface: 'site', dir: 'rtl', rootId: 'root', nodes };
}

function kernel(document: BuilderDocument): BuilderKernel {
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: fixedClock(1), ids: seededIds('intent') },
  });
}

const CLINIC = page([
  ['الواجهة', 'عيادة الابتسامة لطب الأسنان'],
  ['خدماتنا', 'تنظيف وتقويم'],
  ['تواصل معنا', 'هاتف: 0790000000'],
]);
const CAFE = page([
  ['الواجهة', 'محمصة الهيل'],
  ['المنيو', 'قهوة عربية 2 د.أ'],
]);
const WEDDING = page([
  ['Hero', 'Sara & Omar'],
  ['Details', 'June 10, 2027'],
]);
const EMPTY = page([]);

const noProvider: AiPlanProvider = {
  propose: () => Promise.reject(new Error('never called')),
};

function options(
  document: BuilderDocument,
  request: string,
  extra: Partial<GenerateAiPlanOptions> = {},
): GenerateAiPlanOptions {
  return {
    kernel: kernel(document),
    provider: noProvider,
    request,
    validationPorts: { clock: fixedClock(2), ids: seededIds('intent-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    ...extra,
  };
}

function active(prepared: ReturnType<typeof prepareAiSkillsForGeneration>): readonly string[] {
  return (prepared?.activations ?? []).map(({ id }) => id);
}

describe('skills are gated on the intent the request has ON THE PAGE it is about', () => {
  it.each([
    ['رقم هاتف العيادة غلط', CLINIC, 'craftkit.clinic-page'],
    ['سعر القهوة 3 دنانير مش 2', CAFE, 'craftkit.menu-page'],
    ['the wedding date is June 12 not June 10', WEDDING, 'craftkit.occasion-page'],
  ] as const)('loads no whole-page playbook for the edit %s', (request, document, playbook) => {
    // The premise: read as if on a blank page, the edit is a brief and the playbook loads.
    const blank = createCraftkitAiSkillRegistry().prepare({ request });
    expect(blank.activations.map(({ id }) => id)).toContain(playbook);

    const prepared = prepareAiSkillsForGeneration(options(document, request));

    expect(skillIntentForGeneration(options(document, request))).toBe('edit');
    expect(active(prepared)).not.toContain(playbook);
    expect(prepared?.totalTokens ?? 0).toBeLessThan(blank.totalTokens);
  });

  /*
    The owner's row (2026-09-28): «تغيير عنوان قسم التعليم والشهادات إلى مرحبا»
    on a CV page showed ~11.3k tokens and cv-page among its skills. Measured
    the same day on the built-in registry: 1,073 skill tokens either way — the
    words alone no longer match cv-page — so what is pinned is the gate: on
    the CV page it is an edit, and no page playbook can ride on it.
  */
  it('reads a heading rename on a CV page as the edit it is — no CV playbook', () => {
    const cv = page([
      ['نبذة', 'ريم حداد — مصممة منتجات'],
      ['الخبرات', 'خمس سنوات في تصميم التطبيقات'],
      ['التعليم والشهادات', 'بكالوريوس تصميم جرافيك 2018'],
      ['تواصل', 'reem@example.com'],
    ]);
    const request = 'تغيير عنوان قسم التعليم والشهادات إلى مرحبا';

    expect(skillIntentForGeneration(options(cv, request))).toBe('edit');
    expect(active(prepareAiSkillsForGeneration(options(cv, request)))).not.toContain(
      'craftkit.cv-page',
    );
  });

  it('keeps the page playbook for a page ask on a page with content', () => {
    const prepared = prepareAiSkillsForGeneration(
      options(CLINIC, 'اعمل صفحة هبوط لعيادة أسنان في عمّان'),
    );
    expect(active(prepared)).toContain('craftkit.clinic-page');
  });

  it('reads a bare brief on an empty page as the brief it is', () => {
    const prepared = prepareAiSkillsForGeneration(options(EMPTY, 'حلويات شرقية وكنافة'));
    expect(skillIntentForGeneration(options(EMPTY, 'حلويات شرقية وكنافة'))).toBe('build-page');
    expect(active(prepared)).toContain('craftkit.menu-page');
  });

  it('lets the host’s route win over the words, both ways', () => {
    const edit = 'رقم هاتف العيادة غلط';
    const pageAsk = 'اعمل صفحة هبوط لعيادة أسنان في عمّان';
    const asPage = prepareAiSkillsForGeneration(
      options(CLINIC, edit, { intent: routeIntent({ request: pageAsk }) }),
    );
    const asEdit = prepareAiSkillsForGeneration(
      options(CLINIC, pageAsk, {
        intent: { kind: 'edit', confidence: 0.9, reason: 'the host routed it' },
      }),
    );
    expect(active(asPage)).toContain('craftkit.clinic-page');
    expect(active(asEdit)).not.toContain('craftkit.clinic-page');
  });

  it('routes on a summary the host hands in, in place of the kernel’s page', () => {
    // The kernel holds a café; the host says the request is about a blank page it is making.
    const prepared = prepareAiSkillsForGeneration(
      options(CAFE, 'حلويات شرقية وكنافة', {
        document: { nodeCount: 0, placeholderOnly: false, sectionLabels: [] },
      }),
    );
    expect(active(prepared)).toContain('craftkit.menu-page');
  });

  it('gates the skills a whole run and an outline carry the same way', async () => {
    const contexts: AssembledAiContext[] = [];
    const plan: AiPlan = {
      rationale: 'Fix the phone number.',
      commands: [{ command: 'setProp', args: { id: 's2', key: 'label', value: 'تواصل' } }],
    };
    const capturing: AiPlanProvider = {
      propose(_request, context) {
        contexts.push(context);
        return Promise.resolve(plan);
      },
    };
    // Only the context the provider was handed is read here; the verdict on the plan is not.
    await generateAiPlan({ ...options(CLINIC, 'رقم هاتف العيادة غلط'), provider: capturing }).catch(
      () => undefined,
    );
    await outlineAiPlan({
      ...options(CLINIC, 'رقم هاتف العيادة غلط'),
      provider: {
        propose(_request, context) {
          contexts.push(context);
          return Promise.resolve({ rationale: 'A plan.', commands: [] });
        },
      },
    });

    expect(contexts).toHaveLength(2);
    for (const context of contexts) {
      expect((context.skills ?? []).map(({ id }) => id)).not.toContain('craftkit.clinic-page');
    }
  });
});
