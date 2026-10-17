import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { initialRunProgress } from '../AssistantPanel/AssistantPanel.progress';
import type { Turn } from '../AssistantPanel/AssistantPanel.turns';
import { AssistantThread } from './AssistantThread';

const you: Turn = { id: 't1', from: 'you', text: 'أضف قسم أسعار بثلاث خطط' };

const thinking: Turn = {
  id: 't2',
  from: 'assistant',
  kind: 'thinking',
  subject: 'the page',
  progress: 'أرتّب الأقسام…',
  run: initialRunProgress('never', 0),
};

const stopped: Turn = {
  id: 't3',
  from: 'assistant',
  kind: 'stopped',
  receipt: { elapsed: '00:04.210', stage: 'structure', stageLabel: 'Structure' },
};

const outline: Turn = {
  id: 't4',
  from: 'assistant',
  kind: 'outline',
  text: 'الهدف: صفحة تبيع الاشتراك.\n\nالخطوات:\n١. قسم بطل بعنوان واحد\n٢. ثلاث خطط\n٣. أسئلة شائعة',
  dropped: 0,
};

const meta = {
  title: 'Playground/AssistantThread',
  component: AssistantThread,
  parameters: { layout: 'padded' },
  args: {
    turns: [you, thinking],
    face: {
      mood: 'thinking',
      line: { key: 'thinking', subject: 'the page' },
      typing: true,
      since: 0,
    },
    locale: 'ar',
    mode: 'ask',
    busy: true,
    canWrite: true,
    threadRef: null,
    watchEmptyZone: null,
    holdEmptySeat: null,
    onApproval: () => undefined,
    onStop: () => undefined,
    onUndoTask: () => undefined,
    onRetrySkipped: () => undefined,
    onRetry: () => undefined,
    onBuild: () => undefined,
    onApplyPlan: () => undefined,
    onPreviewPlan: () => undefined,
    onDiscardPlan: () => undefined,
    onUndoPlan: () => undefined,
  },
} satisfies Meta<typeof AssistantThread>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A question asked, and an answer being written. */
export const Thinking: Story = {};

/** Nothing yet: one invitation, and his face waiting for it. */
export const Empty: Story = {
  args: {
    turns: [],
    busy: false,
    face: { mood: 'idle', line: { key: 'idle' }, typing: false, since: 0 },
  },
};

/** A run the person stopped. The receipt says how far it got. */
export const Stopped: Story = {
  args: {
    turns: [you, stopped],
    busy: false,
    face: { mood: 'stopped', line: { key: 'stopped' }, typing: false, since: 0 },
  },
};

/** A plan in prose, with nothing to apply — Plan mode's own answer. */
export const Outline: Story = {
  args: {
    turns: [you, outline],
    busy: false,
    mode: 'plan',
    face: { mood: 'done', line: { key: 'idle' }, typing: false, since: 0 },
  },
};
