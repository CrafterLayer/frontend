import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { FEEDBACK_LABELS_AR, FEEDBACK_LABELS_EN, type FeedbackLabels } from '../../feedback.labels';
import { notifyPublish } from '../../notify';

import { FeedbackToaster } from './FeedbackToaster';

const retry = fn();

type Outcome = 'published' | 'failed' | 'working';

const FILES = ['index.html', 'about/index.html', 'sitemap.xml', 'robots.txt', '404.html'];

/** Publishes as the top bar does, ending in the story's outcome. */
function publish(outcome: Outcome, labels: FeedbackLabels): void {
  const result = (): Promise<readonly unknown[] | undefined> =>
    outcome === 'working'
      ? new Promise(() => undefined)
      : Promise.resolve(outcome === 'published' ? FILES : undefined);
  void notifyPublish(result, labels, retry);
}

/** The editor's canvas area with the toaster at its foot, and a Publish to press. */
function Stage({
  outcome,
  labels,
  dir,
}: {
  readonly outcome: Outcome;
  readonly labels: FeedbackLabels;
  readonly dir: 'ltr' | 'rtl';
}) {
  return (
    <div
      lang={dir === 'rtl' ? 'ar' : 'en'}
      dir={dir}
      style={{
        minBlockSize: 360,
        padding: 'var(--bldr-space-3xl)',
        background: 'var(--bldr-surface-sunken)',
        fontFamily: 'var(--bldr-font)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          toast.dismiss();
          publish(outcome, labels);
        }}
      >
        Publish
      </button>
      <FeedbackToaster labels={labels} dir={dir} />
    </div>
  );
}

/** sonner fades a toast in after it mounts, so "seen" waits for the fade to land. */
async function seen(canvasElement: HTMLElement, text: string): Promise<void> {
  const page = within(canvasElement);
  await waitFor(async () => {
    await expect(page.getByText(text)).toBeVisible();
  });
}

const meta = {
  title: 'Playground/Feedback/FeedbackToaster',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { outcome: 'published', labels: FEEDBACK_LABELS_EN, dir: 'ltr' },
} satisfies Meta<typeof Stage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The outcome in place: the files are ready and downloading. */
export const Published: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(page.getByRole('button', { name: 'Publish' }));
    await seen(canvasElement, 'Site published · 5 files');
  },
};

/** A failure keeps its way forward: Try again. */
export const Failed: Story = {
  args: { outcome: 'failed' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(page.getByRole('button', { name: 'Publish' }));
    await seen(canvasElement, 'The site was not published');
    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    await expect(retry).toHaveBeenCalled();
  },
};

/** While it runs: one quiet line and a ring. */
export const Working: Story = {
  args: { outcome: 'working' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(page.getByRole('button', { name: 'Publish' }));
    await seen(canvasElement, 'Publishing the site…');
  },
};

/** The Arabic editor: right to left, the count in agreement («5 ملفات»). */
export const PublishedRightToLeft: Story = {
  args: { labels: FEEDBACK_LABELS_AR, dir: 'rtl' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(page.getByRole('button', { name: 'Publish' }));
    await seen(canvasElement, 'نُشر الموقع · 5 ملفات');
  },
};
