import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { OutcomeCard } from './OutcomeCard';

const meta = {
  title: 'Playground/OutcomeCard',
  component: OutcomeCard,
  parameters: { layout: 'centered' },
  args: {
    busy: false,
    onRetry: () => undefined,
    turn: {
      id: 'turn-1',
      from: 'assistant',
      kind: 'stopped',
      receipt: { elapsed: '00:04.210', stage: 'structure', stageLabel: 'Structure' },
    },
  },
} satisfies Meta<typeof OutcomeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The person pressed Stop. The receipt says how far it got before they did. */
export const Stopped: Story = {};

/** A proposal dismissed. It was never a run, so there is no duration to report. */
export const Discarded: Story = {
  args: { turn: { id: 'turn-2', from: 'assistant', kind: 'discarded' } },
};

/** A retryable failure that kept its request. */
export const RetryableFailure: Story = {
  args: {
    turn: {
      id: 'turn-3',
      from: 'assistant',
      kind: 'refused',
      text: 'تعذّر إكمال الطلب — انتهت مهلة المزوّد.',
      failure: {
        code: 'timeout',
        message: 'upstream timed out',
        source: 'provider',
        retryable: true,
        status: 504,
      },
      request: 'أضف قسم أسعار بثلاث خطط',
      receipt: { elapsed: '00:30.000', stage: 'content', stageLabel: 'Content' },
    },
  },
};

/** A permanent failure. No Retry: the same answer would come back. */
export const PermanentFailure: Story = {
  args: {
    turn: {
      id: 'turn-4',
      from: 'assistant',
      kind: 'refused',
      text: 'الخطة رُفضت عند الباب: أمر غير مسموح.',
      failure: {
        code: 'plan-rejected',
        message: 'command not allowed',
        source: 'plan',
        retryable: false,
      },
      receipt: { elapsed: '00:02.100', stage: 'sitemap', stageLabel: 'Plan' },
    },
  },
};

/** Another run owns the panel, so Retry is closed rather than hidden. */
export const RetryWhileBusy: Story = {
  args: { ...RetryableFailure.args, busy: true },
};

/** A refusal with no failure record: the sentence is the whole card. */
export const PlainRefusal: Story = {
  args: {
    turn: {
      id: 'turn-5',
      from: 'assistant',
      kind: 'refused',
      text: 'لا أستطيع تنفيذ هذا الطلب.',
    },
  },
};
