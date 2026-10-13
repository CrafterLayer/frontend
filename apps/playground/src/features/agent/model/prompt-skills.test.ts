import { describe, expect, it } from 'vitest';
import { readPromptSkillSnapshot, selectedSkillsForRequest } from './prompt-skills';
import { reviveTurn, type UserTurn } from './turns';

describe('request skill choices', () => {
  it('revives bounded optional metadata without changing older user turns', () => {
    const legacy: UserTurn = { id: 'turn-1', kind: 'user', text: '/voice Write', context: [] };
    expect(reviveTurn(legacy)).toBe(legacy);
    expect(
      reviveTurn({
        ...legacy,
        skillSnapshot: { skillIds: ['user.voice', 'user.voice'], request: 'Write' },
      }),
    ).toMatchObject({ skillSnapshot: { skillIds: ['user.voice'], request: 'Write' } });
    for (const skillSnapshot of [
      null,
      { skillIds: [1], request: 'Write' },
      { skillIds: ['a'.repeat(257)], request: 'Write' },
      { skillIds: Array.from({ length: 129 }, () => 'user.voice'), request: 'Write' },
      { skillIds: [], request: 'x'.repeat(65_537) },
    ]) {
      expect(readPromptSkillSnapshot(skillSnapshot)).toBeUndefined();
      expect(reviveTurn({ ...legacy, skillSnapshot } as UserTurn)).toEqual(legacy);
    }
  });
  it('keeps host choices first and deduplicates the current prompt choices', () => {
    const source = {
      selectedSkillIds: ['host.skill'],
      selectedSkillIdsFor: (request: string) =>
        request.includes('/copywriting') ? ['host.skill', 'craftkit.copywriting'] : [],
    };
    expect(selectedSkillsForRequest(source, '/copywriting Rewrite')).toEqual([
      'host.skill',
      'craftkit.copywriting',
    ]);
    expect(selectedSkillsForRequest(source, 'Another request')).toEqual(['host.skill']);
    expect(source.selectedSkillIds).toEqual(['host.skill']);
  });

  it('omits explicit choices when this prompt has none', () => {
    expect(selectedSkillsForRequest({ selectedSkillIdsFor: () => [] }, 'A page')).toBeUndefined();
  });
});
