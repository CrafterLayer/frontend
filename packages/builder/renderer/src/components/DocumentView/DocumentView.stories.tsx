import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { withPassThroughRenderers } from '../../test-utils';

import { DocumentView } from './DocumentView';

function storyKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });
}

const meta = {
  title: 'Builder/Renderer/DocumentView',
  component: DocumentView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocumentView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LandingFixture: Story = {
  args: { kernel: storyKernel() },
};

export const MobileBreakpoint: Story = {
  args: { kernel: storyKernel(), breakpoint: 'mobile' },
};

export const EmptySlotIsHittable: Story = {
  args: {
    kernel: createBuilder({
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: { title: 'Empty' } } },
      },
      extensions: [withPassThroughRenderers(fixtureBlocks)],
      ports: { clock: fixedClock(), ids: seededIds('empty') },
    }),
  },
  play: async ({ canvasElement }) => {
    /*
      A BROWSER gate, because jsdom cannot fail it.

      This box shipped once with the right class and the right attributes —
      every unit assertion passed — and measured 0×0, because nothing styled it.
      A drop target with no area is a drop target nobody can hit, and it is the
      only way to put the first block into an empty region.
    */
    const box = canvasElement.querySelector('.bldr-slot-empty');
    await expect(box).not.toBeNull();

    const rect = (box as HTMLElement).getBoundingClientRect();
    await expect(rect.height).toBeGreaterThan(20);
    await expect(rect.width).toBeGreaterThan(20);

    /*
      And an empty PAGE shows no stray words: the page's only region is the
      unnamed `default` one, whose name is an identifier, not a label. Named
      regions carry their names (NodeView.test.tsx).
    */
    await expect((box as HTMLElement).textContent).toBe('');
  },
};
