import type { NodeId, RunAiAgentOptions } from '@craftkit/builder';

/**
 * What kind of provider is answering — DECLARED by whoever wired it, never
 * inferred from the fact that one was passed.
 *
 * The first version of this file inferred `remote` from `planProvider !==
 * undefined`. Every Storybook provider that wraps `createLocalAiPlanProvider()`
 * — to fail once and then succeed, to answer late, to ignore abort — was then
 * handed an `index` catalog, and the offline provider inside it, which plans
 * by scoring schemas and examples, had nothing to score. Two stories failed in
 * Chromium with "no Apply button", because nothing had been proposed. The
 * presence of a provider says nothing about what that provider needs; only the
 * module that constructed it knows, so it says so.
 */
export type ProviderKind = 'offline' | 'remote';

/**
 * How much catalog a run sends, decided by the KIND of provider answering.
 *
 * The two kinds want opposite things, and the reason is structural rather
 * than a matter of taste:
 *
 * - **`offline`** — `createLocalAiPlanProvider()` and anything wrapping it —
 *   works by scoring a request against every block's prop names, examples, and
 *   slot table. Take those away and it has nothing to score: it cannot name a
 *   legal parent, cannot fill props, and correctly proposes nothing. It needs
 *   `full`.
 *
 * - **`remote`** — a model behind `createRemoteAiPlanProvider()` — reads
 *   descriptions, chooses a type, and reaches for `customCode` when nothing
 *   fits. It needs the NAMES, and the ~58,000 tokens of schemas it did not ask
 *   for are pure cost: 94% of a request, and more than the budget allows.
 *
 * ## Why the offline path also raises the budget
 *
 * On this registry the full catalog no longer fits: 55 blocks serialize to
 * ~63,800 tokens against `DEFAULT_AI_CONTEXT_TOKEN_BUDGET` of 64,000, so a
 * dozen short follow-ups push the offline provider into `AiContextBudgetError`
 * mid-conversation.
 *
 * Raising the ceiling for that path only is not papering over the limit — it
 * is making explicit an assumption the library cannot see. The budget bounds
 * what crosses a NETWORK to a provider that bills for it. The offline provider
 * is a function call in this process: nothing is transmitted, nothing is
 * billed, and the same number is guarding nothing. The remote path keeps the
 * default, where it means what it says.
 *
 * The host's own `policy` always wins over anything set here.
 */
export function catalogPolicyFor(
  kind: ProviderKind,
  selection: readonly NodeId[],
  hostPolicy?: RunAiAgentOptions['policy'],
): Pick<RunAiAgentOptions, 'composition' | 'policy'> {
  const withHostPolicy = (
    own: RunAiAgentOptions['policy'],
  ): Pick<RunAiAgentOptions, 'policy'> => {
    const merged = { ...own, ...hostPolicy };
    return Object.keys(merged).length === 0 ? {} : { policy: merged };
  };

  if (kind === 'offline') {
    return {
      composition: { catalogMode: 'full' },
      // Headroom for the registry to keep growing on a path that transmits nothing.
      ...withHostPolicy({ maxContextTokens: 256_000 }),
    };
  }
  /*
    NO catalog. The model is given what the person wants from the site and the
    escape hatch to build it with — elements, the utility vocabulary, scoped
    CSS — and nothing else. A registered block reaches the model only when the
    person puts it in the request: selecting it or @-mentioning it lands it in
    `selection`, and generate-plan turns that selection into `scopedBlockTypes`,
    so exactly those blocks arrive with their schemas and become referenceable.

    `'index'` (every block's name and description, ~2,600 tokens) remains one
    value away for a host that wants the model to browse the catalog instead.
  */
  void selection;
  return {
    composition: { catalogMode: 'none' },
    ...withHostPolicy({}),
  };
}
