/**
 * Starter skills (2026-10-12): every template in both languages is a draft the store keeps,
 * and the engine accepts as a host skill a request's words turn on.
 */
import { createCraftkitAiSkillRegistry } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { skillTemplates } from './skill-templates';
import {
  checkSkillDraft,
  userSkillDefinitions,
  userSkillIdsFor,
  type UserSkill,
} from './user-skills';

describe('skillTemplates', () => {
  it.each(['en', 'ar'] as const)(
    'offers the same starter skills in %s, each a valid draft',
    (locale) => {
      const templates = skillTemplates(locale);
      expect(templates.map(({ id }) => id)).toEqual(skillTemplates('en').map(({ id }) => id));
      const kept: UserSkill[] = [];
      for (const template of templates) {
        const check = checkSkillDraft(template.draft, kept);
        expect(check.ok).toBe(true);
        if (check.ok)
          kept.push({ id: `user.skill-${String(kept.length + 1)}`, ...check.draft, enabled: true });
      }
      const registry = createCraftkitAiSkillRegistry(userSkillDefinitions(kept));
      expect(registry.list().filter(({ id }) => id.startsWith('user.'))).toHaveLength(
        templates.length,
      );
    },
  );

  it('turns the data storyteller on for a chart request, in either language', () => {
    for (const [locale, request] of [
      ['en', 'Add a chart of monthly bookings'],
      ['ar', 'أضف مخططًا للحجوزات الشهرية'],
    ] as const) {
      const data = skillTemplates(locale).find(({ id }) => id === 'data');
      if (data === undefined) throw new Error('no data template');
      const skill: UserSkill = { id: 'user.skill-1', ...data.draft, enabled: true };
      const registry = createCraftkitAiSkillRegistry(userSkillDefinitions([skill]));
      expect(userSkillIdsFor(registry, [skill], request)).toEqual(['user.skill-1']);
    }
  });
});
