import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import { createScriptedSiteStageProvider } from '../testing/scripted-stage-provider';
import { generateSite, type GeneratedSite } from './generate-site';
import { createOfflineSiteStageProvider } from './offline/offline-stage-provider';
import type { SiteStageProvider } from './stage-provider';
import { StageRejectedError } from './stages/errors';
import { SITE_STAGES, type StageLimits, type StageRequest } from './wire';

/**
 * SC-013 and FR-024: the same brief and the same seed produce the same site.
 *
 * ## What determinism buys, and why it is a property rather than an example
 *
 * A site build is minutes long across five calls, and a person will reload the
 * page, lose a connection, or stop and start it again. Every one of those is
 * only recoverable if asking the same question twice gets the same answer —
 * otherwise a resumed run is a DIFFERENT site than the one it is resuming, and
 * the half already written belongs to a design that no longer exists.
 *
 * An example test would pin one brief. The interesting failures are the ones
 * that appear on the second brief, or the fourth page, or when the content pool
 * happens to finish out of order — so the domain is generated.
 *
 * ## The thousand, measured rather than assumed
 *
 * Each case runs the whole five-stage pipeline twice, so the first draft of this
 * file used three hundred and wrote a paragraph justifying the reduction. Then
 * it was timed: nine hundred cases took 396ms, because the offline provider is
 * arithmetic and the orchestrator is `await`s over resolved promises. The
 * justification was for a cost that does not exist, so the count went to the
 * thousand the rest of this repository's laws use.
 */

const RUNS = 1000;
const SEEDS = {
  determinism: 0x513_3001,
  envelope: 0x513_3002,
  resumable: 0x513_3003,
} as const;

const BLOCK_TYPES = ['hero', 'text', 'pricing'];
const COMMANDS = ['addPage', 'insertNode', 'setProp', 'setDesignSystem'];

/*
  Real briefs, not random noise. A generated string would exercise the
  orchestrator just as well and would also, occasionally, contain a word the
  content validator refuses — so the test would flake on a property it is not
  about. These are the briefs a person actually types, in both languages the
  product serves.
*/
const BRIEFS = [
  'a ceramics studio in Amman',
  'مشغل خزف في عمّان',
  'a two-person law firm that only does housing',
  'مكتب محاماة صغير متخصص في قضايا السكن',
  'a bakery that opens at four in the morning',
  'مخبز يفتح الرابعة فجرًا',
  'freelance structural engineer, bridges',
] as const;

const briefs = fc.constantFrom(...BRIEFS);
const seeds = fc.string({ minLength: 1, maxLength: 12 });
const directions = fc.constantFrom('ltr' as const, 'rtl' as const);
const limits: fc.Arbitrary<StageLimits> = fc.record({
  maxPages: fc.integer({ min: 1, max: 4 }),
  maxSectionsPerPage: fc.integer({ min: 1, max: 3 }),
  maxTokens: fc.constant(20_000),
});

interface Case {
  brief: string;
  seed: string;
  dir: 'ltr' | 'rtl';
  limits: StageLimits;
  contentConcurrency: number;
}

const cases: fc.Arbitrary<Case> = fc.record({
  brief: briefs,
  seed: seeds,
  dir: directions,
  limits,
  /* The pool width is generated too: a site is deterministic or it is not, and
     "deterministic at concurrency 1" would be a much smaller claim. */
  contentConcurrency: fc.integer({ min: 1, max: 4 }),
});

function build(input: Case, provider = createOfflineSiteStageProvider()): Promise<GeneratedSite> {
  return generateSite({
    runId: 'run-1',
    brief: input.brief,
    provider,
    seed: input.seed,
    baseFingerprint: 'site-v1-sha256-abc',
    dir: input.dir,
    limits: input.limits,
    blockTypes: BLOCK_TYPES,
    allowedCommands: COMMANDS,
    contentConcurrency: input.contentConcurrency,
  });
}

