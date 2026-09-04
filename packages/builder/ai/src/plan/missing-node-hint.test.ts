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
  name: 'missing-node-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['note'] } },
          examples: [],
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
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['n1'] } },
        n1: { id: 'n1', type: 'note', props: { text: 'first' } },
      },
    } as unknown as BuilderDocument,
    extensions: [extension],
    ports: { clock: fixedClock(1), ids: seededIds('missing-node') },
  });
}

function ports() {
  return { clock: fixedClock(2), ids: seededIds('gate') };
}

/**
 * A real run died here after 2m48s: the model wrote setProp against a node it
 * was inserting in the SAME plan. It cannot know that id — the kernel mints it
 * after the plan is written — so the repair attempt had nothing to work with
 * and the person got a dead end.
 */
describe('a rejection that names a node the document does not have', () => {
  const inventedId: AiPlan = {
    rationale: 'add a subject section',
    commands: [
      { command: 'insertNode', args: { type: 'note', parentId: 'root' } },
      { command: 'setProp', args: { id: 'missing-subject', key: 'text', value: 'hello' } },
    ],
  };

  it('quotes the ids that DO exist, so the repair has somewhere to go', () => {
    const result = validateAiPlan(inventedId, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const message = result.issues[0]?.message ?? '';
    expect(message).toContain('does not exist');
    expect(message).toContain('root (page)');
    expect(message).toContain('n1 (note)');
  });

  it('names the reason the guess could never have worked', () => {
    const result = validateAiPlan(inventedId, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const message = result.issues[0]?.message ?? '';
    expect(message).toContain('given its id by the kernel');
    expect(message).toContain('insertNode');
  });

  it('adds nothing to a rejection that is not about a missing node', () => {
    const wrongParent: AiPlan = {
      rationale: 'put a page inside a note',
      commands: [{ command: 'insertNode', args: { type: 'page', parentId: 'n1' } }],
    };

    const result = validateAiPlan(wrongParent, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message ?? '').not.toContain("The document's nodes are");
  });
});
