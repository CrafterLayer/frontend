import type { Meta, StoryObj } from '@storybook/react-vite';

import type { BlockRenderProps, CustomCodeRoot, Node } from '@craftkit/builder-schema';

import { CustomCodeBlock } from './CustomCodeBlock';
import type { CustomCodeBlockProps } from './schema';

const node: Node = { id: 'region-1', type: 'customCode', props: {} };

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'ck-card',
      children: [
        { kind: 'element', tag: 'h2', className: 'ck-card__title', text: 'Handmade in Amman' },
        {
          kind: 'element',
          tag: 'p',
          className: 'ck-card__body',
          text: 'Every piece is thrown, trimmed and glazed by one pair of hands.',
        },
      ],
    },
  ],
};

const STYLED = `
.ck-card { border: 1px solid var(--t-accent, #1e3a8a); border-radius: 12px; padding: 20px }
.ck-card__title { color: var(--t-accent, #1e3a8a); margin: 0 0 8px }
.ck-card__body { margin: 0; opacity: 0.8 }
`;

/** The block takes `BlockRenderProps`, so the story supplies the whole render frame. */
function Region(props: { block: Partial<CustomCodeBlockProps>; isCanvas?: boolean }) {
  const renderProps: BlockRenderProps<CustomCodeBlockProps> = {
    node,
    props: { label: 'Region', css: '', tree: TREE, ...props.block },
    slots: {},
    data: {},
    isCanvas: props.isCanvas ?? false,
  };
  return <CustomCodeBlock {...renderProps} />;
}

const meta = {
  title: 'Builder/Extensions/CustomCodeBlock',
  component: Region,
  parameters: { layout: 'padded' },
  args: { block: {} },
} satisfies Meta<typeof Region>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The tree alone, with no stylesheet of its own. */
export const Default: Story = {};

/** The same tree with its block-scoped stylesheet. */
export const Styled: Story = { args: { block: { css: STYLED } } };

/**
 * A refused stylesheet on the CANVAS. It is dropped whole — one bad rule and
 * nothing in it applies — and the reason is said out loud, where the person
 * making the edit can see it.
 */
export const RefusedOnCanvas: Story = {
  args: {
    isCanvas: true,
    block: { css: `@import url("https://evil.test/x.css");\n${STYLED}` },
  },
};

/** The same document published. No styling, and no note: a page explains nothing. */
export const RefusedWhenPublished: Story = {
  args: { block: { css: `@import url("https://evil.test/x.css");\n${STYLED}` } },
};

/** An empty region. Still a region, still addressable, still not an error. */
export const Empty: Story = {
  args: { block: { tree: { kind: 'root', children: [] } } },
};
