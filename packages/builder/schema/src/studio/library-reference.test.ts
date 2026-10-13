import { describe, expect, it } from 'vitest';

import { CK_API_REFERENCE } from './api-reference';
import { CK_LIBRARY_REFERENCE, libraryEntry } from './library-reference';
import { STUDIO_LIB_KEYS, STUDIO_PIXI_BOUND_KEYS } from './types';

describe('CK_LIBRARY_REFERENCE', () => {
  it('describes exactly the add-on libraries the allowlist admits, in order', () => {
    expect(CK_LIBRARY_REFERENCE.map((entry) => entry.key)).toEqual(
      STUDIO_LIB_KEYS.filter((key) => key !== 'kit'),
    );
  });

  it('agrees with the Pixi-bound list', () => {
    for (const entry of CK_LIBRARY_REFERENCE) {
      expect(entry.pixiBound).toBe(STUDIO_PIXI_BOUND_KEYS.includes(entry.key));
    }
  });

  it('has bilingual purposes and at least one call per library', () => {
    for (const entry of CK_LIBRARY_REFERENCE) {
      expect(entry.purpose.en.length).toBeGreaterThan(10);
      expect(entry.purpose.ar).toMatch(/[؀-ۿ]/u);
      expect(entry.api.length).toBeGreaterThan(0);
    }
  });

  it('is named in ck.use and s.lib signatures', () => {
    const use = CK_API_REFERENCE.find((member) => member.name === 'ck.use')?.signature ?? '';
    const lib = CK_API_REFERENCE.find((member) => member.name === 's.lib')?.signature ?? '';
    for (const entry of CK_LIBRARY_REFERENCE) {
      expect(use).toContain(`'${entry.key}'`);
      expect(lib).toContain(`${entry.key}?`);
    }
  });

  it('looks entries up by key', () => {
    expect(libraryEntry('dialogue')?.source).toBe('first-party');
    expect(libraryEntry('kit')).toBeUndefined();
  });

  it('describes the game libraries by the calls their skills teach', () => {
    expect(libraryEntry('audio')?.api.join('\n')).toContain('s.lib.audio.create(s)');
    expect(libraryEntry('gameai')?.pixiBound).toBe(false);
    expect(libraryEntry('gameai')?.api.join('\n')).toContain('.chase(hero)');
    expect(libraryEntry('hud')?.purpose.en).toMatch(/keyboard/u);
    expect(CK_API_REFERENCE.find((member) => member.name === 's.audio')?.detail.en).toContain(
      'Not s.lib.audio',
    );
  });

  it('describes the character library by the calls the creative skills teach', () => {
    const peeps = libraryEntry('peeps');
    expect(peeps?.pixiBound).toBe(false);
    expect(peeps?.purpose.en).toMatch(/Open Peeps.*CC0/u);
    expect(peeps?.api.join('\n')).toContain('s.lib.peeps.cast(');
    expect(peeps?.api.join('\n')).toContain('s.lib.dialogue.cast(people.members())');
  });
});
