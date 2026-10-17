import type { Box, Ctx, Drawn, Gfx, ItemOpts } from './types';
import { at, box, gfx, glow, lit, pick, spread } from './util';

/*
  Plants (mural kit, 2026-10-14): trees by kind — round, pine, palm, olive, cypress, blossom, bare
  — lit from the left (light clumps over shade clumps), bushes, grass and flower meadows across a
  range, a cactus, and seaweed or coral for the reef. Each draws with its base at (x, y) and
  sways gently around it. A pine with `lights: true` carries festive bulbs that light at dusk.
*/

export const TREE_KINDS = ['round', 'pine', 'palm', 'olive', 'cypress', 'blossom', 'bare'] as const;

function clumps(
  ctx: Ctx,
  g: Gfx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  light: number,
  dark: number,
  n: number,
): void {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + ctx.r();
    pts.push([
      cx + Math.cos(a) * rx * 0.55,
      cy + Math.sin(a) * ry * 0.5,
      (0.45 + ctx.r() * 0.25) * Math.min(rx, ry * 1.4),
    ]);
  }
  for (const [x, y, r] of pts) g.circle(x + r * 0.18, y + r * 0.15, r).fill(dark);
  g.circle(cx + rx * 0.08, cy + ry * 0.05, Math.min(rx, ry) * 0.7).fill(dark);
  for (const [x, y, r] of pts)
    if (x < cx + rx * 0.2) g.circle(x - r * 0.12, y - r * 0.14, r * 0.78).fill(light);
}

function trunk(g: Gfx, k: number, h: number, w: number, color: number, lean = 0): void {
  g.poly([-w * k, 0, w * k, 0, (w * 0.45 + lean) * k, -h * k, (-w * 0.45 + lean) * k, -h * k]).fill(
    color,
  );
}

function branches(
  g: Gfx,
  x: number,
  y: number,
  a: number,
  len: number,
  w: number,
  depth: number,
  r: () => number,
  color: number,
  tips: number[],
): void {
  const x1 = x + Math.sin(a) * len;
  const y1 = y - Math.cos(a) * len;
  g.moveTo(x, y).lineTo(x1, y1).stroke({ width: w, color, cap: 'round' });
  if (depth === 0) {
    tips.push(x1, y1);
    return;
  }
  const spreadA = 0.35 + r() * 0.3;
  branches(g, x1, y1, a - spreadA, len * (0.68 + r() * 0.12), w * 0.65, depth - 1, r, color, tips);
  branches(g, x1, y1, a + spreadA, len * (0.68 + r() * 0.12), w * 0.65, depth - 1, r, color, tips);
}

