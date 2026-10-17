/**
 * BackgroundJobsDialog (2026-10-12): a modal named "Background jobs" mounted in the panel's
 * scope. The list explains the half price and lists every job; it asks to be kept fresh only
 * while open, on the list and shown. "Run on several pages" opens the form; a send that
 * succeeds returns to the list and says so; Retry live closes the window; Esc inside a Remove
 * confirm closes only the confirm; focus returns to the header's button.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { jobsLabels } from '../../copy/jobs-labels';
import type { JobsDialogView } from '../../hooks/use-jobs-ui';
import type { BackgroundJobsView } from '../../model/background-jobs';
import {
  fakeJobsView,
  JOB_READY,
  SAMPLE_PAGES_AR,
  SAMPLE_JOBS_AR,
} from '../../testing/batch-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { BackgroundJobsDialog } from './BackgroundJobsDialog';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const EN = jobsLabels('en');
const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'BackgroundJobsDialog',
    'BackgroundJobsDialog.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface HostProps {
  readonly jobs: BackgroundJobsView;
  readonly locale?: 'en' | 'ar';
  readonly start?: JobsDialogView;
  readonly visible?: boolean;
}

/** The dialog in a panel scope, opened from a header button, as AgentPanel wires it. */
function Host({ jobs, locale = 'en', start = 'list', visible = true }: HostProps) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<JobsDialogView>(start);
  const button = useRef<HTMLButtonElement | null>(null);
  return (
    <section className="ck-agent" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <AgentTooltipProvider delayDuration={0}>
        <button
          ref={button}
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Jobs
        </button>
        <BackgroundJobsDialog
          locale={locale}
          jobs={jobs}
          open={open}
          onOpenChange={setOpen}
          view={view}
          onViewChange={setView}
          onStart={() => {
            setView('new');
          }}
          request="Translate every page"
          visible={visible}
          returnFocusRef={button}
        />
      </AgentTooltipProvider>
    </section>
  );
}

function setup(overrides: Partial<BackgroundJobsView> = {}, props: Partial<HostProps> = {}) {
  const jobs = fakeJobsView({
    watch: vi.fn(),
    submit: vi.fn(() => Promise.resolve(true)),
    retryLive: vi.fn(),
    apply: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
  const view = render(<Host jobs={jobs} {...props} />);
  return { user: userEvent.setup(), jobs, view };
}

describe('BackgroundJobsDialog', () => {
  it('is a modal named Background jobs, inside the panel scope, listing every job', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: EN.title });
    expect(dialog.closest('.ck-agent')).not.toBeNull();
    expect(dialog).toHaveAttribute('dir', 'ltr');
    expect(within(dialog).getByText(EN.intro)).toBeInTheDocument();
    expect(within(dialog).getAllByRole('article')).toHaveLength(4);
    expect(within(dialog).getByRole('button', { name: EN.start })).toBeInTheDocument();
  });

  it('asks to be kept fresh only while open, on the list and shown', async () => {
    const { jobs, user, view } = setup();
    expect(jobs.watch).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: EN.start }));
    expect(jobs.watch).toHaveBeenLastCalledWith(false);
    view.rerender(<Host jobs={jobs} visible={false} />);
    expect(jobs.watch).toHaveBeenLastCalledWith(false);
  });

  it('refreshes every batch in progress at once', async () => {
    const { jobs, user } = setup();
    await user.click(screen.getByRole('button', { name: EN.refreshAll }));
    expect(jobs.refresh).toHaveBeenCalledWith();
  });

  it('sends from the form and returns to the list, which says the job is there', async () => {
    const { jobs, user } = setup();
    await user.click(screen.getByRole('button', { name: EN.start }));
    const form = screen.getByRole('dialog', { name: EN.formTitle });
    expect(within(form).getByRole('textbox', { name: EN.form.request })).toHaveValue(
      'Translate every page',
    );
    await user.click(within(form).getByRole('button', { name: EN.form.submit }));
    expect(jobs.submit).toHaveBeenCalledWith(
      'Translate every page',
      jobs.pages.map((page) => page.id),
    );
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: EN.title })).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(EN.form.submitted);
  });

  it('stays on the form when the send fails, and Back returns to the list', async () => {
    const { user } = setup(
      { submit: vi.fn(() => Promise.resolve(false)), submitError: 'Status 502.' },
      { start: 'new' },
    );
    await user.click(screen.getByRole('button', { name: EN.form.submit }));
    expect(screen.getByRole('dialog', { name: EN.formTitle })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Status 502.');
    await user.click(screen.getByRole('button', { name: EN.form.back }));
    expect(screen.getByRole('dialog', { name: EN.title })).toBeInTheDocument();
  });

  it('closes for Retry live, so the run is seen, and focus returns to the button', async () => {
    const { jobs, user } = setup();
    await user.click(screen.getByRole('button', { name: EN.outcome.retryLiveLabel('Contact') }));
    expect(jobs.retryLive).toHaveBeenCalledWith('job-applied', 'contact');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveFocus();
  });

  it('lets Esc close a Remove confirm without closing the window', async () => {
    const { user } = setup({ jobs: [JOB_READY] });
    await user.click(screen.getByRole('button', { name: EN.row.removeLabel(JOB_READY.request) }));
    expect(screen.getByRole('group', { name: EN.row.removeMessage })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: EN.row.removeMessage })).toBeNull();
    expect(screen.getByRole('dialog', { name: EN.title })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('says when there is no server, nothing yet, or the list is being read', () => {
    const offline = setup({ connected: false, jobs: [] });
    expect(screen.getByText(EN.noServer)).toBeInTheDocument();
    expect(screen.getByText(EN.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: EN.refreshAll })).toBeNull();
    offline.view.unmount();
    setup({ jobs: undefined });
    expect(screen.getByText(EN.loading)).toBeInTheDocument();
  });

  it('speaks Arabic, right to left', () => {
    setup({ jobs: SAMPLE_JOBS_AR, pages: SAMPLE_PAGES_AR }, { locale: 'ar' });
    const words = jobsLabels('ar');
    const dialog = screen.getByRole('dialog', { name: words.title });
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(dialog).toHaveAttribute('lang', 'ar');
    expect(within(dialog).getByRole('button', { name: words.start })).toBeInTheDocument();
  });

  it('styles with logical properties and builder tokens only', () => {
    expect(CSS).not.toMatch(/\b(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/\b(?:left|right|top|bottom):/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
  });
});
