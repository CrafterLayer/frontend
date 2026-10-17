import type { Ctx, Drawn, Gfx, ItemOpts } from './types';
import { box, gfx, pair, spread, vfill } from './util';

/*
  Water (mural kit, 2026-10-14): an open sea from the horizon down with glints that shimmer, rows
  of wave crests, a river that winds out of the distance, a lake or a stone-ringed pond, and the
  underwater world — a deep gradient with light rays that sway — plus rising bubbles.
*/

export function sea(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const [light, deep] = pair(o.colors ?? ctx.pal.water.map((c) => ctx.c(c)));
  gfx(v)
    .rect(o.from - 40, o.y, o.to - o.from + 80, 800 - o.y)
    .fill(vfill(ctx, ctx.mix(light, 0xffffff, 0.2), deep));
  gfx(v)
    .rect(o.from - 40, o.y, o.to - o.from + 80, 3)
    .fill({ color: 0xffffff, alpha: 0.5 });
  const glints = gfx(v);
  for (let i = 0; i < ctx.n(o.count); i += 1) {
    const y = o.y + 8 + Math.pow(ctx.r(), 1.6) * (720 - o.y);
    const w = 10 + (y - o.y) * 0.25 * ctx.r();
    glints
      .roundRect(o.from + ctx.r() * (o.to - o.from), y, w, 2 + (y - o.y) / 160, 2)
      .fill({ color: 0xffffff, alpha: 0.18 + ctx.r() * 0.2 });
  }
  return { view: v, ambient: (T) => void (glints.x = Math.sin(T * 0.5) * 10) };
}

export function waves(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const rows: Gfx[] = [];
  const color = o.color ?? 0xffffff;
  for (let row = 0; row < 3; row += 1) {
    const g = gfx(v);
    const y = o.y + row * o.size * 0.35;
    for (let x = o.from - 40 + row * 30; x < o.to + 60; x += 70 + ctx.r() * 60) {
      const w = (30 + ctx.r() * 30) * (1 + row * 0.4);
      g.moveTo(x, y)
        .quadraticCurveTo(x + w / 2, y - 7 - row * 2, x + w, y)
        .stroke({ width: 2 + row, color, alpha: 0.3 + row * 0.12 });
    }
    rows.push(g);
  }
  return {
    view: v,
    ambient: (T) => {
      rows.forEach((g, i) => void (g.x = Math.sin(T * (0.5 + i * 0.15) + i) * (10 + i * 6)));
    },
  };
}

export function river(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const [light, deep] = pair(o.colors ?? ctx.pal.water.map((c) => ctx.c(c)));
  const left: number[] = [];
  const right: number[] = [];
  const phase = ctx.r() * 6;
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const y = o.y + (760 - o.y) * t;
    const cx = o.x + Math.sin(t * 4 + phase) * o.size * 1.6 * t;
    const half = 6 + o.size * 2.2 * t * t + o.size * 0.3 * t;
    left.push(cx - half, y);
    right.unshift(cx + half, y);
  }
  g.poly([...left, ...right]).fill(vfill(ctx, ctx.mix(light, 0xffffff, 0.25), deep));
  g.poly(left, false).stroke({ width: 3, color: ctx.mix(light, 0xffffff, 0.5), alpha: 0.5 });
  return { view: g };
}

export function lake(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const [light, deep] = pair(o.colors ?? ctx.pal.water.map((c) => ctx.c(c)));
  const rx = o.size * 3;
  const ry = o.size * 0.7;
  if (o.kind === 'pond') {
    const stone = ctx.c(ctx.pal.stone);
    for (let a = 0; a < Math.PI * 2; a += 0.32) {
      gfx(v)
        .ellipse(
          Math.cos(a) * rx * 1.04,
          Math.sin(a) * ry * 1.12,
          14 + ctx.r() * 10,
          8 + ctx.r() * 5,
        )
        .fill(ctx.mix(stone, ctx.pal.ink, ctx.r() * 0.3));
    }
  }
  gfx(v)
    .ellipse(0, 0, rx, ry)
    .fill(vfill(ctx, deep, ctx.mix(light, 0xffffff, 0.15)));
  const ripples = gfx(v);
  for (let i = 0; i < 4; i += 1) {
    ripples
      .ellipse((ctx.r() - 0.5) * rx, (ctx.r() - 0.5) * ry, 20 + i * 12, 4 + i * 2)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
  }
  return { view: v, ambient: (T) => void (ripples.alpha = 0.6 + Math.sin(T) * 0.4) };
}

export function underwater(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const [light, deep] = pair(o.colors ?? ctx.pal.water);
  gfx(v)
    .rect(-60, -60, 1400, 840)
    .fill(vfill(ctx, ctx.mix(light, 0xffffff, 0.15), deep));
  const rays = box(ctx.glow);
  const list: Gfx[] = [];
  for (let i = 0; i < 6; i += 1) {
    const g = gfx(rays, 120 + i * 210 + ctx.r() * 80, -40);
    g.blendMode = 'add';
    const w = 30 + ctx.r() * 50;
    g.poly([-w / 2, 0, w / 2, 0, w * 2.4, 700, -w * 0.6, 700]).fill(
      vfill(ctx, 0xe8fbff, 0xe8fbff, 0.22, 0),
    );
    list.push(g);
  }
  return {
    view: v,
    follow: rays,
    ambient: (T) => {
      list.forEach((g, i) => {
        g.alpha = 0.6 + Math.sin(T * 0.7 + i * 1.7) * 0.4;
        g.rotation = Math.sin(T * 0.2 + i) * 0.05;
      });
    },
  };
}

export function bubbles(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const list: { g: Gfx; x: number; y: number; speed: number }[] = [];
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const r = 3 + ctx.r() * 7;
    const g = gfx(v, x, 0);
    g.circle(0, 0, r)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 })
      .circle(-r * 0.35, -r * 0.35, r * 0.25)
      .fill({ color: 0xffffff, alpha: 0.8 });
    list.push({ g, x, y: ctx.r() * 760, speed: 24 + ctx.r() * 40 });
  }
  return {
    view: v,
    ambient: (T) => {
      for (const b of list) {
        b.g.y = o.y - ((b.y + T * b.speed) % 780) + 40;
        b.g.x = b.x + Math.sin(T * 2 + b.y) * 6;
      }
    },
  };
}
