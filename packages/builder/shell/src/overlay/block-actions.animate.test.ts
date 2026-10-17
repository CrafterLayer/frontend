import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  motionSpecSchema,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { blockMotionProperty, performBlockAction, resolveBlockActions } from './block-actions';

/*
  gsap-pixi fix (2026-10-08): a selected registered section offers "Animate"
  («تحريك») when the host can open its Design › Motion control and the block
  declares one (`kind: 'motion'`). It is a panel to open — never a write.
*/

const NullRender: BlockRenderComponent = () => null;

const MANIFEST: TrustedExtensionManifest = {
  tier: 1,
  name: 'block-actions-animate-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['hero', 'card'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'hero',
          description: 'Hero',
          props: z.object({ motion: motionSpecSchema.optional() }),
          propertyGroups: { motion: { tab: 'design', section: 'Motion', kind: 'motion' } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: z.object({ title: z.string().default('Hi') }),
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
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero', 'card'] } },
        hero: { id: 'hero', type: 'hero', props: {} },
        card: { id: 'card', type: 'card', props: { title: 'Hi' } },
      },
    },
    extensions: [MANIFEST],
    ports: { clock: fixedClock(), ids: seededIds('anim') },
  });
}

const ids = (actions: readonly { id: string }[]) => actions.map((action) => action.id);

describe('block action "Animate" (gsap-pixi 2026-10-08)', () => {
  it('appears before Deselect only when the host asks and the block declares a motion control', () => {
    const k = kernel();
    expect(blockMotionProperty(k, 'hero')).toBe('motion');
    expect(blockMotionProperty(k, 'card')).toBeUndefined();
    expect(ids(resolveBlockActions(k, 'hero'))).not.toContain('animate');
    const actions = resolveBlockActions(k, 'hero', { animate: { locale: 'en' } });
    expect(ids(actions).slice(-2)).toEqual(['animate', 'deselect']);
    expect(actions.find((action) => action.id === 'animate')).toMatchObject({ label: 'Animate', enabled: true });
    expect(resolveBlockActions(k, 'hero', { animate: { locale: 'ar' } }).find((a) => a.id === 'animate')?.label).toBe(
      'تحريك',
    );
    expect(ids(resolveBlockActions(k, 'card', { animate: { locale: 'en' } }))).not.toContain('animate');
  });

  it('performing it writes nothing (the host opens the panel)', () => {
    const k = kernel();
    k.setSelection(['hero']);
    const result = performBlockAction(k, 'hero', 'animate');
    expect(result.ok).toBe(false);
    expect(result.selection).toBe('hero');
    expect(k.transactions()).toHaveLength(0);
  });
});
