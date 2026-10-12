/**
 * Story bible wiring: the context providers every run is sent (the applied-change
 * ledger, the story bible), and what a run that changed the page teaches the bible.
 */
import {
  type BuilderKernel,
  createCreativeMemoryContextProvider,
  type RunAiAgentOptions,
} from '@craftkit/builder';

import { sceneScriptsOf, type StoryBibleStore } from '../../model/story-bible';

import type { Env } from './controller-state';

/**
 * What a run is told beyond the page: the applied-change ledger once anything was applied, and
 * the story bible once it holds anything (a `data` fragment; the engine re-validates it).
 */
export function contextProvidersOf(
  env: Env,
): Pick<RunAiAgentOptions, 'additionalContextProviders'> {
  const providers = [
    ...(env.memory.hasRecords() ? [env.memory.provider] : []),
    ...(env.storyBible.isEmpty() ? [] : [storyBibleProvider(env.storyBible)]),
  ];
  return providers.length === 0 ? {} : { additionalContextProviders: providers };
}

type ContextProvider = ReturnType<typeof createCreativeMemoryContextProvider>;

const BIBLE_PROVIDERS = new WeakMap<StoryBibleStore, ContextProvider>();

/** One provider per store, so every run sends the same id and reads the bible live. */
function storyBibleProvider(bible: StoryBibleStore): ContextProvider {
  let provider = BIBLE_PROVIDERS.get(bible);
  if (provider === undefined) {
    provider = createCreativeMemoryContextProvider({ load: () => bible.get() });
    BIBLE_PROVIDERS.set(bible, provider);
  }
  return provider;
}

/** After a run changed the page: learn the cast, assets and places its scenes declare. */
export function learnStoryBible(env: Env, kernel: BuilderKernel): void {
  try {
    env.storyBible.learn(sceneScriptsOf(kernel.getDocument().nodes));
  } catch {
    // Learning is a convenience: a page the reader cannot parse never fails the run.
  }
}
