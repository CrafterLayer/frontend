import {
  createSiteBuilder,
  defaultDesignSystem,
  emptyDocument,
  type BuilderSite,
  type BuilderSiteKernel,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { commitSite } from './commit-site';
import { fingerprintSite } from './drafts';

const LABEL = 'AI: a ceramics studio (3 pages)';

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

const kernelWith = (site: BuilderSite, seed: string): BuilderSiteKernel =>
  createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

/** A draft built by editing a copy of the live site, the way a run does. */
function draftOf(live: BuilderSiteKernel, edit: (draft: BuilderSiteKernel) => void): BuilderSite {
  const draft = kernelWith(live.getSite(), 'draft');
  edit(draft);
  return draft.getSite();
}

function setup() {
  const live = kernelWith(oneHomePage(), 'live');
  return { live, baseFingerprint: fingerprintSite(live.getSite()) };
}

describe('commitSite', () => {
  it('lands a whole generation as ONE transaction, whatever the run did', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('addPage', { address: '/work', title: 'Work' }, 'ai');
      kernel.dispatch('addPage', { address: '/contact', title: 'Contact' }, 'ai');
      kernel.dispatch('renamePage', { pageId: 'p-home', title: 'A ceramics studio' }, 'ai');
    });

    const outcome = commitSite({ live, draft, baseFingerprint, label: LABEL });

    expect(outcome).toMatchObject({ ok: true });
    /*
      Three edits in the draft, one entry in history. A person who does not like
      the result should not press undo three times to find out where it started.
    */
    expect(live.transactions()).toHaveLength(1);
    expect(live.getSite().pages.map((page) => page.address)).toEqual([
      '/',
      '/work',
      '/contact',
    ]);
  });

  it('files the transaction under the agent, with the label it was given', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('addPage', { address: '/work', title: 'Work' }, 'ai');
    });

    commitSite({ live, draft, baseFingerprint, label: LABEL });
    const transaction = live.transactions().at(-1);
    expect(transaction?.author).toBe('ai');
    /* The group's label becomes the transaction's command — what history shows. */
    expect(transaction?.command).toBe(LABEL);
  });

  it('reverses the whole generation in ONE undo', () => {
    const { live, baseFingerprint } = setup();
    const captured = JSON.stringify(live.getSite());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('addPage', { address: '/work', title: 'Work' }, 'ai');
      kernel.dispatch('addPage', { address: '/contact', title: 'Contact' }, 'ai');
    });

    commitSite({ live, draft, baseFingerprint, label: LABEL });
    expect(live.undo()).toBe(true);
    expect(JSON.stringify(live.getSite())).toBe(captured);
  });

  it('refuses with ZERO writes when the site moved while the run was building', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('addPage', { address: '/work', title: 'Work' }, 'ai');
    });

    /*
      A run takes minutes and the person is not required to sit still for them.
      The alternative to refusing is overwriting the page they added in the
      meantime and calling it success.
    */
    live.dispatch('addPage', { address: '/meanwhile', title: 'Meanwhile' }, 'user');
    const captured = JSON.stringify(live.getSite());
    const before = live.transactions().length;

    const outcome = commitSite({ live, draft, baseFingerprint, label: LABEL });

    expect(outcome).toMatchObject({ ok: false, refusal: 'stale' });
    expect(live.transactions()).toHaveLength(before);
    expect(JSON.stringify(live.getSite())).toBe(captured);
  });

  it('refuses a run that changed nothing rather than writing an empty entry', () => {
    const { live, baseFingerprint } = setup();

    const outcome = commitSite({
      live,
      draft: live.getSite(),
      baseFingerprint,
      label: LABEL,
    });

    /*
      A group with no steps would still write a transaction — an entry in
      history, an undo step, a line in the panel — for a run that changed
      nothing. "It did nothing" and "it did nothing but I recorded it anyway"
      are different lies.
    */
    expect(outcome).toMatchObject({ ok: false, refusal: 'unchanged' });
    expect(live.transactions()).toHaveLength(0);
  });

  it('refuses a draft the live registry cannot read back', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('addPage', { address: '/work', title: 'Work' }, 'ai');
    });
    const page = draft.pages.at(-1);
    if (page === undefined) throw new Error('the draft must have gained a page');

    /*
      A block type nobody registered. The codec asks the LIVE registry, so a
      draft built against a different vocabulary is refused here rather than
      landing and breaking the canvas.
    */
    const poisoned: BuilderSite = {
      ...draft,
      pages: draft.pages.map((entry) =>
        entry.id === page.id
          ? {
              ...entry,
              document: {
                ...entry.document,
                nodes: {
                  ...entry.document.nodes,
                  root: { id: 'root', type: 'not-a-registered-block', props: {} },
                },
              },
            }
          : entry,
      ),
    };

    const outcome = commitSite({ live, draft: poisoned, baseFingerprint, label: LABEL });
    expect(outcome).toMatchObject({ ok: false, refusal: 'invalid' });
    expect(live.transactions()).toHaveLength(0);
  });
});
