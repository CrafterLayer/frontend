import type { Box, Ctx, Drawn, Gfx, ItemOpts } from './types';
import { box, gfx, glow, lit } from './util';
import { panes } from './city';

/*
  Vehicles (mural kit, 2026-10-14): a boat (a lateen sail with two fishermen, from the set-F
  fishing village, or a rowing boat), a tall ship, a car and a train whose wheels turn by the
  distance they travel (beats move them), with headlights and carriage windows that light at dusk.
  Boats rock on the water by themselves.
*/

export function boat(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const g = gfx(v);
  const k = o.size / 100;
  const hull = ctx.c(o.color ?? ctx.pal.wood);
  const ink = ctx.c(ctx.pal.ink);
  g.moveTo(-60 * k, -14 * k)
    .lineTo(64 * k, -18 * k)
    .quadraticCurveTo(50 * k, 14 * k, 20 * k, 16 * k)
    .lineTo(-40 * k, 16 * k)
    .quadraticCurveTo(-58 * k, 8 * k, -60 * k, -14 * k)
    .fill(hull)
    .rect(-56 * k, -16 * k, 116 * k, 5 * k)
    .fill(ctx.mix(hull, ink, 0.4));
  if (o.kind !== 'row') {
    g.rect(-2 * k, -130 * k, 4 * k, 116 * k)
      .fill(ink)
      .moveTo(-50 * k, -24 * k)
      .lineTo(36 * k, -150 * k)
      .quadraticCurveTo(50 * k, -70 * k, 40 * k, -24 * k)
      .closePath()
      .fill(ctx.c(o.colors?.[0] ?? 0xf4ead2));
  } else {
    g.moveTo(-30 * k, -20 * k)
      .lineTo(-70 * k, 14 * k)
      .stroke({ width: 3 * k, color: ink });
  }
  for (const dx of [-30, 10])
    g.circle(dx * k, -30 * k, 7 * k)
      .fill(ctx.c(ctx.pal.skin))
      .rect((dx - 8) * k, -24 * k, 16 * k, 10 * k)
      .fill(dx < 0 ? ink : ctx.c(ctx.pal.cloth[0]));
  const phase = o.x * 0.013;
  return { view: v, ambient: (T) => void (v.rotation = Math.sin(T * 1.4 + phase) * 0.04) };
}

export function ship(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const g = gfx(v);
  const k = o.size / 100;
  const hull = ctx.c(o.color ?? ctx.mix(ctx.pal.wood, ctx.pal.ink, 0.3));
  const sail = ctx.c(o.colors?.[0] ?? 0xf4ead2);
  const ink = ctx.c(ctx.pal.ink);
  g.poly([-130 * k, -40 * k, 140 * k, -46 * k, 110 * k, 10 * k, -100 * k, 10 * k]).fill(hull);
  g.rect(-124 * k, -46 * k, 252 * k, 8 * k).fill(ctx.c(ctx.pal.accent));
  g.poly([-130 * k, -40 * k, -136 * k, -70 * k, -90 * k, -70 * k, -90 * k, -44 * k]).fill(hull);
  for (const [x, h] of [
    [-60, 210],
    [20, 250],
    [90, 190],
  ] as const) {
    g.rect((x - 2.5) * k, -h * k, 5 * k, (h - 40) * k).fill(ink);
    for (let s = 0; s < 3; s += 1) {
      const y = (-h + 16 + s * 52) * k;
      const w = (54 - s * 4) * k;
      g.moveTo(x * k - w / 2, y)
        .quadraticCurveTo(x * k + 8 * k, y + 22 * k, x * k + w / 2, y)
        .lineTo(x * k + w / 2 - 4 * k, y + 44 * k)
        .quadraticCurveTo(x * k + 10 * k, y + 54 * k, x * k - w / 2 + 4 * k, y + 44 * k)
        .closePath()
        .fill(ctx.mix(sail, ctx.pal.ink, s * 0.05));
    }
  }
  g.poly([20 * k, -250 * k, 20 * k, -230 * k, 46 * k, -240 * k]).fill(ctx.c(ctx.pal.cloth[0]));
  const phase = o.x * 0.01;
  return { view: v, ambient: (T) => void (v.rotation = Math.sin(T * 0.9 + phase) * 0.02) };
}

function wheel(parent: Box, x: number, y: number, r: number, color: number): Gfx {
  const w = gfx(parent, x, y);
  w.circle(0, 0, r)
    .fill(color)
    .circle(0, 0, r * 0.45)
    .fill(0xb8b8b8);
  w.rect(-r * 0.08, -r * 0.9, r * 0.16, r * 1.8)
    .fill(color)
    .rect(-r * 0.9, -r * 0.08, r * 1.8, r * 0.16)
    .fill(color);
  return w;
}

