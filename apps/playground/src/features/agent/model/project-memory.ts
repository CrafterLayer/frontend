/**
 * The project's MEMORY (2026-10-12): standing facts and preferences the person wants the Agent
 * to keep across every request and conversation — "our brand colour is forest green", «اكتب
 * دائمًا بالعربية الفصحى», "the clinic is closed on Fridays". One tiny store, persisted to the
 * person's own browser storage like the story bible.
 *
 * Every run reads it as one `data` fragment (`createMemoryContextProvider`, kinds `preference`
 * and `site-fact`), so it is context the person reviewed, never an instruction a model wrote.
 * The engine caps a fragment at 20 records of 512 characters; the store holds no more.
 * Blocked or full storage never throws out of here. No React here.
 */
import { createMemoryContextProvider, type AiMemoryRecordV1 } from '@craftkit/builder';

import type { AgentStorage } from './migrate-sessions';
import { createStore, type Store } from './tiny-store';

export const PROJECT_MEMORY_KEY = 'ck-agent-memory:v1';
export const PROJECT_MEMORY_MAX_NOTES = 20;
export const PROJECT_MEMORY_MAX_TEXT = 500;

/** A preference shapes how the Agent works; a fact is something true about the site. */
export type MemoryNoteKind = 'preference' | 'site-fact';

export interface MemoryNote {
  readonly id: string;
  readonly kind: MemoryNoteKind;
  readonly text: string;
}

export type MemoryWrite = 'saved' | 'empty' | 'tooLong' | 'full' | 'duplicate';

export interface ProjectMemoryStore {
  readonly get: () => readonly MemoryNote[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly add: (kind: MemoryNoteKind, text: string) => MemoryWrite;
  readonly update: (id: string, text: string) => MemoryWrite;
  readonly remove: (id: string) => void;
  readonly clear: () => void;
  /** The notes as the engine's memory records, oldest first. */
  readonly records: () => readonly AiMemoryRecordV1[];
  /** One provider per store, so every run sends the same fragment id and reads it live. */
  readonly provider: ReturnType<typeof createMemoryContextProvider>;
}

function readNote(value: unknown): MemoryNote | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const entry = value as Record<string, unknown>;
  const { id, kind, text } = entry;
  if (typeof id !== 'string' || !/^note-[1-9]\d*$/u.test(id)) return undefined;
  if (kind !== 'preference' && kind !== 'site-fact') return undefined;
  if (typeof text !== 'string' || text.trim() === '' || text.length > PROJECT_MEMORY_MAX_TEXT) {
    return undefined;
  }
  return { id, kind, text };
}

function load(storage: AgentStorage | undefined): readonly MemoryNote[] {
  if (storage === undefined) return [];
  try {
    const text = storage.getItem(PROJECT_MEMORY_KEY);
    const parsed: unknown = text === null ? [] : JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const notes = parsed.map(readNote).filter((note) => note !== undefined);
    return notes.slice(-PROJECT_MEMORY_MAX_NOTES);
  } catch {
    return [];
  }
}

function nextNoteId(notes: readonly MemoryNote[]): string {
  const taken = notes.map((note) => Number(note.id.slice('note-'.length)));
  return `note-${String(Math.max(0, ...taken) + 1)}`;
}

/** The note's words, judged; `undefined` when they can be kept. */
function refusal(
  text: string,
  notes: readonly MemoryNote[],
  except?: string,
): MemoryWrite | undefined {
  if (text === '') return 'empty';
  if (text.length > PROJECT_MEMORY_MAX_TEXT) return 'tooLong';
  const folded = text.toLocaleLowerCase();
  if (notes.some((note) => note.id !== except && note.text.toLocaleLowerCase() === folded)) {
    return 'duplicate';
  }
  return undefined;
}

export function createProjectMemoryStore(storage: AgentStorage | undefined): ProjectMemoryStore {
  const store: Store<readonly MemoryNote[]> = createStore(load(storage));

  function commit(next: readonly MemoryNote[]): void {
    store.setState(next);
    try {
      storage?.setItem(PROJECT_MEMORY_KEY, JSON.stringify(next));
    } catch {
      // Full or blocked storage: the memory still serves this session.
    }
  }

  const records = (): readonly AiMemoryRecordV1[] =>
    store.getState().map((note) => ({
      schemaVersion: 1,
      source: 'host',
      kind: note.kind,
      trust: 'reviewed',
      summary: note.text,
    }));

  return {
    get: store.getState,
    subscribe: store.subscribe,
    add: (kind, raw) => {
      const notes = store.getState();
      const text = raw.trim().replace(/\s+/gu, ' ');
      const refused = refusal(text, notes);
      if (refused !== undefined) return refused;
      if (notes.length >= PROJECT_MEMORY_MAX_NOTES) return 'full';
      commit([...notes, { id: nextNoteId(notes), kind, text }]);
      return 'saved';
    },
    update: (id, raw) => {
      const notes = store.getState();
      const text = raw.trim().replace(/\s+/gu, ' ');
      const refused = refusal(text, notes, id);
      if (refused !== undefined) return refused;
      commit(notes.map((note) => (note.id === id ? { ...note, text } : note)));
      return 'saved';
    },
    remove: (id) => {
      const notes = store.getState();
      if (notes.some((note) => note.id === id)) commit(notes.filter((note) => note.id !== id));
    },
    clear: () => {
      if (store.getState().length > 0) commit([]);
    },
    records,
    provider: createMemoryContextProvider({
      load: records,
      title: 'Project memory: standing preferences and facts the person asked the Agent to keep',
      source: 'host:project-memory',
    }),
  };
}
