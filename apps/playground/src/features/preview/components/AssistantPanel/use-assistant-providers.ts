import { useMemo } from 'react';

import {
  createCraftkitAiSkillRegistry,
  createDirectPlanProvider,
  createLocalAiPlanProvider,
  type AiPlanProvider,
  type AiSkillRegistry,
  type BuilderKernel,
} from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import { blocksAtVersion, lastDropped, lastFollowUp } from './AssistantPanel.runs';
import { panelSuggestions } from './AssistantPanel.suggestions';
import type { Turn } from './AssistantPanel.turns';

const DEFAULT_AI_SKILL_REGISTRY = createCraftkitAiSkillRegistry();

export interface AssistantProvidersInputs {
  kernel: BuilderKernel;
  planProvider: AiPlanProvider | undefined;
  skillRegistry: AiSkillRegistry | undefined;
  /** The selected block's type, when one is selected. */
  selectedType: string | undefined;
  turns: readonly Turn[];
  locale: AgentLocale;
}

/**
 * Who answers, with which expertise, and what to offer next: the one skill
 * registry, the wired (or local) provider, the same provider with the catalog
 * in front of it, and the derived suggestion strip.
 */
export function useAssistantProviders({
  kernel,
  planProvider,
  skillRegistry,
  selectedType,
  turns,
  locale,
}: AssistantProvidersInputs) {
  /** The one registry this surface asks — for a run, and for the routing decision. */
  const registry = skillRegistry ?? DEFAULT_AI_SKILL_REGISTRY;

  /**
   * What to offer next, derived and never empty.
   *
   * Recomputed from the catalog, the selection and the last answer's own
   * `followUp`. All three are cheap reads and the strip is small, so it is
   * memoised on what it actually depends on rather than cached across turns:
   * a stale suggestion that no longer matches the selection is worse than no
   * suggestion at all.
   */
  /*
    Keyed on the SCALAR follow-up, not on the whole conversation.

    `turns` changes on every streamed progress tick — a build emits dozens — and
    the derivation walks the entire block registry each time. In the playground
    that is the full marketing catalog, and it was enough to slow a held build
    story past its timeout: work proportional to the catalog, repeated at the
    rate the model narrates.

    The registry's version is a dependency for the opposite reason: the catalog
    is MUTABLE. An extension registered at runtime adds blocks, and without
    reading the version the strip kept offering the old ones until some
    unrelated turn or selection happened to invalidate the memo.
  */
  const catalogVersion = kernel.extensions.version();

  /** Whoever was wired in, or the deterministic local one when nobody was. */
  const resolvedProvider = useMemo(
    () => planProvider ?? createLocalAiPlanProvider(),
    [planProvider],
  );

  /**
   * The same provider with the CATALOG in front of it.
   *
   * Used for one case and one only: the person pressed a suggestion carrying a
   * catalog prompt verbatim. The catalog already holds the node that prompt
   * produces, so there is nothing to guess — asking a model would spend a round
   * trip and tokens to be told a value this build is holding, and might be told
   * something else.
   *
   * TYPED text never reaches this, even when it happens to read the same. A
   * person who wrote "add a hero" in their own words is asking for a hero for
   * THEIR page, and answering with the catalog's demo copy would be a fast
   * wrong answer. Pressing the chip is picking the example by name; typing is
   * not.
   *
   * The plan it returns is an ordinary plan: same door, same proposal, same
   * dispatch. An example that stopped validating is refused exactly as a
   * model's plan would be.
   */
  const catalogFirstProvider = useMemo(
    () =>
      createDirectPlanProvider({
        /*
          The SAME catalog the suggestions were derived from, read at propose
          time so a registered extension is visible immediately. Reading it off
          the assembled context instead would answer a chip on one run and stop
          on the next, because a context carries examples in `full` mode alone.
        */
        catalog: () =>
          blocksAtVersion(kernel, catalogVersion).map(({ schema }) => ({
            type: schema.type,
            examples: schema.examples,
          })),
        fallback: resolvedProvider,
      }),
    [kernel, catalogVersion, resolvedProvider],
  );

  const followUp = lastFollowUp(turns);
  const dropped = lastDropped(turns);
  /*
    The four hardcoded English sentences that used to live here are gone.

    They were wrong three ways at once: English only, in a product whose default
    locale is Arabic; unrelated to the blocks this build actually registered; and
    shown ONLY before the first message, so a person who wrote one thing and
    paused was left with an empty box and a blinking cursor. Suggestions are now
    derived — see `AssistantPanel.suggestions.ts` — and they never run out.
  */
  const suggestions = useMemo(
    () =>
      panelSuggestions({
        /*
          `catalogVersion` is READ here, not merely listed as a dependency. The
          registry is mutable and returns the same object identity after an
          extension is registered, so nothing else in this closure changes when
          the catalog grows — passing the version through the boundary is what
          makes the dependency real rather than a promise to the linter.
        */
        blocks: blocksAtVersion(kernel, catalogVersion),
        selected:
          selectedType === undefined
            ? undefined
            : kernel.context.registry.block(selectedType)?.schema,
        followUp,
        ...(dropped === undefined ? {} : { dropped }),
        locale,
      }),
    [kernel, selectedType, followUp, dropped, catalogVersion, locale],
  );

  return { registry, resolvedProvider, catalogFirstProvider, suggestions };
}
