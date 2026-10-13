import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { jobResults } from '../../../jobs';
import { jobsLabels } from '../../copy/jobs-labels';
import {
  JOB_APPLIED,
  SAMPLE_JOBS_AR,
  SAMPLE_PAGES,
  SAMPLE_PAGES_AR,
} from '../../testing/batch-fixtures';
import { jobsFrame } from '../../testing/jobs-story-frame';

import { BatchOutcomeList } from './BatchOutcomeList';

const APPLIED_AR = SAMPLE_JOBS_AR.find((job) => job.id === JOB_APPLIED.id) ?? JOB_APPLIED;
const RESULTS = jobResults(JOB_APPLIED);
const EN = jobsLabels('en').outcome;

const meta = {
  title: 'Agent/Jobs/BatchOutcomeList',
  component: BatchOutcomeList,
  parameters: { layout: 'centered' },
  args: { locale: 'en', results: RESULTS, pages: SAMPLE_PAGES, onRetryLive: fn() },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [jobsFrame],
} satisfies Meta<typeof BatchOutcomeList>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark' } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;

/** Every way a page can end: applied (whole, and in part), declined, rejected, no answer. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(EN.appliedHint)).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: EN.retryLiveLabel('Contact') }));
    await expect(args.onRetryLive).toHaveBeenCalledWith('contact');
  },
};

export const Dark: Story = { parameters: DARK };

/** What the job measured: the warm call's cache write, and the reads it bought the pages. */
export const WithUsage: Story = {
  args: {
    usage: {
      inputTokens: 1_820,
      outputTokens: 2_140,
      cacheReadTokens: 24_400,
      cacheWriteTokens: 6_100,
    },
  },
};

/** Two pages already sent again: they say so instead of offering it twice. */
export const Retried: Story = { args: { retried: ['about', 'contact'] } };

/** Pages never sent (no model call there), and a page the site no longer has. */
export const NotSentAndRemoved: Story = {
  args: {
    results: [
      { pageId: 'events', status: 'skipped', message: 'This request asks no model on this page.' },
      { pageId: 'home', status: 'applied', transactionIds: ['tx'] },
      { pageId: 'blog', status: 'missing', message: 'This page is no longer in the site.' },
    ],
  },
};

/** Without a retry handler (a host with no live panel), no page offers one. */
export const NoRetry: Story = {
  render: (args) => (
    <BatchOutcomeList locale={args.locale} results={args.results} pages={args.pages} />
  ),
};

export const RightToLeft: Story = {
  args: { locale: 'ar', results: jobResults(APPLIED_AR), pages: SAMPLE_PAGES_AR },
  ...RTL,
};

export const DarkRightToLeft: Story = {
  args: { locale: 'ar', results: jobResults(APPLIED_AR), pages: SAMPLE_PAGES_AR },
  parameters: DARK,
  ...RTL,
};

/** A narrow panel: long reasons wrap, Retry live stays at the inline end. */
export const Narrow: Story = { parameters: { panel: { width: 320 } } };
