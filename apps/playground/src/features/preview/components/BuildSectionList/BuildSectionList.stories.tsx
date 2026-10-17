import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { initialRunProgress } from '../AssistantPanel/AssistantPanel.progress';
import type { BuildProgress, BuildTask } from '../AssistantPanel/AssistantPanel.build';
import { BuildSectionList } from './BuildSectionList';

const NOW = Date.now();

const task = (position: number, title: string, status: BuildTask['status']): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status,
  attempts: 0,
});

function progress(tasks: readonly BuildTask[], running = true): BuildProgress {
  return {
    runId: 'story',
    phase: 'building',
    direction: 'A calm clinic page.',
    tasks,
    startedAt: NOW,
    applied: tasks.filter((entry) => entry.status === 'applied').length,
    skipped: tasks.filter((entry) => entry.status === 'skipped').length,
    run: running ? initialRunProgress('auto', NOW) : null,
    ...(running
      ? {
          liveLog: [
            'Reading the page brief and the selected visual direction.',
            'Building the section outline before writing the next region.',
            'Checking spacing and responsive behavior as the page fills.',
          ],
        }
      : {}),
  };
}

const meta = {
  title: 'Playground/BuildSectionList',
  component: BuildSectionList,
  parameters: { layout: 'centered' },
  args: {
    progress: progress([
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'applied'),
      task(3, 'Benefits', 'running'),
      task(4, 'Pricing', 'waiting'),
      task(5, 'Contact', 'waiting'),
    ]),
    turnId: 'story',
  },
  argTypes: { progress: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuildSectionList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One section in flight, two done, two waiting. */
export const Default: Story = {};

/**
 * THREE in flight at once — what the writer pool actually looks like.
 * Each running section names its own clock; the waiting ones say so.
 */
export const ConcurrentWave: Story = {
  args: {
    progress: progress([
      task(1, 'Hero', 'running'),
      task(2, 'Proof', 'running'),
      task(3, 'Benefits', 'running'),
      task(4, 'Pricing', 'waiting'),
      task(5, 'Contact', 'waiting'),
    ]),
  },
};

/** A section the model would not write: skipped, and the build carried on. */
export const WithSkipped: Story = {
  args: {
    progress: progress([
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'skipped'),
      task(3, 'Benefits', 'running'),
    ]),
  },
};

/** Settled: nothing ticks, because nothing is running. */
export const Settled: Story = {
  args: {
    progress: progress(
      [task(1, 'Hero', 'applied'), task(2, 'Proof', 'applied'), task(3, 'Benefits', 'applied')],
      false,
    ),
  },
};

/** Arabic titles keep their own direction inside an otherwise English card. */
export const Arabic: Story = {
  args: {
    progress: progress([
      task(1, 'الافتتاحية', 'applied'),
      task(2, 'الخدمات', 'running'),
      task(3, 'تواصل', 'waiting'),
    ]),
  },
  decorators: [
    (Story) => (
      <div
        dir="rtl"
        style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}
      >
        <Story />
      </div>
    ),
  ],
};
