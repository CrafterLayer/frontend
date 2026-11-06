/*
  Attachable parts for `s.lib.creatures` (character art, 2026-11-05): ears, horns, wings, tails,
  crests and manes, accessories and markings. Each is drawn for the right side (+x) and mirrored,
  in figure coordinates, and hangs from a pivot where it joins the body, so the life runner can
  twitch an ear or flap a wing about the joint. Attachments sit behind the shape they grow from
  (the head's or body's outline covers their base): no seam ever shows where a part joins.
*/

import type { CreatureDef } from './define';
import { lchToNumber, mix, numberToLch, shade, type Tones } from './color';
import {
  blob,
  curve,
  ellipse,
  flatten,
  formShade,
  glow,
  layer,
  linear,
  mirror,
  part,
  path,
  poly,
  rounded,
  scale,
  shift,
  smooth,
  spine,
  tilted,
  transform,
  tube,
  turn,
  within,
  type Gradient,
  type Layer,
  type Line,
  type Paint,
  type Part,
  type Prim,
  type Pt,
  type Shape,
} from './shapes';

/** Where the body's joints and the head sit, for one character. */
export interface Metrics {
  headY: number;
  headRx: number;
  headTop: number;
  headBottom: number;
  neckY: number;
  torsoY: number;
  torsoRx: number;
  torsoTop: number;
  torsoBottom: number;
  shoulderX: number;
  shoulderY: number;
  hipX: number;
  hipY: number;
  /** Wing joints. */
  wingX: number;
  wingY: number;
  /** Tail joint. */
  tailX: number;
  tailY: number;
  /** Where hats, bows and crowns sit (the head's top, or a mushroom cap's). */
  hatY: number;
}

export interface Ctx {
  readonly def: CreatureDef;
  readonly t: Tones;
  readonly r: () => number;
  readonly ol: Line | undefined;
  readonly m: Metrics;
  /** Form shading for any base colour (cached, so renderers share one gradient per colour). */
  form(base: number): Gradient;
  /** The head silhouette (markings are cut to it). */
  skull?: Shape;
}

export function makeForm(): (base: number) => Gradient {
  const cache = new Map<number, Gradient>();
  return (base) => {
    let g = cache.get(base);
    if (g === undefined) {
      g = formShade(
        shade(base, 0.07, -0.01),
        base,
        shade(base, -0.085, 0.01),
        shade(base, -0.16, 0.012),
        shade(base, -0.11, 0.005),
      );
      cache.set(base, g);
    }
    return g;
  };
}

const both = (prims: readonly Prim[]): Prim[] => [...prims, ...mirror(prims)];

/** A pair of joints (right side drawn, left mirrored), each with an outlined layer. */
function pair(
  name: string,
  px: number,
  py: number,
  right: readonly Prim[],
  ol: Line | undefined,
  extra: readonly Prim[] = [],
): Part[] {
  return [
    part(`${name}R`, -px, py, [layer(mirror(right), ol), layer(mirror(extra))]),
    part(`${name}L`, px, py, [layer(right, ol), layer(extra)]),
  ];
}

/** Inner-ear pink: the belly warmed toward the blush. */
const innerTone = (t: Tones) => mix(t.belly, t.blush, 0.45);

/* ------------------------------------------------------------------ ears */

