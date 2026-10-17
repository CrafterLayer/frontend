import type { Ctx, Drawn, Gfx, ItemOpts, View } from './types';
import { at, box, gfx, glow, lit, vfill } from './util';

/*
  Built things (mural kit, 2026-10-14): a bridge (stone arches or a red Japanese arch), lanterns
  (a Ramadan fanous, a paper lantern, a street lamp) alone or strung across a range, a tent and a
  campfire, a fence, a barn, a windmill whose sails turn, a torii gate and a pagoda. Lamps and
  fire glow in the untinted light layer.
*/

export function bridge(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const w = 300 * k;
  if (o.kind === 'wood') {
    const red = ctx.c(ctx.pal.wood);
    const curve = (y: number) => g.moveTo(-w / 2, 0).quadraticCurveTo(0, y, w / 2, 0);
    curve(-90 * k).stroke({ width: 12 * k, color: red });
    curve(-130 * k).stroke({ width: 6 * k, color: red });
    for (let i = 1; i < 8; i += 1) {
      const t = i / 8;
      const x = -w / 2 + w * t;
      const y = 2 * (1 - t) * t * -90 * k;
      g.rect(
        x - 2 * k,
        y - 34 * k * (1 - Math.abs(t - 0.5)),
        4 * k,
        34 * k * (1 - Math.abs(t - 0.5)),
      ).fill(red);
    }
    return { view: g };
  }
  const stone = ctx.c(o.color ?? ctx.pal.stone);
  const h = 70 * k;
  g.rect(-w / 2, -h - 16 * k, w, 26 * k).fill(stone);
  g.moveTo(-w / 2, -h)
    .lineTo(w / 2, -h)
    .lineTo(w / 2, 10)
    .lineTo(w / 3, 10)
    .arc(w / 6, 10, w / 6, 0, Math.PI, true)
    .lineTo(-w / 6, 10)
    .arc(-w / 3, 10, w / 6, 0, Math.PI, true)
    .lineTo(-w / 2, 10)
    .closePath()
    .fill(ctx.mix(stone, ctx.pal.ink, 0.12));
  for (let x = -w / 2; x <= w / 2; x += 20 * k) g.rect(x, -h - 34 * k, 5 * k, 18 * k).fill(stone);
  g.rect(-w / 2, -h - 36 * k, w, 5 * k).fill(stone);
  return { view: g };
}

/** One lamp: body in the art, flame and halo in the light layer (returned lit marks). */
function lamp(
  ctx: Ctx,
  g: Gfx,
  glowParent: Gfx | ReturnType<typeof box>,
  x: number,
  y: number,
  k: number,
  kind: string,
  color: number,
): View {
  const light = ctx.pal.light;
  if (kind === 'paper') {
    g.ellipse(x, y, 13 * k, 16 * k).fill(color);
    g.rect(x - 7 * k, y - 18 * k, 14 * k, 4 * k)
      .fill(ctx.pal.ink)
      .rect(x - 7 * k, y + 14 * k, 14 * k, 4 * k)
      .fill(ctx.pal.ink);
  } else if (kind === 'street') {
    g.rect(x - 2.5 * k, y, 5 * k, 120 * k)
      .fill(ctx.pal.ink)
      .rect(x - 9 * k, y - 4 * k, 18 * k, 6 * k)
      .fill(ctx.pal.ink);
    g.poly([
      x - 8 * k,
      y - 4 * k,
      x + 8 * k,
      y - 4 * k,
      x + 5 * k,
      y - 22 * k,
      x - 5 * k,
      y - 22 * k,
    ]).fill(ctx.mix(light, 0xffffff, 0.4));
  } else {
    // A fanous: a cap, a domed top, a tapering glass body, a finial ring.
    g.circle(x, y - 26 * k, 3 * k).stroke({ width: 1.5 * k, color });
    g.poly([
      x - 6 * k,
      y - 22 * k,
      x + 6 * k,
      y - 22 * k,
      x + 11 * k,
      y - 14 * k,
      x - 11 * k,
      y - 14 * k,
    ]).fill(color);
    g.poly([
      x - 11 * k,
      y - 14 * k,
      x + 11 * k,
      y - 14 * k,
      x + 8 * k,
      y + 10 * k,
      x - 8 * k,
      y + 10 * k,
    ]).fill(ctx.mix(light, 0xffffff, 0.3));
    g.moveTo(x, y - 14 * k)
      .lineTo(x, y + 10 * k)
      .stroke({ width: 1.5 * k, color });
    g.poly([x - 8 * k, y + 10 * k, x + 8 * k, y + 10 * k, x, y + 18 * k]).fill(color);
  }
  const l = box(glowParent, x, kind === 'street' ? y - 14 * k : y);
  glow(ctx, l, 0, 0, 46 * k, light, 0.6);
  gfx(l)
    .circle(0, 0, 5 * k)
    .fill(0xfff1c8);
  return lit(l);
}

