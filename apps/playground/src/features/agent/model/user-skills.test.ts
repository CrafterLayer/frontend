/**
 * The person's own skills (2026-10-12): drafts judged before they are kept, the engine's
 * definition of an enabled skill, and which skills a request turns on — by the engine's own
 * matcher, so «لعيادتي» finds a skill whose word is «عيادة».
 */
import { createCraftkitAiSkillRegistry } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  checkSkillDraft,
  EMPTY_SKILL_DRAFT,
  exceedsAlwaysBudget,
  nextSkillId,
  readUserSkill,
  splitKeywords,
  userSkillDefinition,
  userSkillDefinitions,
  userSkillIdsFor,
  USER_SKILL_MAX_INSTRUCTIONS,
  USER_SKILLS_MAX,
  USER_SKILLS_MAX_ALWAYS_CHARS,
  type UserSkill,
} from './user-skills';

const skill = (overrides: Partial<UserSkill> = {}): UserSkill => ({
  id: 'user.skill-1',
  name: 'Brand voice',
  description: 'Every line of copy',
  instructions: 'Write short, warm sentences.',
  keywords: ['copy', 'headline'],
  mode: 'auto',
  enabled: true,
  ...overrides,
});

describe('splitKeywords', () => {
  it('splits on Latin and Arabic commas, semicolons and lines, folds case and drops repeats', () => {
    expect(splitKeywords('Copy, headline، نبرة; COPY\nbutton')).toEqual([
      'copy',
      'headline',
      'نبرة',
      'button',
    ]);
  });

  it('drops empty and overlong words and keeps at most sixteen', () => {
    expect(splitKeywords(' , ,')).toEqual([]);
    expect(splitKeywords('x'.repeat(41))).toEqual([]);
    expect(
      splitKeywords(Array.from({ length: 20 }, (_, i) => `w${String(i)}`).join(',')),
    ).toHaveLength(16);
  });
});

describe('checkSkillDraft', () => {
  const draft = {
    ...EMPTY_SKILL_DRAFT,
    name: '  Brand   voice ',
    instructions: ' Be warm. ',
    keywords: ['Copy'],
  };

  it('cleans a good draft', () => {
    expect(checkSkillDraft(draft, [])).toEqual({
      ok: true,
      draft: {
        name: 'Brand voice',
        description: '',
        instructions: 'Be warm.',
        keywords: ['copy'],
        mode: 'auto',
      },
    });
  });

  it('refuses a draft without a name, instructions or (for auto) a word', () => {
    expect(checkSkillDraft({ ...draft, name: ' ' }, [])).toEqual({ ok: false, reason: 'name' });
    expect(checkSkillDraft({ ...draft, instructions: '' }, [])).toEqual({
      ok: false,
      reason: 'instructions',
    });
    expect(checkSkillDraft({ ...draft, keywords: [] }, [])).toEqual({
      ok: false,
      reason: 'keywords',
    });
    expect(checkSkillDraft({ ...draft, keywords: [], mode: 'always' }, []).ok).toBe(true);
  });

  it('refuses overlong text and a full shelf', () => {
    const long = 'x'.repeat(USER_SKILL_MAX_INSTRUCTIONS + 1);
    expect(checkSkillDraft({ ...draft, instructions: long }, [])).toEqual({
      ok: false,
      reason: 'tooLong',
    });
    const full = Array.from({ length: USER_SKILLS_MAX }, (_, i) =>
      skill({ id: `user.skill-${String(i + 1)}` }),
    );
    expect(checkSkillDraft(draft, full)).toEqual({ ok: false, reason: 'full' });
    // An edit of a kept skill is never refused for room.
    expect(checkSkillDraft(draft, full, 'user.skill-1').ok).toBe(true);
  });

  it('keeps always-on instructions within their budget, not counting the skill being edited', () => {
    const half = 'x'.repeat(USER_SKILLS_MAX_ALWAYS_CHARS / 2);
    const kept = [
      skill({ mode: 'always', instructions: half }),
      skill({ id: 'user.skill-2', mode: 'always', instructions: half }),
    ];
    const always = { ...draft, mode: 'always' as const, instructions: 'One more line.' };
    expect(checkSkillDraft(always, kept)).toEqual({ ok: false, reason: 'alwaysBudget' });
    expect(checkSkillDraft({ ...always, instructions: half }, kept, 'user.skill-2').ok).toBe(true);
    // An auto skill has no such budget: the engine drops it when it does not fit.
    expect(checkSkillDraft({ ...draft, instructions: half }, kept).ok).toBe(true);
  });
});