export function ears(c: Ctx): Part[] {
  const { t, m, ol } = c;
  const top = m.headY - m.headTop;
  const fur = c.form(t.body);
  switch (c.def.ears) {
    case 'round': {
      const x = m.headRx * 0.66;
      const y = top + m.headTop * 0.3;
      return pair('ear', x, y + 4, [{ shape: ellipse(x, y, 9.6, 9.2), fill: fur }], ol, [
        { shape: ellipse(x - 0.4, y + 0.6, 5.4, 5.0), fill: c.form(innerTone(t)) },
      ]);
    }
    case 'pointy': {
      const outer: Pt[] = [
        [m.headRx * 0.2, top + 4.6],
        [m.headRx * 0.86, top - 15.5],
        [m.headRx * 0.98, top + 18.5],
      ];
      const inner: Pt[] = [
        [m.headRx * 0.38, top + 6.6],
        [m.headRx * 0.83, top - 9.5],
        [m.headRx * 0.88, top + 15],
      ];
      const tip = mix(t.body, t.ink, 0.45);
      const ear = rounded(outer, [5, 2.6, 6]);
      const tipShape = within(ellipse(m.headRx * 0.86, top - 15.5, 6.5, 7.5), ear, 0);
      return pair('ear', m.headRx * 0.55, top + 8, [{ shape: ear, fill: fur }], ol, [
        { shape: rounded(inner, [3, 2, 3]), fill: c.form(innerTone(t)) },
        ...(tipShape === undefined ? [] : [{ shape: tipShape, fill: tip, alpha: 0.85 }]),
      ]);
    }
    case 'long': {
      const x = m.headRx * 0.36;
      const outer = smooth([
        [x - 6, top + 6],
        [x - 7.5, top - 12],
        [x - 3.5, top - 27],
        [x + 3, top - 30],
        [x + 8, top - 24],
        [x + 8.5, top - 8],
        [x + 6, top + 6],
      ]);
      const inner = smooth([
        [x - 2.5, top + 2],
        [x - 3.6, top - 12],
        [x - 1.2, top - 23],
        [x + 2.6, top - 24],
        [x + 4.6, top - 12],
        [x + 3.4, top + 2],
      ]);
      const right: Prim[] = turn([{ shape: outer, fill: fur }], 0.14, x, top + 6);
      return pair(
        'ear',
        x,
        top + 6,
        right,
        ol,
        turn([{ shape: inner, fill: c.form(innerTone(t)) }], 0.14, x, top + 6),
      );
    }
    case 'droopy': {
      const x = m.headRx * 0.6;
      const ear = smooth([
        [x - 6, top + 2],
        [x + 6, top - 2],
        [x + 14, top + 8],
        [x + 17, top + 26],
        [x + 13, top + 36],
        [x + 6, top + 30],
        [x + 3, top + 14],
      ]);
      return pair('ear', x, top + 4, [{ shape: ear, fill: fur }], ol, [
        { shape: blob(x + 10, top + 22, 3.4, 9, 7, 0), fill: innerTone(t), alpha: 0.7 },
      ]);
    }
    case 'pony': {
      const x = m.headRx * 0.5;
      // A soft leaf, tilted out (rounder than a cat's ear).
      const ear = smooth([
        [x - 6, top + 8],
        [x - 4.5, top - 2],
        [x + 1, top - 12],
        [x + 6, top - 4],
        [x + 8, top + 8],
      ]);
      const inner = smooth([
        [x - 2.6, top + 6],
        [x - 1.6, top - 1],
        [x + 1.2, top - 7],
        [x + 4, top - 1],
        [x + 4.8, top + 6],
      ]);
      return pair(
        'ear',
        x,
        top + 6,
        turn([{ shape: ear, fill: fur }], 0.5, x, top + 6),
        ol,
        turn([{ shape: inner, fill: c.form(innerTone(t)) }], 0.5, x, top + 6),
      );
    }
    case 'fin': {
      const y = m.headY - 2;
      const x = m.headRx - 3;
      if (c.def.kind === 'sea') {
        // Little flippers low on the dome, sweeping out and down.
        const fy = m.headY + 14;
        const fx = m.headRx - 4;
        const fin = smooth([
          [fx - 3, fy - 6],
          [fx + 7, fy - 6],
          [fx + 15, fy + 1],
          [fx + 15, fy + 8],
          [fx + 8, fy + 6],
          [fx - 2, fy + 5],
        ]);
        return pair('ear', fx, fy, [{ shape: fin, fill: c.form(t.body) }], ol, [
          {
            shape: curve([fx + 3, fy + 1], [fx + 8, fy + 1], [fx + 12, fy + 4]),
            line: { w: 1.1, c: t.bodyShade },
          },
        ]);
      }
      const tips: Pt[] = [
        [x + 13, y - 16],
        [x + 17, y - 5],
        [x + 13, y + 6],
      ];
      const frill = rounded(
        [
          [x - 2, y - 9],
          tips[0] ?? [0, 0],
          [x + 9, y - 6],
          tips[1] ?? [0, 0],
          [x + 9, y + 1],
          tips[2] ?? [0, 0],
          [x - 1, y + 7],
        ],
        [3, 2.2, 1.2, 2.2, 1.2, 2.2, 3],
      );
      return pair('ear', x, y, [{ shape: frill, fill: c.form(t.accent) }], ol, [
        ...tips.map(([tx, ty]) => ({
          shape: curve(
            [x + 1, y],
            [(x + tx) / 2, (y + ty) / 2 - 1],
            [tx - 2.5, ty + (ty < y ? 2 : -2)],
          ),
          line: { w: 1.1, c: t.accentShade, a: 0.9 },
        })),
      ]);
    }
    case 'tuft': {
      const x = m.headRx * 0.42;
      const feather = (bx: number, h: number, lean: number) =>
        turn(
          [
            {
              shape: smooth([
                [bx - 3.2, top + 5],
                [bx - 3.6, top - h * 0.45],
                [bx, top - h],
                [bx + 3.4, top - h * 0.5],
                [bx + 3, top + 5],
              ]),
              fill: c.form(t.body),
            },
          ],
          lean,
          bx,
          top + 5,
        );
      return pair('ear', x, top + 5, [...feather(x + 4, 9, 0.75), ...feather(x, 11.5, 0.4)], ol);
    }
    case 'antenna': {
      const glowTone = c.def.kind === 'robot' ? t.accent : shade(t.accent, 0.04, 0.02);
      if (c.def.head === 'box') {
        const stalk = tube(spine([0, top + 4], [0, top - 6], [0, top - 13]), 3, 2.6);
        return [
          part('earL', 0, top + 2, [
            layer(
              [
                { shape: stalk, fill: c.form(mix(t.body, t.ink, 0.2)) },
                { shape: ellipse(0, top - 15.5, 4.6, 4.6), fill: c.form(glowTone) },
              ],
              ol,
            ),
            layer([{ shape: ellipse(-1.4, top - 17, 1.5, 1.1), fill: t.white, alpha: 0.8 }]),
          ]),
        ];
      }
      const x = m.headRx * 0.32;
      const stalk = tube(spine([x, top + 6], [x + 1, top - 8], [x + 9, top - 16]), 3, 2.4);
      return pair(
        'ear',
        x,
        top + 6,
        [
          { shape: stalk, fill: c.form(t.body) },
          { shape: ellipse(x + 10.5, top - 18.5, 4.4, 4.4), fill: c.form(glowTone) },
        ],
        ol,
        [{ shape: ellipse(x + 9.2, top - 20, 1.5, 1.1), fill: t.white, alpha: 0.85 }],
      );
    }
    case 'bolts': {
      const y = m.headY + 2;
      const x = m.headRx;
      return pair(
        'ear',
        x,
        y,
        [{ shape: blob(x + 1.5, y, 4.4, 7, 7, 0, 0.7), fill: c.form(t.accent) }],
        ol,
      );
    }
    case 'none':
      return [];
  }
}