export function tree(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const g = gfx(v);
  const k = o.size / 100;
  const [leaf, shade] = (o.colors ?? ctx.pal.leaf).map((c) => ctx.c(c)) as [number, number];
  const bark = ctx.c(ctx.pal.trunk);
  const light = ctx.mix(leaf, 0xfff2b0, 0.22);
  const kind = o.kind;
  const lights: Box[] = [];
  if (kind === 'pine') {
    trunk(g, k, 18, 5, bark);
    for (let i = 0; i < 4; i += 1) {
      const y0 = -12 - i * 21;
      const w = 34 - i * 7;
      g.poly([-w * k, y0 * k, 0, (y0 - 34) * k, w * k, y0 * k]).fill(shade);
      g.poly([-w * k, y0 * k, 0, (y0 - 34) * k, w * 0.1 * k, y0 * k]).fill(leaf);
      if (o.flag['snow'] === true)
        g.poly([
          -w * 0.55 * k,
          (y0 - 16) * k,
          0,
          (y0 - 34) * k,
          w * 0.55 * k,
          (y0 - 16) * k,
          0,
          (y0 - 20) * k,
        ]).fill(ctx.c(ctx.pal.snow));
    }
    if (o.flag['lights'] === true) {
      const holder = box(ctx.glow, o.x, o.y);
      const bulbs = box(holder);
      for (let i = 0; i < 14; i += 1) {
        const t = ctx.r();
        const y = -14 - t * 90;
        const x = (ctx.r() - 0.5) * (34 - (t * 90) / 3.2) * 1.6;
        glow(ctx, bulbs, x * k, y * k, 9 * k, at([0xffd36a, 0xff6a5a, 0x7ad0ff], i), 0.9);
      }
      glow(ctx, bulbs, 0, -110 * k, 16 * k, 0xfff0a0, 0.9);
      lights.push(lit(bulbs));
    }
  } else if (kind === 'palm') {
    const lean = (ctx.r() - 0.5) * 30;
    for (let i = 0; i < 8; i += 1) {
      const t = i / 8;
      g.roundRect((lean * t * t - 5) * k, (-t * 100 - 13) * k, 10 * k, 14 * k, 4 * k).fill(
        i % 2 ? bark : ctx.mix(bark, 0xffffff, 0.12),
      );
    }
    const top = [lean * k, -104 * k] as const;
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI + (i / 6) * Math.PI + (ctx.r() - 0.5) * 0.2;
      const len = (42 + ctx.r() * 14) * k;
      const ex = top[0] + Math.cos(a) * len;
      const ey = top[1] + Math.sin(a) * len * 0.5 + len * 0.45;
      g.moveTo(top[0], top[1])
        .quadraticCurveTo(
          top[0] + Math.cos(a) * len * 0.6,
          top[1] + Math.sin(a) * len * 0.9,
          ex,
          ey,
        )
        .quadraticCurveTo(
          top[0] + Math.cos(a) * len * 0.45,
          top[1] + Math.sin(a) * len * 0.45,
          top[0],
          top[1] + 4 * k,
        )
        .fill(i % 2 ? leaf : shade);
    }
    g.circle(top[0] - 4 * k, top[1] + 6 * k, 4 * k)
      .fill(bark)
      .circle(top[0] + 5 * k, top[1] + 7 * k, 4 * k)
      .fill(bark);
  } else if (kind === 'cypress') {
    trunk(g, k, 10, 4, bark);
    g.poly([-13 * k, -8 * k, -15 * k, -50 * k, 0, -108 * k, 15 * k, -50 * k, 13 * k, -8 * k]).fill(
      shade,
    );
    g.poly([-13 * k, -8 * k, -15 * k, -50 * k, 0, -108 * k, -3 * k, -50 * k, -2 * k, -8 * k]).fill(
      leaf,
    );
  } else if (kind === 'bare') {
    const tips: number[] = [];
    branches(g, 0, 0, 0, 34 * k, 9 * k, 5, ctx.r, ctx.mix(bark, ctx.pal.ink, 0.2), tips);
    if (o.flag['snow'] === true)
      for (let i = 0; i < tips.length; i += 4)
        g.circle(at(tips, i), at(tips, i + 1) + 2 * k, 2.5 * k).fill(ctx.c(ctx.pal.snow));
  } else {
    const olive = kind === 'olive';
    const blossom = kind === 'blossom';
    if (olive) {
      g.poly([
        -9 * k,
        0,
        9 * k,
        0,
        4 * k,
        -22 * k,
        14 * k,
        -46 * k,
        8 * k,
        -48 * k,
        0,
        -30 * k,
        -10 * k,
        -50 * k,
        -15 * k,
        -46 * k,
        -4 * k,
        -22 * k,
      ]).fill(bark);
    } else {
      trunk(g, k, 52, 7, bark);
      g.moveTo(0, -40 * k)
        .lineTo(-20 * k, -62 * k)
        .stroke({ width: 5 * k, color: bark, cap: 'round' });
      g.moveTo(0, -46 * k)
        .lineTo(18 * k, -66 * k)
        .stroke({ width: 4 * k, color: bark, cap: 'round' });
    }
    const base = blossom ? ctx.c(ctx.pal.bloom) : olive ? ctx.mix(leaf, ctx.pal.stone, 0.45) : leaf;
    const dark = blossom
      ? ctx.mix(base, ctx.pal.roof, 0.25)
      : olive
        ? ctx.mix(base, ctx.pal.ink, 0.25)
        : shade;
    const hi = blossom
      ? ctx.mix(base, 0xffffff, 0.45)
      : olive
        ? ctx.mix(base, 0xffffff, 0.2)
        : light;
    clumps(
      ctx,
      g,
      0,
      (olive ? -62 : -78) * k,
      (olive ? 54 : 40) * k,
      (olive ? 26 : 34) * k,
      hi,
      dark,
      7,
    );
    if (blossom) {
      for (let i = 0; i < 18; i += 1) {
        g.circle((ctx.r() - 0.5) * 80 * k, (-78 + (ctx.r() - 0.5) * 60) * k, 3 * k).fill(
          ctx.mix(base, 0xffffff, 0.7),
        );
      }
      const petals: { p: Gfx; x: number; y: number; s: number }[] = [];
      for (let i = 0; i < ctx.n(6); i += 1) {
        const p = gfx(v);
        p.ellipse(0, 0, 4 * k, 2.4 * k).fill(hi);
        petals.push({ p, x: (ctx.r() - 0.3) * 120 * k, y: ctx.r(), s: 0.08 + ctx.r() * 0.06 });
      }
      return {
        view: v,
        ambient: (T) => {
          v.rotation = Math.sin(T * 0.7 + o.x) * 0.012;
          for (const q of petals) {
            const t = (q.y + T * q.s) % 1;
            q.p.position.set(q.x + t * 60 * k + Math.sin(T * 2 + q.x) * 6 * k, (-70 + t * 72) * k);
            q.p.alpha = t < 0.9 ? 1 : (1 - t) * 10;
            q.p.rotation = T * 2 + q.x;
          }
        },
      };
    }
  }
  const phase = o.x * 0.01;
  return {
    view: v,
    lights,
    ...(lights[0]?.parent ? { follow: lights[0].parent as Box } : {}),
    ambient: (T) =>
      void (v.rotation = Math.sin(T * 0.7 + phase) * (kind === 'palm' ? 0.025 : 0.012)),
  };
}

