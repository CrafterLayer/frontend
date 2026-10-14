import type { Box, Ctx, Drawn, Gfx, ItemOpts } from './types';
import { box, crescent, gfx, glow, lit, pair, spread, vfill } from './util';
import { panes } from './city';

/*
  Space and fantasy (mural kit, 2026-10-14): planets (earth, moon, mars, a ringed giant), a rocket
  with a flickering flame, a comet, a castle whose windows light at dusk, a dragon whose wings are
  the rig's arms, fireflies that drift and blink at night, and magic sparkles. Planets, comets and
  the rocket's flame sit in the untinted light layer, so a night sky never dims them.
*/

const PLANETS: Readonly<Record<string, [number, number]>> = {
  earth: [0x3a7cc8, 0x5aa65a],
  moon: [0xc9c6bc, 0x9c9a92],
  mars: [0xc8643c, 0x9a4a2c],
  ringed: [0xe0b878, 0xb88a5a],
  ice: [0x9fd6e8, 0xe8f6fa],
};

export const PLANET_KINDS = Object.keys(PLANETS);

export function planet(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, o.x, o.y);
  const r = o.size / 2;
  const [base, detail] = pair(o.colors ?? PLANETS[o.kind] ?? [0x3a7cc8, 0x5aa65a]);
  const g = gfx(v);
  if (o.kind === 'earth' || o.kind === '') glow(ctx, v, 0, 0, r * 1.35, 0x8fd0ff, 0.35);
  if (o.kind === 'ringed')
    g.ellipse(0, 0, r * 2, r * 0.45).stroke({ width: r * 0.16, color: detail, alpha: 0.8 });
  g.circle(0, 0, r).fill(base);
  if (o.kind === 'moon') {
    for (let i = 0; i < 7; i += 1) {
      const a = ctx.r() * 6.28;
      const d = ctx.r() * r * 0.7;
      g.circle(Math.cos(a) * d, Math.sin(a) * d, r * (0.08 + ctx.r() * 0.12)).fill(detail);
    }
  } else if (o.kind === 'ringed' || o.kind === 'mars' || o.kind === 'ice') {
    for (let i = -2; i <= 2; i += 1)
      g.ellipse(0, i * r * 0.32, r * 0.95 * Math.sqrt(1 - (i * 0.32) ** 2), r * 0.08).fill({
        color: detail,
        alpha: 0.5,
      });
  } else {
    // Continents: clusters of soft blobs, kept inside the disc.
    for (let i = 0; i < 4; i += 1) {
      const a = ctx.r() * 6.28;
      const d = ctx.r() * r * 0.45;
      for (let j = 0; j < 6; j += 1) {
        const x = Math.cos(a) * d + (ctx.r() - 0.5) * r * 0.4;
        const y = Math.sin(a) * d + (ctx.r() - 0.5) * r * 0.3;
        g.circle(x, y, r * (0.08 + ctx.r() * 0.08)).fill(detail);
      }
    }
    for (let i = 0; i < 3; i += 1)
      g.ellipse((ctx.r() - 0.5) * r, (ctx.r() - 0.5) * r * 1.4, r * 0.4, r * 0.06).fill({
        color: 0xffffff,
        alpha: 0.6,
      });
  }
  // The night side: a soft crescent of shadow on the right.
  g.poly(crescent(r, 0.15, 1)).fill({ color: 0x000814, alpha: 0.38 });
  if (o.kind === 'ringed')
    g.moveTo(-r * 2, 0)
      .bezierCurveTo(-r * 2, r * 0.5, r * 2, r * 0.5, r * 2, 0)
      .stroke({ width: r * 0.16, color: detail, alpha: 0.9 });
  return { view: v };
}

