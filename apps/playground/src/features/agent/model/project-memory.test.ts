/**
 * The project memory (2026-10-12): notes judged and kept, persisted to the person's storage,
 * and sent to every run as one reviewed `data` fragment of host memory records.
 */
import { describe, expect, it } from 'vitest';

import type { AgentStorage } from './migrate-sessions';
import {
  createProjectMemoryStore,
  PROJECT_MEMORY_KEY,
  PROJECT_MEMORY_MAX_NOTES,
  PROJECT_MEMORY_MAX_TEXT,
} from './project-memory';

function memoryStorage(seed: Record<string, string> = {}): AgentStorage {
  const items = new Map(Object.entries(seed));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe('createProjectMemoryStore', () => {
  it('remembers, persists and reads back notes', () => {
    const storage = memoryStorage();
    const memory = createProjectMemoryStore(storage);
    expect(memory.add('preference', '  Our colour is   green ')).toBe('saved');
    expect(memory.add('site-fact', 'Closed on Fridays')).toBe('saved');
    expect(memory.get()).toEqual([
      { id: 'note-1', kind: 'preference', text: 'Our colour is green' },
      { id: 'note-2', kind: 'site-fact', text: 'Closed on Fridays' },
    ]);
    expect(createProjectMemoryStore(storage).get()).toEqual(memory.get());
  });

  it('refuses empty, overlong, repeated and one note too many', () => {
    const memory = createProjectMemoryStore(memoryStorage());
    expect(memory.add('preference', '   ')).toBe('empty');
    expect(memory.add('preference', 'x'.repeat(PROJECT_MEMORY_MAX_TEXT + 1))).toBe('tooLong');
    memory.add('preference', 'Green');
    expect(memory.add('site-fact', 'GREEN')).toBe('duplicate');
    for (let i = 1; i < PROJECT_MEMORY_MAX_NOTES; i += 1)
      memory.add('site-fact', `Fact ${String(i)}`);
    expect(memory.add('site-fact', 'One more')).toBe('full');
  });

  it('updates, forgets and clears', () => {
    const memory = createProjectMemoryStore(memoryStorage());
    memory.add('preference', 'Green');
    memory.add('preference', 'Warm');
    expect(memory.update('note-1', 'Forest green')).toBe('saved');
    expect(memory.update('note-2', 'forest GREEN')).toBe('duplicate');
    memory.remove('note-2');
    expect(memory.get()).toEqual([{ id: 'note-1', kind: 'preference', text: 'Forest green' }]);
    memory.clear();
    expect(memory.get()).toEqual([]);
  });

  it('sends the notes as reviewed host memory records in one data fragment', () => {
    const memory = createProjectMemoryStore(memoryStorage());
    memory.add('site-fact', 'Closed on Fridays');
    expect(memory.records()).toEqual([
      {
        schemaVersion: 1,
        source: 'host',
        kind: 'site-fact',
        trust: 'reviewed',
        summary: 'Closed on Fridays',
      },
    ]);
    const fragment = memory.provider.collect({} as never, []);
    expect(fragment).toMatchObject({
      kind: 'data',
      trust: 'reviewed',
      source: 'host:project-memory',
    });
    expect(JSON.stringify(fragment)).toContain('Closed on Fridays');
  });

  it('drops stored notes it cannot read and survives broken storage', () => {
    const stored = [
      { id: 'note-1', kind: 'preference', text: 'Green' },
      { id: 'note-x', kind: 'preference', text: 'Bad id' },
      { id: 'note-2', kind: 'mood', text: 'Bad kind' },
    ];
    expect(
      createProjectMemoryStore(
        memoryStorage({ [PROJECT_MEMORY_KEY]: JSON.stringify(stored) }),
      ).get(),
    ).toEqual([{ id: 'note-1', kind: 'preference', text: 'Green' }]);
    expect(createProjectMemoryStore(memoryStorage({ [PROJECT_MEMORY_KEY]: 'nope' })).get()).toEqual(
      [],
    );
    const throwing: AgentStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const memory = createProjectMemoryStore(throwing);
    expect(memory.add('preference', 'Still works')).toBe('saved');
  });
});
