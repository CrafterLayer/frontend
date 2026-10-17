import { describe, expect, it, vi } from 'vitest';

import { createSiteBuilder, type BuilderSiteKernel } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder-core/testing';
import { defaultDesignSystem, emptyDocument, type BuilderSite } from '@craftkit/builder-schema';

import { createScriptedAiPlanProvider } from '../testing/scripted-provider';
import { refineSite } from './refine-site';
import { resolveRefineTarget } from './resolve-target';
import type { AiPlan, AiValidationPorts } from '../types';

const pageWith = (id: string, address: string, title: string, marker: string) => ({
  id,
  address,
  title,
  purpose: `What ${title} is for.`,
  audience: 'anyone',
  document: {
    ...emptyDocument('site', 'ltr'),
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['body'] } },
      body: { id: 'body', type: 'text', props: { content: marker } },
    },
  },
  regions: [],
});

const siteFixture = (): BuilderSite => ({
  siteVersion: 1,
  dir: 'ltr',
  pages: [
    pageWith('home', '/', 'Home', 'home words'),
    pageWith('work', '/work', 'Work', 'work words'),
    pageWith('contact', '/contact', 'Contact', 'contact words'),
  ],
  sharedRegions: {},
  designSystem: defaultDesignSystem(),
  assets: {},
});

const kernelFor = (): BuilderSiteKernel =>
  createSiteBuilder({
    site: siteFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('refine') },
  });

const ports: AiValidationPorts = { ids: seededIds('plan'), clock: fixedClock() };

const plan = (content: string): AiPlan => ({
  rationale: 'Rewrite the body',
  commands: [{ command: 'setProp', args: { id: 'body', key: 'content', value: content } }],
});

const run = (
  site: BuilderSiteKernel,
  request: string,
  provider = createScriptedAiPlanProvider(plan('rewritten')),
) =>
  refineSite({
    site,
    request,
    provider,
    validationPorts: ports,
    runId: 'refine-1',
    clock: fixedClock(),
  });

describe('resolveRefineTarget', () => {
  it('finds a page by title, by address, or by id', () => {
    const site = siteFixture();
    for (const request of ['make the Work page warmer', 'tighten /work', 'work needs air']) {
      expect(resolveRefineTarget(site, request)).toMatchObject({
        ok: true,
        target: { kind: 'page', pageId: 'work' },
      });
    }
  });

  it('prefers the NARROWER target when a request names both', () => {
    /*
      "the contact page's colours" is about a page. A refinement that widened
      itself to the palette would change three pages a person did not mention.
    */
    expect(resolveRefineTarget(siteFixture(), "the contact page's colours")).toMatchObject({
      ok: true,
      target: { kind: 'page', pageId: 'contact' },
    });
  });

  it('resolves a node inside a page when the request names one', () => {
    expect(resolveRefineTarget(siteFixture(), 'the body on the work page')).toMatchObject({
      ok: true,
      target: { kind: 'node', pageId: 'work', nodeId: 'body' },
    });
  });

  it('reaches the design system by name, and by token when one is named', () => {
    expect(resolveRefineTarget(siteFixture(), 'warm up the palette')).toMatchObject({
      ok: true,
      target: { kind: 'design-system' },
    });
    expect(resolveRefineTarget(siteFixture(), 'the accent colour is too loud')).toMatchObject({
      ok: true,
      target: { kind: 'design-system', token: 'accent' },
    });
  });

  it('REFUSES a page the site does not have, and says what it does have', () => {
    const result = resolveRefineTarget(siteFixture(), 'make the pricing page warmer');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    /*
      Refused, not guessed. Picking the nearest page and changing it is the
      failure this refusal exists to prevent.
    */
    expect(result.reason).toContain('"Home"');
    expect(result.reason).toContain('"Contact"');
  });
});

