/**
 * The project's STORY BIBLE as the panel keeps it (creative agent, 2026-10-12): the engine's
 * `CreativeMemoryV1` — characters, approved assets, locations and canon — in one tiny store,
 * persisted to the person's own browser storage.
 *
 * - It LEARNS from what the Agent actually wrote: after a build, every custom-code region's
 *   scene script is read for its literal `dialogue.cast([...])` array, its loaded asset URLs
 *   and its background cues (`learnCreativeMemoryFromScripts`, data-only — nothing executes).
 * - The person can add a character or a canon fact and remove anything; the bible is theirs.
 * - Every build reads it (`RunAiAgentOptions.creativeMemory`) and a creative writer is handed
 *   it as a `data` fragment, so names, colours and voices stay the same across sections and
 *   turns. Anything loaded from storage is re-validated by `readCreativeMemory`.
 * - Blocked or full storage never throws out of here: the bible keeps working in memory.
 *
 * No React here; `useStoryBible` subscribes to it.
 */
import {
  creativeSlug,
  emptyCreativeMemory,
  isCreativeMemoryEmpty,
  learnCreativeMemoryFromScripts,
  mergeCreativeMemory,
  normalizeColor,
  readCreativeMemory,
  type CreativeMemoryV1,
} from '@craftkit/builder';

import type { AgentStorage } from './migrate-sessions';
import { createStore, type Store } from './tiny-store';

export const STORY_BIBLE_KEY = 'ck-agent-story-bible:v1';

export interface NewCharacter {
  readonly name: string;
  readonly color?: string | undefined;
  readonly role?: string | undefined;
}

export interface StoryBibleStore {
  readonly get: () => CreativeMemoryV1;
  readonly subscribe: (listener: () => void) => () => void;
  readonly isEmpty: () => boolean;
  /** Merge what the given scene scripts declare; returns whether anything changed. */
  readonly learn: (scripts: readonly string[]) => boolean;
  readonly addCharacter: (character: NewCharacter) => boolean;
  readonly addFact: (fact: string) => boolean;
  readonly removeCharacter: (id: string) => void;
  readonly removeAsset: (id: string) => void;
  readonly removeLocation: (id: string) => void;
  readonly removeFact: (fact: string) => void;
  readonly clear: () => void;
}

function load(storage: AgentStorage | undefined): CreativeMemoryV1 {
  if (storage === undefined) return emptyCreativeMemory();
  try {
    const text = storage.getItem(STORY_BIBLE_KEY);
    return text === null ? emptyCreativeMemory() : readCreativeMemory(JSON.parse(text)).memory;
  } catch {
    // Unreadable or blocked storage: start empty rather than fail the panel.
    return emptyCreativeMemory();
  }
}

export function createStoryBibleStore(storage: AgentStorage | undefined): StoryBibleStore {
  const store: Store<CreativeMemoryV1> = createStore(load(storage));

  function commit(next: CreativeMemoryV1): boolean {
    const previous = store.getState();
    if (JSON.stringify(previous) === JSON.stringify(next)) return false;
    store.setState(next);
    try {
      storage?.setItem(STORY_BIBLE_KEY, JSON.stringify(next));
    } catch {
      // Full or blocked storage: the bible still serves this session.
    }
    return true;
  }

  const without = (key: 'characters' | 'assets' | 'locations', id: string): void => {
    const memory = store.getState();
    commit({ ...memory, [key]: memory[key].filter((entry) => entry.id !== id) });
  };

  return {
    get: store.getState,
    subscribe: store.subscribe,
    isEmpty: () => isCreativeMemoryEmpty(store.getState()),
    learn: (scripts) => commit(learnCreativeMemoryFromScripts(scripts, store.getState())),
    addCharacter: ({ name, color, role }) => {
      const clean = name.trim();
      if (clean === '') return false;
      const id = creativeSlug(clean);
      const hex = normalizeColor(color);
      return commit(
        mergeCreativeMemory(store.getState(), {
          characters: [
            {
              id,
              name: clean,
              ...(hex === undefined ? {} : { color: hex }),
              ...(role === undefined || role.trim() === '' ? {} : { role: role.trim() }),
            },
          ],
        }),
      );
    },
    addFact: (fact) => {
      const clean = fact.trim();
      if (clean === '') return false;
      return commit(mergeCreativeMemory(store.getState(), { facts: [clean] }));
    },
    removeCharacter: (id) => {
      without('characters', id);
    },
    removeAsset: (id) => {
      without('assets', id);
    },
    removeLocation: (id) => {
      without('locations', id);
    },
    removeFact: (fact) => {
      const memory = store.getState();
      commit({ ...memory, facts: memory.facts.filter((entry) => entry !== fact) });
    },
    clear: () => {
      commit(emptyCreativeMemory());
    },
  };
}

/** What the panel renders: the bible as it stands and the person's own edits. */
export interface StoryBibleView {
  readonly memory: CreativeMemoryV1;
  readonly addCharacter: StoryBibleStore['addCharacter'];
  readonly addFact: StoryBibleStore['addFact'];
  readonly removeCharacter: StoryBibleStore['removeCharacter'];
  readonly removeAsset: StoryBibleStore['removeAsset'];
  readonly removeLocation: StoryBibleStore['removeLocation'];
  readonly removeFact: StoryBibleStore['removeFact'];
  readonly clear: StoryBibleStore['clear'];
}

/** The scene scripts on a page: every custom-code region's `js`, in document order. */
export function sceneScriptsOf(
  nodes: Readonly<Record<string, { type: string; props: Readonly<Record<string, unknown>> }>>,
): string[] {
  const scripts: string[] = [];
  for (const node of Object.values(nodes)) {
    const js = node.props['js'];
    if (node.type === 'customCode' && typeof js === 'string' && js.trim() !== '') scripts.push(js);
  }
  return scripts;
}