/* ------------------------------------------------------------------ horns, crests, manes */

const GOLD = lchToNumber({ l: 0.87, c: 0.12, h: 88 });
const CREAM = 0xfff1d8;

export function horns(c: Ctx): Layer[] {
  const { t, m, ol } = c;
  const top = m.headY - m.headTop;
  const horn = c.form(mix(CREAM, GOLD, 0.3));
  switch (c.def.horns) {
    case 'nubs': {
      // Short, blunt and curving out: friendly, never sharp.
      const x = m.headRx * 0.42;
      const h = tube(spine([x, top + 7], [x + 0.5, top - 1], [x + 5, top - 6.5]), 9, 4.8);
      return [layer(both([{ shape: h, fill: horn }]), ol)];
    }
    case 'unicorn': {
      const shapeH = rounded(
        [
          [-5.6, top + 4],
          [0, top - 22],
          [5.6, top + 4],
        ],
        [2.2, 1.6, 2.2],
      );
      const gold: Gradient = {
        type: 'linear',
        x1: 0,
        y1: 0.4,
        x2: 1,
        y2: 0.6,
        stops: [
          [0, shade(GOLD, 0.08), 1],
          [0.55, GOLD, 1],
          [1, shade(GOLD, -0.12, 0.01), 1],
        ],
      };
      const bands: Prim[] = [];
      for (let i = 0; i < 4; i += 1) {
        const y = top - 2 - i * 5.2;
        const band = within(
          path([
            ['M', -7, y + 1.4],
            ['L', 7, y - 2.6],
            ['L', 7, y - 1.2],
            ['L', -7, y + 2.8],
            ['Z'],
          ]),
          shapeH,
          0.2,
        );
        if (band !== undefined)
          bands.push({ shape: band, fill: shade(GOLD, -0.14, 0.01), alpha: 0.75 });
      }
      return [layer([{ shape: shapeH, fill: gold }], ol), layer(bands)];
    }
    case 'antlers': {
      const x = m.headRx * 0.36;
      const tone = c.form(mix(t.belly, 0x9a6b4a, 0.55));
      const beam = tube(spine([x, top + 6], [x + 2, top - 6], [x + 9, top - 14]), 4.4, 2.8);
      const prong = tube(spine([x + 2.4, top - 4], [x + 7, top - 5], [x + 11, top - 2]), 3.2, 2.4);
      const prong2 = tube(spine([x + 1.4, top - 1], [x - 2, top - 7], [x - 3, top - 12]), 3, 2.2);
      return [
        layer(
          both([
            { shape: beam, fill: tone },
            { shape: prong, fill: tone },
            { shape: prong2, fill: tone },
          ]),
          ol,
        ),
      ];
    }
    case 'crystal':
      return [];
    case 'none':
      return [];
  }
}

/** A forehead gem: drawn in front of the head (unlike the other horns). */
export function crystal(c: Ctx): Layer[] {
  if (c.def.horns !== 'crystal') return [];
  const { t, m, ol } = c;
  const y = m.headY - m.headTop * 0.66;
  const gem = rounded(
    [
      [0, y - 6.5],
      [5, y],
      [0, y + 6.5],
      [-5, y],
    ],
    1.2,
  );
  const tone = shade(t.accent, 0.02, 0.03);
  return [
    layer(
      [{ shape: gem, fill: linear(shade(tone, 0.12), shade(tone, -0.1), 0.2, 0, 0.8, 1) }],
      ol && { ...ol, w: ol.w * 0.7 },
    ),
    layer([
      {
        shape: path([['M', -2.6, y - 1.2], ['L', 0, y - 4.6], ['L', 1, y - 2.4], ['Z']]),
        fill: t.white,
        alpha: 0.8,
      },
    ]),
  ];
}

/** A point on the upper head outline at angle a (radians, -π/2 is straight up). */
function headPoint(m: Metrics, a: number, out = 0): Pt {
  return [Math.cos(a) * (m.headRx + out), m.headY + Math.sin(a) * (m.headTop + out)];
}

