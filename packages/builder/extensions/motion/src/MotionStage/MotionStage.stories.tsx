import type { Meta, StoryObj } from '@storybook/react-vite';

import { MotionStage } from './MotionStage';

const meta = {
  title: 'Builder/Extensions/MotionStage',
  component: MotionStage,
  /*
    No `tags: ['autodocs']` on purpose. This component ships a written
    MotionStage.docs.mdx attached with <Meta of={...}>, and Storybook 10 refuses
    both at once — a generated docs page and an authored one for the same
    component is an ambiguity it will not guess at. The authored page wins,
    because the reason a person opens these docs is to find out whether they
    need the engine at all, and a generated props table cannot say that.
  */
  parameters: {
    docs: {
      description: {
        component:
          'The upgrade path for the two things CSS cannot do: pinning a section, and telling a child its own index so a cascade can be computed. Everything else is plain CSS and needs none of this.',
      },
    },
  },
  args: {
    children: <p style={{ margin: 0 }}>A section of page content.</p>,
  },
} satisfies Meta<typeof MotionStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No motion asked for: one plain element, no engine involvement at all. */
export const Still: Story = {
  args: { spec: undefined },
};

/** The common case. The attributes drive the CSS baseline; nothing runs here. */
export const Reveal: Story = {
  args: { spec: { reveal: 'fade-up', duration: 'normal', easing: 'ease-out' } },
};

/** A cascade. Each child receives `--stagger-index`, which the stylesheet multiplies. */
export const Staggered: Story = {
  args: {
    spec: { reveal: 'fade-up', stagger: 'normal' },
    children: (
      <>
        <p style={{ margin: 0 }}>First card</p>
        <p style={{ margin: 0 }}>Second card</p>
        <p style={{ margin: 0 }}>Third card</p>
      </>
    ),
  },
};

/** The one effect that genuinely needs the engine. CSS cannot hold an element in place. */
export const Pinned: Story = {
  args: { spec: { scroll: 'pin' } },
};

/** A scroll-linked effect that stays on the CSS baseline despite being scroll-driven. */
export const Parallax: Story = {
  args: { spec: { scroll: 'parallax-slow' } },
};

/**
 * Motion explicitly switched off. The stage must leave NO trace — no class and
 * no attributes — so the reduced-motion and fallback rules have nothing to
 * match.
 */
export const SwitchedOff: Story = {
  args: { spec: { reveal: 'none', scroll: 'none' } },
};

/** Right-to-left content. Motion is direction-agnostic; the layout is not. */
export const RightToLeft: Story = {
  args: { spec: { reveal: 'fade-right' } },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
