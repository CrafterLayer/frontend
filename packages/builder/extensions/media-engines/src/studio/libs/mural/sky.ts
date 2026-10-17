import type { Box, Ctx, Drawn, Gfx, ItemOpts } from './types';
import { box, crescent, gfx, glow, lit, spread, vfill } from './util';

/*
  Skies (mural kit, 2026-10-14): an extra gradient, the sun and moon (they follow the time of
  day), stars that twinkle, drifting clouds, aurora curtains, and rain or snow sheets that fall
  over the whole view. Night marks live in the untinted glow layer, so they stay bright.
*/

export function gradient(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const [top = ctx.pal.sky.day[0], bottom = ctx.pal.sky.day[1]] = o.colors ?? [];
  g.rect(o.from - 40, o.y - o.size, o.to - o.from + 80, o.size).fill(vfill(ctx, top, bottom));
  return { view: g };
}

export function sun(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const color = o.color ?? 0xfff1c4;
  glow(ctx, v, 0, 0, 150 * k, color, 0.55);
  gfx(v)
    .circle(0, 0, 34 * k)
    .fill(color);
  return { view: v, sun: v };
}

export function moon(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const color = o.color ?? 0xf4ecd0;
  glow(ctx, v, 0, 0, 120 * k, color, 0.35);
  const g = gfx(v);
  const r = 30 * k;
  if (o.kind === 'full') {
    g.circle(0, 0, r).fill(color);
    for (let i = 0; i < 4; i += 1) {
      g.circle((ctx.r() - 0.5) * r, (ctx.r() - 0.5) * r, r * (0.12 + ctx.r() * 0.12)).fill({
        color: 0xb9b29a,
        alpha: 0.45,
      });
    }
  } else {
    // A crescent: the lit limb (half a circle) and the terminator (half an ellipse) back.
    g.poly(crescent(r, 0.35, -1)).fill(color);
    v.rotation = -0.5;
  }
  return { view: v, night: [lit(v)] };
}

export function stars(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow);
  const [s0, s1] = [gfx(v), gfx(v)];
  const n = ctx.n(o.count);
  for (let i = 0; i < n; i += 1) {
    const g = i % 2 ? s1 : s0;
    const x = o.from + ctx.r() * (o.to - o.from);
    const y = Math.pow(ctx.r(), 1.4) * o.y;
    const r = 0.6 + ctx.r() * ctx.r() * 2.2;
    if (r > 2.2) g.star(x, y, 4, r * 2, r * 0.5).fill(0xfff6d8);
    else g.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.5 + ctx.r() * 0.5 });
  }
  return {
    view: v,
    night: [lit(v)],
    ambient: (T) => {
      s0.alpha = 0.65 + Math.sin(T * 1.3) * 0.35;
      s1.alpha = 0.65 + Math.sin(T * 1.7 + 2) * 0.35;
    },
  };
}

function cloudShape(g: Gfx, x: number, y: number, w: number, color: number, alpha: number): void {
  const h = w * 0.32;
  g.roundRect(x - w / 2, y - h * 0.45, w, h * 0.5, h * 0.25).fill({ color, alpha });
  for (const [dx, dy, r] of [
    [-0.28, -0.42, 0.42],
    [0.02, -0.68, 0.55],
    [0.3, -0.45, 0.4],
  ] as const) {
    g.circle(x + dx * w, y + dy * h, r * h).fill({ color, alpha });
  }
}

export function clouds(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const list: { g: Gfx; speed: number; x: number }[] = [];
  const color = o.color ?? ctx.mix(0xffffff, ctx.pal.sky.day[0], 0.12);
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const g = gfx(v, x, o.y - ctx.r() * 180);
    const w = o.size * 1.6 * (0.6 + ctx.r() * 0.7);
    if (o.kind === 'streak') {
      g.roundRect(-w, -6, w * 2, 12, 6).fill({ color, alpha: 0.6 });
      g.roundRect(-w * 0.6, 10, w * 1.3, 8, 4).fill({ color, alpha: 0.45 });
    } else {
      cloudShape(g, 0, 0, w, ctx.mix(color, ctx.pal.ink, 0.12), 0.9);
      cloudShape(g, -w * 0.04, -w * 0.05, w * 0.94, color, 1);
    }
    list.push({ g, speed: 4 + ctx.r() * 8, x: x - o.from + 200 });
  }
  const span = o.to - o.from + 400;
  return {
    view: v,
    ambient: (T) => {
      for (const c of list) c.g.x = o.from - 200 + ((c.x + T * c.speed) % span);
    },
  };
}

export function aurora(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, 0, o.y);
  const colors = o.colors ?? [0x6af2b0, 0x58b8f0, 0xb08af0];
  const bands: Gfx[] = [];
  colors.forEach((color, i) => {
    const g = gfx(v);
    g.blendMode = 'add';
    const top: number[] = [];
    const bottom: number[] = [];
    const phase = ctx.r() * 6;
    for (let x = o.from - 60; x <= o.to + 60; x += 40) {
      const y = Math.sin(x * 0.006 + phase) * 40 + Math.sin(x * 0.017 + i) * 16;
      top.push(x, y - 150 - i * 30);
      bottom.unshift(x, y + 10);
    }
    g.poly([...top, ...bottom]).fill(vfill(ctx, color, color, 0, 0.45));
    bands.push(g);
  });
  return {
    view: v,
    night: [lit(v)],
    ambient: (T) => {
      bands.forEach((g, i) => {
        g.x = Math.sin(T * 0.25 + i) * 40;
        g.scale.y = 1 + Math.sin(T * 0.6 + i * 2) * 0.12;
      });
    },
  };
}

/** Rain or snow: two sheets of the whole view, falling and wrapping. */
function weather(ctx: Ctx, o: ItemOpts, snow: boolean): Drawn {
  const v = box(ctx.art);
  const sheets: Box[] = [];
  const n = ctx.n(o.count);
  for (let s = 0; s < 2; s += 1) {
    const g = gfx(v, 0, -720 * s);
    for (let i = 0; i < n; i += 1) {
      const x = ctx.r() * 1400 - 60;
      const y = ctx.r() * 720;
      if (snow) {
        g.circle(x, y, 1.2 + ctx.r() * 2.8).fill({ color: 0xffffff, alpha: 0.65 + ctx.r() * 0.35 });
      } else {
        g.moveTo(x, y)
          .lineTo(x - 6, y + 22)
          .stroke({ width: 1.4, color: 0xd8e6f4, alpha: 0.45 });
      }
    }
    sheets.push(g);
  }
  const speed = snow ? 40 : 520;
  return {
    view: v,
    ambient: (T) => {
      const y = (T * speed) % 720;
      sheets.forEach((g, i) => {
        g.y = y - 720 * i;
        if (snow) g.x = Math.sin(T * 0.5 + i) * 16;
      });
    },
  };
}

export const rain = (ctx: Ctx, o: ItemOpts): Drawn => weather(ctx, o, false);
export const snow = (ctx: Ctx, o: ItemOpts): Drawn => weather(ctx, o, true);
