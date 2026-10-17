import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { EndingLine } from './EndingLine';

const meta = {
  title: 'Playground/EndingLine',
  component: EndingLine,
  parameters: { layout: 'centered' },
  args: {
    verb: 'Stopped',
    receipt: { elapsed: '00:04.210', stage: 'structure', stageLabel: 'Structure' },
  },
} satisfies Meta<typeof EndingLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A stop, four seconds in, at the row that was open. */
export const Stopped: Story = {};

/** A failure. Same line, same weight — the card around it carries the colour. */
export const Failed: Story = {
  args: {
    verb: 'Failed',
    receipt: { elapsed: '00:12.880', stage: 'content', stageLabel: 'Content' },
  },
};

/** The provider streamed something before it ended. Its own words, its own direction. */
export const WithLastWords: Story = {
  args: {
    receipt: {
      elapsed: '00:06.400',
      stage: 'sitemap',
      stageLabel: 'Plan',
      lastLine: 'أفكر في ترتيب الأقسام…',
    },
  },
};

/** Ended before any row opened: no "at", and no dangling preposition. */
export const NoStage: Story = {
  args: { receipt: { elapsed: '00:00.180', stage: null, stageLabel: null } },
};

/** A card revived from storage kept no receipt. The line is absent, not empty. */
export const Revived: Story = { args: { receipt: undefined } };
