import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { initialRunProgress, type RunProgress } from '../AssistantPanel/AssistantPanel.progress';
import { LiveStageClock } from './LiveStageClock';

const NOW = Date.now();

/** Built through the real factory: the stage ids are a vocabulary, not free text. */
function run(overrides: Partial<RunProgress> = {}): RunProgress {
  return { ...initialRunProgress('auto', NOW), ...overrides };
}

const meta = {
  title: 'Playground/LiveStageClock',
  component: LiveStageClock,
  parameters: { layout: 'centered' },
  args: { heading: 'Working on the page skeleton', run: run() },
  argTypes: { run: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LiveStageClock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A run in flight: the open row counts up, the rest wait. */
export const Running: Story = {};

/** A review run has no apply row — the rows are the run's, not a template. */
export const ReviewRun: Story = { args: { run: run({ ...initialRunProgress('never', NOW) }) } };

/** Settled: no open row, so nothing ticks and no timer exists. */
export const Settled: Story = {
  args: {
    run: run({
      stageSince: null,
      stages: initialRunProgress('auto', NOW).stages.map((stage) => ({ ...stage, status: 'done' })),
    }),
  },
};

/** Past 90 seconds: muted words, never a warning colour. Slow is not wrong. */
export const TakingLonger: Story = {
  args: { run: run({ startedAt: NOW - 120_000, stageSince: NOW - 120_000 }) },
};

/** The heading is the region's accessible name, so a section says which one it is. */
export const NamedForOneSection: Story = { args: { heading: 'Working on Benefits' } };
