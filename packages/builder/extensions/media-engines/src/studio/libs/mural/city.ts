import type { Box, Ctx, Drawn, Gfx, ItemOpts, View } from './types';
import { box, gfx, glow, lit, rfill } from './util';

/*
  Towns and skylines (mural kit, 2026-10-14): a house by kind (a pitched-roof cottage, a flat-roofed
  Arab house, a Japanese house), a mosque with a dome and two minarets, a row of arches, and a
  skyline across a range — generic blocks, an Arab old town (domes, minarets, arched windows) or
  modern towers. Windows are dark panes by day; their warm light lives in the glow layer, split
  into a few groups so the lights beat can turn them on one after another.
*/

const WARM = 0xffd27a;

export interface Panes {
  readonly groups: Gfx[];
  add(x: number, y: number, w: number, h: number, arch?: boolean): void;
}

/** Windows: dark panes in the art, warm panes and a halo in the glow layer. */
export function panes(ctx: Ctx, art: Gfx, glowParent: Box, count = 1): Panes {
  const groups = Array.from({ length: count }, () => lit(gfx(glowParent)));
  const dark = ctx.mix(ctx.pal.ink, ctx.pal.wall, 0.25);
  let i = 0;
  return {
    groups,
    add(x, y, w, h, arch = false) {
      const shape = (g: Gfx) => (arch ? g.roundRect(x, y, w, h, w / 2) : g.rect(x, y, w, h));
      shape(art).fill(dark);
      const g = groups[i++ % count] ?? art;
      g.blendMode = 'add';
      g.circle(x + w / 2, y + h / 2, Math.max(w, h) * 1.4).fill(rfill(ctx, 0xffb45c, 0.32));
      shape(g).fill(WARM);
    },
  };
}

function dome(g: Gfx, x: number, y: number, r: number, color: number, gold: number): void {
  g.moveTo(x - r, y)
    .bezierCurveTo(x - r, y - r * 1.2, x - r * 0.2, y - r * 1.25, x, y - r * 1.55)
    .bezierCurveTo(x + r * 0.2, y - r * 1.25, x + r, y - r * 1.2, x + r, y)
    .closePath()
    .fill(color);
  g.rect(x - 1.5, y - r * 1.95, 3, r * 0.45)
    .fill(gold)
    .circle(x, y - r * 2, r * 0.12)
    .fill(gold);
}

function minaret(
  ctx: Ctx,
  g: Gfx,
  win: Panes,
  x: number,
  y: number,
  h: number,
  w: number,
  color: number,
): void {
  const gold = ctx.c(ctx.pal.accent);
  g.rect(x - w / 2, y - h, w, h).fill(color);
  g.rect(x - w / 2 + w * 0.65, y - h, w * 0.35, h).fill(ctx.mix(color, ctx.pal.ink, 0.15));
  g.rect(x - w * 0.8, y - h * 0.72, w * 1.6, w * 0.3).fill(ctx.mix(color, ctx.pal.ink, 0.2));
  g.rect(x - w * 0.38, y - h * 1.08, w * 0.76, h * 0.08).fill(color);
  dome(g, x, y - h * 1.08, w * 0.42, color, gold);
  win.add(x - w * 0.18, y - h * 0.62, w * 0.36, w * 0.7, true);
}

