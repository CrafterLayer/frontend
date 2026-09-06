import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { BuildProgress, BuildTask } from '../AssistantPanel/AssistantPanel.build';
import type { BuiltTurn } from '../AssistantPanel/AssistantPanel.turns';
import { BuildReportCard } from './BuildReportCard';

const task = (
  position: number,
  title: string,
  status: BuildTask['status'],
  reason?: string,
): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status,
  attempts: 1,
  ...(reason === undefined ? {} : { reason }),
});

function report(rows: readonly BuildTask[], overrides: Partial<BuiltTurn> = {}): BuiltTurn {
  const progress: BuildProgress = {
    runId: 'story',
    phase: 'completed',
    direction: 'A calm clinic page.',
    tasks: rows,
    startedAt: 0,
    applied: rows.filter((row) => row.status === 'applied').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    run: null,
  };
  return {
    id: 'story',
    from: 'assistant',
    kind: 'built',
    progress,
    undoable: true,
    request: 'build a clinic page',
    ...overrides,
  };
}

/** A revived report: readable history, and no request left to re-send. */
function revivedWithoutRequest(): BuiltTurn {
  const withRequest = report([task(1, 'Hero', 'applied'), task(2, 'Pricing', 'skipped')]);
  const revived: Record<string, unknown> = { ...withRequest };
  delete revived['request'];
  return revived as unknown as BuiltTurn;
}

const ALL_APPLIED = report([
  task(1, 'Hero', 'applied'),
  task(2, 'Services', 'applied'),
  task(3, 'Team', 'applied'),
  task(4, 'Contact', 'applied'),
]);

const meta = {
  title: 'Playground/BuildReportCard',
  component: BuildReportCard,
  parameters: { layout: 'centered' },
  args: {
    report: ALL_APPLIED,
    turnId: 'story',
    busy: false,
    canUndo: true,
    onUndoTask: fn(),
    onRetrySkipped: fn(),
  },
  argTypes: { report: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuildReportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything landed. Each section can still be undone on its own. */
export const AllApplied: Story = {};

/** A section the model would not write, with the door's own reason. */
export const WithSkipped: Story = {
  args: {
    report: report([
      task(1, 'Hero', 'applied'),
      task(2, 'Pricing', 'skipped', 'The model would not invent prices.'),
      task(3, 'Contact', 'applied'),
    ]),
  },
};

/** Plan mode: no Undo anywhere — this button loops `kernel.undo()`. */
export const PlanningOnly: Story = { args: { canUndo: false } };

/** Stopped short: the build completed its bookkeeping, not its work. */
export const Stopped: Story = {
  args: {
    report: report(
      [task(1, 'Hero', 'applied'), task(2, 'Services', 'waiting'), task(3, 'Contact', 'waiting')],
      { stopped: true },
    ),
  },
};

/** Revived after a reload: readable history, and no retry it could not send. */
export const RevivedWithoutRequest: Story = {
  args: {
    /*
      Built WITHOUT a request rather than with an undefined one:
      `exactOptionalPropertyTypes` treats "absent" and "present and undefined"
      as different things, and a revived report means the first.
    */
    report: revivedWithoutRequest(),
  },
};

/** Arabic titles keep their own direction. */
export const Arabic: Story = {
  args: {
    report: report([
      task(1, 'الافتتاحية', 'applied'),
      task(2, 'الأسعار', 'skipped', 'لم يوافق النموذج على اختراع أسعار.'),
      task(3, 'تواصل', 'applied'),
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
