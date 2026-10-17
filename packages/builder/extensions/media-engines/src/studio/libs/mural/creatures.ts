import type { Box, Ctx, Drawn, Gfx, ItemOpts } from './types';
import { box, gfx, pick } from './util';

/*
  Creatures (mural kit, 2026-10-14), built from joints so s.lib.anim rigs move them: a bird whose
  wings are the rig's arms (the run state flaps them), a fish whose tail is the rig's tail, and
  four-legged animals — camel, horse, dog, cat, sheep, cow — whose front legs are the rig's arms
  and hind legs its legs, so the walk state gives them a real gait. Butterflies flutter by
  themselves. Everything faces +x; a beat that walks it the other way turns it.
*/

/** A joint: a container at x, y holding one rounded limb hanging down `len`. */
export function limb(
  parent: Box,
  x: number,
  y: number,
  len: number,
  w: number,
  color: number,
): Box {
  const j = box(parent, x, y);
  gfx(j)
    .roundRect(-w / 2, -w / 2, w, len + w / 2, w / 2)
    .fill(color);
  return j;
}

export function bird(ctx: Ctx, o: ItemOpts): Drawn {
  const size = o.size * 0.3;
  const color = ctx.c(o.color ?? ctx.mix(ctx.pal.ink, ctx.pal.wall, 0.15));
  const r = box(ctx.art, o.x, o.y);
  const wing = () => {
    const j = box(r);
    gfx(j)
      .poly([0, 0, -size * 0.9, -size * 0.5, -size * 1.3, -size * 0.1])
      .fill(color);
    return j;
  };
  const armL = wing();
  const body = box(r);
  gfx(body)
    .ellipse(0, 0, size * 0.6, size * 0.22)
    .fill(color)
    .circle(size * 0.5, -size * 0.12, size * 0.16)
    .fill(color)
    .poly([size * 0.62, -size * 0.14, size * 0.82, -size * 0.08, size * 0.62, -size * 0.04])
    .fill(ctx.c(ctx.pal.accent));
  const armR = wing();
  armR.scale.x = -1;
  return { view: r, rig: { root: r, body, armL, armR }, rest: 'run' };
}

export function fish(ctx: Ctx, o: ItemOpts): Drawn {
  const k = o.size / 100;
  const r = box(ctx.art, o.x, o.y);
  const koi = o.kind === 'koi';
  const color = ctx.c(o.color ?? (koi ? 0xf4f0ea : pick(ctx.r, ctx.pal.cloth)));
  const patch = koi ? 0xf06a2a : ctx.mix(color, 0xffffff, 0.45);
  const tail = box(r, -30 * k, 0);
  gfx(tail)
    .poly([0, 0, -26 * k, -16 * k, -20 * k, 0, -26 * k, 16 * k])
    .fill(koi ? patch : color);
  const body = box(r);
  const g = gfx(body);
  g.ellipse(0, 0, 34 * k, 15 * k).fill(color);
  if (koi)
    g.ellipse(-6 * k, -5 * k, 12 * k, 7 * k)
      .fill(patch)
      .ellipse(14 * k, 3 * k, 8 * k, 6 * k)
      .fill(patch);
  else for (const x of [-10, 4]) g.rect(x * k, -13 * k, 5 * k, 26 * k).fill(patch);
  g.poly([-4 * k, -12 * k, 10 * k, -22 * k, 14 * k, -12 * k]).fill(
    ctx.mix(color, ctx.pal.ink, 0.15),
  );
  g.circle(22 * k, -3 * k, 3 * k).fill(ctx.pal.ink);
  const phase = ctx.r() * 6;
  return {
    view: r,
    rig: { root: r, body, tail },
    rest: 'walk',
    ambient: (T) => {
      if (r.pivot !== undefined) {
        r.pivot.x = Math.sin(T * 0.35 + phase) * 30;
        r.pivot.y = Math.sin(T * 0.8 + phase) * 6;
      }
    },
  };
}

interface Beast {
  len: number;
  h: number;
  leg: number;
  neck: [number, number];
  head: number;
  color: number;
  hump?: boolean;
  wool?: boolean;
  spots?: boolean;
  ears?: boolean;
  tailUp?: boolean;
}

const DOG: Beast = {
  len: 46,
  h: 20,
  leg: 24,
  neck: [22, -16],
  head: 11,
  color: 0xb07a4a,
  ears: true,
  tailUp: true,
};

const BEASTS: Readonly<Record<string, Beast>> = {
  camel: { len: 70, h: 26, leg: 52, neck: [34, -40], head: 11, color: 0xc89a62, hump: true },
  horse: { len: 66, h: 28, leg: 46, neck: [30, -42], head: 12, color: 0x8a5a3a },
  dog: {
    len: 46,
    h: 20,
    leg: 24,
    neck: [22, -16],
    head: 11,
    color: 0xb07a4a,
    ears: true,
    tailUp: true,
  },
  cat: {
    len: 38,
    h: 16,
    leg: 18,
    neck: [18, -12],
    head: 9,
    color: 0x6c6c78,
    ears: true,
    tailUp: true,
  },
  sheep: { len: 44, h: 26, leg: 20, neck: [14, -4], head: 11, color: 0xf2eee4, wool: true },
  cow: { len: 66, h: 32, leg: 30, neck: [24, -6], head: 13, color: 0xf4f0ea, spots: true },
};

export const BEAST_NAMES = Object.keys(BEASTS);

