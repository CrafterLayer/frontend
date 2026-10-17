/**
 * The person's skills, kept (2026-10-12): every write judged, persisted to their storage,
 * re-read and re-validated, and never a throw out of blocked storage.
 */
import { describe, expect, it } from 'vitest';

import type { AgentStorage } from './migrate-sessions';
import { USER_SKILLS_MAX_ALWAYS_CHARS } from './user-skills';
import { createUserSkillsStore, USER_SKILLS_KEY } from './user-skills-store';

function memoryStorage(
  seed: Record<string, string> = {},
): AgentStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(seed));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const draft = {
  name: 'Brand voice',
  description: '',
  instructions: 'Be warm.',
  keywords: ['copy'],
  mode: 'auto' as const,
};

describe('createUserSkillsStore', () => {
  it('adds, persists and reads back a skill', () => {
    const storage = memoryStorage();
    const store = createUserSkillsStore(storage);
    const added = store.add(draft);
    expect(added).toMatchObject({ ok: true, skill: { id: 'user.skill-1', enabled: true } });
    expect(createUserSkillsStore(storage).get()).toEqual(store.get());
  });

  it('updates, toggles and removes, and notifies its listeners', () => {
    const store = createUserSkillsStore(memoryStorage());
    store.add(draft);
    let heard = 0;
    store.subscribe(() => {
      heard += 1;
    });
    expect(store.update('user.skill-1', { ...draft, name: 'Voice' })).toMatchObject({ ok: true });
    expect(store.setEnabled('user.skill-1', false)).toMatchObject({
      ok: true,
      skill: { enabled: false },
    });
    expect(store.setEnabled('user.skill-1', false)).toMatchObject({ ok: true });
    store.remove('user.skill-1');
    store.remove('user.skill-1');
    expect(store.get()).toEqual([]);
    expect(heard).toBe(3);
    expect(store.update('user.skill-404', draft)).toEqual({ ok: false, reason: 'unreadable' });
    expect(store.setEnabled('user.skill-404', true)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses to turn an always-on skill on past the budget', () => {
    const store = createUserSkillsStore(memoryStorage());
    const half = 'x'.repeat(USER_SKILLS_MAX_ALWAYS_CHARS / 2);
    expect(store.add({ ...draft, mode: 'always', instructions: half }).ok).toBe(true);
    expect(store.add({ ...draft, name: 'B', mode: 'always', instructions: half.slice(1) }).ok).toBe(
      true,
    );
    store.setEnabled('user.skill-1', false);
    expect(store.add({ ...draft, name: 'C', mode: 'always', instructions: 'Ten chars.' }).ok).toBe(
      true,
    );
    expect(store.setEnabled('user.skill-1', true)).toEqual({ ok: false, reason: 'alwaysBudget' });
  });

  it('imports a SKILL.md and refuses an unreadable one', () => {
    const store = createUserSkillsStore(memoryStorage());
    expect(store.importMarkdown('---\nname: Menu\nkeywords: menu\n---\nSoup first.')).toMatchObject(
      { ok: true },
    );
    expect(store.importMarkdown('  ')).toEqual({ ok: false, reason: 'unreadable' });
    expect(store.importMarkdown('---\nname: Nothing\n---\n')).toEqual({
      ok: false,
      reason: 'instructions',
    });
  });

  it('drops stored entries it cannot read, and repeats', () => {
    const good = {
      id: 'user.skill-2',
      name: 'A',
      description: '',
      instructions: 'B',
      keywords: ['c'],
      mode: 'auto',
      enabled: true,
    };
    const storage = memoryStorage({
      [USER_SKILLS_KEY]: JSON.stringify([good, good, { id: 'evil' }, 7]),
    });
    expect(createUserSkillsStore(storage).get()).toEqual([good]);
    expect(createUserSkillsStore(memoryStorage({ [USER_SKILLS_KEY]: '{' })).get()).toEqual([]);
    expect(createUserSkillsStore(memoryStorage({ [USER_SKILLS_KEY]: '{}' })).get()).toEqual([]);
  });

  it('keeps working when storage throws', () => {
    const throwing: AgentStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const store = createUserSkillsStore(throwing);
    expect(store.add(draft).ok).toBe(true);
    expect(store.get()).toHaveLength(1);
    expect(createUserSkillsStore(undefined).get()).toEqual([]);
  });
});
