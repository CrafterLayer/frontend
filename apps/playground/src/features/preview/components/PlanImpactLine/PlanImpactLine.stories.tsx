import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { PlanImpact } from '../AssistantPanel/AssistantPanel.impact';
import { PlanImpactLine } from './PlanImpactLine';

const impact = (partial: Partial<PlanImpact>): PlanImpact => ({
  added: [],
  changed: [],
  removed: [],
  addedTypes: [],
  meta: [],
  empty: false,
  ...partial,
});

const meta = {
  title: 'Playground/PlanImpactLine',
  component: PlanImpactLine,
  parameters: { layout: 'centered' },
  args: {
    impact: impact({ added: ['hero', 'pricing'], addedTypes: ['hero', 'pricing'] }),
    costTokens: 4237,
    locale: 'ar',
  },
  argTypes: { impact: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanImpactLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: what would change, and what the request cost. */
export const Default: Story = {};

export const English: Story = { args: { locale: 'en' } };

/** The one a step list cannot tell you: the plan reads like work and moves nothing. */
export const ChangesNothing: Story = { args: { impact: impact({ empty: true }) } };

/** A direction flip: no node changes at all, and the largest change the panel can make. */
export const DirectionFlip: Story = { args: { impact: impact({ meta: ['dir'] }) } };

/** Added, changed and removed together — the counts, not the ids. */
export const Mixed: Story = {
  args: {
    impact: impact({
      added: ['a'],
      changed: ['b', 'c'],
      removed: ['d'],
      addedTypes: ['hero'],
    }),
    locale: 'en',
  },
};

/** Rehearsal failed: the cost is still known, so the line still says something. */
export const CostOnly: Story = { args: { impact: undefined } };
