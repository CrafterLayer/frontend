import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
  assembleAiContext,
  estimateAiPlanWireRequestTokens,
  type AiCatalogMode,
} from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';

/**
 * The cost gate.
 *
 * ## Why this measures the WIRE request and not the context
 *
 * An earlier version of this file measured `assembleAiContext` alone and
 * asserted it under the budget. It passed at 63,782 — and the product still
 * threw `AiContextBudgetError: estimated 64,218, maximum 64,000` on a real
 * request, because the budget is not charged against the context. It is
 * charged against the whole envelope: `assertWireRequestBudget` in
 * generate-plan.ts sizes `{version, request, context, history?, attempt?}`.
 *
 * So the context fitting proves nothing. A gate that measures a different
 * quantity from the one that fails is worse than no gate: it reports safety
 * while the margin is gone.
 *
 * The margin was gone because this work registered a 55th block. That is the
 * ordinary act of authoring the earlier note warned about, and it took eleven
 * days to arrive — which is the argument for measuring the real quantity here.
 */
function measure(mode: AiCatalogMode, request: string, history: readonly string[] = []): number {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  return estimateAiPlanWireRequestTokens({
    version: 1,
    request,
    context: assembleAiContext(kernel.context, { composition: { catalogMode: mode } }),
    ...(history.length === 0
      ? {}
      : { history: history.map((text) => ({ role: 'user' as const, text })) }),
  });
}

/** A request of the size a person actually types. */
const TYPICAL_REQUEST = 'اعمل لي صفحة سيرة ذاتية احترافية بخلفية داكنة وقسم مهارات وتجارب';

describe('AI context cost', () => {
  it('index mode leaves the budget almost entirely to the conversation', () => {
    /*
      ~8,700 today: ~2,600 catalog + ~3,300 document + ~1,000 escape hatch (see
      AiCompositionPolicy.alwaysDetailedBlockTypes) + the request itself.

      The ceiling leaves room for the registry to roughly double, and still
      fails loudly if a mode regression put per-block schemas back.

      2026-10-12: 12,000 → 12,500. Measured 12,243 with the 63rd block (report,
      ~120 tokens of description), the chart's seven added types (+~45) and
      the Table tools' longer description (+~110): registry growth, one
      description line each, not schemas. Per-block schemas would add tens of
      thousands, which this still catches.

      2026-10-13: 12,500 → 13,000. Measured 12,731 with 71 blocks: the eight
      new marketing blocks (beforeAfter, pullQuote, reviewSummary, caseStudy,
      jobsList, downloadList, appDownload, fundraiser) are 1,597 characters of
      index entries (~400 tokens, one description line each). The templates
      added the same day cost nothing here: only those in the page's direction
      are offered (template-context.ts).
    */
    expect(measure('index', TYPICAL_REQUEST)).toBeLessThan(13_000);
  });

  it("none mode — what the playground actually sends — is the document, the escape hatch, and the page's own blocks by name", () => {
    /*
      ~9,000 on the landing fixture: ~3,300 document + ~1,000 escape hatch +
      ~4,500 for the 22 block types already on the page (name, description and
      prop KEYS — no schema, no examples). Measured before that addition the
      mode cost ~4,500 and the first live request ("make the hero title
      bigger") failed: the model invented a `size` prop the door rejected. A
      block that is NOT on the page still reaches the model only when the
      person selects or mentions it. The list is stable across a conversation,
      so the server's cached prefix pays for it once.
    */
    const none = measure('none', TYPICAL_REQUEST);

    expect(none).toBeLessThan(12_000);
    expect(none).toBeLessThan(measure('full', TYPICAL_REQUEST) / 5);
  });

  it('scoped mode stays cheap with a block expanded', () => {
    expect(measure('scoped', TYPICAL_REQUEST)).toBeLessThan(14_000);
  });

  it('index mode survives a long conversation, which full mode has no room for', () => {
    const history = Array.from(
      { length: 20 },
      (_unused, at) => `Turn ${String(at)}: change the hero heading and make the section darker.`,
    );

    expect(measure('index', TYPICAL_REQUEST, history)).toBeLessThan(
      DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
    );
  });

  it('records how little headroom full mode has left: one short follow-up', () => {
    /*
      The number that matters, stated precisely rather than rounded into a
      reassurance.

      A bare request in `full` mode fits — with about 200 tokens to spare
      against a 64,000 budget. That is roughly 800 characters: ONE short
      follow-up turn, and the run throws `AiContextBudgetError` before the
      provider is reached. Which is exactly how this surfaced in the app, on a
      second message rather than a first.

      So the assertion is on the MARGIN, not on the total. A test asserting
      `full < 64_000` passes today and tells the reader the mode is healthy,
      which is the opposite of true.
    */
    const bare = measure('full', TYPICAL_REQUEST);
    const headroom = DEFAULT_AI_CONTEXT_TOKEN_BUDGET - bare;

    expect(headroom).toBeLessThan(2_000);
  });

  it('full mode runs out mid-conversation, which is why it is not the wire default', () => {
    /*
      Measured, not guessed: a bare request in `full` costs 63,799 and each
      short turn adds ~17, so the twelfth follow-up throws
      `AiContextBudgetError` — mid-session, on a page that was working, with no
      warning on the eleventh.

      A ceiling reached by CONVERSING is the worst shape this failure could
      take: it does not reproduce on a fresh chat, so it reads as random.
    */
    const turn = 'اجعل العنوان أكبر وغيّر لون الخلفية للأغمق';
    const twelve = Array.from({ length: 12 }, () => turn);

    expect(measure('full', TYPICAL_REQUEST, twelve)).toBeGreaterThan(
      DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
    );
    // And index mode is nowhere near it, with the same conversation.
    expect(measure('index', TYPICAL_REQUEST, twelve)).toBeLessThan(
      DEFAULT_AI_CONTEXT_TOKEN_BUDGET / 4,
    );
  });

  it('index mode is a large multiple cheaper than full, not a marginal saving', () => {
    expect(measure('full', TYPICAL_REQUEST) / measure('index', TYPICAL_REQUEST)).toBeGreaterThan(5);
  });
});
