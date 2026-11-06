import { describe, expect, it, vi } from 'vitest';

import { createStickersLibrary } from '../stickers-entry';
import { foldWord, STICKER_NAMES } from './catalog';
import { STICKER_ROWS } from './stickers.generated';
import { stickerTexture, stickerTextures, type StickerRasterEnv } from './texture';

const stickers = createStickersLibrary();

/* What must never ship, whatever the curated list says (scripts/build-stickers-data.mjs). */
const EXCLUDED = [
  /-flag$|-flags$/u,
  // A person's five skin tones (the traffic light is not one).
  /(?<!traffic)-(light|medium-light|medium|medium-dark|dark)$/u,
  /beer|wine|cocktail|sake|tumbler-glass|tropical-drink|bottle-with-popping-cork|clinking/u,
  /cigarette|smoking/u,
  /bomb|dagger|sword|pistol|^axe$|bow-and-arrow|kitchen-knife|military/u,
  /slot-machine|joker|mahjong|flower-playing-cards|pool-8-ball/u,
  /syringe|drop-of-blood|adhesive-bandage|pill|head-bandage|x-ray|coffin|headstone|funeral|skull/u,
  /^pig|^boar$|bacon/u,
  /church|latin-cross|orthodox-cross|synagogue|temple|shrine|menorah|^om$|khanda|star-of-david/u,
  /santa|christmas|jack-o-lantern|hamsa|nazar|prayer/u,
  /kiss|bikini|briefs|lipstick|middle-finger|vomit|nauseated|woozy|pile-of-poo|horns|vampire|zombie/u,
];

const ARABIC = /[؀-ۿ]/u;

