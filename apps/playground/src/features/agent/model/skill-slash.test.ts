/**
 * The composer's `/` (2026-10-12): which drafts open the list, what picking takes out of the
 * draft, how a name becomes a command, and how a query orders the skills.
 */
import { describe, expect, it } from 'vitest';

import type { BuiltInSkillView } from './knowledge';
import { commandOf, slashOptions, slashToken, withoutSlash } from './skill-slash';
import type { UserSkill } from './user-skills';

const own = (id: string, name: string, description = '', enabled = true): UserSkill => ({
  id,
  name,
  description,
  instructions: 'Do it.',
  keywords: ['x'],
  mode: 'auto',
  enabled,
});

const SKILLS = [
  own('user.skill-1', 'Brand voice', 'Every line of copy'),
  own('user.skill-2', 'أسلوب المنزل', 'كل الصفحات'),
  own('user.skill-3', 'Off skill', '', false),
];
const BUILT_INS: readonly BuiltInSkillView[] = [
  {
    id: 'craftkit.copywriting',
    name: 'Headlines, actions and body copy',
    description: 'Copy rules',
  },
  {
    id: 'craftkit.arabic-rtl',
    name: 'Arabic and right-to-left',
    description: 'Direction and type',
  },
];

describe('slashToken', () => {
  it('opens on a slash at the start or after a space, with the words after it', () => {
    expect(slashToken('/')).toEqual({ query: '', start: 0 });
    expect(slashToken('/bra')).toEqual({ query: 'bra', start: 0 });
    expect(slashToken('Rewrite the hero /bra')).toEqual({ query: 'bra', start: 17 });
    expect(slashToken('اكتب /أسل')).toEqual({ query: 'أسل', start: 5 });
  });

  it('stays closed inside a word, a path, or once a space follows the words', () => {
    expect(slashToken('and/or')).toBeNull();
    expect(slashToken('/a/b')).toBeNull();
    expect(slashToken('/brand ')).toBeNull();
    expect(slashToken('hello')).toBeNull();
  });
});

describe('withoutSlash', () => {
  it('takes the words out and leaves one space between what remains and the caret', () => {
    expect(withoutSlash('/bra', { query: 'bra', start: 0 })).toBe('');
    expect(withoutSlash('Rewrite the hero /bra', { query: 'bra', start: 17 })).toBe(
      'Rewrite the hero ',
    );
    expect(withoutSlash('Rewrite   /x', { query: 'x', start: 10 })).toBe('Rewrite ');
  });
});

describe('commandOf', () => {
  it('turns a name into a command, Arabic letters kept', () => {
    expect(commandOf('  Brand Voice! ')).toBe('brand-voice');
    expect(commandOf('أسلوب المنزل')).toBe('أسلوب-المنزل');
    expect(commandOf('SEO 2.0')).toBe('seo-2-0');
  });
});

describe('slashOptions', () => {
  it('lists the enabled skills, then the built-ins, without the pinned ones', () => {
    const all = slashOptions(SKILLS, BUILT_INS, '');
    expect(all.map(({ id }) => id)).toEqual([
      'user.skill-1',
      'user.skill-2',
      'craftkit.copywriting',
      'craftkit.arabic-rtl',
    ]);
    expect(all[2]).toMatchObject({ command: 'copywriting', source: 'builtin' });
    expect(slashOptions(SKILLS, BUILT_INS, '', ['user.skill-1']).map(({ id }) => id)).not.toContain(
      'user.skill-1',
    );
  });

  it('ranks a command or word start before a match inside, before the description', () => {
    expect(slashOptions(SKILLS, BUILT_INS, 'copy').map(({ id }) => id)).toEqual([
      'craftkit.copywriting',
      'user.skill-1',
    ]);
    expect(slashOptions(SKILLS, BUILT_INS, 'voice').map(({ id }) => id)).toEqual(['user.skill-1']);
    expect(slashOptions(SKILLS, BUILT_INS, 'type').map(({ id }) => id)).toEqual([
      'craftkit.arabic-rtl',
    ]);
  });

  it('folds hamza and case, and finds nothing for nonsense', () => {
    expect(slashOptions(SKILLS, BUILT_INS, 'اسلوب').map(({ id }) => id)).toEqual(['user.skill-2']);
    expect(slashOptions(SKILLS, BUILT_INS, 'BRAND').map(({ id }) => id)).toEqual(['user.skill-1']);
    expect(slashOptions(SKILLS, BUILT_INS, 'zzz')).toEqual([]);
  });
});
