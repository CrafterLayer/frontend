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

  it('describes the emitter presets and the physics world by the calls the skills teach', () => {
    const emitter = libraryEntry('emitter');
    expect(emitter?.api.join('\n')).toContain("s.lib.emitter.spawn(s, 'snow'");
    expect(emitter?.api.join('\n')).toContain('s.lib.emitter.burst(s,');
    expect(emitter?.api.join('\n')).toContain('new PIXI.ParticleContainer(');
    for (const preset of ['fire', 'snow', 'confetti', 'fireworks', 'embers']) {
      expect(emitter?.purpose.en).toContain(preset);
    }
    const physics = libraryEntry('physics');
    expect(physics?.pixiBound).toBe(false);
    expect(physics?.api.join('\n')).toContain('s.lib.physics.world(s,');
    expect(physics?.purpose.ar).toContain('world(s)');
  });

  it('describes the character library by the calls the creative skills teach', () => {
    const peeps = libraryEntry('peeps');
    expect(peeps?.pixiBound).toBe(false);
    expect(peeps?.purpose.en).toMatch(/Open Peeps.*CC0/u);
    expect(peeps?.api.join('\n')).toContain('s.lib.peeps.cast(');
    expect(peeps?.api.join('\n')).toContain('s.lib.dialogue.cast(people.members())');
  });

  it('describes procedural maps and animated GIFs by the calls the creative agent writes', () => {
    const procgen = libraryEntry('procgen');
    expect(procgen?.pixiBound).toBe(false);
    expect(procgen?.source).toBe('rot-js');
    expect(procgen?.api.join('\n')).toContain('s.lib.procgen.dungeon(s,');
    expect(procgen?.api.join('\n')).toContain('rows: map.rows()');
    expect(procgen?.purpose.en).toMatch(/always connected/u);
    const gif = libraryEntry('gif');
    expect(gif?.pixiBound).toBe(false);
    expect(gif?.api.join('\n')).toContain('await s.lib.gif.load(s, url');
    expect(gif?.purpose.en).toMatch(/never an invented one/u);
    expect(gif?.purpose.en).toMatch(/reduced motion/u);
  });

  it('describes the mural libraries and the hex tiles by the calls the mural playbook teaches', () => {
    const noise = libraryEntry('noise');
    expect(noise?.pixiBound).toBe(false);
    expect(noise?.api.join('\n')).toContain('s.lib.noise.create(s,');
    expect(noise?.api.join('\n')).toContain('n.grid({ width: 1280, height: 720');
    expect(noise?.api.join('\n')).toContain("'perlin' | 'value' | 'value-cubic'");
    const geom = libraryEntry('geom');
    expect(geom?.pixiBound).toBe(false);
    expect(geom?.source).toBe('d3-contour + polybooljs + Bezier.js + d3-shape + simplify-js');
    for (const call of [
      's.lib.geom.bands(grid',
      's.lib.geom.mosaic(s,',
      's.lib.geom.draw(g,',
      's.lib.geom.curve([',
      's.lib.geom.spline(points,',
      's.lib.geom.pie([3, 1, 2], { pad: 0.03, dir: s.dir })',
      's.lib.geom.arc({ cx: 640, cy: 360, inner: 120, outer: 220',
      's.lib.geom.simplify(strokePoints, 2',
    ])
      expect(geom?.api.join('\n')).toContain(call);
    const hex = libraryEntry('hex');
    expect(hex?.pixiBound).toBe(false);
    expect(hex?.purpose.en).toMatch(/Kenney.*CC0/u);
    expect(hex?.purpose.en).toMatch(/mirrors in RTL/u);
    expect(hex?.api.join('\n')).toContain('await s.lib.hex.load(s)');
  });

  it('describes perceptual colour and L-system growth by the calls the mural playbook teaches', () => {
    const color = libraryEntry('color');
    expect(color?.pixiBound).toBe(false);
    expect(color?.source).toBe('culori');
    expect(color?.purpose.en).toMatch(/OKLCH.*page palette|page palette.*OKLCH/u);
    for (const call of [
      "Co.ramp(C.surface, C.accent, 7, { space: 'oklch' })",
      'Co.readable(',
      'Co.shades(',
    ])
      expect(color?.api.join('\n')).toContain(call);
    const lsys = libraryEntry('lsys');
    expect(lsys?.pixiBound).toBe(false);
    expect(lsys?.source).toBe('lindenmayer');
    expect(lsys?.purpose.en).toMatch(/mirrors with s\.dir/u);
    expect(lsys?.purpose.ar).toContain('s.dir');
    for (const call of ['L.grow(s, {', 'L.fit(', 'L.upTo(r, t)', 'dir: s.dir'])
      expect(lsys?.api.join('\n')).toContain(call);
  });
});
