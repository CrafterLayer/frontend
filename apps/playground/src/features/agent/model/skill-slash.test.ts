/**
 * The composer's `/` (2026-10-12): which drafts open the list, what picking takes out of the
 * draft, how a name becomes a command, and how a query orders the skills.
 */
import { describe, expect, it } from 'vitest';

import { defaultSkillViews } from './default-skills';
import type { BuiltInSkillView } from './knowledge';
import {
  batchCommandText,
  commandOf,
  slashCommands,
  slashOptions,
  slashToken,
  textBeforeSlash,
  withoutSlash,
  withInlineSkill,
  inlineSkillIds,
  inlineSkillRequest,
} from './skill-slash';
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

describe('inline prompt skills', () => {
  it('keeps a chosen token in the same prompt and permits more than three choices', () => {
    const options = slashOptions(SKILLS, BUILT_INS, '');
    expect(withInlineSkill('Rewrite /bra', { query: 'bra', start: 8 }, options[0]!)).toBe(
      '/brand-voice Rewrite ',
    );
    expect(
      inlineSkillIds('/brand-voice /أسلوب-المنزل /copywriting /arabic-rtl Write this', options),
    ).toEqual(options.map(({ id }) => id));
  });

  it('selects enabled exact tokens once, ignoring unknown words, paths and the next prompt', () => {
    const options = slashOptions(SKILLS, BUILT_INS, '');
    expect(
      inlineSkillIds(
        '/brand-voice /BRAND-VOICE /off-skill /missing ./copywriting https://example.test/copywriting',
        options,
      ),
    ).toEqual(['user.skill-1']);
    expect(inlineSkillIds('Write another hero', options)).toEqual([]);
  });

  it('removes only enabled choices from the semantic brief, retaining unknown slash text', () => {
    const options = slashOptions(SKILLS, BUILT_INS, '');
    expect(inlineSkillRequest('/copywriting سوي جدارية وبدي تضيف صور', options)).toBe(
      'سوي جدارية وبدي تضيف صور',
    );
    expect(
      inlineSkillRequest(
        'Keep /missing ./copywriting https://example.test/copywriting /off-skill',
        options,
      ),
    ).toBe('Keep /missing ./copywriting https://example.test/copywriting /off-skill');
  });

  it('does not interpret a relative URL in the request body as an explicit skill', () => {
    const options = slashOptions(SKILLS, BUILT_INS, '');
    const request = 'Link the CTA to /copywriting';
    expect(inlineSkillIds(request, options)).toEqual([]);
    expect(inlineSkillRequest(request, options)).toBe(request);
    expect(inlineSkillRequest('/brand-voice Link the CTA to /copywriting', options)).toBe(request);
    expect(inlineSkillIds('/brand-voice Link the CTA to /copywriting', options)).toEqual([
      'user.skill-1',
    ]);
  });

  it('keeps a selected user skill distinct from built-ins and executable slash commands', () => {
    const options = slashOptions(
      [own('user.skill-1', 'Copywriting'), own('user.skill-2', 'Batch')],
      BUILT_INS,
      '',
    );
    const ownCopy = options.find(({ id }) => id === 'user.skill-1')!;
    const ownBatch = options.find(({ id }) => id === 'user.skill-2')!;
    expect(inlineSkillIds('/copywriting', options)).toEqual(['craftkit.copywriting']);
    expect(inlineSkillIds(`/${ownCopy.command} /${ownBatch.command}`, options)).toEqual([
      'user.skill-1',
      'user.skill-2',
    ]);
    expect(batchCommandText(`/${ownBatch.command} Write`)).toBeUndefined();
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

describe('slashCommands', () => {
  it('offers every command for no words, and those a word of theirs starts', () => {
    expect(slashCommands('')).toEqual(['remember', 'checkpoint', 'skill', 'batch']);
    expect(slashCommands('rem')).toEqual(['remember']);
    expect(slashCommands('sav')).toEqual(['checkpoint']);
    expect(slashCommands('تذك')).toEqual(['remember']);
    expect(slashCommands('مهار')).toEqual(['skill']);
    expect(slashCommands('zzz')).toEqual([]);
  });

  it('names the background-jobs command in both languages', () => {
    expect(slashCommands('ba')).toEqual(['batch']);
    expect(slashCommands('خلف')).toEqual(['batch']);
  });

  it('reads a sent `/batch <request>` as the request, and nothing else as one', () => {
    expect(batchCommandText('/batch Translate every page')).toBe('Translate every page');
    expect(batchCommandText('  /Batch   Add an FAQ\nto each page ')).toBe(
      'Add an FAQ\nto each page',
    );
    expect(batchCommandText('/خلفية ترجم كل الصفحات')).toBe('ترجم كل الصفحات');
    expect(batchCommandText('/batch')).toBe('');
    expect(batchCommandText('/batches of cookies')).toBeUndefined();
    expect(batchCommandText('Run /batch later')).toBeUndefined();
  });

  it('reads the words before the slash', () => {
    expect(textBeforeSlash('Green is ours /rem', { query: 'rem', start: 13 })).toBe(
      'Green is ours',
    );
    expect(textBeforeSlash('/rem', { query: 'rem', start: 0 })).toBe('');
  });
});

describe('slashOptions with the default skills', () => {
  it('lists the enabled defaults after the person’s skills and before the built-ins', () => {
    const defaults = defaultSkillViews('en', ['craftkit.trust-proof']);
    const options = slashOptions(SKILLS, BUILT_INS, '', [], defaults);
    expect(options.map(({ source }) => source)).toEqual([
      'user',
      'user',
      ...Array.from({ length: defaults.length - 1 }, () => 'default'),
      'builtin',
      'builtin',
    ]);
    expect(options.find(({ id }) => id === 'craftkit.pro-max-design')?.command).toBe(
      'pro-max-design',
    );
    expect(options.some(({ id }) => id === 'craftkit.trust-proof')).toBe(false);
    expect(slashOptions(SKILLS, BUILT_INS, 'pro-max', [], defaults)[0]?.id).toBe(
      'craftkit.pro-max-design',
    );
  });
});
