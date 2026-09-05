import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { MentionPicker } from './MentionPicker';

const meta = {
  title: 'Playground/MentionPicker',
  component: MentionPicker,
  parameters: { layout: 'centered' },
  args: {
    candidates: [
      { id: 'hero', type: 'hero', excerpt: 'ابنِ موقعك في دقيقة' },
      { id: 'pricing', type: 'pricing-table', excerpt: 'ثلاث خطط، بلا رسوم خفية' },
      { id: 'faq-2', type: 'faq' },
    ],
    onPick: () => undefined,
  },
} satisfies Meta<typeof MentionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three blocks, two of which are known by their words rather than their ids. */
export const Default: Story = {};

/** A block with no string prop is still pickable — id and type carry it. */
export const NoExcerpt: Story = {
  args: { candidates: [{ id: 'spacer-1', type: 'spacer' }] },
};

/**
 * A typo. The picker STAYS and says so, because vanishing would be
 * indistinguishable from never having opened.
 */
export const NoMatch: Story = { args: { candidates: [] } };
