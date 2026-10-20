import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeJsMeta,
  customCodeJsParams,
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { scenePreset } from '../scene-presets/catalog';
import { createCraftkitAiSkillRegistry } from '../skills';
import { expandAgentTools } from '../tools/agent/expand';
import type { AiPlan, AiPlanProvider, PagePlanCandidate } from '../types';
import { revertBuildSection } from './build-revert';
import { runAiBuild } from './run-build';

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'scene-kit-build-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({
            title: z.string().default(''),
            description: z.string().default(''),
            lang: z.string().default(''),
            pageCss: customCss(20_000),
          }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A scene region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
            js: z.string().max(32_000).default(''),
            jsMeta: customCodeJsMeta(),
            jsParams: customCodeJsParams(),
          }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function kernel() {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } },
      },
    },
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('scene-kit-build') },
  });
}

function plan(lang: string, title: string, purpose: string): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang },
    title,
    description: purpose,
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'emerald-800',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Tajawal', weights: [400, 700] },
      fontBody: { family: 'Tajawal', weights: [400, 700] },
      radius: 'md',
      signature: 'A scene with readable controls.',
    },
    primaryCta: {
      label: lang === 'ar' ? 'تعرف على التفاصيل' : 'Explore the details',
      href: '#details',
    },
    sections: [
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Navigation.' },
      { key: 'hero', role: 'hero', title, anchorId: 'play', purpose },
      {
        key: 'details',
        role: 'band',
        title: 'Details',
        anchorId: 'details',
        purpose: 'More detail.',
      },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Footer.' },
    ],
  };
}

function plainSection(request: string): AiPlan {
  const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Details';
  const tree: CustomCodeRoot = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        children: [{ kind: 'element', tag: 'h2', text: title }],
      },
    ],
  };
  return {
    rationale: 'Complete the section.',
    commands: [{ command: 'setProp', args: { id, key: 'tree', value: tree } }],
  };
}

vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — tested game and story kits in owned skeleton regions', () => {
  it.each([
    { input: { preset: 'arcade' }, freeCode: false },
    { input: { preset: 'arcade', id: 'root' }, freeCode: true },
    { input: { preset: 'arcade', after: 'root' }, freeCode: true },
    { input: { preset: 'arcade', params: { notASetting: 1 } }, freeCode: true },
  ])('keeps the command door authoritative for %j', async ({ input, freeCode }) => {
    const live = kernel();
    const provider: AiPlanProvider = {
      proposePagePlan: () =>
        Promise.resolve({
          pagePlan: plan('ar', 'مغامرة النجوم', 'لعبة تفاعلية'),
          rationale: 'A game.',
        }),
      propose: (request) =>
        Promise.resolve(
          request.includes('ROLE: HERO')
            ? {
                rationale: 'A scene.',
                commands: [{ command: 'tool', args: { name: 'scene.preset', input } }],
              }
            : plainSection(request),
        ),
    };
    const result = await runAiBuild({
      runId: 'refused-scene-kit',
      clock: fixedClock(2),
      kernel: live,
      provider,
      request: 'اصنع لعبه',
      validationPorts: { clock: fixedClock(2), ids: seededIds('refused-scene-kit') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      freeCode,
    });
    expect(result.skipped).toBeGreaterThan(0);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.status).not.toBe(
      'applied',
    );
    expect(live.getDocument().nodes['root']?.slots?.['default']).toHaveLength(4);
    expect(Object.values(live.getDocument().nodes).every(({ props }) => !props['js'])).toBe(true);
  });

  it.each([
    { preset: 'arcade', lang: 'ar', title: 'مغامرة النجوم', request: 'اصنع لعبه', explicit: true },
    {
      preset: 'picture-book',
      lang: 'en',
      title: 'A lantern adventure',
      request: 'Build an interactive picture book story',
      explicit: false,
    },
  ])(
    'applies one compact $preset answer without repair or an extra inserted section',
    async ({ preset, lang, title, request, explicit }) => {
      const live = kernel();
      const answers: AiPlan[] = [];
      const repair = vi.fn(() => Promise.reject(new Error('A tested kit should not need repair.')));
      const provider: AiPlanProvider = {
        proposePagePlan: () =>
          Promise.resolve({ pagePlan: plan(lang, title, request), rationale: request }),
        propose: (prompt, context) => {
          if (!prompt.includes('ROLE: HERO')) return Promise.resolve(plainSection(prompt));
          const id = context.selection.ids[0];
          const answer: AiPlan = {
            rationale: 'Use the tested scene.',
            commands: [
              {
                command: 'tool',
                args: { name: 'scene.preset', input: { preset, ...(explicit ? { id } : {}) } },
              },
            ],
          };
          answers.push(answer);
          return Promise.resolve(answer);
        },
        repair,
      };
      const result = await runAiBuild({
        runId: 'scene-kit-build',
        clock: fixedClock(2),
        kernel: live,
        provider,
        request,
        validationPorts: { clock: fixedClock(2), ids: seededIds('scene-kit-door') },
        skillRegistry: createCraftkitAiSkillRegistry(),
        freeCode: true,
      });
      expect(result.outcome).toBe('completed');
      expect(answers).toHaveLength(1);
      expect(JSON.stringify(answers[0]).length).toBeLessThan(250);
      expect(repair).not.toHaveBeenCalled();
      const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
      expect(hero?.status).toBe('applied');
      expect(hero?.check).toEqual({ issues: [], repaired: false });
      const props = live.getDocument().nodes[hero?.id ?? '']?.props;
      expect(props?.['js']).toBe(scenePreset(preset)?.code);
      expect(props?.['jsMeta']).toMatchObject({ ref: { id: preset, tier: 'builtin' } });
      expect(JSON.stringify(props?.['tree'])).toContain(title);
      expect(JSON.stringify(props?.['tree'])).toContain(lang === 'ar' ? 'ابدأ' : 'Read aloud');
      expect(live.getDocument().nodes['root']?.slots?.['default']).toHaveLength(4);

      if (hero?.status !== 'applied') throw new Error('Missing applied scene.');
      revertBuildSection(live, hero, { clock: fixedClock(3), ids: seededIds('scene-kit-revert') });
      expect(live.getDocument().nodes[hero.id]?.props['js']).toBe('');
      // The general edit tool still refuses to replace authored content that has no scene.
      const before = structuredClone(live.getDocument());
      const expanded = expandAgentTools(
        {
          rationale: 'Replace page content.',
          commands: [
            { command: 'tool', args: { name: 'scene.preset', input: { preset, id: hero.id } } },
          ],
        },
        live,
      );
      expect(expanded.issues.map(({ message }) => message).join(' ')).toContain('not a scene');
      expect(live.getDocument()).toEqual(before);
    },
  );
});
