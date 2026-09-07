import { describe, expect, it } from 'vitest';

import { defaultDesignSystem, validateDesignSystem } from '@craftkit/builder-schema';

import { generateSite } from '../generate-site';
import { createOfflineSiteStageProvider } from '../offline/offline-stage-provider';
import { StageRejectedError } from './errors';
import { validateStageDesignSystem } from './design-system';
import type { DesignSystemResponse, StageLimits } from '../wire';

const LIMITS: StageLimits = { maxPages: 3, maxSectionsPerPage: 3, maxTokens: 20_000 };

const answer = (designSystem: unknown): DesignSystemResponse =>
  ({ stage: 'design-system', designSystem }) as DesignSystemResponse;

const refusal = (response: unknown): readonly string[] => {
  try {
    validateStageDesignSystem(response as DesignSystemResponse);
  } catch (error: unknown) {
    if (error instanceof StageRejectedError) return error.reasons;
    throw error;
  }
  throw new Error('the design-system validator accepted a system it should have refused');
};

describe('what the design-system stage must produce', () => {
  it('accepts a complete, legible system', () => {
    expect(validateStageDesignSystem(answer(defaultDesignSystem())).name).toBe(
      defaultDesignSystem().name,
    );
  });

  it('refuses an answer that is not shaped like one, by shape and not by TypeError', () => {
    expect(refusal(null).join(' ')).toContain('must be an object');
    expect(refusal({ stage: 'design-system' }).join(' ').length).toBeGreaterThan(0);
  });

  it('refuses a system with a token the vocabulary does not have', () => {
    const base = defaultDesignSystem();
    expect(
      refusal(answer({ ...base, tokens: { ...base.tokens, notAToken: '#fff' } })).length,
    ).toBeGreaterThan(0);
  });

  it('delegates legibility to the schema, rather than answering it twice', () => {
    const base = defaultDesignSystem();
    const unreadable = { ...base, tokens: { ...base.tokens, text: base.tokens.surface } };
    /*
      The reason this file does not compute a contrast ratio: `validateDesignSystem`
      owns the thresholds and the fail-closed behaviour on a colour it cannot
      parse. A second opinion here would be a second answer to one question, and
      the day the two disagreed the pipeline would ship a palette the theme
      refuses.
    */
    expect(refusal(answer(unreadable)).length).toBeGreaterThan(0);
    expect(validateDesignSystem(unreadable).ok).toBe(false);
  });
});

/**
 * FR-013: replacing the design system leaves page structure and copy unchanged.
 *
 * The claim is about SEPARATION, and the way to test a separation is to change
 * one side and measure the other. Two runs of the same brief and seed differ in
 * nothing but their palette, so anything that moved in the pages moved because
 * the palette did — which is exactly the failure the criterion exists to catch.
 */
describe('the design system is replaceable (FR-013)', () => {
  const build = (designSystem: unknown) =>
    generateSite({
      runId: 'run-1',
      brief: 'a ceramics studio in Amman',
      provider: {
        async run(request, options) {
          const offline = createOfflineSiteStageProvider();
          if (request.stage !== 'design-system') return offline.run(request, options);
          return { stage: 'design-system', designSystem } as never;
        },
      },
      seed: 'seed-1',
      baseFingerprint: 'site-v1-sha256-abc',
      dir: 'ltr',
      limits: LIMITS,
      blockTypes: ['section', 'text'],
      allowedCommands: ['addPage', 'insertNode', 'setDesignSystem'],
    });

  it('changes the palette and NOTHING about the pages', async () => {
    const base = defaultDesignSystem();
    const first = await build(base);
    const second = await build({
      ...base,
      name: 'Warm Clinical',
      tokens: { ...base.tokens, accent: '#0b5cff' },
    });

    expect(second.designSystem.tokens.accent).toBe('#0b5cff');
    expect(second.designSystem.name).toBe('Warm Clinical');

    /* The structure, the words, and the page set: byte-identical. */
    expect(JSON.stringify(second.pages)).toBe(JSON.stringify(first.pages));
    expect(JSON.stringify(second.structure)).toBe(JSON.stringify(first.structure));
    expect(JSON.stringify(second.content)).toBe(JSON.stringify(first.content));

    /* Non-vacuity: there was something to be unchanged. */
    expect(first.pages.length).toBeGreaterThan(1);
    expect(first.content.flatMap((page) => page.sections).length).toBeGreaterThan(1);
  });

  it('reaches the site through ONE command, not through every section', async () => {
    const base = defaultDesignSystem();
    const site = await build(base);
    const designCommands = site.commands.filter((command) => command.command === 'setDesignSystem');

    /*
      One command for the whole palette. A pipeline that wrote colours into
      sections would need one per section — and a re-theme would then be N
      writes and N undo steps instead of one.
    */
    expect(designCommands).toHaveLength(1);
    expect(JSON.stringify(site.commands.filter((c) => c.command === 'insertNode'))).not.toContain(
      '#',
    );
  });
});
