/*
  The creative domain's two context seams (creative agent, 2026-10-12): the story bible (host
  memory) and the planner's brief. Both are `data` fragments with reviewed provenance — they
  describe the project, they never instruct beyond it or widen any permission.
*/

import type { AiContextProvider } from '@craftkit/builder-schema';

import {
  isCreativeMemoryEmpty,
  readCreativeMemory,
  renderCreativeMemory,
  type CreativeMemoryV1,
} from './creative-memory';
import {
  planCreativeBrief,
  renderCreativeBrief,
  type CreativePlannerOptions,
} from './creative-planner';

export const CREATIVE_MEMORY_PROVIDER_ID = 'host:creative-memory';
export const CREATIVE_BRIEF_PROVIDER_ID = 'craftkit:creative-brief';

export interface CreativeMemoryProviderOptions {
  /** Called for every assembly; the host owns persistence. Anything returned is validated. */
  load: () => unknown;
  title?: string;
}

/** The project's story bible as a context fragment (empty memory → an empty body). */
export function createCreativeMemoryContextProvider(
  options: CreativeMemoryProviderOptions,
): AiContextProvider {
  return {
    id: CREATIVE_MEMORY_PROVIDER_ID,
    collect() {
      const { memory } = readCreativeMemory(options.load());
      return {
        source: CREATIVE_MEMORY_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: options.title ?? 'Story bible: characters, assets and canon',
        body: isCreativeMemoryEmpty(memory) ? '' : renderCreativeMemory(memory),
      };
    },
  };
}

/** The deterministic creative brief for one scene request. */
export function createCreativeBriefContextProvider(
  request: string,
  options: CreativePlannerOptions & { readonly memory?: CreativeMemoryV1 } = {},
): AiContextProvider {
  return {
    id: CREATIVE_BRIEF_PROVIDER_ID,
    collect() {
      return {
        source: CREATIVE_BRIEF_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: 'Creative brief (planner): genre, libraries, beats, effects, animation',
        body: renderCreativeBrief(planCreativeBrief(request, options)),
      };
    },
  };
}
