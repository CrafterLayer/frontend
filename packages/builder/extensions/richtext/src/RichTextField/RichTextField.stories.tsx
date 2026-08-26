import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { Inspector } from '@craftkit/builder-shell';

import { richTextExtension } from '../index';
import { RichTextField } from './RichTextField';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'richtext-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'article',
          description: 'Article',
          props: z.object({
            title: z.string().default(''),
            body: richText().default(emptyRichText() as never),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const doc = (dir: 'ltr' | 'rtl', text: string): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'a1',
  nodes: {
    a1: {
      id: 'a1',
      type: 'article',
      props: {
        title: 'Post',
        body: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Body with ' },
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: '.' },
              ],
            },
          ],
        },
      },
    },
  },
});

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr', text = 'Editable rich text') => {
  const kernel = createBuilder({
    document: doc(dir, text),
    extensions: [VOCAB, richTextExtension],
    ports: { clock: fixedClock(), ids: seededIds('rts') },
  });
  kernel.setSelection(['a1']);
  return kernel;
};

const meta = {
  title: 'Builder/Extensions/RichTextField',
  component: RichTextField,
} satisfies Meta<typeof RichTextField>;
export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
  schema: richText(),
  value: emptyRichText(),
  path: ['props', 'body'],
  onChange: () => undefined,
};

export const ViaInspector: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={makeKernel()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
    await expect(canvas.getByRole('group', { name: 'Formatting' })).toBeInTheDocument();
  },
};

const editKernel = makeKernel();
export const ToolbarCommits: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={editKernel} />,
  play: async ({ canvasElement }) => {
    // Idempotent: toggles bold on the whole selection and back — asserts the
    // transaction ARITHMETIC, never an absolute document state.
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
    const content = canvasElement.querySelector('.tiptap');
    await expect(content).not.toBeNull();
    const before = editKernel.transactions().length;
    const selectAllThen = async (button: string) => {
      (content as HTMLElement).focus();
      await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
      await userEvent.click(canvas.getByRole('button', { name: button }));
    };
    await selectAllThen('Bold');
    await waitFor(async () => {
      await expect(editKernel.transactions().length).toBe(before + 1);
    });
    await selectAllThen('Bold'); // restore — rerun-idempotent
    await waitFor(async () => {
      await expect(editKernel.transactions().length).toBe(before + 2);
    });
  },
};

export const RightToLeft: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={makeKernel('rtl', 'نص غني قابل للتحرير')} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
  },
};

/** The states the catalog a11y gate must actually SEE (§10 review fix M7). */
const stateArgs = {
  schema: richText(),
  path: ['props', 'body'],
  onChange: () => undefined,
};

export const Empty: Story = {
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.bldr-richtext-field__surface')).not.toBeNull();
    await expect(within(canvasElement).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { ...stateArgs, value: emptyRichText(), disabled: true },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    // A disabled field cannot commit — the toolbar is inert too, not just the
    // typing surface (§10 review fix M1).
    const canvas = within(canvasElement);
    for (const name of ['Bold', 'Italic', 'Link', 'Clear formatting']) {
      await expect(canvas.getByRole('button', { name })).toBeDisabled();
    }
  },
};

export const ResponsiveNoticeState: Story = {
  name: 'Responsive notice',
  args: { ...stateArgs, value: emptyRichText(), path: ['responsive', 'tablet', 'body'] },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/switch to desktop/i);
    // e5: the notice must not instantiate the engine.
    await expect(canvasElement.querySelector('.bldr-richtext-field__surface')).toBeNull();
  },
};