export function crest(c: Ctx): Layer[] {
  const { t, m, ol } = c;
  if (c.def.spikes === 'none' || c.def.spikes === 'mane') return [];
  const plates = c.def.spikes === 'plates';
  const fill = c.form(plates ? shade(t.accent, -0.02) : t.accent);
  const up = -Math.PI / 2;
  const angles = plates
    ? [up - 0.74, up - 0.37, up, up + 0.37, up + 0.74]
    : [up - 0.38, up, up + 0.38];
  const sizes = plates ? [0.72, 0.92, 1.12, 0.92, 0.72] : [1, 1.2, 1];
  const prims: Prim[] = angles.map((a, i) => {
    const big = sizes[i] ?? 1;
    const h = (plates ? 10.5 : 9) * big;
    const w = (plates ? 4.2 : 5.2) * big;
    const base = headPoint(m, a, -3.5);
    const tip = headPoint(m, a, h);
    const nx = -Math.sin(a);
    const ny = Math.cos(a) * (m.headTop / m.headRx);
    const nl = Math.hypot(nx, ny) || 1;
    const l: Pt = [base[0] + (nx / nl) * w, base[1] + (ny / nl) * w];
    const r: Pt = [base[0] - (nx / nl) * w, base[1] - (ny / nl) * w];
    const shapeS = plates
      ? rounded(
          [
            l,
            [l[0] + (tip[0] - base[0]) * 0.62, l[1] + (tip[1] - base[1]) * 0.62],
            tip,
            [r[0] + (tip[0] - base[0]) * 0.62, r[1] + (tip[1] - base[1]) * 0.62],
            r,
          ],
          [1.5, 3.4, 3, 3.4, 1.5],
        )
      : rounded([l, tip, r], [2, 2.2, 2]);
    return { shape: shapeS, fill };
  });
  return [layer(prims, ol)];
}

function maneTones(t: Tones): [number, number, number] {
  const a = numberToLch(t.accent);
  const tone = (dh: number) => lchToNumber({ l: 0.83, c: 0.1, h: a.h + dh });
  return [tone(0), tone(-50), tone(-100)];
}

/** The unicorn's mane behind the head, and the forelock in front of it. */
export function mane(c: Ctx): { back: Layer[]; front: Layer[] } {
  if (c.def.spikes !== 'mane') return { back: [], front: [] };
  const { t, m, ol } = c;
  const [m1, m2, m3] = maneTones(t);
  const top = m.headY - m.headTop;
  const rx = m.headRx;
  const back1 = smooth([
    [2, top - 2],
    [rx * 0.6, top - 3],
    [rx * 1.05, top + 10],
    [rx * 1.24, top + 30],
    [rx * 1.2, top + 48],
    [rx * 0.95, top + 42],
    [rx * 0.8, top + 22],
    [rx * 0.4, top + 8],
  ]);
  const back2 = smooth([
    [rx * 0.7, top + 14],
    [rx * 1.08, top + 26],
    [rx * 1.08, top + 44],
    [rx * 0.98, top + 52],
    [rx * 0.86, top + 40],
  ]);
  // Two locks swept to one side: the second peeks out under the first.
  const fore1 = smooth([
    [-rx * 0.1, top - 3.5],
    [rx * 0.42, top - 2],
    [rx * 0.44, top + 5],
    [rx * 0.1, top + 8],
    [-rx * 0.3, top + 12],
    [-rx * 0.62, top + 12.5],
    [-rx * 0.5, top + 4],
  ]);
  const fore2 = smooth([
    [-rx * 0.2, top + 5],
    [rx * 0.12, top + 7],
    [-rx * 0.16, top + 13],
    [-rx * 0.5, top + 17.5],
    [-rx * 0.66, top + 14],
    [-rx * 0.48, top + 9],
  ]);
  return {
    back: [
      layer(
        [
          { shape: back1, fill: c.form(m1) },
          { shape: back2, fill: c.form(m3) },
        ],
        ol,
      ),
    ],
    front: [
      layer([{ shape: fore2, fill: c.form(m2) }], ol),
      layer([{ shape: fore1, fill: c.form(m1) }], ol),
      layer([highlight(-rx * 0.05, top + 1.5, 5, 1.8, 0.5)]),
    ],
  };
}

/* ------------------------------------------------------------------ wings */