describe('stickers data', () => {
  it('has unique names, a viewBox and an SVG body for every sticker', () => {
    expect(new Set(STICKER_NAMES).size).toBe(STICKER_NAMES.length);
    expect(stickers.count).toBe(STICKER_ROWS.length);
    expect(stickers.count).toBeGreaterThanOrEqual(350);
    expect(stickers.count).toBeLessThanOrEqual(500);
    for (const name of STICKER_NAMES) {
      const info = stickers.info(name);
      expect(info?.viewBox, name).toMatch(/^0 0 32 3[23]$/u);
      expect(stickers.svg(name), name).toMatch(
        /^<svg [^>]*viewBox="0 0 32 3[23]"[^>]*><.+<\/svg>$/su,
      );
    }
  });

  it('leaves out flags, skin tones, alcohol, weapons, gambling, gore and adult art', () => {
    const shipped = STICKER_NAMES.filter((name) => EXCLUDED.some((pattern) => pattern.test(name)));
    expect(shipped).toEqual([]);
  });

  it('carries no script, event handler or outside reference in any body', () => {
    for (const [name, , , , body] of STICKER_ROWS) {
      expect(body, name).not.toMatch(/<script|<foreignObject|\son\w+=|xlink:|href="(?!#)/iu);
    }
  });

  it('gives the groups the brief asks for, each sticker in one of them', () => {
    expect(Object.keys(stickers.groups)).toEqual([
      'animals',
      'nature',
      'sky',
      'food',
      'vehicles',
      'home',
      'clothes',
      'toys',
      'school',
      'music',
      'sports',
      'fantasy',
      'faces',
      'gestures',
      'people',
      'arab',
      'symbols',
    ]);
    const grouped = Object.values(stickers.groups).flat();
    expect(grouped.length).toBe(stickers.count);
    expect(stickers.groups['arab']).toEqual(
      expect.arrayContaining(['mosque', 'kaaba', 'camel', 'palm-tree', 'teapot', 'falafel']),
    );
    expect(stickers.groups['fantasy']).toEqual(
      expect.arrayContaining(['dragon', 'unicorn', 'castle']),
    );
  });

  it('resolves every alias to the sticker that owns it, and most have Arabic', () => {
    let arabic = 0;
    for (const name of STICKER_NAMES) {
      const words = stickers.info(name)?.words ?? [];
      if (words.some((word) => ARABIC.test(word))) arabic += 1;
      expect(stickers.find(name), name).toBe(name);
      for (const word of words) expect(stickers.find(word), `${word} → ${name}`).toBe(name);
    }
    // Every sticker has at least one Arabic word.
    expect(arabic).toBe(stickers.count);
  });
});

describe('stickers find and search', () => {
  it('finds English names in any spelling', () => {
    expect(stickers.find('teddy-bear')).toBe('teddy-bear');
    expect(stickers.find('Teddy Bear')).toBe('teddy-bear');
    expect(stickers.find('  CAT ')).toBe('cat');
    expect(stickers.find('cats')).toBe('cat');
    expect(stickers.find('butterflies')).toBe('butterfly');
    expect(stickers.find('kitty')).toBe('cat');
  });

  it('finds Arabic words with or without ال, tashkeel and hamza', () => {
    expect(stickers.find('قطة')).toBe('cat');
    expect(stickers.find('القطة')).toBe('cat');
    expect(stickers.find('بسة')).toBe('cat');
    expect(stickers.find('دُبّ')).toBe('bear');
    expect(stickers.find('بطريق')).toBe('penguin');
    expect(stickers.find('اسد')).toBe('lion');
    expect(stickers.find('الأسد')).toBe('lion');
    expect(stickers.find('مسجد')).toBe('mosque');
    expect(stickers.find('الكعبة')).toBe('kaaba');
    expect(stickers.find('هلال')).toBe('crescent-moon');
    expect(stickers.find('٣')).toBe('keycap-3');
  });

  it('refuses words nothing answers to, and non-strings', () => {
    expect(stickers.find('xylophone-quasar')).toBeUndefined();
    expect(stickers.find('')).toBeUndefined();
    expect(stickers.find(42 as unknown as string)).toBeUndefined();
  });

  it('searches by word part and by group, best first, within the limit', () => {
    const hearts = stickers.search('heart');
    expect(hearts[0]).toBe('red-heart');
    expect(hearts).toEqual(expect.arrayContaining(['blue-heart', 'broken-heart']));
    expect(stickers.search('قلب', 3)).toHaveLength(3);
    expect(stickers.search('حيوانات', 100)).toEqual(expect.arrayContaining(['cat', 'lion']));
    expect(stickers.search('animals', 5)).toHaveLength(5);
    expect(stickers.search('سيارة')[0]).toBe('automobile');
    expect(stickers.search('nothing-like-this')).toEqual([]);
    expect(stickers.search('cat', 1000).length).toBeLessThanOrEqual(100);
  });

  it('folds the way the build script does', () => {
    expect(foldWord('الشَّمْسُ')).toBe('شمس');
    expect(foldWord('Teddy_Bear')).toBe('teddy bear');
    expect(foldWord('أرنب')).toBe(foldWord('ارنب'));
    expect(foldWord('بطة')).toBe(foldWord('بطه'));
  });
});

describe('stickers svg and line art', () => {
  it('draws a sized SVG, accepting a word as well as a name', () => {
    const svg = stickers.svg('cat', { size: 64 }) ?? '';
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"')).toBe(
      true,
    );
    expect(stickers.svg('قطة', { size: 64 })).toBe(svg);
    expect(stickers.svg('cat', { size: 5 })).toContain('width="16"');
    expect(stickers.svg('cat', { size: 99_999 })).toContain('width="1024"');
    expect(stickers.svg('cat')).toContain('width="128"');
    expect(stickers.svg('no-such-sticker-anywhere')).toBeUndefined();
    expect(stickers.dataUrl('cat')?.startsWith('data:image/svg+xml,%3Csvg ')).toBe(true);
    expect(stickers.dataUrl('no-such-sticker-anywhere')).toBeUndefined();
  });

  it('outlines every sticker with only white fills and no paint servers', () => {
    for (const name of STICKER_NAMES) {
      const line = stickers.lineArt(name) ?? '';
      const fills = [...line.matchAll(/ fill="([^"]*)"/gu)].map((match) => match[1]);
      expect(
        fills.filter((fill) => fill !== '#fff' && fill !== 'none'),
        name,
      ).toEqual([]);
      expect(line, name).not.toMatch(/Gradient|<filter|<clipPath|<mask|url\(#|opacity=/u);
      expect(line, name).toContain(`viewBox="${stickers.info(name)?.viewBox ?? ''}"`);
      expect(line, name).toContain('stroke="#1f2937"');
    }
  });

  it('keeps shared shapes a sticker reuses through <use>', () => {
    const name = STICKER_NAMES.find((candidate) => stickers.svg(candidate)?.includes('<use '));
    expect(name).toBeDefined();
    const line = stickers.lineArt(name ?? '') ?? '';
    const id = /<use href="#([^"]+)"/u.exec(line)?.[1] ?? '';
    expect(line).toContain(`id="${id}"`);
  });

  it('takes a line colour and width, ignoring anything that is not a hex colour', () => {
    const line = stickers.lineArt('sun', { stroke: '#ff0000', width: 1.2, size: 512 }) ?? '';
    expect(line).toContain('stroke="#ff0000" stroke-width="1.2"');
    expect(line).toContain('width="512"');
    const safe = stickers.lineArt('sun', { stroke: 'red" onload="x', width: 99 }) ?? '';
    expect(safe).toContain('stroke="#1f2937" stroke-width="3"');
    expect(safe).not.toContain('onload');
    expect(stickers.lineArt('no-such-sticker-anywhere')).toBeUndefined();
  });
});

