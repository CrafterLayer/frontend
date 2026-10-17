import type { Ctx, Drawn, ItemOpts } from './types';
import { box, gfx, pick } from './util';
import { limb } from './creatures';

/*
  People (mural kit, 2026-10-14): the set-F walking figure, generalised — feet at (x, y), joints
  for s.lib.anim's rig (legs, arms, body, head), an outfit by kind (robe, casual, dress, child, a
  diver who swims level with fins, mask and tank) and headwear (keffiyeh, hijab, hat, none). With
  `peep: 'name'` and s.lib.peeps loaded, the head is that Open Peeps character instead.
*/

export const PERSON_KINDS = ['robe', 'casual', 'dress', 'child', 'diver'] as const;

export function person(ctx: Ctx, o: ItemOpts): Drawn {
  const kind = (PERSON_KINDS as readonly string[]).includes(o.kind) ? o.kind : 'robe';
  const k = (o.size / 100) * (kind === 'child' ? 0.68 : 1);
  const cloth = ctx.c(o.colors?.[0] ?? o.color ?? pick(ctx.r, ctx.pal.cloth));
  const skin = ctx.c(o.colors?.[1] ?? ctx.pal.skin);
  const headwear = ctx.c(o.colors?.[2] ?? (kind === 'robe' ? 0xf2efe6 : ctx.pal.ink));
  const diver = kind === 'diver';
  const trousers = diver
    ? cloth
    : kind === 'casual'
      ? ctx.c(ctx.pal.cloth[1] === cloth ? ctx.pal.ink : ctx.pal.cloth[1])
      : skin;
  const back = ctx.mix(cloth, ctx.pal.ink, 0.25);
  const r = box(ctx.art, o.x, o.y);
  const armL = limb(r, -2 * k, -72 * k, 34 * k, 8 * k, diver ? back : ctx.mix(cloth, skin, 0.5));
  const legL = limb(r, -3 * k, -44 * k, 44 * k, 9 * k, ctx.mix(trousers, ctx.pal.ink, 0.15));
  const body = box(r);
  const g = gfx(body);
  if (kind === 'robe' || kind === 'dress') {
    g.poly([
      -11 * k,
      -76 * k,
      11 * k,
      -76 * k,
      17 * k,
      kind === 'dress' ? -14 * k : -8 * k,
      -17 * k,
      kind === 'dress' ? -14 * k : -8 * k,
    ]).fill(cloth);
  } else {
    g.roundRect(-11 * k, -76 * k, 22 * k, 36 * k, 6 * k).fill(cloth);
  }
  if (diver) g.roundRect(-20 * k, -74 * k, 10 * k, 30 * k, 4 * k).fill(ctx.c(ctx.pal.accent));
  const legR = limb(r, 3 * k, -44 * k, 44 * k, 9 * k, trousers);
  if (diver)
    for (const leg of [legL, legR])
      gfx(leg)
        .poly([-5 * k, 40 * k, 14 * k, 50 * k, -5 * k, 48 * k])
        .fill(ctx.pal.ink);
  const armR = limb(r, 2 * k, -72 * k, 34 * k, 8 * k, cloth);
  if (o.flag['staff'] === true)
    gfx(armR)
      .roundRect(-2 * k, -40 * k, 4 * k, 112 * k, 2 * k)
      .fill(ctx.mix(skin, ctx.pal.ink, 0.35));
  const head = box(r, 0, -78 * k);
  const hg = gfx(head);
  hg.circle(0, -9 * k, 9 * k).fill(skin);
  const peep =
    typeof o.flag['peep'] === 'string' && ctx.peep !== undefined
      ? ctx.peep(o.flag['peep'], 30 * k)
      : undefined;
  if (peep !== undefined) {
    head.addChild(peep);
  } else if (diver) {
    hg.roundRect(-2 * k, -14 * k, 12 * k, 8 * k, 3 * k)
      .fill(0x9fd8ec)
      .circle(0, -10 * k, 10 * k)
      .stroke({ width: 2 * k, color: ctx.pal.ink });
  } else {
    const hw =
      o.flag['head'] ?? (kind === 'robe' ? 'keffiyeh' : kind === 'dress' ? 'hijab' : 'none');
    if (hw === 'keffiyeh')
      hg.poly([-11 * k, -9 * k, 0, -23 * k, 11 * k, -9 * k, 13 * k, 4 * k, -9 * k, -4 * k]).fill(
        headwear,
      );
    else if (hw === 'hijab')
      hg.poly([
        -12 * k,
        -6 * k,
        -6 * k,
        -20 * k,
        6 * k,
        -20 * k,
        12 * k,
        -6 * k,
        13 * k,
        10 * k,
        -13 * k,
        10 * k,
      ])
        .fill(headwear)
        .circle(2 * k, -8 * k, 6 * k)
        .fill(skin);
    else if (hw === 'hat')
      hg.rect(-14 * k, -16 * k, 28 * k, 3 * k)
        .fill(headwear)
        .roundRect(-8 * k, -26 * k, 16 * k, 11 * k, 3 * k)
        .fill(headwear);
    else
      hg.poly([
        -9 * k,
        -8 * k,
        -8 * k,
        -15 * k,
        0,
        -19 * k,
        8 * k,
        -15 * k,
        9 * k,
        -9 * k,
        3 * k,
        -13 * k,
        -5 * k,
        -12 * k,
      ]).fill(ctx.mix(ctx.pal.ink, ctx.pal.trunk, 0.4));
  }
  if (diver) r.rotation = Math.PI / 2;
  return {
    view: r,
    rig: { root: r, body, head, armL, armR, legL, legR },
    rest: diver ? 'walk' : 'idle',
  };
}