export function wings(c: Ctx): Part[] {
  const { t, m, ol } = c;
  const ax = m.wingX;
  const ay = m.wingY;
  const at = (prims: Prim[]) => shift(prims, ax - 10, ay + 40);
  switch (c.def.wings) {
    case 'bat': {
      const f0: Pt = [40, -66];
      const f1: Pt = [47, -48];
      const f2: Pt = [39, -36];
      const wing = path([
        ['M', 8, -42],
        ['Q', 22, -62, f0[0], f0[1]],
        ['Q', 38, -55, f1[0], f1[1]],
        ['Q', 38, -45, f2[0], f2[1]],
        ['Q', 28, -38, 14, -29],
        ['Z'],
      ]);
      const bones: Prim[] = [f1, f2].map((f) => ({
        shape: curve([13, -40], [(13 + f[0]) / 2, (-40 + f[1]) / 2 - 3], [f[0] - 2, f[1] + 1]),
        line: { w: 1.3, c: t.accentShade },
      }));
      const right = at([{ shape: wing, fill: c.form(t.accent) }]);
      return pair('wing', ax, ay, right, ol, [
        ...at(bones),
        ...at([
          {
            shape: curve([10, -42], [24, -60], [f0[0] - 1, f0[1] + 1.5]),
            line: { w: 2.2, c: t.body },
          },
        ]),
      ]);
    }
    case 'feather': {
      const tone = mix(t.belly, t.body, 0.4);
      // A rounded wing whose trailing edge ends in three soft feather points.
      const wing = rounded(
        [
          [8, -44],
          [20, -62],
          [36, -72],
          [48, -69],
          [44, -60],
          [50, -54],
          [42, -49],
          [46, -41],
          [37, -38],
          [39, -29],
          [27, -28],
          [15, -31],
        ],
        [4, 8, 7, 3, 1, 2.6, 1, 2.6, 1, 2.6, 5, 4],
      );
      const lines: Prim[] = [
        {
          shape: curve([20, -46], [30, -50], [40, -54]),
          line: { w: 1.1, c: shade(tone, -0.16), a: 0.8 },
        },
        {
          shape: curve([20, -40], [29, -42], [36, -42]),
          line: { w: 1.1, c: shade(tone, -0.16), a: 0.8 },
        },
        {
          shape: curve([20, -35], [27, -35], [32, -32]),
          line: { w: 1.1, c: shade(tone, -0.16), a: 0.8 },
        },
      ];
      return pair('wing', ax, ay, at([{ shape: wing, fill: c.form(tone) }]), ol, at(lines));
    }
    case 'fairy': {
      const upper = smooth([
        [8, -44],
        [18, -64],
        [34, -76],
        [46, -70],
        [42, -54],
        [24, -44],
      ]);
      const lower = smooth([
        [8, -40],
        [24, -42],
        [36, -32],
        [32, -22],
        [18, -26],
      ]);
      const tone = shade(t.accent, 0.08, -0.02);
      const edge: Line = { w: 1.4, c: shade(t.accent, -0.1), a: 0.9 };
      const veins: Prim[] = [
        { shape: curve([10, -44], [24, -56], [38, -68]), line: { w: 1, c: t.white, a: 0.7 } },
        { shape: curve([10, -40], [22, -38], [30, -29]), line: { w: 1, c: t.white, a: 0.7 } },
      ];
      return pair(
        'wing',
        ax,
        ay,
        at([
          { shape: upper, fill: glowWing(tone), line: edge },
          { shape: lower, fill: glowWing(tone), line: edge },
        ]),
        undefined,
        at(veins),
      );
    }
    case 'none':
      return [];
  }
}

function glowWing(tone: number): Gradient {
  return {
    type: 'radial',
    cx: 0.15,
    cy: 0.75,
    r: 1,
    stops: [
      [0, shade(tone, 0.1), 0.85],
      [1, tone, 0.55],
    ],
  };
}

/* ------------------------------------------------------------------ tails */

