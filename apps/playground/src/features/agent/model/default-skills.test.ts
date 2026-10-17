import { describe, expect, it } from 'vitest';

import { CRAFTKIT_DEFAULT_SKILLS } from '@craftkit/builder';

import { seededStorage } from '../testing/knowledge-fixtures';
import {
  createDefaultSkillsStore,
  DEFAULT_SKILLS_KEY,
  defaultSkillDraft,
  defaultSkillViews,
  enabledDefaultDefinitions,
} from './default-skills';
import { checkSkillDraft } from './user-skills';

describe('default skills', () => {
  it('lists the engine’s pack, on until switched off, in the panel’s language', () => {
    const english = defaultSkillViews('en', []);
    expect(english.map(({ id }) => id)).toEqual(CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id));
    expect(english.every(({ enabled }) => enabled)).toBe(true);
    expect(english[0]?.name).toBe('Design intelligence (UI UX Pro Max)');
    const arabic = defaultSkillViews('ar', ['craftkit.trust-proof']);
    expect(arabic.every(({ name }) => /[؀-ۿ]/u.test(name))).toBe(true);
    expect(arabic.every(({ description }) => /[؀-ۿ]/u.test(description))).toBe(true);
    expect(arabic.find(({ id }) => id === 'craftkit.trust-proof')?.enabled).toBe(false);
    // The Agent reads the instructions as written, whatever the panel's language.
    expect(arabic[0]?.instructions).toBe(english[0]?.instructions);
  });

  it('gives the registry only the defaults left on', () => {
    expect(enabledDefaultDefinitions([]).length).toBe(CRAFTKIT_DEFAULT_SKILLS.length);
    expect(enabledDefaultDefinitions(['craftkit.pro-max-ux']).map(({ id }) => id)).not.toContain(
      'craftkit.pro-max-ux',
    );
  });

  it('makes each default a draft the skill editor accepts', () => {
    for (const view of defaultSkillViews('ar', [])) {
      expect({ id: view.id, ok: checkSkillDraft(defaultSkillDraft(view), []).ok }).toEqual({
        id: view.id,
        ok: true,
      });
    }
  });

  it('keeps the switched-off ids per viewer, ignoring unknown ones', () => {
    const storage = seededStorage();
    const store = createDefaultSkillsStore(storage);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.setEnabled('craftkit.natural-copy', false);
    store.setEnabled('craftkit.natural-copy', false);
    store.setEnabled('not.a-default', false);
    expect(store.get()).toEqual(['craftkit.natural-copy']);
    expect(calls).toBe(1);
    expect(createDefaultSkillsStore(storage).get()).toEqual(['craftkit.natural-copy']);
    store.setEnabled('craftkit.natural-copy', true);
    expect(createDefaultSkillsStore(storage).get()).toEqual([]);
    storage.setItem(DEFAULT_SKILLS_KEY, '["craftkit.pro-max-ux", 7, "gone.skill"]');
    expect(createDefaultSkillsStore(storage).get()).toEqual(['craftkit.pro-max-ux']);
    storage.setItem(DEFAULT_SKILLS_KEY, '{not json');
    expect(createDefaultSkillsStore(storage).get()).toEqual([]);
  });
});