export function bush(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const [leaf, shade] = (o.colors ?? ctx.pal.leaf).map((c) => ctx.c(c)) as [number, number];
  const g = gfx(v);
  clumps(ctx, g, 0, -22 * k, 46 * k, 24 * k, ctx.mix(leaf, 0xfff2b0, 0.18), shade, 6);
  if (o.flag['flowers'] === true)
    for (let i = 0; i < 8; i += 1)
      g.circle((ctx.r() - 0.5) * 70 * k, (-30 + ctx.r() * 22) * k, 3.5 * k).fill(
        ctx.c(ctx.pal.bloom),
      );
  return { view: v };
}

export function grass(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const [g0, g1] = [gfx(v), gfx(v)];
  const [leaf, shade] = (o.colors ?? ctx.pal.leaf).map((c) => ctx.c(c)) as [number, number];
  const k = o.size / 100;
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const g = ctx.r() < 0.5 ? g0 : g1;
    for (let b = 0; b < 5; b += 1) {
      const h = (14 + ctx.r() * 20) * k;
      const lean = (ctx.r() - 0.5) * 16 * k;
      const bx = x + (b - 2) * 4 * k;
      g.poly([bx - 2 * k, o.y, bx + lean, o.y - h, bx + 2 * k, o.y]).fill(b % 2 ? leaf : shade);
    }
  }
  return {
    view: v,
    ambient: (T) => {
      [g0, g1].forEach((g, i) => void (g.x = Math.sin(T * 1.2 + i * 2) * 1.5));
    },
  };
}

