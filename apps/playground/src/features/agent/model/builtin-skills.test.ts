import { describe, expect, it } from 'vitest';

import { CRAFTKIT_DEFAULT_SKILLS, createCraftkitAiSkillRegistry } from '@craftkit/builder';

import { seededStorage } from '../testing/knowledge-fixtures';
import {
  ALWAYS_ON_SKILL_IDS,
  BUILT_IN_SKILLS_KEY,
  builtInSkillViews,
  createBuiltInSkillsStore,
  switchableBuiltInIds,
} from './builtin-skills';
import { createDefaultSkillsStore, DEFAULT_SKILLS_KEY } from './default-skills';

const SKILLS = createCraftkitAiSkillRegistry().list();
const KNOWN = switchableBuiltInIds(SKILLS);

describe('built-in skills', () => {
  it('offers a switch for every auto built-in and photo direction, never an engine-only one', () => {
    const auto = SKILLS.filter((skill) => skill.activation.mode === 'auto').map(({ id }) => id);
    expect([...KNOWN].sort()).toEqual([...auto, 'craftkit.photo-direction'].sort());
    for (const id of [...ALWAYS_ON_SKILL_IDS, 'craftkit.plan-mode', 'craftkit.precise-edit']) {
      expect(KNOWN).not.toContain(id);
    }
    for (const { id } of CRAFTKIT_DEFAULT_SKILLS) expect(KNOWN).not.toContain(id);
  });

  it('lists them by group, the engine’s own last and locked, in the panel’s language', () => {
    const english = builtInSkillViews(SKILLS, 'en', ['craftkit.data-viz', 'craftkit.build-fill']);
    const groups = english.map(({ group }) => group);
    expect(groups).toEqual([...groups].sort((a, b) => order(a) - order(b)));
    const byId = new Map(english.map((view) => [view.id, view]));
    expect(byId.get('craftkit.data-viz')).toMatchObject({ group: 'data', enabled: false });
    expect(byId.get('craftkit.logo-design')?.group).toBe('images');
    expect(byId.get('craftkit.pixi-games')?.group).toBe('creative');
    expect(byId.get('craftkit.arabic-rtl')?.group).toBe('language');
    expect(byId.get('craftkit.copywriting')?.group).toBe('content');
    expect(byId.get('craftkit.page-composition')?.group).toBe('design');
    // A locked skill reads on, whatever storage says.
    expect(byId.get('craftkit.build-fill')).toMatchObject({ locked: true, enabled: true });
    expect(byId.has('craftkit.plan-mode')).toBe(false);

    // Creative playbooks are still being added elsewhere: a new one reads English until named.
    const arabic = builtInSkillViews(SKILLS, 'ar', []).filter(({ group }) => group !== 'creative');
    expect(arabic.every(({ name }) => /[؀-ۿ]/u.test(name))).toBe(true);
    expect(arabic.every(({ description }) => /[؀-ۿ]/u.test(description))).toBe(true);
  });

  it('keeps the switched-off ids per viewer, ignoring unknown and locked ones', () => {
    const storage = seededStorage();
    const store = createBuiltInSkillsStore(KNOWN, storage);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.setEnabled('craftkit.data-viz', false);
    store.setEnabled('craftkit.data-viz', false);
    store.setEnabled('craftkit.build-fill', false);
    store.setEnabled('not.a-skill', false);
    expect(store.get()).toEqual(['craftkit.data-viz']);
    expect(calls).toBe(1);
    expect(storage.getItem(BUILT_IN_SKILLS_KEY)).toBe('["craftkit.data-viz"]');
    expect(createBuiltInSkillsStore(KNOWN, storage).get()).toEqual(['craftkit.data-viz']);
    store.setEnabled('craftkit.data-viz', true);
    expect(createBuiltInSkillsStore(KNOWN, storage).get()).toEqual([]);

    storage.setItem(BUILT_IN_SKILLS_KEY, '["craftkit.motion", 7, "gone.skill", "craftkit.motion"]');
    expect(createBuiltInSkillsStore(KNOWN, storage).get()).toEqual(['craftkit.motion']);
    storage.setItem(BUILT_IN_SKILLS_KEY, '{not json');
    expect(createBuiltInSkillsStore(KNOWN, storage).get()).toEqual([]);
  });

  it('resets every built-in back on, once', () => {
    const storage = seededStorage();
    const store = createBuiltInSkillsStore(KNOWN, storage);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.setEnabled('craftkit.motion', false);
    store.setEnabled('craftkit.pixi-games', false);
    store.reset();
    store.reset();
    expect(store.get()).toEqual([]);
    expect(calls).toBe(3);
    expect(createBuiltInSkillsStore(KNOWN, storage).get()).toEqual([]);
  });

  it('never touches the default skills’ saved choice', () => {
    const storage = seededStorage();
    storage.setItem(DEFAULT_SKILLS_KEY, '["craftkit.trust-proof"]');
    const store = createBuiltInSkillsStore(KNOWN, storage);
    store.setEnabled('craftkit.data-viz', false);
    store.reset();
    expect(storage.getItem(DEFAULT_SKILLS_KEY)).toBe('["craftkit.trust-proof"]');
    expect(createDefaultSkillsStore(storage).get()).toEqual(['craftkit.trust-proof']);
  });

  it('keeps the choice for this visit when storage refuses it', () => {
    const store = createBuiltInSkillsStore(KNOWN, {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    });
    store.setEnabled('craftkit.motion', false);
    expect(store.get()).toEqual(['craftkit.motion']);
  });
});

function order(group: string): number {
  return ['design', 'content', 'data', 'images', 'creative', 'language', 'always'].indexOf(group);
}
