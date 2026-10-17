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
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { pagePlanningBrief } from '../../agent/plan-page';
import { createCraftkitAiSkillRegistry } from '../index';
import { PIXI_PAGE_SHAPES_ID, PIXI_PAGE_SHAPES_SKILL } from './page-shapes';
import { pixiSkillIdsFor } from './pixi-selection';

/*
  creative power (2026-10-12): the page planner's creative shapes — named for the page plan of a
  game, story or mural, never for a section writer, never for a business page.
*/

const REGISTRY = createCraftkitAiSkillRegistry();
const NullRender: BlockRenderComponent = () => null;

function kernel(dir: 'ltr' | 'rtl' = 'ltr'): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'page-shapes-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({ title: z.string().max(120).default(''), pageCss: customCss(20_000) }),
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
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: fixedClock(1), ids: seededIds('shapes') },
  });
}

describe('creative page shapes', () => {
  it('teaches each piece its shape and keeps scene words out of text sections', () => {
    const text = PIXI_PAGE_SHAPES_SKILL.instructions;
    for (const part of ['GAME:', 'STORY:', 'MURAL:', 'BEDTIME:', 'How to play', 'chapter scene'])
      expect(text).toContain(part);
    expect(text).toContain('only the hero');
    expect(text).toContain('read-aloud');
    expect(PIXI_PAGE_SHAPES_SKILL.activation).toEqual({ mode: 'explicit' });
    expect(PIXI_PAGE_SHAPES_SKILL.dependencies).toBeUndefined();
  });

  it('names experience words that really make a section writer write a scene', () => {
    const line = PIXI_PAGE_SHAPES_SKILL.instructions
      .split('\n')
      .find((text) => text.startsWith('WRITERS ARE BLIND'));
    const phrases = [...(line ?? '').matchAll(/"([^"]+)"|«([^»]+)»/gu)].map(
      (match) => match[1] ?? match[2] ?? '',
    );
    expect(phrases).toHaveLength(8);
    for (const phrase of phrases) {
      expect(pixiSkillIdsFor(REGISTRY, `Chapter 2 — ${phrase}`).length, phrase).toBeGreaterThan(0);
    }
    // A text section's own words stay out of the scene lane.
    for (const title of ['How to play', 'Credits and thanks', 'كيف تلعب'])
      expect(pixiSkillIdsFor(REGISTRY, title)).toEqual([]);
  });

  it.each([
    'A forest platformer starring a fox named Rumi',
    'Write a bedtime story about a sleepy bunny',
    'A parallax scroll mural of a desert caravan',
    'قصة تفاعلية للأطفال قبل النوم عن غيمة صغيرة',
  ])('leads the page plan lane, and only that lane: %s', (request) => {
    expect(pixiSkillIdsFor(REGISTRY, request, 'page-plan')[0]).toBe(PIXI_PAGE_SHAPES_ID);
    expect(pixiSkillIdsFor(REGISTRY, request)).not.toContain(PIXI_PAGE_SHAPES_ID);
  });

  it.each(['Build a landing page for our game studio', 'صفحة هبوط لمقهى في عمّان'])(
    'is never named for a business page: %s',
    (request) => {
      expect(pixiSkillIdsFor(REGISTRY, request, 'page-plan')).toEqual([]);
    },
  );

  it.each([
    ['Write a bedtime story about a fox named Rumi in a moonlit forest', 'ltr'],
    ['قصة تفاعلية للأطفال قبل النوم عن غيمة صغيرة تبحث عن القمر', 'rtl'],
    ['A physics game where crates stack and a ball knocks them down', 'ltr'],
  ] as const)(
    'reaches the planner beside the deck and copy rules, within budget: %s',
    (request, dir) => {
      const brief = pagePlanningBrief(kernel(dir), {
        request,
        target: 'replace',
        skillRegistry: REGISTRY,
      });
      // 2026-10-14: the request's skills come last, so a tight budget sheds them first.
      expect(brief.skillIds).toContain(PIXI_PAGE_SHAPES_ID);
      expect(brief.skillIds).toEqual(
        expect.arrayContaining(['craftkit.direction-deck', 'craftkit.copywriting']),
      );
      if (dir === 'rtl') expect(brief.skillIds).toContain('craftkit.arabic-rtl');
      const prepared = REGISTRY.prepare({
        request: brief.request,
        intent: 'build-page',
        selectedSkillIds: brief.skillIds,
        auto: false,
      });
      expect(prepared.omitted).toEqual([]);
      expect(prepared.totalTokens).toBeLessThan(16_000);
    },
  );
});
