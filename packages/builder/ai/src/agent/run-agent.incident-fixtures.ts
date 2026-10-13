import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlan } from '../types';
import { parseTreeMarkup } from '../plan/tree-markup';
import type { RunAiAgentOptions } from './types';

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'scene-incident-fixture',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page root.',
          props: z.object({
            title: z.string().default(''),
            lang: z.string().default('en'),
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
          description: 'Scene region.',
          props: z.object({
            label: z.string().default(''),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
            js: z.string().max(32_000).default(''),
            jsMeta: z.record(z.string(), z.unknown()).optional(),
            jsParams: z.record(z.string(), z.unknown()).default({}),
          }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

export const MURAL_REQUEST = 'Build a custom narrative mural of a winter landscape in Arabic';
export const SCENE_JS =
  'const s=await ck.scene();const g=new s.PIXI.Graphics().rect(0,0,100,100).fill(0x335577);s.app.stage.addChild(g);';
export const METADATA: AiPlan = {
  rationale: 'Created the narrative mural.',
  commands: [
    { command: 'setDocMeta', args: { dir: 'rtl' } },
    { command: 'setProp', args: { id: 'root', key: 'lang', value: 'ar' } },
    { command: 'setProp', args: { id: 'root', key: 'pageCss', value: ':root{--ck-surface:#fff}' } },
  ],
};
export const SCENE: AiPlan = {
  rationale: 'Created the winter mural.',
  commands: [
    {
      command: 'insertNode',
      args: {
        parentId: 'root',
        slot: 'default',
        type: 'customCode',
        props: {
          label: 'Winter landscape',
          js: SCENE_JS,
          tree: parseTreeMarkup('<section class="winter-scene"><h1>رحلة الشتاء</h1></section>'),
          css: '.winter-scene{min-height:400px}',
        },
      },
    },
  ],
};
export const INVALID: AiPlan = {
  rationale: 'Bad scene.',
  commands: [{ command: 'unknown', args: {} }],
};

export function incidentOptions(overrides: Partial<RunAiAgentOptions> = {}): RunAiAgentOptions {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Blank', lang: 'en', pageCss: '' },
        slots: {},
      },
    },
  };
  return {
    runId: 'incident',
    clock: fixedClock(100, 5),
    kernel: createBuilder({
      document,
      extensions: [blocks],
      ports: { clock: fixedClock(10), ids: seededIds('incident') },
    }),
    provider: { propose: () => Promise.resolve(METADATA) },
    request: 'Set the page language to Arabic and its direction to RTL',
    validationPorts: { clock: fixedClock(20), ids: seededIds('incident-validation') },
    freeCode: true,
    apply: 'auto',
    ...overrides,
  };
}
