import { describe, expect, it } from 'vitest';

import { LIBRARY_ID_PATTERN } from '../site/library';
import {
  parseSoundAttribute,
  parseSoundAttributeRuntime,
  parseZzfxCall,
  searchSoundBank,
  SOUND_BANK,
  SOUND_BANK_IDS,
  SOUND_RECIPE_IDS,
  soundAttributeProblem,
  soundBankEntry,
  soundPlaybackEntry,
  soundRecipeParamsProblem,
  validateZzfxParams,
  zzfxParam,
  zzfxDurationSeconds,
} from './index';

const ARABIC = /[؀-ۿ]/u;

describe('the built-in sound bank', () => {
  it('holds 28 presets: 10 ui, 10 effects, 8 ambient recipes, ids unique and kebab', () => {
    expect(SOUND_BANK).toHaveLength(28);
    expect(SOUND_BANK.filter((entry) => entry.bus === 'ui')).toHaveLength(10);
    expect(SOUND_BANK.filter((entry) => entry.bus === 'sfx')).toHaveLength(10);
    expect(SOUND_BANK.filter((entry) => entry.kind === 'recipe').map((entry) => entry.id)).toEqual([
      ...SOUND_RECIPE_IDS,
    ]);
    expect(new Set(SOUND_BANK_IDS).size).toBe(28);
    for (const id of SOUND_BANK_IDS) expect(id).toMatch(/^[a-z][a-z0-9-]*$/u);
  });

  it.each(SOUND_BANK.map((entry) => [entry.id, entry] as const))('%s validates', (_id, entry) => {
    expect(entry.label.en.length).toBeGreaterThan(0);
    expect(entry.label.ar).toMatch(ARABIC);
    expect(entry.tags.length).toBeGreaterThan(0);
    for (const tag of entry.tags) expect(tag).toMatch(/^[a-z][a-z0-9-]*$/u);
    expect(entry.durationMs).toBeGreaterThan(0);
    if (entry.kind === 'zzfx') {
      expect(validateZzfxParams(entry.params)).toBeUndefined();
      expect(entry.params.length).toBeLessThanOrEqual(21);
      expect(entry.durationMs).toBe(Math.round(zzfxDurationSeconds(entry.params) * 1000));
      expect(entry.durationMs).toBeLessThanOrEqual(1_000);
    } else {
      expect(entry.bus).toBe('ambient');
      expect(soundRecipeParamsProblem(entry.params)).toBeUndefined();
    }
    const playback = soundPlaybackEntry(entry.id);
    expect(playback?.kind).toBe(entry.kind);
    expect(playback?.bus).toBe(entry.bus);
    if (entry.kind === 'zzfx' && playback?.kind === 'zzfx') {
      expect(entry.params.map((_value, index) => zzfxParam(playback.params, index))).toEqual(
        entry.params,
      );
    }
  });

  it('finds sounds by id, English or Arabic label and tag', () => {
    expect(soundBankEntry('pop')?.kind).toBe('zzfx');
    expect(soundBankEntry('nope')).toBeUndefined();
    expect(searchSoundBank('رياح').map((entry) => entry.id)).toEqual(['wind', 'desert-wind']);
    expect(searchSoundBank('Glass').map((entry) => entry.id)).toEqual(['glass-ting']);
    expect(searchSoundBank('arabic').map((entry) => entry.id)).toEqual([
      'desert-wind',
      'oud-drone',
    ]);
    expect(searchSoundBank('  ')).toHaveLength(28);
  });

  it('refuses recipe params outside the closed keys or 0..1', () => {
    expect(soundRecipeParamsProblem({ intensity: 2 })).toMatch(/0 to 1/u);
    expect(soundRecipeParamsProblem({ loud: 1 })).toMatch(/not one of/u);
    expect(soundRecipeParamsProblem([1])).toMatch(/object/u);
  });
});