export function rocket(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const body = o.color ?? 0xf2f0ea;
  const red = ctx.pal.cloth[0];
  const flame = box(v, 0, 0);
  glow(ctx, flame, 0, 30 * k, 50 * k, 0xffa040, 0.7);
  const f = gfx(flame);
  f.poly([-12 * k, 0, 0, 70 * k, 12 * k, 0])
    .fill(0xff8a2a)
    .poly([-6 * k, 0, 0, 40 * k, 6 * k, 0])
    .fill(0xffe8a0);
  const g = gfx(v);
  g.poly([-22 * k, -10 * k, -40 * k, 14 * k, -40 * k, 2 * k, -20 * k, -40 * k]).fill(red);
  g.poly([22 * k, -10 * k, 40 * k, 14 * k, 40 * k, 2 * k, 20 * k, -40 * k]).fill(red);
  g.roundRect(-20 * k, -110 * k, 40 * k, 112 * k, 12 * k).fill(body);
  g.rect(6 * k, -100 * k, 14 * k, 100 * k).fill(ctx.mix(body, ctx.pal.ink, 0.15));
  g.moveTo(-20 * k, -100 * k)
    .quadraticCurveTo(-18 * k, -140 * k, 0, -160 * k)
    .quadraticCurveTo(18 * k, -140 * k, 20 * k, -100 * k)
    .closePath()
    .fill(red);
  g.circle(0, -70 * k, 10 * k)
    .fill(0x7fc8f0)
    .circle(0, -70 * k, 10 * k)
    .stroke({ width: 3 * k, color: ctx.mix(body, ctx.pal.ink, 0.4) });
  g.rect(-12 * k, 0, 24 * k, 8 * k).fill(ctx.pal.ink);
  return {
    view: v,
    ambient: (T) => {
      flame.scale.set(1 + Math.sin(T * 17) * 0.08, 1 + Math.sin(T * 23) * 0.18);
    },
  };
}

export function comet(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const color = o.color ?? 0xbfe8ff;
  const tail = gfx(v);
  tail.blendMode = 'add';
  tail
    .poly([0, -10 * k, -260 * k, -40 * k, -260 * k, 30 * k, 0, 10 * k])
    .fill(vfill(ctx, color, color, 0.03, 0.55, true));
  glow(ctx, v, 0, 0, 40 * k, color, 0.9);
  gfx(v)
    .circle(0, 0, 8 * k)
    .fill(0xffffff);
  v.rotation = -0.35;
  return { view: v };
}

export function castle(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const glowBox = box(ctx.glow, o.x, o.y);
  const g = gfx(v);
  const win = panes(ctx, g, glowBox, 3);
  const k = o.size / 100;
  const stone = ctx.c(o.color ?? ctx.pal.stone);
  const shade = ctx.mix(stone, ctx.pal.ink, 0.2);
  const roof = ctx.c(ctx.pal.roof);
  const tower = (x: number, w: number, h: number) => {
    g.rect(x - w / 2, -h, w, h)
      .fill(stone)
      .rect(x + w * 0.15, -h, w * 0.35, h)
      .fill(shade);
    g.poly([x - w / 2 - 6 * k, -h, x, -h - w * 1.5, x + w / 2 + 6 * k, -h]).fill(roof);
    g.poly([x, -h - w * 1.5, x + w / 2 + 6 * k, -h, x + w * 0.1, -h]).fill(
      ctx.mix(roof, ctx.pal.ink, 0.25),
    );
    g.rect(x - 1 * k, -h - w * 1.5 - 24 * k, 2 * k, 24 * k)
      .fill(ctx.pal.ink)
      .poly([
        x + k,
        -h - w * 1.5 - 24 * k,
        x + 22 * k,
        -h - w * 1.5 - 18 * k,
        x + k,
        -h - w * 1.5 - 12 * k,
      ])
      .fill(ctx.c(ctx.pal.accent));
    for (let y = -h + 24 * k; y < -30 * k; y += 40 * k) win.add(x - 5 * k, y, 10 * k, 16 * k, true);
  };
  g.rect(-110 * k, -110 * k, 220 * k, 110 * k).fill(stone);
  for (let x = -110; x < 110; x += 20) g.rect(x * k, -122 * k, 12 * k, 14 * k).fill(stone);
  tower(-120 * k, 46 * k, 170 * k);
  tower(120 * k, 46 * k, 170 * k);
  tower(0, 60 * k, 230 * k);
  tower(-56 * k, 34 * k, 140 * k);
  g.moveTo(-26 * k, 0)
    .lineTo(-26 * k, -40 * k)
    .arc(0, -40 * k, 26 * k, Math.PI, 0)
    .lineTo(26 * k, 0)
    .closePath()
    .fill(ctx.mix(stone, ctx.pal.ink, 0.6));
  return { view: v, lights: win.groups, follow: glowBox };
}

