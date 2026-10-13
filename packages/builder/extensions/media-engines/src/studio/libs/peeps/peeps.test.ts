import { describe, expect, it, vi } from 'vitest';

import { createDialogueLibrary } from '../dialogue-entry';
import { createPeepsLibrary } from '../peeps-entry';
import { createPeepCast, MAX_PEEP_CAST } from './cast';
import { dicebearOptions, moodOf, peepTraits, PEEP_MOODS, seedOf } from './looks';
import { CORE_MOODS, peepTexture, peepTextures, type PeepRasterEnv } from './texture';

const peeps = createPeepsLibrary();

/** The parts and colours of a look, minus the face a mood picks. */
function identity(options: Parameters<typeof peepTraits>[0]) {
  return Object.fromEntries(Object.entries(peepTraits(options)).filter(([key]) => key !== 'face'));
}

describe('peeps looks', () => {
  it('draws the same SVG for the same seed, whatever its case and spacing', () => {
    const svg = peeps.svg({ seed: 'Layla' });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('viewBox="0 0 704 704"');
    expect(peeps.svg({ seed: 'Layla' })).toBe(svg);
    expect(peeps.svg({ seed: '  layla ' })).toBe(svg);
    expect(peeps.svg({ name: 'LAYLA' })).toBe(svg);
    expect(peeps.svg({ seed: 'Omar' })).not.toBe(svg);
    expect(seedOf(42)).toBe('42');
    expect(seedOf('')).toBe('peep');
    expect(seedOf({})).toBe('peep');
  });

  it('carries the Open Peeps credit and licence inside every SVG', () => {
    const svg = peeps.svg({ seed: 'credit' });
    expect(svg).toContain('Pablo Stanley');
    expect(svg).toContain('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(peeps.credit.art).toContain('CC0 1.0');
  });

  it('changes only the face with the mood', () => {
    const calm = peepTraits({ seed: 'Omar' });
    expect(calm['face']).toBe('smile');
    const faces = new Set<string>();
    for (const mood of PEEP_MOODS) {
      const traits = peepTraits({ seed: 'Omar', mood });
      faces.add(traits['face'] ?? '');
      expect(identity({ seed: 'Omar', mood })).toEqual(identity({ seed: 'Omar' }));
    }
    expect(faces.size).toBe(PEEP_MOODS.length);
    expect(peeps.svg({ seed: 'Omar', mood: 'angry' })).not.toBe(peeps.svg({ seed: 'Omar' }));
    expect(peepTraits({ seed: 'Omar', face: 'cute', mood: 'sad' })['face']).toBe('cute');
  });

  it('reads mood words in English and Arabic, falling back to calm', () => {
    expect(moodOf('Excited')).toBe('happy');
    expect(moodOf('حزين')).toBe('sad');
    expect(moodOf('surprised')).toBe('surprised');
    expect(moodOf('hungry')).toBe('calm');
    expect(moodOf(undefined)).toBe('calm');
    expect(peeps.mood('غاضب')).toBe('angry');
    expect(peeps.face('thinking')).toBe('suspicious');
    expect(peeps.coreMoods).toEqual(['calm', 'happy', 'surprised', 'sad', 'angry', 'thinking']);
  });

  it('pins art direction without reshuffling the rest of the character', () => {
    const base = peepTraits({ seed: 'Huda' });
    const directed = peepTraits({
      seed: 'Huda',
      hair: 'hijab',
      skin: 'medium-dark',
      hairColor: 'auburn',
      clothing: '#123',
    });
    expect(directed).toMatchObject({
      head: 'hijab',
      skinColor: '#ae5d29',
      headContrastColor: '#a55728',
      clothingColor: '#112233',
    });
    // A cast colour dresses the outfit unless clothing is set.
    expect(peepTraits({ seed: 'Huda', color: '#F59E0B' })['clothingColor']).toBe('#f59e0b');
    expect(peepTraits({ seed: 'Huda', color: 0x38bdf8 })['clothingColor']).toBe('#38bdf8');
    expect(identity({ seed: 'Huda', accessories: false })).toMatchObject({
      head: base['head'],
      skinColor: base['skinColor'],
      clothingColor: base['clothingColor'],
    });
    expect(peepTraits({ seed: 'Huda', accessories: 'eyepatch' })['accessories']).toBe('eyepatch');
    expect(peepTraits({ seed: 'Huda', accessories: false })['accessories']).toBeUndefined();
    expect(peepTraits({ seed: 'Huda', facialHair: 'goatee1' })['facialHair']).toBe('goatee1');
  });

  it('ignores unknown names and anything that is not a colour', () => {
    const plain = peeps.svg({ seed: 'safe' });
    const hostile = peeps.svg({
      seed: 'safe',
      hair: 'mohawk"><script>',
      skin: '"/><script>alert(1)</script>',
      background: 'url(javascript:1)',
      face: 'nope',
    });
    expect(hostile).toBe(plain);
    expect(hostile).not.toContain('<script');
    expect(dicebearOptions(null)).toMatchObject({ seed: 'peep', size: 256, face: ['smile'] });
    expect(dicebearOptions({ size: 5 })['size']).toBe(16);
    expect(dicebearOptions({ size: 1e6 })['size']).toBe(2048);
    expect(dicebearOptions({ background: '#0F172A', round: true, flip: true })).toMatchObject({
      backgroundColor: ['0f172a'],
      radius: 50,
      flip: true,
    });
    expect(peeps.svg({ seed: 'x', size: 120 })).toContain('width="120"');
  });

  it('encodes a data: URL that decodes back to the SVG', () => {
    const svg = peeps.svg({ seed: 'Noor', mood: 'happy' });
    const url = peeps.dataUrl({ seed: 'Noor', mood: 'happy' });
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    const body = url.slice('data:image/svg+xml,'.length);
    expect(body).not.toMatch(/["#<>%\n](?![0-9A-F]{2})/u);
    expect(decodeURIComponent(body)).toBe(svg.replaceAll('"', "'"));
    expect(url.length).toBeLessThan(svg.length * 1.3);
  });
});

describe('peeps cast', () => {
  it('gives the same name the same look in any cast', () => {
    const first = createPeepCast(['Layla', 'Omar']);
    const later = createPeepCast(['Sam', { name: 'omar' }, 'LAYLA']);
    const looks = (cast: typeof first, name: string) => {
      const character = cast.get(name);
      return character === undefined ? undefined : peeps.svg(character);
    };
    expect(looks(later, 'layla')).toBe(looks(first, 'Layla'));
    expect(looks(later, 'Omar')).toBe(looks(first, 'omar'));
    expect(first.list.map(({ id }) => id)).toEqual(['layla', 'omar']);
    expect(first.get('Layla')?.color).toMatch(/^#[0-9a-f]{6}$/u);
    expect(first.get('Layla')?.colorNumber).toBe(
      Number.parseInt(first.get('Layla')?.color.slice(1) ?? '', 16),
    );
  });

  it('keeps dialogue ids, colours and art direction, collapses repeats and bounds the size', () => {
    const cast = peeps.cast([
      { id: 'guide', name: 'The Guide', color: '#a78bfa', hair: 'grayBun', side: 'end' },
      'The Guide',
      'ليلى',
      '',
      7,
    ]);
    expect(cast.list.map(({ id, name }) => [id, name])).toEqual([
      ['guide', 'The Guide'],
      ['the-guide', 'The Guide'],
      ['ليلى', 'ليلى'],
    ]);
    expect(cast.get('guide')).toMatchObject({ color: '#a78bfa', side: 'end', hair: 'grayBun' });
    expect(peepTraits(cast.get('guide'))).toMatchObject({
      head: 'grayBun',
      clothingColor: '#a78bfa',
    });
    expect(createPeepCast(['A', 'a', ' a ']).size).toBe(1);
    expect(() => peeps.cast('Layla')).toThrow(RangeError);
    expect(() =>
      peeps.cast(Array.from({ length: MAX_PEEP_CAST + 1 }, (_, i) => `n${String(i)}`)),
    ).toThrow(RangeError);
  });

  it('hands the dialogue box a portrait per mood that the dialogue cast keeps whole', () => {
    const cast = peeps.cast([{ id: 'layla', name: 'Layla', color: '#f59e0b', title: 'hero' }]);
    const [member] = cast.members(['calm', 'happy', 'excited', 'sad']);
    expect(member).toMatchObject({ id: 'layla', name: 'Layla', color: '#f59e0b', title: 'hero' });
    expect(Object.keys(member?.expressions ?? {})).toEqual(['calm', 'happy', 'sad']);
    expect(member?.portrait).toBe(member?.expressions['calm']);
    expect(member?.portrait.startsWith('data:image/svg+xml,')).toBe(true);
    expect(member?.portrait.length).toBeGreaterThan(2048);
    expect(Object.keys(cast.members()[0]?.expressions ?? {})).toEqual([...PEEP_MOODS]);
    const dialogue = createDialogueLibrary().cast(cast.members());
    expect(dialogue.portrait('layla')).toBe(member?.portrait);
    expect(dialogue.portrait('layla', 'happy')).toBe(member?.expressions['happy']);
    expect(dialogue.get('layla')?.color).toBe('#f59e0b');
  });
});

/* A browser stand-in: images "decode" on the next task, canvases record what was drawn. */
function fakeEnv(options: { fail?: boolean } = {}) {
  const drawn: { width: number; height: number; src: string }[] = [];
  const env: PeepRasterEnv = {
    devicePixelRatio: 1,
    createImage() {
      const image = {
        src: '',
        decoding: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      setTimeout(() => {
        if (options.fail === true) image.onerror?.();
        else image.onload?.();
      }, 0);
      return image;
    },
    createCanvas(width, height) {
      const canvas = {
        width,
        height,
        getContext: () => ({
          drawImage(image: unknown, _x: number, _y: number, w: number, h: number) {
            drawn.push({ width: w, height: h, src: (image as { src: string }).src });
          },
        }),
      };
      return canvas;
    },
  };
  return { env, drawn };
}

function fakePixi() {
  const from = vi.fn((source: { resource: { width: number }; resolution: number }) => ({
    source,
    width: source.resource.width / source.resolution,
    destroyed: false,
  }));
  return { Texture: { from }, from };
}

describe('peeps textures', () => {
  it('rasterizes at size × the scene resolution and wraps the canvas as a texture', async () => {
    const { env, drawn } = fakeEnv();
    const PIXI = fakePixi();
    const scene = { PIXI, dpr: 2, app: { renderer: { resolution: 1 } } };
    const texture = (await peepTexture(scene, { seed: 'Layla', size: 100 }, env)) as {
      width: number;
      source: { resolution: number; resource: { width: number; height: number } };
    };
    expect(texture.width).toBe(100);
    expect(texture.source.resolution).toBe(2);
    expect(texture.source.resource).toMatchObject({ width: 200, height: 200 });
    expect(PIXI.from).toHaveBeenCalledWith(expect.objectContaining({ resolution: 2 }), true);
    expect(drawn[0]).toMatchObject({ width: 200, height: 200 });
    expect(drawn[0]?.src.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(drawn[0]?.src ?? '')).toContain(`width='200'`);
  });

  it('reuses a texture for the same look until it is destroyed', async () => {
    const { env } = fakeEnv();
    const PIXI = fakePixi();
    const first = (await peepTexture(PIXI, { seed: 'Sam', resolution: 1 }, env)) as {
      destroyed: boolean;
    };
    expect(await peepTexture(PIXI, { seed: 'sam', resolution: 1 }, env)).toBe(first);
    expect(PIXI.from).toHaveBeenCalledTimes(1);
    first.destroyed = true;
    expect(await peepTexture(PIXI, { seed: 'Sam', resolution: 1 }, env)).not.toBe(first);
    expect(PIXI.from).toHaveBeenCalledTimes(2);
  });

  it('renders a still (reduced-motion) scene once the texture is in use', async () => {
    const { env } = fakeEnv();
    const render = vi.fn();
    const scene = { PIXI: fakePixi(), reducedMotion: true, app: { render } };
    await peepTexture(scene, { seed: 'still' }, env);
    // The awaiting code places its sprite first; the render follows on the next task.
    expect(render).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(render).toHaveBeenCalledTimes(1);
    await peepTexture({ ...scene, reducedMotion: false }, { seed: 'still' }, env);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('prepares every core mood at once', async () => {
    const { env } = fakeEnv();
    const PIXI = fakePixi();
    const faces = await peepTextures(PIXI, { seed: 'Noor' }, undefined, env);
    expect(Object.keys(faces)).toEqual([...CORE_MOODS]);
    expect(new Set(Object.values(faces)).size).toBe(CORE_MOODS.length);
    const two = await peepTextures(PIXI, { seed: 'Noor' }, ['happy', 'joy', 'sad'], env);
    expect(Object.keys(two)).toEqual(['happy', 'sad']);
    expect(two['happy']).toBe(faces['happy']);
  });

  it('refuses a target without Pixi and reports an image that does not decode', async () => {
    await expect(peepTexture({ app: {} }, { seed: 'x' }, fakeEnv().env)).rejects.toThrow(
      /needs the scene/u,
    );
    await expect(peeps.texture(null, { seed: 'x' })).rejects.toThrow(TypeError);
    const PIXI = fakePixi();
    await expect(
      peepTexture(PIXI, { seed: 'broken' }, fakeEnv({ fail: true }).env),
    ).rejects.toThrow(/did not decode/u);
    // The failure is not cached: the next call tries again.
    await expect(peepTexture(PIXI, { seed: 'broken' }, fakeEnv().env)).resolves.toBeDefined();
  });
});

describe('createPeepsLibrary', () => {
  it('is a frozen, documented surface', () => {
    expect(Object.isFrozen(peeps)).toBe(true);
    expect(peeps.version).toBe('9.4.3');
    expect(peeps.moods).toEqual([...PEEP_MOODS]);
    expect(peeps.hair).toContain('hijab');
    expect(peeps.skins).toEqual(['light', 'medium-light', 'medium', 'medium-dark', 'dark']);
    expect(peeps.limits).toMatchObject({ defaultSize: 256, maxCast: MAX_PEEP_CAST });
  });
});