/* A browser stand-in: images "decode" on the next task, canvases record what was drawn. */
function fakeEnv(options: { fail?: boolean } = {}) {
  const drawn: { width: number; height: number; src: string }[] = [];
  const env: StickerRasterEnv = {
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
      return {
        width,
        height,
        getContext: () => ({
          drawImage(image: unknown, _x: number, _y: number, w: number, h: number) {
            drawn.push({ width: w, height: h, src: (image as { src: string }).src });
          },
        }),
      };
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

describe('stickers textures', () => {
  it('rasterises at size × the scene resolution and wraps the canvas as a texture', async () => {
    const { env, drawn } = fakeEnv();
    const PIXI = fakePixi();
    const scene = { PIXI, dpr: 2, app: { renderer: { resolution: 1 } } };
    const texture = (await stickerTexture(scene, 'cat', { size: 100 }, env)) as {
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

  it('accepts s.PIXI or { PIXI, app } and reuses a texture until it is destroyed', async () => {
    const { env } = fakeEnv();
    const PIXI = fakePixi();
    const first = (await stickerTexture(PIXI, 'sun', { resolution: 1 }, env)) as {
      destroyed: boolean;
    };
    expect(await stickerTexture({ PIXI, app: {} }, 'شمس', { resolution: 1 }, env)).toBe(first);
    expect(PIXI.from).toHaveBeenCalledTimes(1);
    first.destroyed = true;
    expect(await stickerTexture(PIXI, 'sun', { resolution: 1 }, env)).not.toBe(first);
    expect(PIXI.from).toHaveBeenCalledTimes(2);
  });

  it('rasterises the outline when asked', async () => {
    const { env, drawn } = fakeEnv();
    await stickerTexture(fakePixi(), 'cat', { lineArt: true, resolution: 1 }, env);
    expect(decodeURIComponent(drawn[0]?.src ?? '')).toContain(`stroke='#1f2937'`);
  });

  it('renders a still (reduced-motion) scene once the texture is in use', async () => {
    const { env } = fakeEnv();
    const render = vi.fn();
    const scene = { PIXI: fakePixi(), reducedMotion: true, app: { render } };
    await stickerTexture(scene, 'star', {}, env);
    expect(render).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('prepares several stickers at once, keyed by the words given', async () => {
    const { env } = fakeEnv();
    const PIXI = fakePixi();
    const set = await stickerTextures(PIXI, ['cat', 'قطة', 'dog', 'cat'], { resolution: 1 }, env);
    expect(Object.keys(set)).toEqual(['cat', 'قطة', 'dog']);
    expect(set['cat']).toBe(set['قطة']);
    expect(set['dog']).not.toBe(set['cat']);
    await expect(stickerTextures(PIXI, ['cat', 'zzzz-nope'], {}, env)).rejects.toThrow(
      /no sticker answers to "zzzz-nope"/u,
    );
    await expect(stickerTextures(PIXI, 'cat', {}, env)).rejects.toThrow(TypeError);
  });

  it('refuses a target without Pixi or an unknown name, and reports a failed decode', async () => {
    await expect(stickerTexture({ app: {} }, 'cat', {}, fakeEnv().env)).rejects.toThrow(
      /needs the scene/u,
    );
    await expect(stickers.texture(null, 'cat')).rejects.toThrow(TypeError);
    await expect(stickerTexture(fakePixi(), 'zzzz-nope', {}, fakeEnv().env)).rejects.toThrow(
      TypeError,
    );
    const PIXI = fakePixi();
    await expect(stickerTexture(PIXI, 'moon', {}, fakeEnv({ fail: true }).env)).rejects.toThrow(
      /did not decode/u,
    );
    // The failure is not cached: the next call tries again.
    await expect(stickerTexture(PIXI, 'moon', {}, fakeEnv().env)).resolves.toBeDefined();
  });
});

describe('createStickersLibrary', () => {
  it('is a frozen, documented surface', () => {
    expect(Object.isFrozen(stickers)).toBe(true);
    expect(stickers.version).toBe('1.2.5');
    expect(stickers.credit.art).toContain('Microsoft');
    expect(stickers.credit.art).toContain('MIT');
    expect(Object.isFrozen(stickers.names)).toBe(true);
    expect(Object.isFrozen(stickers.groups)).toBe(true);
    expect(stickers.limits).toMatchObject({ minSize: 16, maxSize: 1024, defaultSize: 128 });
  });
});
