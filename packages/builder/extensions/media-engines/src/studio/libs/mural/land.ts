import type { Ctx, Drawn, ItemOpts } from './types';
import { at, band, gfx, ridge, vfill } from './util';

/*
  Land (mural kit, 2026-10-14): wide bands from `from` to `to` whose top line sits near y and
  rises up to `size` — rolling hills, peaks lit from one side (snow caps on request or in a
  winter mood), dunes with lee shadows, plains (grass, fields, snow, a road) — and two placed
  forms, rocks and a cliff. Everything is filled down past the bottom of the design so layers
  never show a gap.
*/

const BOTTOM = 780;

/** The layer's own land colour (far, mid, near) unless the item names one. */
export function landColor(ctx: Ctx, o: ItemOpts): number {
  const i = ctx.depth === 'far' || ctx.depth === 'sky' ? 0 : ctx.depth === 'mid' ? 1 : 2;
  return o.color ?? ctx.c(ctx.pal.land[i]);
}

export function hills(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const color = landColor(ctx, o);
  const top = ridge(ctx.r, o.from - 40, o.to + 40, o.y, o.size, 24, 0.25);
  band(
    g,
    top,
    BOTTOM,
    vfill(ctx, ctx.mix(color, 0xffffff, 0.08), ctx.mix(color, ctx.pal.ink, 0.22)),
  );
  // A lit rim along the crest: the light comes from the left.
  g.poly(top, false).stroke({ width: 3, color: ctx.mix(color, 0xffffff, 0.25), alpha: 0.6 });
  return { view: g };
}

export function mountains(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const color = landColor(ctx, o);
  const lit = ctx.mix(color, 0xffffff, 0.14);
  const shade = ctx.mix(color, ctx.pal.ink, 0.25);
  const snow = o.flag['snow'] === true || o.kind === 'snowy';
  const peaks = Math.max(2, Math.round((o.to - o.from) / (o.size * 1.4)));
  g.rect(o.from - 40, o.y - 2, o.to - o.from + 80, BOTTOM - o.y).fill(shade);
  for (let i = 0; i < peaks; i += 1) {
    const px = o.from + ((i + 0.5) / peaks) * (o.to - o.from) + (ctx.r() - 0.5) * o.size * 0.6;
    const h = o.size * (0.55 + ctx.r() * 0.45);
    const w = h * (1.8 + ctx.r() * 0.8);
    const ax = px + (ctx.r() - 0.5) * w * 0.2;
    const ay = o.y - h;
    const mid = px + (ctx.r() - 0.5) * w * 0.15;
    g.poly([px - w / 2, o.y, ax, ay, mid, o.y]).fill(lit);
    g.poly([ax, ay, px + w / 2, o.y, mid, o.y]).fill(shade);
    // A shoulder ridge on the lit face.
    g.poly([ax, ay, ax - w * 0.16, ay + h * 0.45, ax - w * 0.08, ay + h * 0.4]).fill({
      color: shade,
      alpha: 0.35,
    });
    if (snow) {
      const d = h * 0.28;
      const pts = [ax, ay];
      const left = ax - (ax - (px - w / 2)) * (d / h);
      const right = ax + (px + w / 2 - ax) * (d / h);
      for (let j = 0; j <= 5; j += 1) {
        const x = right + ((left - right) * j) / 5;
        pts.push(x, ay + d * (j % 2 === 0 ? 1 : 0.7));
      }
      g.poly(pts).fill(ctx.c(ctx.pal.snow));
      g.poly([ax, ay, right, ay + d, mid + (right - mid) * 0.2, ay + d * 0.8]).fill({
        color: 0x9fb4d6,
        alpha: 0.4,
      });
    }
  }
  return { view: g };
}

