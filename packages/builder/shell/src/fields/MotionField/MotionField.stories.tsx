import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { motionSpecSchema } from '@craftkit/builder-schema';

import { MotionField } from './MotionField';

const meta = {
  title: 'Builder/Fields/MotionField',
  component: MotionField,
  /*
    No `tags: ['autodocs']`: this component ships an authored MotionField.docs.mdx
    attached with <Meta of={...}>, and Storybook refuses a generated and an
    authored docs page for the same component.
  */
  args: {
    schema: motionSpecSchema,
    path: ['motion'],
    onChange: fn(),
    controlId: 'motion',
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '18rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MotionField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a section with no motion. Every control reads "—". */
export const Empty: Story = {
  args: { value: {} },
};

/** The common choice — something arrives as it scrolls into view. */
export const Reveal: Story = {
  args: { value: { reveal: 'fade-up', duration: 'normal', easing: 'ease-out' } },
};

/** A cascade. The stagger row is the one that needs the motion extension. */
export const Staggered: Story = {
  args: { value: { reveal: 'fade-up', stagger: 'normal' } },
};

/** Scroll-linked. Everything here except `pin` is plain CSS. */
export const ScrollDriven: Story = {
  args: { value: { scroll: 'parallax-slow' } },
};

/** Every part set at once, including the replay switch. */
export const FullySpecified: Story = {
  args: {
    value: {
      reveal: 'blur-in',
      scroll: 'scale-on-scroll',
      duration: 'slow',
      delay: 'medium',
      easing: 'spring',
      stagger: 'tight',
      repeat: true,
    },
  },
};

/** Read-only, as the inspector renders it when the row cannot be edited. */
export const Disabled: Story = {
  args: { value: { reveal: 'fade' }, disabled: true },
};

/**
 * A stored value the vocabulary does not recognise — the state a hand-edited
 * document or an older schema produces. The control must show "no motion"
 * rather than crash the inspector.
 */
export const MalformedValue: Story = {
  args: { value: 'not an object' },
};

/** Right-to-left. Labels and hints mirror; the vocabulary does not. */
export const RightToLeft: Story = {
  args: { value: { reveal: 'fade-right' } },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '18rem' }}>
        <Story />
      </div>
    ),
  ],
};
