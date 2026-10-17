import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { RunRecord, RunUnitRecord, RunUnitStatus } from '../../../vault/run-journal';
import { InterruptedCard } from './InterruptedCard';

const unit = (
  position: number,
  title: string,
  status: RunUnitStatus,
  reason?: string,
): RunUnitRecord => ({
  position,
  id: `n${String(position)}`,
  title,
  status,
  attempts: 1,
  ...(reason === undefined ? {} : { reason }),
});

const record = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  runId: 'run-12',
  docId: 'playground/landing',
  pageId: 'home',
  request: 'ابنِ لي صفحة استوديو خزف في عمّان',
  mode: 'ask',
  providerKind: 'remote',
  baseFingerprint: 'doc-v1-sha256-abc',
  limits: { maxTasks: 12, taskTimeoutMs: 240_000, buildBudgetMs: 900_000 },
  status: 'stopped',
  stage: 'planned',
  units: [
    unit(1, 'قسم التعريف', 'applied'),
    unit(2, 'معرض الأعمال', 'applied'),
    unit(3, 'الأسعار', 'skipped', 'رُفض عند الهبوط'),
    unit(4, 'تواصل معنا', 'waiting'),
  ],
  spent: { elapsedMs: 96_000, tasksStarted: 3 },
  createdAt: 0,
  updatedAt: 1,
  heartbeatAt: 1,
  ...overrides,
});

const meta = {
  title: 'Playground/InterruptedCard',
  component: InterruptedCard,
  parameters: { layout: 'padded' },
  args: {
    record: record(),
    locale: 'ar',
    onResume: () => undefined,
    onRestart: () => undefined,
    onKeep: () => undefined,
    onDiscard: () => undefined,
  },
} satisfies Meta<typeof InterruptedCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two sections landed, one was refused, one was never reached. */
export const Resumable: Story = {};

/** The same card in English. */
export const English: Story = { args: { locale: 'en' } };

/**
 * Every section either landed or was refused. There is nothing to continue, so
 * Resume is withdrawn — and the card says why rather than showing a dead button.
 */
export const NothingToResume: Story = {
  args: {
    record: record({
      units: [unit(1, 'قسم التعريف', 'applied'), unit(2, 'الأسعار', 'skipped', 'رُفض مرّتين')],
    }),
  },
};

/**
 * The tab died between laying the skeleton and knowing what the sections were.
 * There is no list, and Start over must remove the skeleton first.
 */
export const OnlyASkeleton: Story = {
  args: { record: record({ stage: 'scaffolding', units: [] }) },
};

/** Nothing landed at all: no Keep, because there is nothing to keep. */
export const NothingKept: Story = {
  args: {
    record: record({
      units: [unit(1, 'قسم التعريف', 'waiting'), unit(2, 'الأسعار', 'waiting')],
    }),
  },
};

/** Another run owns the panel. */
export const Busy: Story = { args: { busy: true } };