export function flowers(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const k = o.size / 100;
  const heads = o.colors ?? [ctx.pal.bloom, ...ctx.pal.cloth, 0xffffff];
  const stem = ctx.c(ctx.pal.leaf[1]);
  for (const x of spread(ctx.r, ctx.n(o.count), o.from, o.to)) {
    const h = (16 + ctx.r() * 22) * k;
    const y = o.y + ctx.r() * 10;
    g.moveTo(x, y)
      .lineTo(x + (ctx.r() - 0.5) * 6, y - h)
      .stroke({ width: 2 * k, color: stem });
    const c = ctx.c(pick(ctx.r, heads));
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2;
      g.circle(x + Math.cos(a) * 4 * k, y - h + Math.sin(a) * 4 * k, 3.2 * k).fill(c);
    }
    g.circle(x, y - h, 2.4 * k).fill(ctx.c(ctx.pal.accent));
  }
  return { view: g };
}

export function cactus(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const [leaf, shade] = (
    o.colors ?? [ctx.mix(ctx.pal.leaf[0], ctx.pal.sand, 0.15), ctx.pal.leaf[1]]
  ).map((c) => ctx.c(c)) as [number, number];
  const arm = (x: number, y: number, h: number, dir: number) => {
    g.roundRect(x, y - 9 * k, dir * 26 * k, 14 * k, 7 * k).fill(shade);
    g.roundRect(x + dir * 18 * k - 7 * k, y - h * k, 14 * k, h * k, 7 * k).fill(leaf);
  };
  arm(0, -40 * k, 34, -1);
  arm(0, -58 * k, 30, 1);
  g.roundRect(-11 * k, -100 * k, 22 * k, 100 * k, 11 * k).fill(leaf);
  g.roundRect(2 * k, -96 * k, 7 * k, 94 * k, 4 * k).fill(shade);
  return { view: g, ambient: () => undefined };
}

export function seaweed(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const fronds: Gfx[] = [];
  const colors = (o.colors ?? ctx.pal.leaf).map((c) => ctx.c(c));
  for (let i = 0; i < 4; i += 1) {
    const g = gfx(v, (i - 1.5) * 10 * k, 0);
    const h = (70 + ctx.r() * 40) * k;
    const left: number[] = [];
    const right: number[] = [];
    for (let j = 0; j <= 10; j += 1) {
      const t = j / 10;
      const x = Math.sin(t * 5 + i) * 8 * k * t;
      const w = (5 - t * 4) * k;
      left.push(x - w, -t * h);
      right.unshift(x + w, -t * h);
    }
    g.poly([...left, ...right]).fill(at(colors, i));
    fronds.push(g);
  }
  return {
    view: v,
    ambient: (T) => {
      fronds.forEach((g, i) => void (g.rotation = Math.sin(T * 1.1 + i + o.x) * 0.12));
    },
  };
}

export function coral(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const color = ctx.c(o.color ?? pick(ctx.r, ctx.pal.cloth));
  const kind = o.kind === 'fan' || o.kind === 'brain' ? o.kind : 'branch';
  if (kind === 'fan') {
    g.moveTo(0, 0)
      .arc(0, 0, 60 * k, Math.PI * 1.05, Math.PI * 1.95)
      .closePath()
      .fill({ color, alpha: 0.85 });
    for (let a = 1.1; a < 1.95; a += 0.12)
      g.moveTo(0, 0)
        .lineTo(Math.cos(a * Math.PI) * 58 * k, Math.sin(a * Math.PI) * 58 * k)
        .stroke({ width: 2 * k, color: ctx.mix(color, ctx.pal.ink, 0.3) });
  } else if (kind === 'brain') {
    g.ellipse(0, -20 * k, 38 * k, 24 * k).fill(color);
    for (let i = 0; i < 5; i += 1)
      g.ellipse(0, -20 * k, (34 - i * 7) * k, (20 - i * 4) * k).stroke({
        width: 2 * k,
        color: ctx.mix(color, ctx.pal.ink, 0.25),
      });
  } else {
    const tips: number[] = [];
    branches(g, 0, 0, 0, 22 * k, 10 * k, 3, ctx.r, color, tips);
    for (let i = 0; i < tips.length; i += 2)
      g.circle(at(tips, i), at(tips, i + 1), 5 * k).fill(ctx.mix(color, 0xffffff, 0.25));
  }
  return { view: g };
}