describe('zzfx parameter rule', () => {
  it('bounds length, volume and duration', () => {
    expect(validateZzfxParams([1, 0.05, 537, 0.02, 0.22])).toBeUndefined();
    expect(validateZzfxParams(Array.from({ length: 22 }, () => 0))).toMatch(/at most 21/u);
    expect(validateZzfxParams([1.5])).toMatch(/volume/u);
    expect(validateZzfxParams([1, 0, 220, 2, 2, 0.5])).toMatch(/at most 4 s/u);
    expect(validateZzfxParams([1, 0, 220, -1])).toMatch(/negative/u);
    expect(validateZzfxParams([1, Number.NaN])).toMatch(/finite/u);
    expect(validateZzfxParams('1,2')).toMatch(/array/u);
    expect(validateZzfxParams([])).toMatch(/at least one/u);
  });

  it('reads zzfx(…) with empty slots and refuses spaces or words', () => {
    expect(parseZzfxCall('zzfx(1,,537,.02)')).toEqual([1, undefined, 537, 0.02]);
    expect(parseZzfxCall('zzfx(1, 2)')).toMatch(/numbers only/u);
    expect(parseZzfxCall('zzfx(a)')).toMatch(/numbers only/u);
    expect(parseZzfxCall('zzfx1,2')).toMatch(/written zzfx/u);
    expect(parseZzfxCall(`zzfx(${Array.from({ length: 22 }, () => '0').join(',')})`)).toMatch(
      /at most 21/u,
    );
  });
});

describe('data-ck-sound grammar', () => {
  it('reads triggers, refs and volumes', () => {
    expect(
      parseSoundAttribute('click:pop hover:hover-tick@0.4 enter:lib:brand-chime ambient:wind'),
    ).toEqual({
      tokens: [
        { trigger: 'click', ref: { kind: 'bank', id: 'pop' }, volume: undefined },
        { trigger: 'hover', ref: { kind: 'bank', id: 'hover-tick' }, volume: 0.4 },
        { trigger: 'enter', ref: { kind: 'lib', id: 'brand-chime' }, volume: undefined },
        { trigger: 'ambient', ref: { kind: 'bank', id: 'wind' }, volume: undefined },
      ],
    });
    expect(parseSoundAttribute('leave:asset:snd_01@1')).toEqual({
      tokens: [{ trigger: 'leave', ref: { kind: 'asset', id: 'snd_01' }, volume: 1 }],
    });
    expect(parseSoundAttribute('click:zzfx(.5,,900)@.3')).toEqual({
      tokens: [
        { trigger: 'click', ref: { kind: 'zzfx', params: [0.5, undefined, 900] }, volume: 0.3 },
      ],
    });
  });

  it.each([
    ['', /at least one/u],
    ['pop', /starts with a trigger/u],
    ['scroll:pop', /starts with a trigger/u],
    ['click:boom', /not a sound/u],
    ['click:pop@2', /0 to 1/u],
    ['click:lib:Bad_Id', /project sound id/u],
    ['click:asset:a/b', /asset id/u],
    ['click:zzfx(2)', /volume/u],
    ['ambient:wind ambient:rain', /one ambient/u],
    ['click:pop click:tap click:coin click:bubble click:thud', /at most 4/u],
  ])('refuses %j with a repair sentence', (value, message) => {
    expect(soundAttributeProblem(value)).toMatch(message);
    expect(parseSoundAttributeRuntime(value)).toBeUndefined();
  });

  it('keeps its library id rule equal to the site library pattern', () => {
    for (const id of ['a', 'rain-loop', `a${'b'.repeat(47)}`]) {
      expect(LIBRARY_ID_PATTERN.test(id)).toBe(true);
      expect(soundAttributeProblem(`click:lib:${id}`)).toBeUndefined();
    }
    for (const id of ['9a', 'A', `a${'b'.repeat(48)}`]) {
      expect(LIBRARY_ID_PATTERN.test(id)).toBe(false);
      expect(soundAttributeProblem(`click:lib:${id}`)).toBeDefined();
    }
  });
});