export function tail(c: Ctx): Part | undefined {
  const { t, m, ol } = c;
  const tx = m.tailX;
  const ty = m.tailY;
  const wrap = (layers: Layer[]) => part('tail', tx, ty, [part('tailSway', tx, ty, layers)]);
  switch (c.def.tail) {
    case 'spade': {
      const end: Pt = [tx + 27, ty - 14];
      const pts = spine([tx - 4, ty + 2], [tx + 20, ty + 12], end, 14);
      const dir = Math.atan2(end[1] - ty - 12, end[0] - tx - 20);
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const spade = rounded(
        [
          [end[0] - dy * 6 + dx * 1, end[1] + dx * 6 + dy * 1],
          [end[0] + dx * 10, end[1] + dy * 10],
          [end[0] + dy * 6 + dx * 1, end[1] - dx * 6 + dy * 1],
          [end[0] - dx * 1.5, end[1] - dy * 1.5],
        ],
        [2.6, 1.6, 2.6, 1],
      );
      return wrap([
        layer(
          [
            { shape: tube(pts, 9.5, 4.2), fill: c.form(t.body) },
            { shape: spade, fill: c.form(t.accent) },
          ],
          ol,
        ),
      ]);
    }
    case 'thick': {
      const pts = spine([tx - 7, ty + 3], [tx + 22, ty + 13], [tx + 33, ty - 7], 14);
      return wrap([layer([{ shape: tube(pts, 15, 3.6), fill: c.form(t.body) }], ol)]);
    }
    case 'fluffy': {
      const plume = smooth([
        [tx - 2, ty + 2],
        [tx + 9, ty + 6],
        [tx + 21, ty + 3],
        [tx + 31, ty - 8],
        [tx + 35, ty - 24],
        [tx + 31, ty - 37],
        [tx + 24, ty - 41],
        [tx + 21, ty - 32],
        [tx + 17, ty - 20],
        [tx + 9, ty - 10],
        [tx, ty - 5],
      ]);
      // The plume curves (not convex): cut the white tip to its upper lobe, which is.
      const lobe = poly(flatten(plume).filter(([, y]) => y < ty - 18));
      const tipShape = within(blob(tx + 29, ty - 34, 10, 10, 9, 0), lobe, 0.3);
      const one = [
        { shape: plume, fill: c.form(t.body) },
        ...(tipShape === undefined ? [] : [{ shape: tipShape, fill: c.form(t.belly) }]),
      ];
      const count = c.def.kind === 'fox' ? 3 : 1;
      const layers: Layer[] = [];
      for (let i = 0; i < count; i += 1) {
        // Spirit tails fan out: up behind the head, out to the side, and low.
        const a = count === 1 ? 0 : ([-0.62, 0.02, 0.62][i] ?? 0);
        const k = count === 1 ? 1 : ([0.82, 0.92, 0.84][i] ?? 1);
        layers.push(layer(turn(scale(one, k, tx, ty), a, tx, ty), ol));
      }
      return wrap(layers);
    }
    case 'puff': {
      const pts: Pt[] = [];
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 === 0 ? 7.6 : 6.4;
        pts.push([tx + 5 + Math.cos(a) * rr, ty - 2 + Math.sin(a) * rr]);
      }
      return wrap([layer([{ shape: smooth(pts), fill: c.form(t.belly) }], ol)]);
    }
    case 'pony': {
      const [m1, m2] = maneTones(t);
      const s1 = smooth([
        [tx - 3, ty - 4],
        [tx + 11, ty - 4],
        [tx + 23, ty + 1],
        [tx + 31, ty + 9],
        [tx + 33, ty + 15],
        [tx + 27, ty + 16],
        [tx + 20, ty + 9],
        [tx + 12, ty + 5],
        [tx + 3, ty + 4],
      ]);
      // A second lock peeking out under the first, outlined like the forelock.
      const s2 = smooth([
        [tx + 2, ty + 2],
        [tx + 13, ty + 6],
        [tx + 20, ty + 12],
        [tx + 20, ty + 17],
        [tx + 13, ty + 13],
        [tx + 5, ty + 8],
      ]);
      return wrap([
        layer([{ shape: s2, fill: c.form(m2) }], ol),
        layer([{ shape: s1, fill: c.form(m1) }], ol),
      ]);
    }
    case 'tuft': {
      const end: Pt = [tx + 23, ty - 9];
      const pts = spine([tx - 3, ty + 1], [tx + 15, ty + 10], end, 12);
      const tuftPts: Pt[] = [];
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? 6.6 : 5;
        tuftPts.push([end[0] + 2 + Math.cos(a) * rr, end[1] - 3 + Math.sin(a) * rr * 1.1]);
      }
      return wrap([
        layer(
          [
            { shape: tube(pts, 4.6, 3.4), fill: c.form(t.body) },
            { shape: smooth(tuftPts), fill: c.form(t.accent) },
          ],
          ol,
        ),
      ]);
    }
    case 'none':
      return undefined;
  }
}

/* ------------------------------------------------------------------ accessories */