/** A four-legged animal: front legs as the rig's arms, hind legs as its legs. */
export function beast(name: string): (ctx: Ctx, o: ItemOpts) => Drawn {
  return (ctx, o) => {
    const b = BEASTS[name] ?? DOG;
    const k = o.size / 100;
    const color = ctx.c(o.color ?? b.color);
    const back = ctx.mix(color, ctx.pal.ink, 0.25);
    const dark = ctx.mix(color, ctx.pal.ink, 0.6);
    const legW = (b.wool ? 7 : 8) * k;
    const top = -(b.leg + b.h) * k;
    const root = box(ctx.art, o.x, o.y);
    const armL = limb(
      root,
      b.len * 0.38 * k,
      top + b.h * 0.7 * k,
      b.leg * k,
      legW,
      b.wool ? dark : back,
    );
    const legL = limb(
      root,
      -(b.len * 0.36) * k,
      top + b.h * 0.7 * k,
      b.leg * k,
      legW,
      b.wool ? dark : back,
    );
    const tail = box(root, -b.len * 0.5 * k, top + b.h * 0.3 * k);
    gfx(tail)
      .poly(
        b.tailUp
          ? [0, 0, -6 * k, -26 * k, -1 * k, -26 * k, 3 * k, 0]
          : [0, 0, -6 * k, 30 * k, -1 * k, 32 * k, 4 * k, 0],
      )
      .fill(name === 'horse' ? dark : color);
    const body = box(root);
    const g = gfx(body);
    if (b.wool) {
      for (let i = 0; i < 7; i += 1)
        g.circle(
          (-b.len * 0.42 + i * b.len * 0.14) * k,
          top + (b.h * 0.45 + (i % 2) * 5) * k,
          b.h * 0.42 * k,
        ).fill(color);
    } else {
      g.roundRect(-b.len * 0.5 * k, top, b.len * k, b.h * k, b.h * 0.5 * k).fill(color);
    }
    if (b.hump) g.ellipse(-4 * k, top + 2 * k, 20 * k, 18 * k).fill(color);
    if (b.spots)
      for (const [x, y, r] of [
        [-14, 8, 9],
        [12, 14, 7],
        [24, 4, 5],
      ] as const)
        g.circle(x * k, top + y * k, r * k).fill(dark);
    const nx = b.len * 0.42 * k;
    const [dx, dy] = [b.neck[0] * k, b.neck[1] * k];
    // The neck: as deep as the chest where it meets the body, tapering to the head.
    g.poly([
      nx - 12 * k,
      top + 2 * k,
      nx + 6 * k,
      top + b.h * 0.6 * k,
      nx + dx + 5 * k,
      top + dy + 6 * k,
      nx + dx - 7 * k,
      top + dy - 3 * k,
    ]).fill(b.wool ? dark : color);
    if (name === 'horse')
      g.poly([
        nx - 8 * k,
        top + 2 * k,
        nx + dx - 10 * k,
        top + dy - 4 * k,
        nx + dx - 14 * k,
        top + dy + 8 * k,
        nx - 12 * k,
        top + 14 * k,
      ]).fill(dark);
    const head = box(root, nx + dx, top + dy);
    const hg = gfx(head);
    if (name === 'horse' || name === 'camel') head.rotation = 0.45;
    hg.roundRect(
      -b.head * 0.6 * k,
      -b.head * 0.7 * k,
      b.head * 2 * k,
      b.head * 1.2 * k,
      b.head * 0.5 * k,
    ).fill(b.wool ? dark : color);
    if (b.ears)
      hg.poly([-4 * k, -b.head * 0.6 * k, 0, -b.head * 1.5 * k, 4 * k, -b.head * 0.6 * k]).fill(
        back,
      );
    hg.circle(b.head * 0.5 * k, -b.head * 0.2 * k, 1.8 * k).fill(ctx.pal.ink);
    const armR = limb(
      root,
      b.len * 0.28 * k,
      top + b.h * 0.75 * k,
      b.leg * k,
      legW,
      b.wool ? dark : color,
    );
    const legR = limb(
      root,
      -(b.len * 0.26) * k,
      top + b.h * 0.75 * k,
      b.leg * k,
      legW,
      b.wool ? dark : color,
    );
    if (b.hump && o.flag['saddle'] === true) {
      gfx(body)
        .roundRect(-16 * k, top - 14 * k, 32 * k, 10 * k, 4 * k)
        .fill(ctx.c(ctx.pal.cloth[0]));
    }
    return { view: root, rig: { root, body, head, armL, armR, legL, legR, tail }, rest: 'idle' };
  };
}

export function butterfly(ctx: Ctx, o: ItemOpts): Drawn {
  const k = o.size / 100;
  const v = box(ctx.art, o.x, o.y);
  const color = ctx.c(o.color ?? pick(ctx.r, ctx.pal.cloth));
  const wings: Gfx[] = [];
  for (const s of [-1, 1]) {
    const w = gfx(v);
    w.ellipse(s * 9 * k, -6 * k, 9 * k, 11 * k)
      .fill(color)
      .ellipse(s * 7 * k, 7 * k, 6 * k, 7 * k)
      .fill(ctx.mix(color, ctx.pal.ink, 0.25));
    wings.push(w);
  }
  gfx(v)
    .roundRect(-1.5 * k, -10 * k, 3 * k, 20 * k, 1.5 * k)
    .fill(ctx.pal.ink);
  const phase = ctx.r() * 6;
  return {
    view: v,
    ambient: (T) => {
      const flap = Math.abs(Math.sin(T * 9 + phase));
      for (const w of wings) w.scale.x = 0.25 + flap * 0.75;
      if (v.pivot !== undefined) {
        v.pivot.x = Math.sin(T * 0.7 + phase) * 40;
        v.pivot.y = Math.sin(T * 1.3 + phase) * 18;
      }
    },
  };
}