/** Everything a caller can observe, in one string, so "identical" means it. */
const shapeOf = (site: GeneratedSite): string =>
  JSON.stringify({
    pages: site.pages,
    structure: site.structure,
    content: site.content,
    designSystem: site.designSystem,
    commands: site.commands,
  });

describe('the site is deterministic (SC-013, FR-024)', () => {
  it(`the same brief and seed produce the same site, whatever the pool width (${String(RUNS)} cases, seed ${String(SEEDS.determinism)})`, async () => {
    await fc.assert(
      fc.asyncProperty(cases, async (input) => {
        const first = await build(input);
        const second = await build(input);

        expect(shapeOf(second)).toBe(shapeOf(first));
        /*
          Non-vacuity. Two empty sites are also identical, and a `generateSite`
          that returned nothing would pass the line above forever.
        */
        expect(first.pages.length).toBeGreaterThan(0);
        expect(first.commands.length).toBeGreaterThan(0);
        expect(first.content.map((entry) => entry.pageId)).toEqual(
          first.pages.map((page) => page.id),
        );
      }),
      { numRuns: RUNS, seed: SEEDS.determinism },
    );
  }, 60_000);

  it(`carries ONE seed on every envelope of every stage (${String(RUNS)} cases, seed ${String(SEEDS.envelope)})`, async () => {
    await fc.assert(
      fc.asyncProperty(cases, async (input) => {
        const provider = createScriptedSiteStageProvider({
          /*
            One stage fails once, so the RETRY's envelope is measured too. A
            repair that asked with a fresh seed would be asking a different
            question — the answer could not be compared with the one it repairs.
          */
          stages: {
            sitemap: {
              failFirst: 1,
              error: () => new StageRejectedError('sitemap', ['It named no pages at all.'], true),
            },
          },
          fallback: createOfflineSiteStageProvider(),
        });
        const spy = vi.spyOn(provider, 'run');
        await build(input, provider);

        const envelopes = spy.mock.calls.map((call) => call[0] as StageRequest);
        expect(envelopes.length).toBeGreaterThan(SITE_STAGES.length);
        for (const envelope of envelopes) {
          expect(envelope.seed).toBe(input.seed);
          expect(envelope.baseFingerprint).toBe('site-v1-sha256-abc');
          expect(envelope.dir).toBe(input.dir);
          expect(envelope.limits).toEqual(input.limits);
          expect(envelope.stageId).toBe(`run-1/${envelope.stage}`);
        }
      }),
      { numRuns: RUNS, seed: SEEDS.envelope },
    );
  }, 60_000);

  it(`every stage re-asked ALONE with its own envelope gives the same answer (${String(RUNS)} cases, seed ${String(SEEDS.resumable)})`, async () => {
    await fc.assert(
      fc.asyncProperty(cases, async (input) => {
        const provider = createOfflineSiteStageProvider();
        const asked: { request: StageRequest; answer: unknown }[] = [];
        const recording: SiteStageProvider = {
          async run(request, options) {
            const answer = await provider.run(request, options);
            asked.push({ request, answer });
            return answer;
          },
        };

        await build(input, recording);
        /* Four fixed stages plus one content call per page — never fewer. */
        expect(asked.length).toBeGreaterThanOrEqual(SITE_STAGES.length);

        /*
          THE RESUMABILITY CLAIM, made concrete. Every envelope is a complete
          question: replaying one alone — after a reload, on another machine, in
          this test — must produce the answer the run already has. A stage that
          depended on server-side session state would fail here, and a pipeline
          whose stages could not be replayed alone could not be resumed at all.
        */
        for (const { request, answer } of asked) {
          const again: unknown = await provider.run(request);
          expect(JSON.stringify(again)).toBe(JSON.stringify(answer));
        }
      }),
      { numRuns: RUNS, seed: SEEDS.resumable },
    );
  }, 60_000);
});
