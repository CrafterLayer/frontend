import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { ANIMALS_CREDIT, ANIMALS_VERSION, createAnimalsLibrary } from '../animals-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import {
  ANIMAL_ATLAS_SCALE,
  ANIMAL_ATLAS_SHA256,
  ANIMAL_ATLAS_SIZE,
  ANIMAL_ATLAS_URL,
  ANIMAL_FRAMES,
} from './atlas.generated';
import { ANIMAL_NAMES, closeAnimals, findAnimal } from './names';
import { animalSprite, animalTexture, animalTextures } from './texture';

class FrameTexture {
  destroyed = false;

  constructor(
    readonly options: {
      source: unknown;
      frame: { x: number; y: number; width: number; height: number };
    },
  ) {}

  destroy(): void {
    this.destroyed = true;
  }
}

/* Fake Pixi plus a Texture that records frames, and a decoder that counts atlas decodes. */
function pixi() {
  const { PIXI } = fakePixi();
  const image = { label: 'decoded atlas image' };
  const source = { label: 'atlas-source', destroyed: false };
  const decoded: string[] = [];
  const Texture = class extends FrameTexture {
    static from(resource: unknown, skipCache?: boolean) {
      expect(resource).toBe(image);
      expect(skipCache).toBe(true);
      return { source, destroyed: false, destroy: () => undefined };
    }
  };
  return {
    PIXI: { ...PIXI, Texture },
    source,
    decoded,
    decode: (url: string) => {
      decoded.push(url);
      return Promise.resolve(image);
    },
  };
}

describe('the animal atlas', () => {
  it('frames every animal inside the atlas, without overlaps, at the advertised scale', () => {
    const names = Object.keys(ANIMAL_FRAMES);
    // 30 heads in the pack; the pig is left out by the owner's decision (2026-11-05).
    expect(names).toHaveLength(29);
    expect(names).not.toContain('pig');
    expect(new Set(names).size).toBe(names.length);
    expect(ANIMAL_NAMES).toEqual([...names].sort());
    const boxes = Object.values(ANIMAL_FRAMES);
    for (const [x, y, width, height] of boxes) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(ANIMAL_ATLAS_SIZE.width);
      expect(y + height).toBeLessThanOrEqual(ANIMAL_ATLAS_SIZE.height);
      // Every Kenney head is at least 128 units wide and tall.
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(Math.floor(128 * ANIMAL_ATLAS_SCALE));
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart =
          a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
        expect(apart).toBe(true);
      }
    }
    expect(Math.max(ANIMAL_ATLAS_SIZE.width, ANIMAL_ATLAS_SIZE.height)).toBeLessThanOrEqual(2048);
  });

  it('is the WebP its hash and size name', () => {
    const [prefix, base64] = ANIMAL_ATLAS_URL.split(',');
    expect(prefix).toBe('data:image/webp;base64');
    const bytes = Buffer.from(base64 ?? '', 'base64');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(ANIMAL_ATLAS_SHA256);
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
    // VP8L (lossless) header: 14-bit width - 1 and height - 1 after the signature byte.
    expect(bytes.subarray(12, 16).toString('latin1')).toBe('VP8L');
    const bits = bytes.readUInt32LE(21);
    expect((bits & 0x3fff) + 1).toBe(ANIMAL_ATLAS_SIZE.width);
    expect(((bits >>> 14) & 0x3fff) + 1).toBe(ANIMAL_ATLAS_SIZE.height);
  });
});

describe('animals.find', () => {
  it.each([
    ['panda', 'panda'],
    ['Panda', 'panda'],
    ['pandas', 'panda'],
    ['bunny', 'rabbit'],
    ['killer whale', 'whale'],
    ['Hippopotamus', 'hippo'],
    ['rooster', 'chicken'],
    ['دب', 'bear'],
    ['الدُّبّ', 'bear'],
    ['باندا', 'panda'],
    ['بطريق', 'penguin'],
    ['البطريق', 'penguin'],
    ['فيل', 'elephant'],
    ['الفيل', 'elephant'],
    ['زرافة', 'giraffe'],
    ['زرافه', 'giraffe'],
    ['أرنب', 'rabbit'],
    ['ارنب', 'rabbit'],
    ['الأرنب', 'rabbit'],
    ['بومة', 'owl'],
    ['قرد', 'monkey'],
    ['بقرة', 'cow'],
    ['حصان', 'horse'],
    ['ضفدع', 'frog'],
    ['تمساح', 'crocodile'],
    ['حوت', 'whale'],
    ['الحوت', 'whale'],
    ['فرس النهر', 'hippo'],
    ['وحيد القرن', 'rhino'],
    ['حمار وحشي', 'zebra'],
    ['الحمار الوحشي', 'zebra'],
    ['ببغاء', 'parrot'],
    ['كلب', 'dog'],
    ['جرو', 'dog'],
    ['ماعز', 'goat'],
    ['عنزة', 'goat'],
    ['صوص', 'chick'],
    ['كتكوت', 'chick'],
    ['دجاجة', 'chicken'],
    ['جاجة', 'chicken'],
    ['بطة', 'duck'],
    ['غوريلا', 'gorilla'],
    ['ثعبان', 'snake'],
    ['أفعى', 'snake'],
    ['افعى', 'snake'],
  ])('%s → %s', (word, name) => {
    expect(findAnimal(word)).toBe(name);
    expect(createAnimalsLibrary().find(word)).toBe(name);
  });

  it('finds nothing for animals the pack lacks, or for non-words', () => {
    for (const word of ['camel', 'جمل', 'خروف', 'خاروف', 'sheep', 'cat', '', '   ', 'ال']) {
      expect(findAnimal(word)).toBeUndefined();
    }
    expect(findAnimal(42)).toBeUndefined();
    expect(findAnimal(null)).toBeUndefined();
  });

  it('suggests close names for typos', () => {
    expect(closeAnimals('pandaa')).toContain('panda');
    expect(closeAnimals('girafe')).toContain('giraffe');
    expect(closeAnimals('زرافا')).toContain('giraffe');
    expect(closeAnimals('camel')).toEqual([]);
  });
});

