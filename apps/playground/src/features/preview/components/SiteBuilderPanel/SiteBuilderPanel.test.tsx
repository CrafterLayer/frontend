import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createOfflineSiteStageProvider,
  createSiteBuilder,
  defaultDesignSystem,
  defineBlockSchema,
  emptyDocument,
  type BuilderSite,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { createScriptedSiteStageProvider, fixedClock, seededIds } from '@craftkit/builder/testing';
import { z } from 'zod';

import type { SiteRunHost } from '../AssistantPanel/AssistantPanel.siteRun';
import type { SiteRunSeam } from '../AssistantPanel/use-site-run';
import { SiteBuilderPanel } from './SiteBuilderPanel';

const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['section', 'text'], max: 6 } },
  examples: [],
});
const section = defineBlockSchema({
  type: 'section',
  description: 'A section.',
  props: z.object({ heading: z.string().default('Heading'), content: z.string().default('') }),
  examples: [],
});
const text = defineBlockSchema({
  type: 'text',
  description: 'Text.',
  props: z.object({ heading: z.string().default(''), content: z.string().default('') }),
  examples: [],
});
const Null = () => null;
const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'site-builder.vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: Null },
      { schema: section, render: Null },
      { schema: text, render: Null },
    ],
  },
};

/**
 * The panel's real lease, in the smallest form that keeps its one promise: a
 * second run cannot start while the first owns it.
 */
function realSeam(): SiteRunSeam & { held: () => boolean } {
  let held: { runId: string; controller: AbortController } | null = null;
  return {
    get busy() {
      return held !== null;
    },
    claim: (runId, controller) => {
      if (held !== null) return false;
      held = { runId, controller };
      return true;
    },
    release: (runId) => {
      if (held?.runId === runId) held = null;
    },
    stop: () => {
      held?.controller.abort();
    },
    held: () => held !== null,
  };
}

let seam = realSeam();

function renderBuilder(host: SiteRunHost | undefined) {
  seam = realSeam();
  const user = userEvent.setup();
  render(
    <SiteBuilderPanel
      site={host}
      seam={seam}
      onStop={() => {
        seam.stop();
      }}
      locale="en"
    />,
  );
  return user;
}

describe('the staged site flow', () => {
  const oneHomePage = (): BuilderSite => ({
    siteVersion: 1,
    dir: 'ltr',
    pages: [
      {
        id: 'p-home',
        address: '/',
        title: 'Home',
        purpose: 'The page that was already here.',
        audience: 'anyone',
        document: emptyDocument('site', 'ltr'),
        regions: [],
      },
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  });

  const siteKernelWith = (site: BuilderSite, seed: string) =>
    createSiteBuilder({
      site,
      extensions: [vocabulary],
      ports: { clock: fixedClock(), ids: seededIds(seed) },
    });

  /**
   * Let a React ACTION settle.
   *
   * A React ACTION does not settle while Testing Library is waiting for it.
   * RTL wraps every async utility in `act`, and inside `act` the transition is
   * deferred — so `findByText` and `waitFor` poll for their full second and
   * never see the update, while an ordinary `setTimeout` outside act shows it.
   * Both were measured here before this helper existed: `waitFor` failed on
   * the same assertion a bare 50ms sleep passed.
   *
   * So this is `waitFor` with the wrapper taken off: the same retry loop, on a
   * plain timer. A fixed sleep would have been the other option and it would
   * have been a flake waiting to happen.
   */
  const settle = async (until: () => void): Promise<void> => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        until();
        return;
      } catch {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      }
    }
    /* One last unguarded call, so the failure is the real assertion's. */
    until();
  };

  function siteHost(over: Partial<SiteRunHost> = {}) {
    const kernel = siteKernelWith(oneHomePage(), 'live');
    let drafts = 0;
    const host: SiteRunHost = {
      kernel,
      createDraft: (site) => {
        drafts += 1;
        return siteKernelWith(site, `draft-${String(drafts)}`);
      },
      provider: createOfflineSiteStageProvider(),
      ...over,
    };
    return { host, kernel };
  }

  it('offers no brief at all when the host wired no site', () => {
    renderBuilder(undefined);
    expect(screen.queryByLabelText(/Describe the site you want|صف الموقع/u)).toBeNull();
  });

  it('turns one sentence into a multi-page site, in ONE undo', async () => {
    const { host, kernel } = siteHost();
    const user = renderBuilder(host);
    const captured = JSON.stringify(kernel.getSite());

    await user.type(
      screen.getByLabelText('Describe the site you want'),
      'a ceramics studio in Amman',
    );
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    await waitFor(() => {
      expect(kernel.getSite().pages.length).toBeGreaterThan(1);
    });
    /*
      The checkpoint sentence, measured: a brief produced a complete, VALID,
      multi-page site — and the whole of it is one entry in history.
    */
    expect(kernel.validate().ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(await screen.findByText(/pages, in one undo/u)).toBeVisible();

    act(() => {
      expect(kernel.undo()).toBe(true);
    });
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
  });

  it('shows the five named stages while it runs, with Stop reachable', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { host, kernel } = siteHost({
      provider: {
        async run(request, options) {
          if (request.stage === 'content') await held;
          return createOfflineSiteStageProvider().run(request, options);
        },
      },
    });
    const user = renderBuilder(host);

    await user.type(
      screen.getByLabelText('Describe the site you want'),
      'a ceramics studio in Amman',
    );
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    try {
      /*
        Polled on "Content", never on "Plan": the composer's mode row carries a
        button reading Plan, so polling for that word succeeded instantly on
        the wrong element and the assertion after it then failed against a card
        that had not rendered yet.
      */
      await settle(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });
      /* The card names what it is waiting for, rather than spinning anonymously. */
      expect(screen.getByText('Structure')).toBeVisible();
      expect(screen.getByText('Apply')).toBeVisible();
      /*
        The CARD's own cancel, scoped: the composer's send slot is also a Stop
        while a run owns the panel, so an unscoped query matched both and said
        so. Two ways to stop one run is correct; a test that cannot tell them
        apart is not.
      */
      const card = screen.getByRole('region', { name: 'Building the site' });
      expect(within(card).getByRole('button', { name: /cancel|stop/iu })).toBeEnabled();
      expect(kernel.transactions()).toHaveLength(0);
    } finally {
      /*
        Released even when an assertion above threw. A held promise that
        outlives its own test leaves the panel busy for every test after it,
        and the failure then names the wrong one.
      */
      release?.();
    }

    await settle(() => {
      expect(kernel.transactions()).toHaveLength(1);
    });
  });

  it('leaves the site byte-identical when a stage is refused, and says why', async () => {
    const { host, kernel } = siteHost({
      provider: createScriptedSiteStageProvider({
        stages: {
          structure: {
            failFirst: Infinity,
            error: () => new Error('the structure stage would not answer'),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      }),
    });
    const captured = JSON.stringify(kernel.getSite());
    const user = renderBuilder(host);

    await user.type(screen.getByLabelText('Describe the site you want'), 'a ceramics studio');
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    await settle(() => {
      expect(screen.getByText(/would not answer/u)).toBeVisible();
    });
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
    expect(kernel.transactions()).toHaveLength(0);
    /* And the form comes back, with the failure beside it rather than instead of it. */
    expect(screen.getByLabelText('Describe the site you want')).toBeEnabled();
  });
});
