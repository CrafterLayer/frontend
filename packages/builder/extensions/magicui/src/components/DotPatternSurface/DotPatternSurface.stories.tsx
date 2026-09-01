import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { DotPatternSurface } from './DotPatternSurface';
import { dotPatternSurfaceExamples } from './examples';
import { dotPatternSurfaceSchema } from './schema';

const node: Node = { id: 'dot-pattern-story', type: 'dotPatternSurface', props: {} };
const exampleProps = (index: number) =>
  dotPatternSurfaceSchema.props.parse(
    (dotPatternSurfaceExamples[index]?.node as { props: unknown }).props,
  );

const content = (
  <div className="mx-auto flex max-w-content-narrow flex-col items-center gap-gap text-center">
    <p className="m-0 text-sm font-semibold tracking-wide text-accent uppercase">
      Build with proof
    </p>
    <h3 className="m-0 text-3xl leading-tight font-bold tracking-tight text-balance">
      A calm surface for the page's most important idea
    </h3>
    <p className="m-0 text-text-muted">
      The pattern supports the content hierarchy without becoming the content.
    </p>
  </div>
);

const meta = {
  title: 'Builder/MagicUI/Dot Pattern Surface',
  component: DotPatternSurface,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DotPatternSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SubtleSurface: Story = {
  args: {
    node,
    props: exampleProps(0),
    slots: { default: content },
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/A calm surface/i)).toBeVisible();
  },
};

export const AccentStart: Story = {
  args: {
    node: { ...node, id: 'dot-pattern-accent' },
    props: exampleProps(1),
    slots: { default: content },
    data: {},
    isCanvas: false,
  },
};

export const ArabicLogicalStart: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'dot-pattern-arabic' },
    props: exampleProps(2),
    slots: {
      default: (
        <div className="flex flex-col gap-gap text-start">
          <h3 className="m-0 text-3xl font-bold tracking-tight">خلفية تدعم المحتوى</h3>
          <p className="m-0 text-text-muted">يتحرك موضع القناع المنطقي تلقائيًا مع اتجاه الصفحة.</p>
        </div>
      ),
    },
    data: {},
    isCanvas: false,
  },
};

export const Inverse: Story = {
  args: {
    node: { ...node, id: 'dot-pattern-inverse' },
    props: dotPatternSurfaceSchema.props.parse({
      className: 'bg-surface-inverse text-text-inverse',
      intensity: 'strong',
      tone: 'inverse',
    }),
    slots: { default: content },
    data: {},
    isCanvas: false,
  },
};