export function dragon(ctx: Ctx, o: ItemOpts): Drawn {
  const k = o.size / 100;
  const color = ctx.c(o.color ?? ctx.mix(ctx.pal.ink, ctx.pal.leaf[1], 0.3));
  const r = box(ctx.art, o.x, o.y);
  const wing = (s: number) => {
    const j = box(r, 10 * k, -6 * k);
    gfx(j)
      .poly([
        0,
        0,
        -40 * k,
        -90 * k * s,
        -70 * k,
        -70 * k * s,
        -90 * k,
        -86 * k * s,
        -100 * k,
        -40 * k * s,
        -60 * k,
        -20 * k * s,
      ])
      .fill(s > 0 ? color : ctx.mix(color, ctx.pal.ink, 0.3));
    return j;
  };
  const armL = wing(1);
  const tail = box(r, -40 * k, 0);
  gfx(tail)
    .moveTo(0, -6 * k)
    .bezierCurveTo(-50 * k, -20 * k, -80 * k, 40 * k, -130 * k, 10 * k)
    .lineTo(-146 * k, 18 * k)
    .lineTo(-128 * k, 20 * k)
    .bezierCurveTo(-80 * k, 50 * k, -50 * k, 0, 0, 6 * k)
    .closePath()
    .fill(color);
  const body = box(r);
  gfx(body)
    .ellipse(0, 0, 50 * k, 18 * k)
    .fill(color)
    .poly([40 * k, -6 * k, 80 * k, -40 * k, 92 * k, -34 * k, 54 * k, 8 * k])
    .fill(color);
  const head = box(r, 88 * k, -40 * k);
  gfx(head)
    .poly([-6 * k, -8 * k, 30 * k, -2 * k, 34 * k, 6 * k, -4 * k, 8 * k])
    .fill(color)
    .poly([0, -8 * k, -10 * k, -22 * k, 6 * k, -8 * k])
    .fill(color)
    .circle(18 * k, -2 * k, 2 * k)
    .fill(0xffd060);
  const armR = wing(-0.4);
  return { view: r, rig: { root: r, body, head, armL, armR, tail }, rest: 'run' };
}

export function fireflies(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow);
  const list: { g: Gfx; x: number; y: number; p: number }[] = [];
  const color = o.color ?? 0xf6ff9a;
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const g = glow(ctx, v, x, 0, 10 + ctx.r() * 8, color, 0.9);
    gfx(g).circle(0, 0, 2).fill(0xffffff);
    list.push({ g, x, y: o.y - ctx.r() * o.size * 2, p: ctx.r() * 6 });
  }
  return {
    view: v,
    night: [lit(v)],
    ambient: (T) => {
      for (const f of list) {
        f.g.position.set(
          f.x + Math.sin(T * 0.4 + f.p) * 30,
          f.y + Math.sin(T * 0.6 + f.p * 2) * 20,
        );
        f.g.alpha = 0.35 + 0.65 * Math.max(0, Math.sin(T * 1.5 + f.p * 3));
      }
    },
  };
}

export function sparkles(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.glow);
  const list: { g: Box; p: number }[] = [];
  const color = o.color ?? 0xfff2c0;
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const g = gfx(v, x, o.y - ctx.r() * o.size * 2);
    g.blendMode = 'add';
    const s = 4 + ctx.r() * 6;
    g.star(0, 0, 4, s, s * 0.25).fill(color);
    list.push({ g, p: ctx.r() * 6 });
  }
  return {
    view: v,
    ambient: (T) => {
      for (const s of list) {
        const t = Math.max(0, Math.sin(T * 2 + s.p * 4));
        s.g.scale.set(0.3 + t);
        s.g.alpha = t;
        s.g.rotation = T + s.p;
      }
    },
  };
}