/** Accessories worn on the head (drawn in front of it). */
export function headwear(c: Ctx): Layer[] {
  const { t, m, ol } = c;
  const top = m.hatY;
  switch (c.def.accessory) {
    case 'bow': {
      const x = m.headRx * 0.52;
      const y = top + 4;
      const tone = c.def.kind === 'robot' ? t.blush : t.accent;
      const loops = [
        rounded(
          [
            [x, y],
            [x - 10, y - 6.5],
            [x - 9, y + 6],
          ],
          3.4,
        ),
        rounded(
          [
            [x, y],
            [x + 10, y - 6.5],
            [x + 9, y + 6],
          ],
          3.4,
        ),
      ];
      const prims = turn(
        [
          ...loops.map((shape) => ({ shape, fill: c.form(tone) })),
          { shape: ellipse(x, y, 3.2, 3), fill: c.form(shade(tone, -0.04)) },
        ],
        0.35,
        x,
        y,
      );
      return [layer(prims, ol)];
    }
    case 'flower': {
      const x = -m.headRx * 0.5;
      const y = top + 5;
      const petals: Prim[] = [];
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        petals.push({
          shape: ellipse(x + Math.cos(a) * 4.3, y + Math.sin(a) * 4.3, 3.7, 3.7),
          fill: c.form(shade(t.accent, 0.06)),
        });
      }
      return [
        layer(petals, ol),
        layer([{ shape: ellipse(x, y, 2.8, 2.8), fill: c.form(GOLD) }], ol),
      ];
    }
    case 'crown': {
      const y = top + 3;
      const crown = rounded(
        [
          [-10, y],
          [-12, y - 12],
          [-5, y - 6],
          [0, y - 15],
          [5, y - 6],
          [12, y - 12],
          [10, y],
        ],
        [1.5, 1.6, 1, 1.6, 1, 1.6, 1.5],
      );
      return [
        layer([{ shape: crown, fill: c.form(GOLD) }], ol),
        layer([
          { shape: ellipse(0, y - 4, 2.1, 2.1), fill: c.form(t.accent) },
          { shape: ellipse(-7, y - 3, 1.4, 1.4), fill: t.blush },
          { shape: ellipse(7, y - 3, 1.4, 1.4), fill: t.blush },
        ]),
      ];
    }
    case 'leaf': {
      const leafTone = lchToNumber({ l: 0.74, c: 0.14, h: 140 });
      const leaf = (cx: number, cy: number, a: number) => {
        const s = path([['M', 0, 0], ['Q', 4.5, -4.6, 10, 0], ['Q', 4.5, 4.6, 0, 0], ['Z']]);
        return { shape: transform(s, cx, cy, a), fill: c.form(leafTone) };
      };
      const sx = -2;
      return [
        layer([
          {
            shape: curve([sx, top + 3], [sx - 0.4, top - 4], [sx + 2, top - 8]),
            line: { w: 2, c: shade(leafTone, -0.16) },
          },
        ]),
        layer(
          [leaf(sx + 1.6, top - 7.6, -0.5), leaf(sx + 1.4, top - 7.4, -2.7)],
          ol && { ...ol, w: ol.w * 0.8 },
        ),
      ];
    }
    case 'party-hat': {
      const bx = m.headRx * 0.32;
      const by = top + 4;
      const cone = rounded(
        [
          [-8.5, 0],
          [0, -23],
          [8.5, 0],
        ],
        [3, 1.4, 3],
      );
      const coneT = transform(cone, bx, by, 0.32, 0, 0);
      const stripes: Prim[] = [];
      for (const y of [-6, -13]) {
        const band = within(
          transform(rrectShape(-12, y - 1.8, 24, 3.6), bx, by, 0.32, 0, 0),
          coneT,
          0.1,
        );
        if (band !== undefined) stripes.push({ shape: band, fill: t.white, alpha: 0.85 });
      }
      const tip = transform(ellipse(0, -23, 3.4, 3.4), bx, by, 0.32, 0, 0);
      return [
        layer([{ shape: coneT, fill: c.form(t.accent) }], ol),
        layer(stripes),
        layer([{ shape: tip, fill: c.form(t.belly) }], ol),
      ];
    }
    default:
      return [];
  }
}

function rrectShape(x: number, y: number, w: number, h: number): Shape {
  return path([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]);
}

/** A scarf around the neck (between the body and the head). */
export function scarf(c: Ctx): Layer[] {
  if (c.def.accessory !== 'scarf') return [];
  const { t, m, ol } = c;
  const y = m.neckY;
  const w = Math.min(m.torsoRx, 20);
  const band = smooth([
    [-w - 1, y - 1.5],
    [0, y + 0.5],
    [w + 1, y - 1.5],
    [w + 2, y + 5.5],
    [0, y + 8.5],
    [-w - 2, y + 5.5],
  ]);
  const end = rounded(
    [
      [w * 0.3, y + 4],
      [w * 0.72, y + 3],
      [w * 0.86, y + 18],
      [w * 0.42, y + 19],
    ],
    2.4,
  );
  const tone = c.form(t.accent);
  const stripe = within(rrectShape(w * 0.2, y + 11, w, 2.6), end, 0.2);
  return [
    layer([{ shape: end, fill: tone }], ol),
    layer(stripe === undefined ? [] : [{ shape: stripe, fill: t.accentLight }]),
    layer([{ shape: band, fill: tone }], ol),
  ];
}

/** A forehead mark (a small flame), drawn on the skull. */
export function mark(c: Ctx): Prim[] {
  if (c.def.accessory !== 'mark') return [];
  const { t, m } = c;
  const y = m.headY - m.headTop * 0.6;
  const flame = path([
    ['M', 0, y - 6.5],
    ['Q', 4.2, y - 1, 2.6, y + 2.4],
    ['Q', 0, y + 4.4, -2.6, y + 2.4],
    ['Q', -4.2, y - 1, 0, y - 6.5],
    ['Z'],
  ]);
  return [
    { shape: flame, fill: linear(shade(t.accent, 0.08), shade(t.accent, -0.06)), alpha: 0.95 },
  ];
}

/* ------------------------------------------------------------------ markings */

const star5 = (x: number, y: number, r: number): Shape => {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.48;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return rounded(pts, r * 0.18);
};

const heart = (x: number, y: number, r: number): Shape =>
  path([
    ['M', x, y + r * 0.9],
    ['C', x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.1, x, y - r * 0.35],
    ['C', x + r * 0.7, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9],
    ['Z'],
  ]);