export function house(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const g = gfx(v);
  const glowBox = box(ctx.glow, o.x, o.y);
  const win = panes(ctx, g, glowBox);
  const k = o.size / 100;
  const wall = ctx.c(o.color ?? ctx.pal.wall);
  const roof = ctx.c(ctx.pal.roof);
  const side = ctx.mix(wall, ctx.pal.ink, 0.18);
  const w = 90 * k;
  const h = 64 * k;
  g.rect(-w / 2, -h, w, h)
    .fill(wall)
    .rect(w * 0.22, -h, w * 0.28, h)
    .fill(side);
  if (o.kind === 'arab') {
    g.rect(-w / 2 - 3 * k, -h - 6 * k, w + 6 * k, 8 * k).fill(ctx.mix(wall, ctx.pal.stone, 0.4));
    g.roundRect(-12 * k, -34 * k, 22 * k, 34 * k, 11 * k).fill(ctx.c(ctx.pal.wood));
    win.add(-36 * k, -46 * k, 12 * k, 18 * k, true);
    win.add(24 * k, -46 * k, 12 * k, 18 * k, true);
  } else if (o.kind === 'japanese') {
    g.poly([
      -w / 2 - 16 * k,
      -h,
      w / 2 + 16 * k,
      -h,
      w / 2 - 6 * k,
      -h - 22 * k,
      -w / 2 + 6 * k,
      -h - 22 * k,
    ]).fill(roof);
    g.poly([-w / 2 - 22 * k, -h + 4 * k, -w / 2 - 12 * k, -h - 2 * k, -w / 2, -h]).fill(roof);
    for (let i = 0; i < 4; i += 1) win.add((-40 + i * 21) * k, -50 * k, 16 * k, 30 * k);
  } else {
    const peak = -h - 44 * k;
    g.poly([-w / 2 - 8 * k, -h, 0, peak, w / 2 + 8 * k, -h]).fill(roof);
    g.poly([0, peak, w / 2 + 8 * k, -h, w * 0.22, -h]).fill(ctx.mix(roof, ctx.pal.ink, 0.2));
    if (o.flag['snow'] === true)
      g.poly([
        -w / 2 - 8 * k,
        -h,
        0,
        peak - 4 * k,
        w / 2 + 8 * k,
        -h,
        w / 2,
        -h - 8 * k,
        0,
        peak + 8 * k,
        -w / 2,
        -h - 8 * k,
      ]).fill(ctx.c(ctx.pal.snow));
    g.rect(w * 0.18, peak + 6 * k, 10 * k, 26 * k).fill(ctx.mix(roof, ctx.pal.ink, 0.4));
    g.rect(-8 * k, -30 * k, 18 * k, 30 * k).fill(ctx.c(ctx.pal.wood));
    win.add(-36 * k, -50 * k, 16 * k, 16 * k);
    win.add(22 * k, -50 * k, 16 * k, 16 * k);
  }
  return { view: v, lights: win.groups, follow: glowBox };
}

export function mosque(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const g = gfx(v);
  const glowBox = box(ctx.glow, o.x, o.y);
  const win = panes(ctx, g, glowBox, 2);
  const k = o.size / 100;
  const wall = ctx.c(o.color ?? ctx.pal.wall);
  const domeColor = ctx.c(o.kind === 'gold' ? ctx.pal.accent : ctx.pal.roof);
  minaret(ctx, g, win, -110 * k, 0, 190 * k, 20 * k, wall);
  minaret(ctx, g, win, 110 * k, 0, 190 * k, 20 * k, wall);
  g.rect(-90 * k, -80 * k, 180 * k, 80 * k)
    .fill(wall)
    .rect(30 * k, -80 * k, 60 * k, 80 * k)
    .fill(ctx.mix(wall, ctx.pal.ink, 0.12));
  g.rect(-50 * k, -104 * k, 100 * k, 24 * k).fill(wall);
  dome(g, 0, -104 * k, 50 * k, domeColor, ctx.c(ctx.pal.accent));
  // Floodlit at night: a warm light on the dome.
  const flood = lit(glow(ctx, glowBox, 0, -150 * k, 90 * k, 0xffd08a, 0.35));
  g.roundRect(-16 * k, -56 * k, 32 * k, 56 * k, 16 * k).fill(ctx.mix(wall, ctx.pal.ink, 0.45));
  for (const x of [-70, -46, 34, 58]) win.add(x * k, -60 * k, 12 * k, 24 * k, true);
  return { view: v, lights: [...win.groups, flood], follow: glowBox };
}

