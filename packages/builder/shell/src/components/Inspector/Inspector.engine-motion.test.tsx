import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  motionSpecSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { installBrowserStandIns, installClassOracle } from '../../style-manager/test-support';
import { Inspector } from './Inspector';

/*
  gsap-pixi fix (2026-10-08): the Inspector reaches the engine.
  - A customCode CONTAINER element: an Animated background section under the
    Interactions panel (one attribute patch, one transaction).
  - A registered SECTION: its Design › Motion control gains Cinematic motion
    and Animated background, writing the `motion` prop in one transaction.
  - The block bar's "Animate" (a Design request at the motion sector) opens
    that Motion section.
*/

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-engine-motion-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'hero'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({ tree: customCodeTree().default(emptyCustomCodeTree()) }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'hero',
          description: 'A hero section',
          props: z.object({ heading: z.string().max(120).default('Hello'), motion: motionSpecSchema.optional() }),
          propertyGroups: {
            heading: { tab: 'content', section: 'Text' },
            motion: { tab: 'design', section: 'Motion', kind: 'motion' },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-8',
      children: [{ kind: 'element', tag: 'h1', text: 'Reem Haddad' }],
    },
  ],
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'h1'] } },
    r1: { id: 'r1', type: 'region', props: { tree: TREE as never } },
    h1: { id: 'h1', type: 'hero', props: { heading: 'Welcome', motion: { reveal: 'fade-up', duration: 'slow' } } },
  },
};

const makeKernel = () =>
  createBuilder({ document: DOC, extensions: [VOCAB], ports: { clock: fixedClock(), ids: seededIds('iem') } });

const treeOf = (kernel: BuilderKernel) => kernel.getDocument().nodes['r1']?.props['tree'] as unknown as CustomCodeRoot;
const heroMotion = (kernel: BuilderKernel) => kernel.getDocument().nodes['h1']?.props['motion'];

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = installClassOracle();
});
afterAll(() => {
  restoreOracle();
});

describe('Inspector — engine motion', () => {
  it('a customCode section: Interactions gains an Animated background; a scene is ONE labelled write', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Interactions' }));
    const scenes = screen.getByRole('group', { name: 'Animated background' });
    // Scenes only here: Cinematic motion lives in the Interactions panel itself.
    expect(within(scenes).getAllByRole('button').map((card) => card.getAttribute('data-value'))).toEqual([
      'none',
      'particles',
      'mesh-gradient',
    ]);
    await user.click(within(scenes).getByRole('button', { name: 'Mesh gradient' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toMatch(/^Animated background · /u);
    const section = treeOf(kernel).children[0];
    expect(section?.kind === 'element' ? section.attributes : undefined).toEqual({ 'data-ck-scene': 'mesh-gradient' });
    expect(kernel.undo()).toBe(true);
    expect(treeOf(kernel)).toEqual(TREE);
  });

  it('a customCode heading has no Animated background', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Interactions' }));
    expect(screen.queryByRole('group', { name: 'Animated background' })).toBeNull();
  });

  it('a registered section: Design › Motion writes motion.timeline (dropping reveal) and motion.scene, one transaction each', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const recipes = screen.getByRole('group', { name: 'Cinematic motion' });
    expect(within(recipes).queryByRole('button', { name: 'Velocity marquee' })).toBeNull();
    await user.click(within(recipes).getByRole('button', { name: 'Fade in' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(heroMotion(kernel)).toEqual({ duration: 'slow', timeline: 'fade-in' });
    await user.click(within(screen.getByRole('group', { name: 'Animated background' })).getByRole('button', { name: 'Particles' }));
    expect(kernel.transactions()).toHaveLength(2);
    expect(heroMotion(kernel)).toEqual({ duration: 'slow', timeline: 'fade-in', scene: 'particles' });
    kernel.undo();
    kernel.undo();
    expect(heroMotion(kernel)).toEqual({ reveal: 'fade-up', duration: 'slow' });
  });

  it('the block bar’s Animate request opens Design › Motion (expanded), once per request', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const user = userEvent.setup();
    const handled: number[] = [];
    const { rerender } = render(
      <Inspector
        kernel={kernel}
        focusRequest={{ tab: 'design', sector: 'motion', nonce: 1 }}
        onFocusRequestHandled={(nonce) => handled.push(nonce)}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Cinematic motion' })).toBeVisible();
    expect(handled).toEqual([1]);
    // Collapsed by the person, then asked again: the new request opens it again.
    await user.click(screen.getByRole('button', { name: 'Motion' }));
    expect(screen.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-expanded', 'false');
    rerender(
      <Inspector
        kernel={kernel}
        focusRequest={{ tab: 'design', sector: 'motion', nonce: 2 }}
        onFocusRequestHandled={(nonce) => handled.push(nonce)}
      />,
    );
    expect(screen.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-expanded', 'true');
    expect(handled).toEqual([1, 2]);
  });
});