describe('exceedsAlwaysBudget', () => {
  it('says whether turning an always-on skill on would overspend', () => {
    const big = 'x'.repeat(USER_SKILLS_MAX_ALWAYS_CHARS - 10);
    const skills = [
      skill({ mode: 'always', instructions: big }),
      skill({
        id: 'user.skill-2',
        mode: 'always',
        instructions: 'twenty characters!!!',
        enabled: false,
      }),
      skill({ id: 'user.skill-3', mode: 'auto', enabled: false }),
    ];
    expect(exceedsAlwaysBudget(skills, 'user.skill-2')).toBe(true);
    expect(exceedsAlwaysBudget(skills, 'user.skill-3')).toBe(false);
    expect(exceedsAlwaysBudget(skills, 'user.skill-404')).toBe(false);
  });
});

describe('nextSkillId', () => {
  it('counts up from the highest id', () => {
    expect(nextSkillId([])).toBe('user.skill-1');
    expect(nextSkillId([skill({ id: 'user.skill-7' }), skill({ id: 'user.skill-2' })])).toBe(
      'user.skill-8',
    );
  });
});

describe('the engine’s definition', () => {
  it('is a valid host skill the registry accepts, reviewed and data-only', () => {
    const always = skill({ id: 'user.skill-2', mode: 'always', keywords: [], description: '' });
    const definitions = userSkillDefinitions([
      skill(),
      always,
      skill({ id: 'user.skill-3', enabled: false }),
    ]);
    expect(definitions.map(({ id }) => id)).toEqual(['user.skill-1', 'user.skill-2']);
    expect(definitions[1]).toMatchObject({
      description: 'Brand voice',
      activation: { mode: 'always' },
    });
    expect(userSkillDefinition(skill())).toMatchObject({
      source: 'host',
      trust: 'reviewed',
      version: '1.0.0',
      activation: { mode: 'auto', keywords: ['copy', 'headline'] },
    });
    const registry = createCraftkitAiSkillRegistry(definitions);
    expect(registry.get('user.skill-1')?.name).toBe('Brand voice');
  });
});

describe('userSkillIdsFor', () => {
  const clinic = skill({ id: 'user.skill-1', name: 'Clinic tone', keywords: ['عيادة'] });
  const always = skill({ id: 'user.skill-2', name: 'House style', mode: 'always', keywords: [] });
  const off = skill({ id: 'user.skill-3', keywords: ['menu'], enabled: false });
  const skills = [clinic, always, off];
  const registry = createCraftkitAiSkillRegistry(userSkillDefinitions(skills));

  it('names the always-on skills and the auto ones the request mentions, Arabic clitics included', () => {
    expect([...userSkillIdsFor(registry, skills, 'اعمل صفحة لعيادتي')].sort()).toEqual([
      'user.skill-1',
      'user.skill-2',
    ]);
    expect(userSkillIdsFor(registry, skills, 'Build a menu page')).toEqual(['user.skill-2']);
  });

  it('names none when no skill is on', () => {
    expect(userSkillIdsFor(registry, [skill({ enabled: false })], 'copy')).toEqual([]);
  });

  it('falls back to the always-on skills when the registry cannot prepare', () => {
    const broken = {
      ...registry,
      prepare: () => {
        throw new Error('budget');
      },
    };
    expect(userSkillIdsFor(broken, skills, 'اعمل صفحة لعيادتي')).toEqual(['user.skill-2']);
  });
});

describe('readUserSkill', () => {
  it('reads a stored skill and refuses anything this version did not write', () => {
    expect(readUserSkill(skill())).toEqual(skill());
    expect(readUserSkill({ ...skill(), enabled: undefined })?.enabled).toBe(true);
    expect(readUserSkill({ ...skill(), id: 'craftkit.copywriting' })).toBeUndefined();
    expect(readUserSkill({ ...skill(), mode: 'sometimes' })).toBeUndefined();
    expect(readUserSkill({ ...skill(), keywords: [] })).toBeUndefined();
    expect(readUserSkill({ ...skill(), instructions: ' ' })).toBeUndefined();
    expect(readUserSkill('skill')).toBeUndefined();
    expect(readUserSkill(null)).toBeUndefined();
  });
});
