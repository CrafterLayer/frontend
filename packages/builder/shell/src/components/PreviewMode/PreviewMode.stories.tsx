import { expect, fn, userEvent, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PreviewMode } from './PreviewMode';

const TextRender = ((props: BlockRenderProps<{ content: string }>) => (
  <p style={{ fontFamily: 'system-ui', padding: '1rem' }}>{props.props.content}</p>
)) as unknown as BlockRenderComponent;
const SlotRender = ((props: BlockRenderProps) => (
  <div>{props.slots['default']}</div>
)) as unknown as BlockRenderComponent;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'preview-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['text'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'text',
          description: 'Text',
          props: z.object({ content: z.string().default('') }),
          examples: [],
        }),
        render: TextRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: { content: 'Exactly what a visitor sees — no chrome.' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pvs') },
  });

const meta = {
  title: 'Builder/Shell/PreviewMode',
  component: PreviewMode,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ blockSize: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreviewMode>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kernel: makeKernel(), theme: lightTheme, onExit: () => undefined },
};

export const DirectionOverride: Story = {
  args: { kernel: makeKernel(), theme: lightTheme, dirOverride: 'rtl', onExit: () => undefined },
};

export const MobileViewport: Story = {
  args: {
    kernel: makeKernel(),
    theme: lightTheme,
    breakpoint: 'mobile',
    frameWidth: 390,
    onExit: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const frameShell = canvasElement.querySelector<HTMLElement>('.bldr-preview__frame');
    await expect(frameShell?.style.inlineSize).toBe('390px');
  },
};

const exitKernel = makeKernel();
export const ExitControl: Story = {
  args: { kernel: exitKernel, theme: lightTheme, onExit: fn() },
  play: async ({ args, canvasElement }) => {
    // Idempotent: asserts the exit fired and the zero-transaction law held.
    const canvas = within(canvasElement);
    const txBefore = exitKernel.transactions().length;
    await userEvent.click(canvas.getByRole('button', { name: 'Exit preview' }));
    await expect(args.onExit).toHaveBeenCalled();
    await expect(exitKernel.transactions().length).toBe(txBefore);
  },
};

const escapeKernel = makeKernel();
export const EscapeExit: Story = {
  args: { kernel: escapeKernel, theme: lightTheme, onExit: fn() },
  play: async ({ args }) => {
    // Review H1: Escape must exit with NO pre-positioning of focus — the
    // preview focuses its region on entry and listens at the host document.
    await userEvent.keyboard('{Escape}');
    await expect(args.onExit).toHaveBeenCalled();
    await expect(escapeKernel.transactions().length).toBe(0);
  },
};
