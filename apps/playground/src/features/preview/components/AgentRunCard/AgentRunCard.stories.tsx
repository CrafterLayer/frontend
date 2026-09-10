import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { AgentRunCard } from './AgentRunCard';

const meta = {
  title: 'Playground/AgentRunCard',
  component: AgentRunCard,
  decorators: [(Story) => <div style={{ inlineSize: 320 }}><Story /></div>],
  args: { status: 'running', title: 'Build landing page', currentTask: 'Writing Hero', completed: 2, total: 6, onStop: () => undefined },
} satisfies Meta<typeof AgentRunCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};
export const Queued: Story = { args: { status: 'queued', currentTask: 'Waiting for current change', completed: 0 } };
export const Stopped: Story = { args: { status: 'stopped', currentTask: undefined, summary: 'Two completed files were saved as a draft.', completed: 2 } };
export const Failed: Story = { args: { status: 'failed', currentTask: undefined, summary: 'The selected target changed.', completed: 1 } };
export const Done: Story = { args: { status: 'done', currentTask: undefined, summary: 'Hero copy and layout updated.', diffSummary: '+18 −7 · 2 files', completed: 6, details: ['pages/home/page.tsx', 'pages/home/styles.css'], onReviewDiff: () => undefined, onUndo: () => undefined } };
