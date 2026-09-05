import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { RunProgress } from '../AssistantPanel/AssistantPanel.progress';
import { StageTimings } from './StageTimings';

const run = (stages: RunProgress['stages']): RunProgress => ({
  stages,
  startedAt: 0,
  stageSince: null,
  failedAt: null,
});

const meta = {
  title: 'Playground/StageTimings',
  component: StageTimings,
  parameters: { layout: 'centered' },
  args: {
    run: run([
      { id: 'sitemap', status: 'done', detail: '00:01.123' },
      { id: 'structure', status: 'done', detail: '00:00.310' },
    ]),
  },
} satisfies Meta<typeof StageTimings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two finished rows, joined by a middot. */
export const Default: Story = {};

/** A single row is a single fact — no separator to imply a second. */
export const OneStage: Story = {
  args: { run: run([{ id: 'sitemap', status: 'done', detail: '00:00.940' }]) },
};

/** Rows that never settled are not timings. Only the done ones are shown. */
export const PartlyFinished: Story = {
  args: {
    run: run([
      { id: 'sitemap', status: 'done', detail: '00:01.123' },
      { id: 'structure', status: 'failed', detail: 'refused' },
      { id: 'content', status: 'pending' },
    ]),
  },
};

/** A card revived from storage keeps no run. The line is absent, not empty. */
export const Revived: Story = { args: { run: undefined } };