export function arches(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const stone = ctx.c(o.color ?? ctx.pal.stone);
  const k = o.size / 100;
  const h = 110 * k;
  const w = 60 * k;
  g.rect(o.from, o.y - h - 26 * k, o.to - o.from, h + 26 * k).fill(stone);
  for (let x = o.from + 14 * k; x + w < o.to; x += w + 18 * k) {
    g.moveTo(x, o.y)
      .lineTo(x, o.y - h * 0.6)
      .arc(x + w / 2, o.y - h * 0.6, w / 2, Math.PI, 0)
      .lineTo(x + w, o.y)
      .closePath()
      .fill(ctx.mix(stone, ctx.pal.ink, 0.5));
  }
  g.rect(o.from, o.y - h - 30 * k, o.to - o.from, 8 * k).fill(ctx.mix(stone, 0xffffff, 0.2));
  return { view: g };
}

/** Skylines: 'generic' blocks, 'old' (an Arab old town) or 'modern' towers. */
export function skyline(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const g = gfx(v);
  const glowBox = box(ctx.glow);
  const win = panes(ctx, g, glowBox, 5);
  const k = o.size / 100;
  const kind = o.kind;
  const base = ctx.c(
    o.color ?? (kind === 'modern' ? ctx.mix(ctx.pal.water[1], ctx.pal.stone, 0.4) : ctx.pal.wall),
  );
  const lights: View[] = win.groups;
  g.rect(o.from - 20, o.y - 2, o.to - o.from + 40, 800 - o.y).fill(
    ctx.mix(base, ctx.pal.ink, 0.22),
  );
  let x = o.from;
  let i = 0;
  while (x < o.to) {
    const r = ctx.r();
    const w = (kind === 'modern' ? 50 + r * 50 : 44 + r * 46) * k;
    const h =
      (kind === 'modern'
        ? 120 + ctx.r() * 200
        : kind === 'old'
          ? 40 + ctx.r() * 70
          : 70 + ctx.r() * 120) * k;
    const tone = ctx.mix(base, ctx.pal.ink, ctx.r() * 0.2);
    const top = o.y - h;
    if (kind === 'old' && i % 7 === 3) {
      minaret(ctx, g, win, x + w / 2, o.y, h * 2.4, 14 * k, tone);
    } else {
      g.rect(x, top, w, h)
        .fill(tone)
        .rect(x + w * 0.7, top, w * 0.3, h)
        .fill(ctx.mix(tone, ctx.pal.ink, 0.14));
      if (kind === 'old') {
        if (i % 5 === 1)
          dome(
            g,
            x + w / 2,
            top,
            w * 0.36,
            ctx.c(i % 2 ? ctx.pal.roof : ctx.pal.accent),
            ctx.c(ctx.pal.accent),
          );
        g.rect(x - 2, top - 4 * k, w + 4, 5 * k).fill(ctx.mix(tone, 0xffffff, 0.15));
        for (let wy = top + 14 * k; wy < o.y - 20 * k; wy += 26 * k)
          if (ctx.r() < 0.7) win.add(x + w * 0.25 + ctx.r() * w * 0.3, wy, 8 * k, 13 * k, true);
      } else {
        if (kind === 'modern' && ctx.r() < 0.3)
          g.rect(x + w / 2 - 1.5 * k, top - 40 * k, 3 * k, 40 * k).fill(tone);
        if (kind !== 'modern' && ctx.r() < 0.4)
          g.poly([x - 3 * k, top, x + w / 2, top - 22 * k, x + w + 3 * k, top]).fill(
            ctx.c(ctx.pal.roof),
          );
        const cols = Math.max(2, Math.floor(w / (13 * k)));
        for (let wy = top + 12 * k; wy < o.y - 14 * k; wy += (kind === 'modern' ? 14 : 22) * k) {
          for (let c = 0; c < cols; c += 1)
            if (ctx.r() < (kind === 'modern' ? 0.55 : 0.6))
              win.add(
                x + 6 * k + c * ((w - 12 * k) / cols),
                wy,
                (kind === 'modern' ? 8 : 6) * k,
                (kind === 'modern' ? 6 : 9) * k,
              );
        }
      }
    }
    x += w + (kind === 'old' ? -4 : 3 + ctx.r() * 10) * k;
    i += 1;
  }
  return { view: v, lights, follow: glowBox };
}
