import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createSiteBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  emptyDocument,
  siteFromDocument,
  type BlockRenderComponent,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiBuild, type AiBuildEvent } from './index';

/*
  The kernel the PRODUCT hands the assistant is not the kernel the other build
  tests use. Since the playground boots on a site, the panel works through
  `site.page(id)` — a page lens — and a lens reports its transactions with
  site-rooted patch paths: `['pages', 0, 'document', 'nodes', id]` where a
  document kernel says `['nodes', id]`.

  Found live on 2026-09-05, twice: the scaffold inserted four labelled regions,
  the build derived ZERO tasks from them, announced "the page skeleton produced
  0 sections" and fell back to one ordinary run — so the parallel section
  writers, the Sections list and the wave clock had never once run in the real
  product while every test that exercised them stayed green on a document
  kernel. This file is the test that would have caught it.
*/

const NullRender: BlockRenderComponent = () => null;

const buildBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'lens-build-fixture',
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

const SECTIONS = ['Hero', 'Proof', 'Pricing'] as const;

function region(title: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text: title, children: [] }],
      },
    ],
  };
}

function scaffoldPlan(rootId: string): AiPlan {
  return {
    rationale:
      'A calm studio page. Palette bg-white text-slate-900. Faces Inter and Inter. Signature a hairline rule. 1 Hero · 2 Proof · 3 Pricing.',
    commands: SECTIONS.map((title) => ({
      command: 'insertNode',
      args: { type: 'customCode', parentId: rootId, props: { label: title, tree: region(title) } },
    })),
  };
}

function fillPlan(regionId: string): AiPlan {
  return {
    rationale: 'Fill one region.',
    commands: [{ command: 'setProp', args: { id: regionId, key: 'tree', value: region('done') } }],
  };
}

describe('runAiBuild on a site kernel page lens', () => {
  it('derives one task per region the scaffold inserted, from site-rooted patches', async () => {
    const site = createSiteBuilder({
      site: siteFromDocument(emptyDocument('site')),
      extensions: [buildBlocks],
      ports: { clock: fixedClock(1), ids: seededIds('lens') },
    });
    const lens = site.page(site.currentPage());
    const events: AiBuildEvent[] = [];
    const provider: AiPlanProvider = {
      propose(_request, context) {
        // Only a fill run is scoped to a region; the scaffold (and an
        // ordinary fallback run) arrive with no selection at all.
        const [regionId] = context.selection.ids;
        return Promise.resolve(
          regionId === undefined ? scaffoldPlan(lens.getDocument().rootId) : fillPlan(regionId),
        );
      },
    };

    const result = await runAiBuild({
      runId: 'lens-build',
      clock: fixedClock(1000),
      kernel: lens,
      provider,
      request: 'A three-section studio page',
      validationPorts: { clock: fixedClock(1), ids: seededIds('lens-ports') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    // The precondition that makes this test mean something: the lens really
    // does report site-rooted paths, so a document-kernel pass proves nothing.
    const skeleton = lens.transactions()[0];
    expect(skeleton?.command).toBe('Assistant: page skeleton');
    expect(skeleton?.patches.some((patch) => patch.path[0] === 'pages')).toBe(true);
    expect(skeleton?.patches.some((patch) => patch.path[0] === 'nodes')).toBe(false);

    expect(events.map(({ type }) => type)).not.toContain('build.skipped');
    expect(result.outcome).toBe('completed');
    expect(result.tasks.map(({ title }) => title)).toEqual([...SECTIONS]);
    expect(result.applied).toBe(SECTIONS.length);
    expect(lens.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...SECTIONS.map((title, index) => `Assistant: ${String(index + 1)}/3 — ${title}`),
    ]);
  });
});