export function lantern(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const glowBox = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const color = ctx.c(o.color ?? (o.kind === 'paper' ? 0xd0402e : ctx.pal.accent));
  const g = gfx(v);
  const hang = o.kind !== 'street' && o.flag['hang'] !== false;
  if (hang)
    g.moveTo(0, -60 * k)
      .lineTo(0, -28 * k)
      .stroke({ width: 1.5 * k, color: ctx.pal.ink });
  const l = lamp(ctx, g, glowBox, 0, o.kind === 'street' ? -120 * k : 0, k, o.kind, color);
  return {
    view: v,
    lights: [l],
    follow: glowBox,
    ambient: (T) => void (v.rotation = hang ? Math.sin(T * 1.3 + o.x) * 0.05 : 0),
  };
}

/** A string of lanterns sagging between from and to, at height y. */
export function lanterns(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art);
  const glowBox = box(ctx.glow);
  const g = gfx(v);
  const k = o.size / 100;
  const n = Math.max(2, o.count);
  const sag = 40 * k;
  const y = (t: number) => o.y + 4 * sag * t * (1 - t);
  g.moveTo(o.from, o.y);
  for (let i = 1; i <= 24; i += 1) g.lineTo(o.from + ((o.to - o.from) * i) / 24, y(i / 24));
  g.stroke({ width: 1.5, color: ctx.pal.ink, alpha: 0.8 });
  const colors = o.colors ?? [ctx.pal.accent, ...ctx.pal.cloth];
  const lights: View[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n;
    const x = o.from + (o.to - o.from) * t;
    g.moveTo(x, y(t))
      .lineTo(x, y(t) + 12 * k)
      .stroke({ width: 1, color: ctx.pal.ink });
    lights.push(
      lamp(
        ctx,
        g,
        glowBox,
        x,
        y(t) + 40 * k,
        k * 0.8,
        o.kind === 'paper' ? 'paper' : 'fanous',
        ctx.c(at(colors, i)),
      ),
    );
  }
  return { view: v, lights, follow: glowBox };
}

export function tent(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const cloth = ctx.c(o.color ?? (o.kind === 'camp' ? ctx.pal.cloth[0] : 0x3a2c28));
  if (o.kind === 'camp') {
    g.poly([-60 * k, 0, 0, -80 * k, 60 * k, 0]).fill(cloth);
    g.poly([0, -80 * k, 60 * k, 0, 10 * k, 0]).fill(ctx.mix(cloth, ctx.pal.ink, 0.25));
    g.poly([-14 * k, 0, 0, -40 * k, 14 * k, 0]).fill(ctx.pal.ink);
  } else {
    g.poly([
      -110 * k,
      0,
      -96 * k,
      -56 * k,
      -40 * k,
      -68 * k,
      0,
      -58 * k,
      40 * k,
      -70 * k,
      96 * k,
      -56 * k,
      110 * k,
      0,
    ]).fill(cloth);
    for (const x of [-96, -40, 40, 96])
      g.rect((x - 2) * k, -64 * k, 4 * k, 64 * k).fill(ctx.c(ctx.pal.wood));
    g.rect(-30 * k, -46 * k, 60 * k, 46 * k).fill(ctx.mix(cloth, ctx.pal.ink, 0.45));
    for (let x = -100; x < 100; x += 22)
      g.rect(x * k, -30 * k, 12 * k, 4 * k).fill({ color: ctx.c(ctx.pal.cloth[0]), alpha: 0.7 });
  }
  return { view: g };
}

export function campfire(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const glowBox = box(ctx.glow, o.x, o.y);
  const k = o.size / 100;
  const g = gfx(v);
  const wood = ctx.c(ctx.pal.wood);
  g.roundRect(-26 * k, -8 * k, 52 * k, 9 * k, 4 * k).fill(wood);
  g.roundRect(-20 * k, -12 * k, 40 * k, 8 * k, 4 * k).fill(ctx.mix(wood, ctx.pal.ink, 0.3));
  glow(ctx, glowBox, 0, -16 * k, 120 * k, 0xff9a40, 0.55);
  const flame = gfx(glowBox, 0, -8 * k);
  flame
    .poly([-16 * k, 0, 0, -46 * k, 16 * k, 0])
    .fill(0xff8a2a)
    .poly([-8 * k, 0, 0, -28 * k, 8 * k, 0])
    .fill(0xffe08a);
  return {
    view: v,
    follow: glowBox,
    ambient: (T) => {
      flame.scale.set(1 + Math.sin(T * 13) * 0.06, 1 + Math.sin(T * 9 + 1) * 0.12);
    },
  };
}

export function fence(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art);
  const k = o.size / 100;
  const wood = ctx.c(o.color ?? ctx.mix(ctx.pal.wood, ctx.pal.wall, 0.3));
  for (let x = o.from; x <= o.to; x += 34 * k) g.rect(x, o.y - 40 * k, 6 * k, 40 * k).fill(wood);
  g.rect(o.from, o.y - 32 * k, o.to - o.from, 5 * k)
    .fill(wood)
    .rect(o.from, o.y - 16 * k, o.to - o.from, 5 * k)
    .fill(wood);
  return { view: g };
}

