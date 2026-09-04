import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { validateAiPlan } from './validate-plan';
import type { AiPlan } from '../types';

const NullRender: BlockRenderComponent = () => null;

const extension: TrustedExtensionManifest = {
  tier: 1,
  name: 'root-insert-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default(''), pageCss: z.string().default('') }),
          slots: { default: { allow: ['note'] } },
          examples: [
            // The real page block ships exactly this: a worked example of the
            // command the door refuses, with an Arabic prompt.
            { prompt: 'ابدأ صفحة فارغة', node: { type: 'page', props: { title: '' } } },
          ],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'note',
          description: 'A note.',
          props: z.object({ text: z.string().default('') }),
          examples: [],
        }),
        render: NullRender,
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
        root: {
          id: 'root',
          type: 'page',
          props: { title: 'Home', pageCss: '' },
          slots: { default: [] },
        },
      },
    } as unknown as BuilderDocument,
    extensions: [extension],
    ports: { clock: fixedClock(1), ids: seededIds('root-insert') },
  });
}

const ports = () => ({ clock: fixedClock(2), ids: seededIds('gate') });

/**
 * A real run asked, in Arabic, for a page and came back
 * "Slot default of root accepts [...], not page" after minutes of work. Two
 * things made that inevitable: the page block's own few-shots demonstrate
 * `insertNode {type:'page'}`, and the door's refusal reads as a vocabulary
 * problem rather than "that thing already exists".
 */
describe('inserting the document root type', () => {
  const insertsAPage: AiPlan = {
    rationale: 'start the page',
    commands: [{ command: 'insertNode', args: { type: 'page', parentId: 'root' } }],
  };

  it('is refused with the edit that was meant instead', () => {
    const result = validateAiPlan(insertsAPage, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const [issue] = result.issues;
    expect(issue?.step).toBe(0);
    expect(issue?.message).toContain("document's ROOT type");
    // The actionable half: what to do instead, naming the node.
    expect(issue?.message).toContain('setProp on "root"');
  });

  it('leaves an ordinary insert alone', () => {
    const addsANote: AiPlan = {
      rationale: 'add a note',
      commands: [{ command: 'insertNode', args: { type: 'note', parentId: 'root' } }],
    };

    expect(validateAiPlan(addsANote, kernel(), ports()).ok).toBe(true);
  });

  it('still allows editing the root, which is what the model usually wanted', () => {
    const editsThePage: AiPlan = {
      rationale: 'darken the page',
      commands: [
        { command: 'setProp', args: { id: 'root', key: 'pageCss', value: '.ck-a{color:red}' } },
      ],
    };

    expect(validateAiPlan(editsThePage, kernel(), ports()).ok).toBe(true);
  });
});
