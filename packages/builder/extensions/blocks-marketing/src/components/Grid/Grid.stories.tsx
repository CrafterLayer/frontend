import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { BlockRenderProps, Node } from '@craftkit/builder-schema';

import { Grid } from './Grid';
import type { GridProps } from './schema';

const meta = {
  title: 'Marketing/Grid',
  component: Grid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

const NODE: Node = { id: 'grid-story', type: 'grid', props: {} };

function args(props: Partial<GridProps>): BlockRenderProps<GridProps> {
  return {
    node: NODE,
    props: {
      columns: '3',
      gap: 'md',
      align: 'start',
      justify: 'start',
      flow: 'row',
      tone: 'transparent',
      spacing: 'none',
      width: 'full',
      ...props,
    },
    slots: {},
    data: {},
    isCanvas: false,
  };
}

function children(prefix: string) {
  return ['a', 'b', 'c', 'd', 'e', 'f'].map((label) => (
    <div
      key={label}
      data-testid={`${prefix}-${label}`}
      style={{
        background: '#e5e7eb',
        boxSizing: 'border-box',
        inlineSize: '100%',
        minBlockSize: '48px',
        padding: 'var(--t-gap-sm, 8px)',
      }}
    >
      {label.toUpperCase()}
    </div>
  ));
}

export const ResponsiveGeometry: Story = {
  args: args({ columns: '3', gap: 'md' }),
  render: (storyArgs) => (
    <div
      style={{
        display: 'grid',
        gap: '48px',
        overflow: 'auto',
        paddingBlock: '24px',
        paddingInline: '24px',
      }}
    >
      <div data-testid="wide-frame" style={{ inlineSize: '760px', maxInlineSize: '100%' }}>
        <Grid {...storyArgs} slots={{ default: children('wide') }} />
      </div>
      <div data-testid="narrow-frame" style={{ inlineSize: '460px', maxInlineSize: '100%' }}>
        <Grid {...storyArgs} slots={{ default: children('narrow') }} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const wide = ['a', 'b', 'c', 'd'].map((label) =>
      canvas.getByTestId(`wide-${label}`).getBoundingClientRect(),
    );
    const narrow = ['a', 'b', 'c'].map((label) =>
      canvas.getByTestId(`narrow-${label}`).getBoundingClientRect(),
    );
    const [wideA, wideB, wideC, wideD] = wide;
    const [narrowA, narrowB, narrowC] = narrow;

    if (
      wideA === undefined ||
      wideB === undefined ||
      wideC === undefined ||
      wideD === undefined ||
      narrowA === undefined ||
      narrowB === undefined ||
      narrowC === undefined
    ) {
      throw new Error('Grid geometry fixture is incomplete');
    }

    // A wide three-column grid has three near-equal tracks and a real gap.
    await expect(Math.abs(wideA.top - wideB.top)).toBeLessThan(1);
    await expect(Math.abs(wideA.top - wideC.top)).toBeLessThan(1);
    await expect(Math.abs(wideA.width - wideB.width)).toBeLessThan(1);
    await expect(Math.abs(wideA.width - wideC.width)).toBeLessThan(1);
    await expect(wideB.left - wideA.right).toBeGreaterThan(8);
    await expect(wideD.top).toBeGreaterThan(wideA.bottom);
    await expect(Math.abs(wideD.left - wideA.left)).toBeLessThan(1);

    // The same declared maximum degrades to two tracks in a narrow container.
    await expect(Math.abs(narrowA.top - narrowB.top)).toBeLessThan(1);
    await expect(narrowB.left - narrowA.right).toBeGreaterThan(8);
    await expect(narrowC.top).toBeGreaterThan(narrowA.bottom);
    await expect(Math.abs(narrowC.left - narrowA.left)).toBeLessThan(1);
  },
};