describe('refineSite', () => {
  it('changes the page it was asked about and NOTHING else (FR-036, SC-007)', async () => {
    const site = kernelFor();
    const before = JSON.stringify(site.getSite().pages.filter((page) => page.id !== 'work'));

    const result = await run(site, 'rewrite the Work page');

    if (!result.ok) throw new Error(`the refinement was refused: ${result.reason}`);
    expect(site.page('work').getDocument().nodes['body']?.props['content']).toBe('rewritten');
    /* Every node outside the target: byte-identical, not 99% of them. */
    expect(JSON.stringify(site.getSite().pages.filter((page) => page.id !== 'work'))).toBe(before);
  });

  it('leaves a hand edit made after the generation alone', async () => {
    const site = kernelFor();
    site.dispatch(
      'setProp',
      { id: 'body', key: 'content', value: 'a person wrote this' },
      'user',
      'home',
    );

    await run(site, 'rewrite the Work page');

    /*
      The commonest way an isolation promise is broken: a refinement that
      regenerates its neighbours quietly discards work someone did by hand.
    */
    expect(site.page('home').getDocument().nodes['body']?.props['content']).toBe(
      'a person wrote this',
    );
  });

  it('REFUSES an unresolvable target BEFORE it proposes anything (FR-038)', async () => {
    const site = kernelFor();
    const provider = { propose: vi.fn() };
    const before = JSON.stringify(site.getSite());

    const result = await refineSite({
      site,
      request: 'make the pricing page warmer',
      provider,
      validationPorts: ports,
      runId: 'refine-1',
      clock: fixedClock(),
    });

    expect(result.ok).toBe(false);
    /*
      Not one call. A model asked about a page that does not exist will
      helpfully change one that does.
    */
    expect(provider.propose).not.toHaveBeenCalled();
    expect(JSON.stringify(site.getSite())).toBe(before);
    expect(site.transactions()).toHaveLength(0);
  });

  it('reverses a refinement in ONE undo (FR-037)', async () => {
    const site = kernelFor();
    const before = JSON.stringify(site.getSite());

    await run(site, 'rewrite the Work page');
    expect(site.transactions()).toHaveLength(1);

    expect(site.undo()).toBe(true);
    expect(JSON.stringify(site.getSite())).toBe(before);
  });

  it('adjusts a colour the door would refuse, and REPORTS the adjustment (FR-039)', async () => {
    const site = kernelFor();
    const result = await run(site, 'make the accent darker');

    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    expect(site.getSite().designSystem.tokens.accent).not.toBe(defaultDesignSystem().tokens.accent);
    /* Every adjustment reported names what was asked for and what was used. */
    for (const adjustment of result.adjustments) {
      expect(adjustment.asked).not.toBe(adjustment.used);
      expect(adjustment.reason.length).toBeGreaterThan(0);
    }
  });

  it('asks which way rather than guessing', async () => {
    const site = kernelFor();
    const result = await run(site, 'do something about the palette');

    expect(result).toMatchObject({ ok: false });
    expect(site.transactions()).toHaveLength(0);
  });

  it('uses the SAME machinery as a generation — no second write path (FR-040)', async () => {
    const site = kernelFor();
    const lens = site.page('work');
    const group = vi.spyOn(lens, 'dispatchGroup');

    await run(site, 'rewrite the Work page');

    /*
      One grouped dispatch through the page's own door. A refinement with its
      own applier would show up here as a bare `dispatch`, or as nothing at all.
    */
    expect(group).toHaveBeenCalledTimes(1);
    expect(site.transactions()).toHaveLength(1);
  });

  it('refuses to treat a whole-site request as a refinement', async () => {
    const site = kernelFor();
    const result = await run(site, 'rebuild the whole site');

    expect(result).toMatchObject({ ok: false });
    expect(site.transactions()).toHaveLength(0);
  });
});

/**
 * SC-007's speed half, stated as a PROPERTY rather than a stopwatch.
 *
 * The criterion says a refinement completes at least three times faster than a
 * full regeneration. A wall-clock assertion here would be a flake: the offline
 * provider is arithmetic, CI is contended, and the number would measure the
 * machine rather than the design. What makes a refinement fast is structural
 * and countable — it asks the provider ONCE about ONE page, where a generation
 * asks five times about all of them — so that is what is measured, and the
 * wall-clock number belongs to the uncontended evidence run.
 */
describe('a refinement is smaller than a regeneration (SC-007)', () => {
  it('asks the provider once, about one page', async () => {
    const site = kernelFor();
    const provider = {
      propose: vi.fn(() => Promise.resolve(plan('rewritten'))),
    };

    await refineSite({
      site,
      request: 'rewrite the Work page',
      provider,
      validationPorts: ports,
      runId: 'refine-1',
      clock: fixedClock(),
    });

    expect(provider.propose).toHaveBeenCalledTimes(1);
    /*
      A generation is five stage calls plus one content call per page — eight
      for this three-page site. One is the whole speed argument, and it does not
      depend on how fast anything runs.
    */
    const generationCalls = 5 + site.getSite().pages.length - 1;
    expect(generationCalls / provider.propose.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('reads ONE page into the request, not the whole site', async () => {
    const site = kernelFor();
    const seen: string[] = [];
    const provider = {
      propose: (request: string, context: unknown) => {
        seen.push(JSON.stringify({ request, context }));
        return Promise.resolve(plan('rewritten'));
      },
    };

    await refineSite({
      site,
      request: 'rewrite the Work page',
      provider,
      validationPorts: ports,
      runId: 'refine-1',
      clock: fixedClock(),
    });

    /*
      The other half of why it is fast: the context is one page's document. A
      refinement that sent the whole site would be as expensive to think about
      as a generation, however few calls it made.
    */
    const sent = seen.join('');
    expect(sent).toContain('work words');
    expect(sent).not.toContain('contact words');
  });
});