export function dunes(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const color = o.color ?? ctx.c(ctx.mix(ctx.pal.sand, ctx.pal.land[1], 0.25));
  const top = ridge(ctx.r, o.from - 40, o.to + 40, o.y, o.size, 20, 0);
  band(
    g,
    top,
    BOTTOM,
    vfill(ctx, ctx.mix(color, 0xffffff, 0.12), ctx.mix(color, ctx.pal.ink, 0.12)),
  );
  const shade = ctx.mix(color, ctx.pal.ink, 0.28);
  for (let i = 0; i + 3 < top.length; i += 2) {
    const [x0, y0, x1, y1] = [at(top, i), at(top, i + 1), at(top, i + 2), at(top, i + 3)];
    // Lee slopes (falling to the right) take the shadow.
    if (y1 > y0 + 1) {
      g.poly([x0, y0, x1, y1, x1, y1 + 50, x0, y0 + 30]).fill({ color: shade, alpha: 0.32 });
    }
  }
  g.poly(top, false).stroke({ width: 2, color: ctx.mix(color, 0xffffff, 0.35), alpha: 0.7 });
  return { view: g };
}

export function plains(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const color = landColor(ctx, o);
  const x = o.from - 40;
  const w = o.to - o.from + 80;
  if (o.kind === 'road') {
    const road = ctx.c(ctx.mix(ctx.pal.stone, ctx.pal.ink, 0.55));
    g.rect(x, o.y, w, BOTTOM - o.y).fill(color);
    g.rect(x, o.y + 10, w, 46).fill(road);
    for (let d = o.from; d < o.to; d += 90) g.rect(d, o.y + 31, 46, 4).fill(0xf2e6c8);
    return { view: g };
  }
  const base =
    o.kind === 'snow' ? ctx.c(ctx.pal.snow) : o.kind === 'sand' ? ctx.c(ctx.pal.sand) : color;
  g.rect(x, o.y, w, BOTTOM - o.y).fill(
    vfill(ctx, ctx.mix(base, 0xffffff, 0.06), ctx.mix(base, ctx.pal.ink, 0.18)),
  );
  if (o.kind === 'fields') {
    const tones = [ctx.mix(base, ctx.pal.accent, 0.35), ctx.mix(base, ctx.pal.leaf[1], 0.25)];
    let y = o.y + 6;
    for (let i = 0; y < 760; i += 1) {
      const h = 10 + i * 6;
      g.rect(x, y, w, h * 0.5).fill({ color: at(tones, i), alpha: 0.55 });
      y += h;
    }
  }
  return { view: g };
}

export function rocks(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const color = o.color ?? ctx.c(ctx.pal.stone);
  const n = 2 + Math.floor(ctx.r() * 3);
  for (let i = 0; i < n; i += 1) {
    const cx = (i - (n - 1) / 2) * 40 * k + (ctx.r() - 0.5) * 20 * k;
    const r = (24 + ctx.r() * 30) * k * (i === Math.floor(n / 2) ? 1.3 : 1);
    const pts: number[] = [];
    for (let j = 0; j < 7; j += 1) {
      const a = Math.PI + (Math.PI * j) / 6;
      pts.push(
        cx + Math.cos(a) * r * (0.85 + ctx.r() * 0.3),
        Math.sin(a) * r * (0.7 + ctx.r() * 0.3),
      );
    }
    g.poly(pts).fill(ctx.mix(color, ctx.pal.ink, 0.15));
    g.poly(pts.slice(0, 8).concat([cx, -r * 0.2])).fill(ctx.mix(color, 0xffffff, 0.12));
  }
  return { view: g };
}

export function cliffs(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const color = o.color ?? ctx.c(ctx.pal.stone);
  const w = 260 * k;
  const h = 260 * k;
  const pts = [-w, 40, -w, -h];
  for (let i = 1; i <= 6; i += 1)
    pts.push(-w + (w * i) / 6 + (ctx.r() - 0.5) * 20 * k, -h + (ctx.r() - 0.3) * 30 * k);
  pts.push(10 * k, -h * 0.6, -5 * k, -h * 0.25, 20 * k, 40);
  g.poly(pts).fill(ctx.mix(color, ctx.pal.ink, 0.1));
  for (let i = 1; i < 6; i += 1) {
    const y = -h + (h * i) / 6;
    g.moveTo(-w, y)
      .lineTo(-w * 0.1 + (ctx.r() - 0.5) * 30 * k, y + 8 * k)
      .stroke({ width: 3 * k, color: ctx.mix(color, ctx.pal.ink, 0.35), alpha: 0.5 });
  }
  g.rect(-w, -h - 14 * k, w + 6 * k, 18 * k).fill(ctx.c(ctx.pal.land[2]));
  return { view: g };
}
