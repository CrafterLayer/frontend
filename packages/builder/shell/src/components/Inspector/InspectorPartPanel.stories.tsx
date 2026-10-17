import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { lightTheme, paletteOf } from '@craftkit/builder-renderer';

import { makePartTestKernel, partStyleAt, PROMO_ID } from '../../style-manager/part-test-kernel';
import { Inspector } from './Inspector';
import { InspectorPartPanel } from './InspectorPartPanel';

const palette = paletteOf(lightTheme);
const noop = () => undefined;

const kernelFocused = (part: string, index: number[] = [], dir: 'ltr' | 'rtl' = 'ltr') => {
  const kernel = makePartTestKernel({ dir });
  kernel.focusPart(PROMO_ID, { part, index });
  return kernel;
};

const meta = {
  title: 'Builder/Shell/Inspector/InspectorPartPanel',
  component: InspectorPartPanel,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ inlineSize: 'var(--bldr-inspector-width)' }}>
        <section className="bldr-inspector">
          <Story />
        </section>
      </div>
    ),
  ],
  args: {
    kernel: kernelFocused('heading'),
    nodeId: PROMO_ID,
    part: { part: 'heading', index: [] },
    palette,
    catalogVersion: 0,
    announce: noop,
    dir: 'ltr',
    device: 'base',
    locale: 'en',
  },
} satisfies Meta<typeof InspectorPartPanel>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A text part: its one bound row on Content; Design holds the style manager. */
export const TextPart: Story = {};

/** A link part over `{ label, href }`: one link field, the words and the address. */
export const LinkPart: Story = {
  args: { kernel: kernelFocused('cta'), part: { part: 'cta', index: [] } },
};

/** An image part: the address (asset picker when the host gives a library) and its alt text. */
export const ImagePart: Story = {
  args: { kernel: kernelFocused('image'), part: { part: 'image', index: [] } },
};

/** A repeated item: its whole group on Content, and a This item / All items switch on Design. */
export const ItemPart: Story = {
  args: { kernel: kernelFocused('item', [1]), part: { part: 'item', index: [1] } },
};

const directionKernel = kernelFocused('heading');
/** Design: the Direction control writes `partStyles.heading.dir` in one transaction. */
export const DirectionControl: Story = {
  args: { kernel: directionKernel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Design' }));
    await userEvent.click(canvas.getByRole('radio', { name: 'Right to left' }));
    await expect(partStyleAt(directionKernel, 'heading')?.dir).toBe('rtl');
  },
};

/** The whole Inspector: the header reads "Heading · Promo" and offers Back to block. */
export const InTheInspector: Story = {
  render: () => <Inspector kernel={kernelFocused('heading')} />,
};

/** The Arabic editor over an Arabic page. */
export const Arabic: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <Inspector kernel={kernelFocused('item.title', [2], 'rtl')} locale="ar" />
    </div>
  ),
};