/** Markings on the head, cut to the skull. */
export function headMarks(c: Ctx, skull: Shape): Prim[] {
  const { t, m, r } = c;
  // Markings are the body's own hue, darker and a little richer (mixing in the complementary
  // accent would turn them muddy grey).
  const tone = shade(t.body, -0.11, 0.03);
  const out: Prim[] = [];
  const add = (s: Shape, fill: Paint, alpha = 1) => {
    const cut = within(s, skull);
    if (cut !== undefined) out.push({ shape: cut, fill, alpha });
  };
  const top = m.headY - m.headTop;
  switch (c.def.pattern) {
    case 'spots':
      add(ellipse(-m.headRx * 0.66, top + m.headTop * 0.42, 5 + r() * 1.5, 4.4), tone, 0.75);
      add(ellipse(-m.headRx * 0.3, top + 4, 3, 2.8), tone, 0.75);
      add(ellipse(m.headRx * 0.72, top + m.headTop * 0.5, 4, 3.8), tone, 0.75);
      break;
    case 'stripes':
      // Two short tapered marks at each temple, pointing in.
      for (const side of [-1, 1]) {
        for (const [dy, len] of [
          [0, 7],
          [5.5, 5.5],
        ] as const) {
          const x = side * m.headRx;
          const y = m.headY - 9 + dy;
          add(
            path([
              ['M', x, y - 2.2],
              ['Q', x - side * len * 0.6, y - 1, x - side * len, y + 0.4],
              ['Q', x - side * len * 0.6, y + 1.6, x, y + 2.2],
              ['Z'],
            ]),
            tone,
            0.85,
          );
        }
      }
      break;
    case 'stars':
      add(star5(-m.headRx * 0.62, top + m.headTop * 0.5, 3.2), t.accentLight, 0.9);
      break;
    case 'hearts':
      add(heart(m.headRx * 0.62, top + m.headTop * 0.52, 3), t.blush, 0.9);
      break;
    default:
      break;
  }
  return out;
}

/** Markings on the torso, cut to it (drawn before the belly patch). */
export function bodyMarks(c: Ctx, torso: Shape): Prim[] {
  const { t, m } = c;
  const tone = shade(t.body, -0.11, 0.03);
  const out: Prim[] = [];
  const add = (s: Shape, fill: Paint, alpha = 1) => {
    const cut = within(s, torso);
    if (cut !== undefined) out.push({ shape: cut, fill, alpha });
  };
  const y = m.torsoY;
  const w = m.torsoRx;
  switch (c.def.pattern) {
    case 'spots':
      add(ellipse(-w * 0.86, y - 2, 4.6, 4.2), tone, 0.75);
      add(ellipse(w * 0.9, y + 5, 3.8, 3.6), tone, 0.75);
      add(ellipse(-w * 0.7, y + 10, 2.6, 2.4), tone, 0.75);
      break;
    case 'stripes':
      for (const s of [-1, 1]) {
        add(tilted(s * w * 0.95, y - 3, 6, 1.9, s * 0.2), tone, 0.8);
        add(tilted(s * w * 0.95, y + 5, 6, 1.9, s * 0.1), tone, 0.8);
      }
      break;
    case 'stars':
      add(star5(w * 0.78, y - 2, 3), t.accentLight, 0.95);
      add(star5(-w * 0.82, y + 6, 2.4), t.accentLight, 0.95);
      break;
    case 'hearts':
      add(heart(-w * 0.8, y, 2.8), t.blush, 0.95);
      add(heart(w * 0.82, y + 7, 2.2), t.blush, 0.95);
      break;
    default:
      break;
  }
  return out;
}

/** Lines over the belly patch (dragon plates, griffin feathers). */
export function bellyMarks(
  c: Ctx,
  belly: Shape,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): Prim[] {
  const { t } = c;
  const line = { w: 1.2, c: shade(t.belly, -0.14), a: 0.9 };
  const out: Prim[] = [];
  if (c.def.pattern === 'plates') {
    for (const k of [-0.42, -0.08, 0.26]) {
      const y = by + bh * k;
      const half = bw * Math.sqrt(Math.max(0, 1 - (k * 1.6) ** 2)) * 0.92;
      out.push({ shape: curve([bx - half, y], [bx, y + 2.6], [bx + half, y]), line });
    }
  } else if (c.def.pattern === 'feathers') {
    for (const [k, n] of [
      [-0.3, 3],
      [0.1, 2],
    ] as const) {
      const y = by + bh * k;
      for (let i = 0; i < n; i += 1) {
        const x = bx + (i - (n - 1) / 2) * 6;
        const s = within(
          path([
            ['M', x - 3.2, y],
            ['Q', x, y + 4.2, x + 3.2, y],
          ]),
          belly,
          0,
        );
        if (s !== undefined) out.push({ shape: curve([x - 3, y], [x, y + 3.8], [x + 3, y]), line });
      }
    }
  }
  return out;
}

/** The soft white top-left highlight on a round form. */
export function highlight(x: number, y: number, rx: number, ry: number, alpha = 0.55): Prim {
  return { shape: tilted(x, y, rx, ry, -0.5), fill: glow(0xffffff, alpha) };
}

/** The same silhouette darkened toward the top: ambient occlusion under the head. */
export function occlusion(shape: Shape, deep: number, alpha: number, reach = 0.36): Prim {
  return {
    shape,
    fill: {
      type: 'linear',
      x1: 0.5,
      y1: 0,
      x2: 0.5,
      y2: reach,
      stops: [
        [0, deep, alpha],
        [1, deep, 0],
      ],
    },
  };
}
