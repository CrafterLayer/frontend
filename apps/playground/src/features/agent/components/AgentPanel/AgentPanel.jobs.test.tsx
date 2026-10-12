/**
 * Background jobs, end to end in the panel (2026-10-12): LiveAgentPanel over a real site
 * kernel and the real controller, with the batch client faked (no network).
 *
 * The composer's `/batch <request>` opens the form prefilled → Run in the background → the
 * job is listed In progress → the batch ends → Refresh → Apply results → one page landed,
 * the others say why → Retry live on one of them shows that page and sends the request as
 * the panel's own run. The header's button opens the list, and the `/` list's "Run in the
 * background" opens the form on the words before the slash.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSiteBuilder, type AiPlanProvider, type BuilderSiteKernel } from '@craftkit/builder';
import { fivePageSite, fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';
import { useSyncExternalStore } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createLocalBatchJobStore, type BackgroundJobsHost } from '../../../jobs';
import { t } from '../../copy';
import { jobsLabels } from '../../copy/jobs-labels';
import { knowledgeLabels } from '../../copy/knowledge-labels';
import { createFakeBatchClient, introPlan } from '../../testing/batch-fixtures';
import { memoryStorage } from '../../testing/scripted-engine';

import { LiveAgentPanel } from './LiveAgentPanel';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const EN = jobsLabels('en');
const REQUEST = 'Rewrite the intro in French';
const WAIT = { timeout: 20_000 } as const;

interface PanelHostProps {
  readonly site: BuilderSiteKernel;
  readonly host: BackgroundJobsHost;
  readonly provider: AiPlanProvider;
}

/** The app's wiring: the panel edits whichever page the site has open. */
function PanelHost({ site, host, provider }: PanelHostProps) {
  const open = useSyncExternalStore(
    (listener) => site.subscribe(listener),
    () => site.currentPage(),
  );
  return (
    <LiveAgentPanel
      kernel={site.page(open)}
      locale="en"
      provider={provider}
      storage={memoryStorage()}
      enhancer={null}
      tooltipDelay={0}
      backgroundJobs={host}
    />
  );
}

function setup() {
  const site = createSiteBuilder({
    site: fivePageSite(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('panel-jobs') },
  });
  // The first page's answer is a plan; every other page is declined.
  const fake = createFakeBatchClient((items) =>
    items.map(({ id }, index) =>
      index === 0
        ? { id, outcome: 'plan' as const, plan: introPlan('Bonjour, voici notre travail.') }
        : { id, outcome: 'refusal' as const, message: 'Not on this page.' },
    ),
  );
  const host: BackgroundJobsHost = {
    client: fake.client,
    site,
    store: createLocalBatchJobStore(undefined, 'playground/panel'),
    ids: seededIds('panel-job'),
    clock: { now: () => Date.UTC(2026, 9, 12, 14, 0) },
  };
  const propose = vi.fn<AiPlanProvider['propose']>(() =>
    Promise.resolve(introPlan('Bonjour, la maison.')),
  );
  const provider: AiPlanProvider = { propose };
  render(<PanelHost site={site} host={host} provider={provider} />);
  return { site, fake, propose, user: userEvent.setup({ delay: null }) };
}

// Hidden from the accessibility tree while a modal is open, so it is found either way.
const composer = () => screen.getByRole('combobox', { name: t('en', 'input.aria'), hidden: true });

describe('AgentPanel: background jobs', () => {
  it('runs /batch from the composer to applied pages, then retries one page live', async () => {
    const { site, fake, propose, user } = setup();

    // `/batch <request>` sent: the form opens on the request, the composer empties.
    await user.type(composer(), `/batch ${REQUEST}`);
    await user.keyboard('{Enter}');
    const form = await screen.findByRole('dialog', { name: EN.formTitle });
    expect(within(form).getByRole('textbox', { name: EN.form.request })).toHaveValue(REQUEST);
    expect(composer()).toHaveValue('');
    expect(propose).not.toHaveBeenCalled();

    // Run in the background, on every page: the job is listed, in progress.
    await user.click(within(form).getByRole('button', { name: EN.form.submit }));
    const list = await screen.findByRole('dialog', { name: EN.title }, WAIT);
    const row = await within(list).findByRole('article', { name: REQUEST }, WAIT);
    expect(within(row).getByText(EN.row.phase['in-progress'])).toBeInTheDocument();
    expect(fake.sent[0]?.items).toHaveLength(5);
    expect(within(list).getByRole('status')).toHaveTextContent(EN.form.submitted);

    // The batch ends; Refresh finds it ready, and Apply lands it.
    fake.end();
    await user.click(within(row).getByRole('button', { name: EN.row.refresh(REQUEST) }));
    await within(row).findByText(EN.row.phase.ready, {}, WAIT);
    await user.click(within(row).getByRole('button', { name: EN.row.apply }));
    // Applied: the results open by themselves (four pages may be retried live).
    await within(row).findByText(EN.row.summary(1, 5), {}, WAIT);
    expect(within(row).getAllByText(EN.row.phase.applied).length).toBeGreaterThan(0);
    expect(site.page('work').getDocument().nodes['intro']?.props['content']).toBe(
      'Bonjour, voici notre travail.',
    );
    expect(site.transactions()).toHaveLength(1);

    // Retry live on a declined page: the window closes, the page shows, the panel runs it.
    await user.click(within(row).getByRole('button', { name: EN.outcome.retryLiveLabel('Home') }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(site.currentPage()).toBe('home');
    await waitFor(() => {
      expect(propose).toHaveBeenCalled();
    }, WAIT);
    expect(propose.mock.calls[0]?.[0]).toContain(REQUEST);
    expect(fake.sent).toHaveLength(1);
  }, 30_000);

  it('opens the list from the header, and the form from the / list on the words before it', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: EN.title });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(button);
    const list = await screen.findByRole('dialog', { name: EN.title });
    expect(within(list).getByText(EN.empty)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(button).toHaveFocus();

    await user.type(composer(), 'Shorter headings /back');
    const option = await screen.findByRole('option', {
      name: new RegExp(knowledgeLabels('en').slash.commands.batch.name, 'u'),
    });
    expect(option).toBeInTheDocument();
    await user.keyboard('{Enter}');
    const form = await screen.findByRole('dialog', { name: EN.formTitle });
    expect(within(form).getByRole('textbox', { name: EN.form.request })).toHaveValue(
      'Shorter headings',
    );
  }, 30_000);
});