export function barn(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const red = ctx.c(o.color ?? ctx.pal.roof);
  const trim = ctx.c(ctx.pal.wall);
  g.poly([
    -70 * k,
    0,
    -70 * k,
    -70 * k,
    -40 * k,
    -110 * k,
    40 * k,
    -110 * k,
    70 * k,
    -70 * k,
    70 * k,
    0,
  ]).fill(red);
  g.poly([
    -76 * k,
    -66 * k,
    -42 * k,
    -116 * k,
    42 * k,
    -116 * k,
    76 * k,
    -66 * k,
    70 * k,
    -62 * k,
    38 * k,
    -106 * k,
    -38 * k,
    -106 * k,
    -70 * k,
    -62 * k,
  ]).fill(ctx.mix(red, ctx.pal.ink, 0.35));
  g.rect(-26 * k, -58 * k, 52 * k, 58 * k)
    .fill(ctx.mix(red, ctx.pal.ink, 0.2))
    .rect(-26 * k, -58 * k, 52 * k, 58 * k)
    .stroke({ width: 4 * k, color: trim });
  g.moveTo(-26 * k, -58 * k)
    .lineTo(26 * k, 0)
    .moveTo(26 * k, -58 * k)
    .lineTo(-26 * k, 0)
    .stroke({ width: 4 * k, color: trim });
  g.rect(-10 * k, -92 * k, 20 * k, 18 * k).fill(trim);
  return { view: g };
}

export function windmill(ctx: Ctx, o: ItemOpts): Drawn {
  const v = box(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const wall = ctx.c(o.color ?? ctx.pal.wall);
  gfx(v)
    .poly([-26 * k, 0, 26 * k, 0, 14 * k, -120 * k, -14 * k, -120 * k])
    .fill(wall)
    .poly([4 * k, 0, 26 * k, 0, 14 * k, -120 * k, 2 * k, -120 * k])
    .fill(ctx.mix(wall, ctx.pal.ink, 0.15))
    .poly([-18 * k, -118 * k, 18 * k, -118 * k, 0, -142 * k])
    .fill(ctx.c(ctx.pal.roof));
  const sails = gfx(v, 0, -122 * k);
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    sails
      .poly([
        0,
        0,
        c * 90 * k - s * 6 * k,
        s * 90 * k + c * 6 * k,
        c * 90 * k + s * 14 * k,
        s * 90 * k - c * 14 * k,
        c * 20 * k + s * 12 * k,
        s * 20 * k - c * 12 * k,
      ])
      .fill(ctx.c(ctx.pal.wall));
  }
  sails.circle(0, 0, 5 * k).fill(ctx.pal.ink);
  return { view: v, ambient: (T) => void (sails.rotation = T * 0.6) };
}

export function torii(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const red = ctx.c(o.color ?? 0xc8402e);
  g.rect(-44 * k, -110 * k, 9 * k, 110 * k)
    .fill(red)
    .rect(35 * k, -110 * k, 9 * k, 110 * k)
    .fill(red);
  g.rect(-56 * k, -94 * k, 112 * k, 8 * k).fill(red);
  g.moveTo(-70 * k, -112 * k)
    .quadraticCurveTo(0, -104 * k, 70 * k, -112 * k)
    .lineTo(64 * k, -124 * k)
    .quadraticCurveTo(0, -116 * k, -64 * k, -124 * k)
    .closePath()
    .fill(ctx.pal.ink);
  return { view: g };
}

export function pagoda(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  const k = o.size / 100;
  const wall = ctx.c(o.color ?? ctx.pal.wall);
  const roof = ctx.c(ctx.pal.roof);
  let y = 0;
  for (let i = 0; i < 3; i += 1) {
    const w = (60 - i * 12) * k;
    g.rect(-w / 2, y - 32 * k, w, 32 * k)
      .fill(wall)
      .rect(w * 0.15, y - 32 * k, w * 0.35, 32 * k)
      .fill(ctx.mix(wall, ctx.pal.ink, 0.15));
    y -= 32 * k;
    g.moveTo(-w / 2 - 22 * k, y + 2 * k)
      .quadraticCurveTo(-w / 2, y - 4 * k, -w / 2 + 6 * k, y - 16 * k)
      .lineTo(w / 2 - 6 * k, y - 16 * k)
      .quadraticCurveTo(w / 2, y - 4 * k, w / 2 + 22 * k, y + 2 * k)
      .closePath()
      .fill(roof);
    y -= 14 * k;
  }
  g.rect(-2 * k, y - 30 * k, 4 * k, 30 * k).fill(ctx.c(ctx.pal.accent));
  return { view: g };
}

/** A soft ground shadow or pool of colour under things (a utility the model can place). */
export function shadow(ctx: Ctx, o: ItemOpts): Drawn {
  const g = gfx(ctx.art, o.x, o.y);
  g.ellipse(0, 0, o.size, o.size * 0.18).fill(vfill(ctx, ctx.pal.ink, ctx.pal.ink, 0.3, 0.1));
  return { view: g };
}