export function car(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const glowBox = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const body = ctx.c(o.color ?? ctx.pal.cloth[0]);
  const g = gfx(v);
  g.roundRect(-70 * k, -44 * k, 140 * k, 30 * k, 12 * k).fill(body);
  g.moveTo(-40 * k, -44 * k)
    .lineTo(-24 * k, -70 * k)
    .lineTo(30 * k, -70 * k)
    .lineTo(48 * k, -44 * k)
    .closePath()
    .fill(body);
  g.poly([-34 * k, -46 * k, -21 * k, -65 * k, 2 * k, -65 * k, 2 * k, -46 * k]).fill(0xb8d8ea);
  g.poly([8 * k, -46 * k, 8 * k, -65 * k, 27 * k, -65 * k, 40 * k, -46 * k]).fill(0xb8d8ea);
  g.rect(-70 * k, -24 * k, 140 * k, 4 * k).fill(ctx.mix(body, ctx.pal.ink, 0.35));
  const wheels = [
    wheel(v, -40 * k, -12 * k, 14 * k, ctx.pal.ink),
    wheel(v, 42 * k, -12 * k, 14 * k, ctx.pal.ink),
  ];
  const beam = gfx(glowBox, 70 * k, -34 * k);
  beam.blendMode = 'add';
  beam
    .poly([0, -4 * k, 140 * k, -30 * k, 140 * k, 26 * k, 0, 4 * k])
    .fill({ color: 0xfff1b8, alpha: 0.25 });
  const lamp = glow(ctx, glowBox, 68 * k, -34 * k, 18 * k, 0xfff1b8, 0.9);
  return {
    view: v,
    follow: glowBox,
    lights: [lit(beam), lit(lamp)],
    roll: (dx) => {
      wheels.forEach((w) => void (w.rotation += dx / (14 * k)));
    },
  };
}

export function train(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const glowBox = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const body = ctx.c(o.color ?? ctx.pal.cloth[1]);
  const g = gfx(v);
  const win = panes(ctx, g, glowBox, 1);
  const wheels: Gfx[] = [];
  const cars = Math.max(1, Math.min(6, o.count));
  for (let c = 0; c < cars; c += 1) {
    const x = -130 * k - c * 128 * k;
    g.roundRect(x - 58 * k, -76 * k, 116 * k, 60 * k, 8 * k).fill(
      c % 2 ? ctx.mix(body, 0xffffff, 0.12) : body,
    );
    g.rect(x - 60 * k, -82 * k, 120 * k, 8 * k).fill(ctx.mix(body, ctx.pal.ink, 0.4));
    for (let w = 0; w < 4; w += 1) win.add(x - 50 * k + w * 26 * k, -66 * k, 18 * k, 18 * k);
    wheels.push(
      wheel(v, x - 34 * k, -14 * k, 11 * k, ctx.pal.ink),
      wheel(v, x + 34 * k, -14 * k, 11 * k, ctx.pal.ink),
    );
  }
  // The engine faces forward (+x).
  g.roundRect(-60 * k, -70 * k, 120 * k, 54 * k, 10 * k).fill(ctx.mix(body, ctx.pal.ink, 0.3));
  g.rect(-60 * k, -110 * k, 50 * k, 44 * k).fill(ctx.mix(body, ctx.pal.ink, 0.45));
  g.rect(24 * k, -104 * k, 18 * k, 36 * k)
    .fill(ctx.pal.ink)
    .rect(18 * k, -110 * k, 30 * k, 8 * k)
    .fill(ctx.pal.ink);
  g.poly([60 * k, -16 * k, 86 * k, -4 * k, 60 * k, -4 * k]).fill(ctx.pal.ink);
  win.add(-52 * k, -102 * k, 30 * k, 22 * k);
  for (const x of [-34, 0, 34]) wheels.push(wheel(v, x * k, -16 * k, 15 * k, ctx.pal.ink));
  g.rect(-130 * k - cars * 128 * k, -4 * k, cars * 128 * k + 220 * k, 4 * k).fill(
    ctx.mix(ctx.pal.stone, ctx.pal.ink, 0.5),
  );
  const puffs: Gfx[] = [];
  for (let i = 0; i < 4; i += 1)
    puffs.push(
      gfx(v)
        .circle(0, 0, 14 * k)
        .fill({ color: 0xffffff, alpha: 0.7 }),
    );
  return {
    view: v,
    follow: glowBox,
    lights: win.groups,
    roll: (dx) => {
      wheels.forEach((w) => void (w.rotation += dx / (13 * k)));
    },
    ambient: (T) => {
      puffs.forEach((p, i) => {
        const t = (T * 0.6 + i / 4) % 1;
        p.position.set(33 * k - t * 120 * k, -116 * k - t * 70 * k);
        p.scale.set(0.5 + t * 1.4);
        p.alpha = 1 - t;
      });
    },
  };
}