describe('animals.texture / textures / sprite', () => {
  it('decodes the atlas once per Pixi namespace and frames each head', async () => {
    const p = pixi();
    const panda = (await animalTexture(p.PIXI, 'panda', p.decode)) as FrameTexture;
    const again = await animalTexture({ PIXI: p.PIXI }, 'باندا', p.decode);
    const owl = (await animalTexture(p.PIXI, 'owl', p.decode)) as FrameTexture;
    expect(p.decoded).toEqual([ANIMAL_ATLAS_URL]);
    expect(again).toBe(panda);
    expect(panda.options.source).toBe(p.source);
    const [x, y, width, height] = ANIMAL_FRAMES['panda'] ?? [];
    expect(panda.options.frame).toMatchObject({ x, y, width, height });
    expect(owl).not.toBe(panda);

    const other = pixi();
    await animalTexture(other.PIXI, 'panda', other.decode);
    expect(other.decoded).toHaveLength(1);
  });

  it('decodes again once a scene destroyed the atlas source, and retries a failed decode', async () => {
    const p = pixi();
    await animalTexture(p.PIXI, 'cow', p.decode);
    p.source.destroyed = true;
    await animalTexture(p.PIXI, 'cow', p.decode);
    expect(p.decoded).toHaveLength(2);

    const q = pixi();
    const failing = () => Promise.reject(new Error('decode failed'));
    await expect(animalTexture(q.PIXI, 'cow', failing)).rejects.toThrow('decode failed');
    await animalTexture(q.PIXI, 'cow', q.decode);
    expect(q.decoded).toHaveLength(1);
  });

  it('returns several heads by canonical name', async () => {
    const p = pixi();
    const set = await animalTextures(p.PIXI, ['panda', 'بومة', 'owl', 'Bunny'], p.decode);
    expect(Object.keys(set)).toEqual(['panda', 'owl', 'rabbit']);
    expect(Object.isFrozen(set)).toBe(true);
    await expect(animalTextures(p.PIXI, 'panda', p.decode)).rejects.toThrow(TypeError);
  });

  it('builds a centred sprite, size px wide', async () => {
    const p = pixi();
    const sprite = (await animalSprite(p.PIXI, 'moose', { size: 200, x: 30, y: 40 }, p.decode)) as {
      anchor: { x: number; y: number };
      scale: { x: number; y: number };
      x: number;
      y: number;
      label: string;
      texture: FrameTexture;
    };
    const frame = ANIMAL_FRAMES['moose'] ?? [0, 0, 1, 1];
    expect(sprite.anchor).toMatchObject({ x: 0.5, y: 0.5 });
    expect(sprite.scale.x).toBeCloseTo(200 / frame[2]);
    expect(sprite.scale.y).toBeCloseTo(200 / frame[2]);
    expect([sprite.x, sprite.y, sprite.label]).toEqual([30, 40, 'animal:moose']);
    expect(sprite.texture.options.frame.width).toBe(frame[2]);

    const tiny = (await animalSprite(p.PIXI, 'owl', { size: -5 }, p.decode)) as {
      scale: { x: number };
    };
    expect(tiny.scale.x).toBeCloseTo(8 / (ANIMAL_FRAMES['owl']?.[2] ?? 1));
  });

  it('refuses the pig, which never ships (the owner left it out)', async () => {
    const p = pixi();
    await expect(animalTexture(p.PIXI, 'pig', p.decode)).rejects.toThrow(TypeError);
    await expect(animalTexture(p.PIXI, 'خنزير', p.decode)).rejects.toThrow(TypeError);
  });

  it('renders a reduced-motion scene once the texture is in use', async () => {
    vi.useFakeTimers();
    try {
      const p = pixi();
      const render = vi.fn();
      await animalTexture({ PIXI: p.PIXI, reducedMotion: true, app: { render } }, 'panda', p.decode);
      expect(render).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      expect(render).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects unknown animals with a TypeError naming close matches, and bad targets', async () => {
    const p = pixi();
    await expect(animalTexture(p.PIXI, 'pandaa', p.decode)).rejects.toThrow(
      /unknown animal "pandaa"; did you mean panda/u,
    );
    await expect(animalSprite(p.PIXI, 'camel', {}, p.decode)).rejects.toThrow(
      /the animals are bear, buffalo/u,
    );
    await expect(animalTexture(p.PIXI, 7, p.decode)).rejects.toThrow(TypeError);
    await expect(animalTexture({}, 'panda', p.decode)).rejects.toThrow(
      /needs the scene \(s\) or s\.PIXI/u,
    );
    expect(p.decoded).toEqual([]);
  });
});

describe('createAnimalsLibrary', () => {
  it('is frozen and lists its names and credit', () => {
    const lib = createAnimalsLibrary();
    expect(Object.isFrozen(lib)).toBe(true);
    expect(Object.isFrozen(lib.names)).toBe(true);
    expect(lib.version).toBe(ANIMALS_VERSION);
    expect(lib.credit).toBe(ANIMALS_CREDIT);
    expect(lib.credit).toMatch(/Kenney.*CC0/u);
    expect(lib.names).toContain('panda');
    expect(lib.atlasSha256).toBe(ANIMAL_ATLAS_SHA256);
  });
});
