import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { Palette } from './Palette';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, label: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description: label,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'palette-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['hero', 'section'] } }),
      block('hero', 'Hero'),
      block('section', 'Section', { default: { allow: ['text'] } }),
      block('text', 'Text paragraph'),
    ],
  },
};

const doc = (dir: 'ltr' | 'rtl'): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'root',
  nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
});

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr') =>
  createBuilder({
    document: doc(dir),
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ps') },
  });

const meta = {
  title: 'Builder/Shell/Palette',
  component: Palette,
} satisfies Meta<typeof Palette>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kernel: makeKernel() },
};

export const RightToLeft: Story = {
  args: { kernel: makeKernel('rtl') },
  globals: { direction: 'rtl' },
};

const insertKernel = makeKernel();
export const KeyboardInsert: Story = {
  args: { kernel: insertKernel },
  play: async ({ canvasElement }) => {
    // Idempotent: each rerun appends one more hero — we assert GROWTH, not an
    // absolute count.
    const before = insertKernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Hero' }));
    await waitFor(async () => {
      const after = insertKernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
      await expect(after).toBe(before + 1);
    });
  },
};
