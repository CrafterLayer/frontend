/*
  The particle presets' textures (particles and physics, 2026-10-13): eight white shapes drawn
  with Pixi Graphics into ONE 512 × 64 render texture per renderer, never a fetched image. One
  source matters: a Pixi v8 ParticleContainer draws every particle from a single texture source,
  so a preset that mixes shapes (snow: soft dots and flakes) picks frames of the same atlas.
  White, so the emitter's tint colours them; a vein or a highlight is drawn darker or lighter.
*/

export const PARTICLE_SHAPES = [
  'soft',
  'streak',
  'flake',
  'leaf',
  'petal',
  'rect',
  'spark',
  'ring',
] as const;
export type ParticleShape = (typeof PARTICLE_SHAPES)[number];

/** One atlas cell, in texture px. Presets size particles in px and divide by it. */
export const CELL = 64;

interface Path {
  circle(x: number, y: number, r: number): Path;
  rect(x: number, y: number, w: number, h: number): Path;
  roundRect(x: number, y: number, w: number, h: number, r: number): Path;
  star(x: number, y: number, points: number, radius: number, inner: number): Path;
  moveTo(x: number, y: number): Path;
  lineTo(x: number, y: number): Path;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): Path;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): Path;
  fill(style: unknown): Path;
  stroke(style: unknown): Path;
}

interface AtlasTexture {
  readonly source?: unknown;
  destroy(destroySource?: boolean): void;
}

/** The Pixi namespace and renderer slice the atlas needs (the page's ONE namespace, D2). */
export interface AtlasPixi {
  Graphics: new () => Path & { destroy(): void };
  FillGradient: new (options: Record<string, unknown>) => { destroy(): void };
  Rectangle: new (x: number, y: number, w: number, h: number) => unknown;
  Texture: new (options: { source: unknown; frame: unknown }) => AtlasTexture;
}

export interface AtlasRenderer {
  generateTexture(options: Record<string, unknown>): AtlasTexture;
}

type Frames = Record<ParticleShape, AtlasTexture>;

interface Atlas {
  readonly frames: Frames;
  readonly sheet: AtlasTexture;
}

const WHITE = 0xffffff;
const atlases = new WeakMap<object, Atlas>();

/** Draws the eight shapes, cell i centred at (i * 64 + 32, 32). Returns the gradients to free. */
export function drawParticleAtlas(PIXI: AtlasPixi, g: Path): { destroy(): void }[] {
  const glow = new PIXI.FillGradient({
    type: 'radial',
    colorStops: [
      { offset: 0, color: '#ffffffff' },
      { offset: 0.3, color: '#ffffffc0' },
      { offset: 0.6, color: '#ffffff44' },
      { offset: 1, color: '#ffffff00' },
    ],
  });
  const tail = new PIXI.FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    colorStops: [
      { offset: 0, color: '#ffffff00' },
      { offset: 0.75, color: '#ffffffb0' },
      { offset: 1, color: '#ffffffff' },
    ],
  });
  const vein = { width: 1.5, color: 0, alpha: 0.28 };
  let c = 32;
  // soft: a radial glow (fire, smoke, dust, embers, magic)
  g.circle(c, 32, 30).fill(glow);
  // streak: a tail fading in toward its head on +x (rain, fireworks; turned along the velocity)
  c += CELL;
  g.roundRect(c - 30, 30, 60, 4, 2).fill(tail);
  // flake: six arms with side branches
  c += CELL;
  for (let arm = 0; arm < 6; arm += 1) {
    const a = (arm * Math.PI) / 3;
    const bx = c + Math.cos(a) * 15;
    const by = 32 + Math.sin(a) * 15;
    g.moveTo(c, 32).lineTo(c + Math.cos(a) * 27, 32 + Math.sin(a) * 27);
    g.moveTo(bx, by).lineTo(bx + Math.cos(a + 0.7) * 8, by + Math.sin(a + 0.7) * 8);
    g.moveTo(bx, by).lineTo(bx + Math.cos(a - 0.7) * 8, by + Math.sin(a - 0.7) * 8);
  }
  g.stroke({ width: 3.5, color: WHITE, cap: 'round' });
  // leaf: a pointed blade along +x with a darker midrib
  c += CELL;
  g.moveTo(c - 28, 32)
    .quadraticCurveTo(c, 10, c + 28, 32)
    .quadraticCurveTo(c, 54, c - 28, 32)
    .fill(WHITE);
  g.moveTo(c - 26, 32)
    .lineTo(c + 22, 32)
    .stroke(vein);
  // petal: a blossom petal with a notched tip
  c += CELL;
  g.moveTo(c - 26, 32)
    .bezierCurveTo(c - 12, 10, c + 16, 12, c + 26, 24)
    .lineTo(c + 19, 32)
    .lineTo(c + 26, 40)
    .bezierCurveTo(c + 16, 52, c - 12, 54, c - 26, 32)
    .fill(WHITE);
  // rect: a confetti slip (flutters on scale.x)
  c += CELL;
  g.rect(c - 18, 22, 36, 20).fill(WHITE);
  // spark: a four-point twinkle with a soft halo
  c += CELL;
  g.circle(c, 32, 18).fill(glow);
  g.star(c, 32, 4, 30, 3.5).fill(WHITE);
  // ring: a bubble — a faint body, a rim and a highlight
  c += CELL;
  g.circle(c, 32, 26).fill({ color: WHITE, alpha: 0.12 }).stroke({ width: 3, color: WHITE });
  g.circle(c - 10, 22, 5).fill(WHITE);
  return [glow, tail];
}

/** The atlas frames for this renderer, drawn once and cached until releaseParticleTextures. */
export function particleTextures(
  PIXI: AtlasPixi,
  renderer: AtlasRenderer,
): Readonly<Record<ParticleShape, unknown>> {
  const cached = atlases.get(renderer);
  if (cached !== undefined) return cached.frames;
  const g = new PIXI.Graphics();
  const gradients = drawParticleAtlas(PIXI, g);
  const sheet = renderer.generateTexture({
    target: g,
    frame: new PIXI.Rectangle(0, 0, CELL * PARTICLE_SHAPES.length, CELL),
    resolution: 1,
    antialias: true,
  });
  g.destroy();
  for (const gradient of gradients) gradient.destroy();
  const frames = {} as Frames;
  PARTICLE_SHAPES.forEach((shape, index) => {
    frames[shape] = new PIXI.Texture({
      source: sheet.source,
      frame: new PIXI.Rectangle(index * CELL, 0, CELL, CELL),
    });
  });
  atlases.set(renderer, { frames, sheet });
  return frames;
}

/** Frees the renderer's atlas (scene disposal). */
export function releaseParticleTextures(renderer: object): void {
  const atlas = atlases.get(renderer);
  if (atlas === undefined) return;
  atlases.delete(renderer);
  for (const shape of PARTICLE_SHAPES) {
    try {
      atlas.frames[shape].destroy(false);
    } catch {
      // The renderer may already be gone.
    }
  }
  try {
    atlas.sheet.destroy(true);
  } catch {
    // Same.
  }
}
