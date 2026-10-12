import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { jobsLabels } from '../../copy/jobs-labels';
import {
  JOB_APPLIED,
  JOB_CANCELED,
  JOB_FAILED,
  JOB_IN_PROGRESS,
  JOB_READY,
  JOBS_NOW,
  SAMPLE_JOBS_AR,
  SAMPLE_PAGES,
  SAMPLE_PAGES_AR,
} from '../../testing/batch-fixtures';
import { jobsFrame } from '../../testing/jobs-story-frame';

import { BackgroundJobRow } from './BackgroundJobRow';

const EN = jobsLabels('en').row;
const arabic = (id: string) => SAMPLE_JOBS_AR.find((job) => job.id === id) ?? JOB_IN_PROGRESS;

const meta = {
  title: 'Agent/Jobs/BackgroundJobRow',
  component: BackgroundJobRow,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    job: JOB_IN_PROGRESS,
    now: JOBS_NOW,
    pages: SAMPLE_PAGES,
    connected: true,
    onRefresh: fn(),
    onCancel: fn(),
    onApply: fn(),
    onRemove: fn(),
    onRetryLive: fn(),
  },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [jobsFrame],
} satisfies Meta<typeof BackgroundJobRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark' } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;

/** Still answering: 3 of 5, Refresh and Cancel job. */
export const InProgress: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('progressbar', { name: EN.progressLabel })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    await userEvent.click(canvas.getByRole('button', { name: EN.cancel }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};

/** Ended with answers: Apply results is the one primary action. */
export const Ready: Story = {
  args: { job: JOB_READY },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: EN.apply }));
    await expect(args.onApply).toHaveBeenCalledTimes(1);
  },
};

/** Applying: the action says so and waits. */
export const Applying: Story = { args: { job: JOB_READY, busy: true } };

/** Applied: the results open by themselves, since some pages need a live retry. */
export const Applied: Story = { args: { job: JOB_APPLIED } };
export const AppliedDark: Story = { args: { job: JOB_APPLIED }, parameters: DARK };

/** Canceled before any page was answered: Show pages lists them for a live retry. */
export const Canceled: Story = { args: { job: JOB_CANCELED } };

/** Every page errored. */
export const Failed: Story = { args: { job: JOB_FAILED } };

/** The last call about the job failed: the server's sentence, under the job. */
export const Notice: Story = {
  args: { notice: 'The assistant server could not be reached: Failed to fetch' },
};

/** No assistant server: Refresh and Cancel wait. */
export const Offline: Story = { args: { connected: false } };

/** Remove asks in place first. */
export const Remove: Story = {
  args: { job: JOB_READY },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EN.removeLabel(JOB_READY.request) }));
    const confirm = canvas.getByRole('group', { name: EN.removeMessage });
    // The confirm fades in where the button was.
    await waitFor(() => expect(confirm).toBeVisible());
    await userEvent.click(canvas.getByRole('button', { name: EN.remove }));
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

export const RightToLeft: Story = {
  args: { locale: 'ar', job: arabic('job-progress'), pages: SAMPLE_PAGES_AR },
  ...RTL,
};

export const AppliedRightToLeft: Story = {
  args: { locale: 'ar', job: arabic('job-applied'), pages: SAMPLE_PAGES_AR },
  ...RTL,
};

export const DarkRightToLeft: Story = {
  args: { locale: 'ar', job: arabic('job-ready'), pages: SAMPLE_PAGES_AR },
  parameters: DARK,
  ...RTL,
};

/** A narrow panel: the request wraps to two lines, the tag stays on the first. */
export const Narrow: Story = { args: { job: JOB_APPLIED }, parameters: { panel: { width: 320 } } };
