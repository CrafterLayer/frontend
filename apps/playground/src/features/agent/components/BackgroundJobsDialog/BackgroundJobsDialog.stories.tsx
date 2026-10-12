import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { jobsLabels } from '../../copy/jobs-labels';
import type { JobsDialogView } from '../../hooks/use-jobs-ui';
import type { BackgroundJobsView } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import {
  fakeJobsView,
  JOB_FAILED,
  SAMPLE_JOBS,
  SAMPLE_JOBS_AR,
  SAMPLE_PAGES_AR,
} from '../../testing/batch-fixtures';
import { jobsFrame } from '../../testing/jobs-story-frame';
import { IconButton } from '../IconButton';

import { BackgroundJobsDialog } from './BackgroundJobsDialog';

interface StageProps {
  readonly locale: Locale;
  readonly view?: JobsDialogView;
  readonly jobs?: Partial<BackgroundJobsView>;
  readonly request?: string;
  readonly fromDraft?: boolean;
  readonly watch: (watching: boolean) => void;
  readonly retryLive: (jobId: string, pageId: string) => void;
}

/** The dialog over a hand-built view, opened from a stand-in for the header's button. */
function Stage({
  locale,
  view: start = 'list',
  jobs,
  request,
  fromDraft,
  watch,
  retryLive,
}: StageProps) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<JobsDialogView>(start);
  const [opening, setOpening] = useState(0);
  const button = useRef<HTMLButtonElement | null>(null);
  const arabic = locale === 'ar';
  const shown = fakeJobsView({
    ...(arabic ? { jobs: SAMPLE_JOBS_AR, pages: SAMPLE_PAGES_AR } : {}),
    watch,
    retryLive,
    ...jobs,
  });
  return (
    <>
      <IconButton
        ref={button}
        icon="layers"
        label={jobsLabels(locale).title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      />
      <BackgroundJobsDialog
        locale={locale}
        jobs={shown}
        open={open}
        onOpenChange={setOpen}
        view={view}
        onViewChange={setView}
        onStart={() => {
          setOpening(opening + 1);
          setView('new');
        }}
        request={request}
        fromDraft={fromDraft}
        opening={opening}
        returnFocusRef={button}
      />
    </>
  );
}

const meta = {
  title: 'Agent/Jobs/BackgroundJobsDialog',
  component: Stage,
  parameters: { layout: 'fullscreen', panel: { width: 1180, height: 820 } },
  args: { locale: 'en', watch: fn(), retryLive: fn() },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [jobsFrame],
} satisfies Meta<typeof Stage>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark', width: 1180, height: 820 } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;
const EN = jobsLabels('en');
const NOT_CONFIGURED =
  'Background batches are not configured on this server: they need the Anthropic Messages API (ANTHROPIC_API_KEY).';

async function dialogOf(canvasElement: HTMLElement, name: string): Promise<HTMLElement> {
  return waitFor(() => within(canvasElement).getByRole('dialog', { name }));
}

/** The list: a job answering, one canceled, one ready, one applied with results open. */
export const List: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await dialogOf(canvasElement, EN.title);
    await expect(dialog.closest('.ck-agent')).not.toBeNull();
    // Open, on the list, with a batch answering: the list asks to be kept fresh.
    await expect(args.watch).toHaveBeenCalledWith(true);
    await userEvent.click(
      within(dialog).getByRole('button', { name: EN.outcome.retryLiveLabel('Contact') }),
    );
    await expect(args.retryLive).toHaveBeenCalledWith('job-applied', 'contact');
  },
};

export const ListDark: Story = { parameters: DARK };
export const ListRightToLeft: Story = { args: { locale: 'ar' }, ...RTL };
export const ListDarkRightToLeft: Story = { args: { locale: 'ar' }, parameters: DARK, ...RTL };

/** "Run on several pages" opens the form. */
export const StartFromList: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await dialogOf(canvasElement, EN.title);
    await userEvent.click(within(dialog).getByRole('button', { name: EN.start }));
    await dialogOf(canvasElement, EN.formTitle);
  },
};

/** The form, prefilled from the composer's draft. */
export const Form: Story = {
  args: { view: 'new', request: 'Translate every page into French', fromDraft: true },
};
export const FormDark: Story = { ...Form, parameters: DARK };
export const FormRightToLeft: Story = {
  args: { locale: 'ar', view: 'new', request: 'ترجم كل الصفحات إلى الفرنسية', fromDraft: true },
  ...RTL,
};

/** The server cannot batch: its sentence on the form, and Submit waits. */
export const Unavailable: Story = {
  args: { view: 'new', request: 'Translate every page', jobs: { unavailable: NOT_CONFIGURED } },
};
export const UnavailableRightToLeft: Story = {
  args: { locale: 'ar', view: 'new', jobs: { unavailable: NOT_CONFIGURED } },
  ...RTL,
};

/** No assistant server: the list says so, and the jobs kept from before stay listed. */
export const Offline: Story = { args: { jobs: { connected: false, jobs: [JOB_FAILED] } } };

export const Empty: Story = { args: { jobs: { jobs: [] } } };
export const Loading: Story = { args: { jobs: { jobs: undefined } } };

/** Busy and failing: a job applying, another whose last refresh failed. */
export const BusyAndNotice: Story = {
  args: {
    jobs: {
      pending: ['job-ready'],
      notices: { 'job-progress': 'The assistant server could not be reached: Failed to fetch' },
    },
  },
};

/** A phone-width screen: the window takes the width less 16 on each side. */
export const Phone: Story = {
  args: { jobs: { jobs: SAMPLE_JOBS.slice(0, 2) } },
  parameters: { panel: { width: 390, height: 760 } },
};
