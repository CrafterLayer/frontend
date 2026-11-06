/*
  Faces for `s.lib.creatures` (character art, 2026-11-05). The face carries the appeal, so it
  follows what polished mascot illustration does: big, low, wide-set eyes; an iris that is dark at
  the rim and glows at the bottom; a big pupil; two speculars on the light's side (upper left, the
  same light that shades the body); a heavier upper lash line; soft blush; a small mouth.

  A mood is a recipe of lids, brows and mouth. Lids are cuts: the eye ellipse itself is clipped
  between two curves, so a lid never paints a flat patch over the shaded head. 'grumpy' pouts with
  its inner lids lowered, but the eyes stay big and round, so it reads cute, never menacing.
*/

import type { CreatureMood, EyeStyle } from './define';
import type { Tones } from './color';
import { mix, shade } from './color';
import {
  clipped,
  curve,
  ellipse,
  glow,
  layer,
  part,
  path,
  polyline,
  rounded,
  scale,
  type Gradient,
  type Layer,
  type Part,
  type Prim,
  type Pt,
} from './shapes';

export interface FaceSpec {
  readonly eyeY: number;
  /** Half the distance between the two eye centres. */
  readonly eyeDx: number;
  readonly eyeRx: number;
  readonly eyeRy: number;
  readonly mouthY: number;
  readonly cheekDx: number;
  readonly cheekY: number;
  readonly nose: 'none' | 'button' | 'bunny' | 'nostrils' | 'small';
  readonly noseY: number;
  /** Robot: light lines on a dark screen. */
  readonly screen: boolean;
  readonly beak: boolean;
  readonly fang: boolean;
  readonly eyes: EyeStyle;
  readonly blush: boolean;
  readonly glasses: boolean;
  /** Mouth size (big blob faces get a bigger mouth). */
  readonly mouthScale: number;
}

type Cut = ((x: number) => number) | undefined;

interface Lids {
  top: Cut;
  bottom: Cut;
  /** Eye scale and pupil scale. */
  scale: number;
  pupil: number;
  /** Pupil offset (gaze baked into the mood). */
  gx: number;
  gy: number;
  sparkle: boolean;
  lashLine: boolean;
}

function lidsFor(
  mood: CreatureMood,
  ex: number,
  ey: number,
  rx: number,
  ry: number,
  side: number,
): Lids {
  const base: Lids = {
    top: undefined,
    bottom: undefined,
    scale: 1,
    pupil: 1,
    gx: 0,
    gy: 0,
    sparkle: false,
    lashLine: true,
  };
  const smileCut = (lift: number) => (x: number) => {
    const u = (x - ex) / rx;
    return ey + ry * (0.95 - lift) - ry * lift * 0.9 * (1 - u * u);
  };
  switch (mood) {
    case 'happy':
      return { ...base, bottom: smileCut(0.28) };
    case 'calm':
      // Open and relaxed: a gentle lower lid, the pupils a touch smaller.
      return { ...base, bottom: smileCut(0.1), pupil: 0.94 };
    case 'surprised':
      return { ...base, scale: 1.12, pupil: 0.62 };
    case 'sad':
      // Outer corners droop.
      return { ...base, top: (x) => ey - ry * 0.42 + (x - ex) * side * 0.42, gy: 0.6 };
    case 'sleepy':
      return {
        ...base,
        top: (x) => ey + ry * 0.12 - (1 - ((x - ex) / rx) ** 2) * ry * 0.12,
        bottom: smileCut(0.08),
        gy: 1.2,
        lashLine: false,
      };
    case 'excited':
      return { ...base, scale: 1.06, sparkle: true, bottom: smileCut(0.16) };
    case 'shy':
      return { ...base, bottom: smileCut(0.2), gx: -1.1, gy: 1.1, pupil: 0.92 };
    case 'grumpy':
      // Inner corners lowered (a soft V), lower lids up a little: a pout, not a glare.
      return {
        ...base,
        top: (x) => ey - ry * 0.4 - (x - ex) * side * 0.2,
        bottom: smileCut(0.1),
        gx: 0.5 * -side,
      };
  }
}

/** The points of `cut` that lie inside the ellipse, as a polyline (a lid line). */
function lidLine(cut: (x: number) => number, ex: number, ey: number, rx: number, ry: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const x = ex - rx + (2 * rx * i) / 16;
    const u = (x - ex) / rx;
    const half = ry * Math.sqrt(Math.max(0, 1 - u * u));
    const y = cut(x);
    if (y >= ey - half - 0.01 && y <= ey + half + 0.01) out.push([x, y]);
  }
  return out;
}

/** A four-point sparkle. */
function sparkle(x: number, y: number, r: number): Prim['shape'] {
  const k = r * 0.22;
  return path([
    ['M', x, y - r],
    ['Q', x + k, y - k, x + r, y],
    ['Q', x + k, y + k, x, y + r],
    ['Q', x - k, y + k, x - r, y],
    ['Q', x - k, y - k, x, y - r],
    ['Z'],
  ]);
}

function eye(
  ex: number,
  ey: number,
  rx0: number,
  ry0: number,
  side: number,
  mood: CreatureMood,
  t: Tones,
  spec: FaceSpec,
): Prim[] {
  const probe = lidsFor(mood, ex, ey, rx0, ry0, side);
  const rx = rx0 * probe.scale;
  const ry = ry0 * probe.scale;
  const l = lidsFor(mood, ex, ey, rx, ry, side);
  const ink = spec.screen ? shade(t.eyes, 0.25, 0.02) : t.ink;
  const irisLight = shade(t.eyes, 0.2, 0.01);
  const irisDark = mix(t.eyes, t.ink, 0.6);
  const iris: Gradient = {
    type: 'radial',
    cx: 0.5,
    cy: 0.78,
    r: 0.72,
    stops: [
      [0, irisLight, 1],
      [0.45, t.eyes, 1],
      [0.85, irisDark, 1],
      [1, irisDark, 1],
    ],
  };
  const cut = (cx: number, cy: number, a: number, b: number) =>
    clipped(cx, cy, a, b, l.top, l.bottom);
  const prims: Prim[] = [
    { shape: cut(ex, ey, rx, ry), fill: iris, line: { w: 1.2, c: spec.screen ? irisDark : t.ink } },
    { shape: cut(ex, ey + ry * 0.52, rx * 0.6, ry * 0.3), fill: irisLight, alpha: 0.55 },
    {
      shape: cut(ex + l.gx, ey - ry * 0.04 + l.gy, rx * 0.54 * l.pupil, ry * 0.58 * l.pupil),
      fill: t.pupil,
    },
  ];
  // The speculars sit toward the light (upper left) on both eyes.
  if (l.sparkle) {
    prims.push({ shape: sparkle(ex - rx * 0.24, ey - ry * 0.3, rx * 0.5), fill: t.white });
  } else {
    prims.push({ shape: cut(ex - rx * 0.3, ey - ry * 0.34, rx * 0.36, ry * 0.31), fill: t.white });
  }
  prims.push({
    shape: cut(ex + rx * 0.36, ey + ry * 0.32, rx * 0.16, rx * 0.16),
    fill: t.white,
    alpha: 0.9,
  });
  if (l.top !== undefined) {
    const line = lidLine(l.top, ex, ey, rx, ry);
    if (line.length > 1) prims.push({ shape: polyline(line), line: { w: 2.3, c: ink } });
  } else if (l.lashLine) {
    // A heavier upper lash line over the top of the iris.
    const pts: Pt[] = [];
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * (1.12 + 0.76 * (i / 10));
      pts.push([ex + Math.cos(a) * rx, ey + Math.sin(a) * ry]);
    }
    prims.push({ shape: polyline(pts), line: { w: 2.1, c: ink } });
  }
  if (spec.eyes === 'lashes' && mood !== 'sleepy') {
    // Two short lashes flicking out from the outer end of the lash line.
    const a = side > 0 ? Math.PI * 1.86 : Math.PI * 1.14;
    const ox = ex + Math.cos(a) * rx;
    const oy = ey + Math.sin(a) * ry;
    const lash = { w: 1.7, c: ink };
    const a2 = a - side * Math.PI * 0.09;
    const ix = ex + Math.cos(a2) * rx;
    const iy = ey + Math.sin(a2) * ry;
    prims.push(
      {
        shape: curve([ox, oy], [ox + side * 1.9, oy - 0.1], [ox + side * 2.8, oy - 1.9]),
        line: lash,
      },
      {
        shape: curve([ix, iy], [ix + side * 1.3, iy - 0.6], [ix + side * 1.7, iy - 2.6]),
        line: lash,
      },
    );
  }
  return prims;
}

function eyesPart(spec: FaceSpec, mood: CreatureMood, t: Tones): Part {
  const prims: Prim[] = [];
  const { eyeY: y, eyeDx: dx, eyeRx: rx, eyeRy: ry } = spec;
  if (spec.eyes === 'one') {
    prims.push(...eye(0, y, rx * 1.45, ry * 1.35, 1, mood, t, spec));
  } else if (spec.eyes === 'three') {
    prims.push(...eye(-dx * 1.05, y + 0.5, rx * 0.86, ry * 0.86, -1, mood, t, spec));
    prims.push(...eye(dx * 1.05, y + 0.5, rx * 0.86, ry * 0.86, 1, mood, t, spec));
    prims.push(...eye(0, y - ry * 1.15, rx * 0.8, ry * 0.8, 1, mood, t, spec));
  } else {
    const k = spec.eyes === 'small' ? 0.68 : 1;
    prims.push(...eye(-dx, y, rx * k, ry * k, -1, mood, t, spec));
    prims.push(...eye(dx, y, rx * k, ry * k, 1, mood, t, spec));
  }
  return part('eyes', 0, y, [layer(prims)]);
}

function brows(spec: FaceSpec, mood: CreatureMood, t: Tones): Prim[] {
  const ink = spec.screen ? shade(t.eyes, 0.25, 0.02) : t.ink;
  const out: Prim[] = [];
  const lift = spec.eyes === 'small' ? 1.5 : 0;
  for (const side of spec.eyes === 'one' ? [] : [-1, 1]) {
    const bx = side * (spec.eyeDx + 0.6);
    const by = spec.eyeY - spec.eyeRy - 3.6 + lift;
    const inner = bx - side * 3.1;
    const outer = bx + side * 3.1;
    let a: Pt | undefined;
    let c: Pt = [bx, by];
    let b: Pt = [outer, by];
    if (mood === 'surprised' || mood === 'excited') {
      const up = mood === 'surprised' ? 2.4 : 1.2;
      a = [inner, by + 0.6 - up];
      c = [bx, by - 2 - up];
      b = [outer, by + 0.6 - up];
    } else if (mood === 'sad' || mood === 'shy') {
      const k = mood === 'sad' ? 1 : 0.7;
      a = [inner, by - 1.8 * k];
      c = [bx, by - 0.9 * k];
      b = [outer, by + 0.9 * k];
    } else if (mood === 'grumpy') {
      a = [inner, by + 1.2];
      c = [bx, by - 0.3];
      b = [outer, by - 0.3];
    }
    if (a !== undefined) out.push({ shape: curve(a, c, b), line: { w: 2.2, c: ink } });
  }
  return out;
}

/* The sub-curve of a quadratic between t0 and t1 (its end points and control point). */
function quadSub(p0: Pt, p1: Pt, p2: Pt, t0: number, t1: number): [Pt, Pt, Pt] {
  const at = (t: number): Pt => {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
  };
  const blossom = (a: number, b: number): Pt => {
    const w0 = (1 - a) * (1 - b);
    const w1 = (1 - a) * b + a * (1 - b);
    const w2 = a * b;
    return [w0 * p0[0] + w1 * p1[0] + w2 * p2[0], w0 * p0[1] + w1 * p1[1] + w2 * p2[1]];
  };
  return [at(t0), blossom(t0, t1), at(t1)];
}

/** An open, smiling mouth: a soft D with a tongue. */
function openMouth(
  y: number,
  w: number,
  depth: number,
  t: Tones,
  ink: number,
  fang: boolean,
): Prim[] {
  const left: Pt = [-w, y];
  const right: Pt = [w, y];
  const low: Pt = [0, y + depth * 2];
  const mouth = path([
    ['M', left[0], left[1]],
    ['Q', 0, y + 1.2, right[0], right[1]],
    ['Q', low[0], low[1], left[0], left[1]],
    ['Z'],
  ]);
  const [a, c, b] = quadSub(right, low, left, 0.2, 0.8);
  const tongue = path([
    ['M', a[0], a[1]],
    ['Q', c[0], c[1], b[0], b[1]],
    ['Q', (a[0] + b[0]) / 2 - 0.4, a[1] - depth * 0.55, a[0], a[1]],
    ['Z'],
  ]);
  const prims: Prim[] = [
    { shape: mouth, fill: t.mouth },
    { shape: tongue, fill: t.tongue },
  ];
  if (fang) {
    prims.push({
      shape: rounded(
        [
          [w * 0.22, y + 0.7],
          [w * 0.62, y + 0.6],
          [w * 0.42, y + 3.3],
        ],
        0.5,
      ),
      fill: t.white,
    });
  }
  prims.push({ shape: mouth, line: { w: 1.8, c: ink } });
  return prims;
}

function beak(y: number, mood: CreatureMood, t: Tones): Prim[] {
  const top = t.warm;
  const low = shade(t.warm, -0.1, 0.01);
  const open = mood === 'happy' || mood === 'excited' || mood === 'surprised';
  const gap = open ? (mood === 'excited' ? 3.6 : 2.6) : 0;
  const prims: Prim[] = [];
  if (open) {
    prims.push({
      shape: rounded(
        [
          [-4.4, y - 0.4],
          [4.4, y - 0.4],
          [0, y + gap + 3.8],
        ],
        1.6,
      ),
      fill: t.mouth,
      line: { w: 1.6, c: t.ink },
    });
  }
  prims.push({
    shape: rounded(
      [
        [-4.2, y + gap * 0.6],
        [4.2, y + gap * 0.6],
        [0, y + gap + 4.6],
      ],
      1.4,
    ),
    fill: low,
    line: { w: 1.6, c: t.ink },
  });
  prims.push({
    shape: rounded(
      [
        [-5.4, y - 1.6],
        [0, y - 3.6],
        [5.4, y - 1.6],
        [0, y + 3.2],
      ],
      [2, 1.6, 2, 1.4],
    ),
    fill: {
      type: 'linear',
      x1: 0.5,
      y1: 0,
      x2: 0.5,
      y2: 1,
      stops: [
        [0, shade(top, 0.08), 1],
        [1, top, 1],
      ],
    },
    line: { w: 1.6, c: t.ink },
  });
  prims.push({ shape: ellipse(-1.8, y - 1.6, 1.4, 0.7), fill: t.white, alpha: 0.6 });
  return prims;
}

function mouth(spec: FaceSpec, mood: CreatureMood, t: Tones): Prim[] {
  const y = spec.mouthY;
  const ink = spec.screen ? shade(t.eyes, 0.25, 0.02) : t.ink;
  const line = (w = 1.9) => ({ w, c: ink });
  if (spec.beak) return beak(y - 1, mood, t);
  return scale(mouthShapes(spec, mood, t, y, ink, line), spec.mouthScale, 0, y);
}

function mouthShapes(
  spec: FaceSpec,
  mood: CreatureMood,
  t: Tones,
  y: number,
  ink: number,
  line: (w?: number) => { w: number; c: number },
): Prim[] {
  const prims: Prim[] = [];
  // A muzzle line from a nose down to the mouth (bear, fox, bunny) for the closed moods.
  const closed =
    mood === 'calm' || mood === 'sad' || mood === 'shy' || mood === 'grumpy' || mood === 'sleepy';
  if (spec.nose !== 'none' && spec.nose !== 'nostrils' && closed) {
    prims.push({
      shape: polyline([
        [0, spec.noseY + 1.6],
        [0, y + 0.4],
      ]),
      line: line(1.5),
    });
  }
  switch (mood) {
    case 'happy':
      prims.push(...openMouth(y, 4.4, 3.6, t, ink, spec.fang));
      break;
    case 'excited':
      prims.push(...openMouth(y - 0.4, 5.6, 4.8, t, ink, spec.fang));
      break;
    case 'calm':
      prims.push({ shape: curve([-3.6, y + 0.4], [0, y + 3.4], [3.6, y + 0.4]), line: line() });
      break;
    case 'surprised':
      prims.push({ shape: ellipse(0, y + 1.6, 2.5, 3.1), fill: t.mouth, line: line(1.7) });
      break;
    case 'sad':
      prims.push({ shape: curve([-3.4, y + 2.4], [0, y - 1.2], [3.4, y + 2.4]), line: line() });
      break;
    case 'sleepy':
      prims.push({ shape: ellipse(0, y + 1.4, 1.8, 2.1), fill: t.mouth, line: line(1.6) });
      break;
    case 'shy':
      prims.push({
        shape: path([
          ['M', -3.6, y + 1],
          ['Q', -1.8, y - 0.6, 0, y + 1],
          ['Q', 1.8, y + 2.6, 3.6, y + 1],
        ]),
        line: line(1.8),
      });
      break;
    case 'grumpy':
      // A pout: a short frown with a little puffed lower lip.
      prims.push({ shape: ellipse(0, y + 2.3, 2.3, 1.3), fill: t.tongue, alpha: 0.7 });
      prims.push({ shape: curve([-3.2, y + 2.2], [0, y - 0.6], [3.2, y + 2.2]), line: line(2.1) });
      break;
  }
  return prims;
}

function nose(spec: FaceSpec, t: Tones): Prim[] {
  const y = spec.noseY;
  switch (spec.nose) {
    case 'button':
      return [
        {
          shape: rounded(
            [
              [-3.4, y - 1.6],
              [3.4, y - 1.6],
              [0, y + 2],
            ],
            1.7,
          ),
          fill: shade(t.ink, 0.04),
        },
        { shape: ellipse(-1, y - 0.7, 1.1, 0.55), fill: t.white, alpha: 0.6 },
      ];
    case 'small':
      return [
        {
          shape: rounded(
            [
              [-2.4, y - 1.2],
              [2.4, y - 1.2],
              [0, y + 1.5],
            ],
            1.1,
          ),
          fill: shade(t.ink, 0.04),
        },
      ];
    case 'bunny':
      return [
        {
          shape: rounded(
            [
              [-2.2, y - 1.1],
              [2.2, y - 1.1],
              [0, y + 1.4],
            ],
            1,
          ),
          fill: shade(t.tongue, -0.06),
        },
      ];
    case 'nostrils':
      return [
        { shape: ellipse(-2.6, y, 0.9, 0.7), fill: mix(t.ink, t.bodyShade, 0.3) },
        { shape: ellipse(2.6, y, 0.9, 0.7), fill: mix(t.ink, t.bodyShade, 0.3) },
      ];
    case 'none':
      return [];
  }
}

function cheeks(spec: FaceSpec, mood: CreatureMood, t: Tones): Prim[] {
  if (!spec.blush) return [];
  const big = mood === 'shy' || mood === 'grumpy' || mood === 'excited';
  const out: Prim[] = [];
  for (const side of [-1, 1]) {
    const x = side * spec.cheekDx;
    out.push({
      shape: ellipse(x, spec.cheekY, big ? 6.2 : 5.2, big ? 3.9 : 3.3),
      fill: glow(t.blush, mood === 'shy' ? 0.85 : 0.7),
    });
    if (mood === 'shy') {
      for (const k of [-1.6, 0, 1.6]) {
        out.push({
          shape: polyline([
            [x + k - 0.6, spec.cheekY + 1],
            [x + k + 0.6, spec.cheekY - 1],
          ]),
          line: { w: 0.9, c: shade(t.blush, -0.12), a: 0.8 },
        });
      }
    }
  }
  return out;
}

function extras(spec: FaceSpec, mood: CreatureMood, t: Tones): Prim[] {
  const out: Prim[] = [];
  if (mood === 'sad') {
    const x = spec.eyeDx + spec.eyeRx * 0.4;
    const y = spec.eyeY + spec.eyeRy * 0.95;
    out.push({
      shape: path([
        ['M', x, y],
        ['Q', x + 1.9, y + 2.6, x + 1.6, y + 3.6],
        ['Q', x, y + 5.4, x - 1.6, y + 3.6],
        ['Q', x - 1.9, y + 2.6, x, y],
        ['Z'],
      ]),
      fill: 0xbfe6ff,
      line: { w: 0.9, c: 0x6aa8d8 },
    });
  }
  if (mood === 'sleepy') {
    // A tiny "z" floating up by the head (drawn, not text, so SVG and Pixi agree).
    const x = spec.eyeDx + spec.eyeRx + 6;
    const y = spec.eyeY - spec.eyeRy - 6;
    out.push({
      shape: polyline([
        [x - 2, y - 2],
        [x + 2, y - 2],
        [x - 2, y + 2],
        [x + 2, y + 2],
      ]),
      line: { w: 1.4, c: t.ink, a: 0.75 },
    });
  }
  if (spec.glasses) {
    const r = spec.eyeRy + 2.2;
    for (const side of [-1, 1]) {
      out.push({
        shape: ellipse(side * spec.eyeDx, spec.eyeY, r * 0.98, r),
        fill: t.white,
        alpha: 0.18,
        line: { w: 1.6, c: t.ink },
      });
    }
    out.push({
      shape: curve(
        [-spec.eyeDx + r * 0.95, spec.eyeY - 1],
        [0, spec.eyeY - 3],
        [spec.eyeDx - r * 0.95, spec.eyeY - 1],
      ),
      line: { w: 1.6, c: t.ink },
    });
  }
  return out;
}

/** The whole face for a mood: cheeks, eyes (their own part, to blink and look), brows, nose, mouth. */
export function buildFace(spec: FaceSpec, mood: CreatureMood, t: Tones): Part {
  const items: (Layer | Part)[] = [
    layer(cheeks(spec, mood, t)),
    eyesPart(spec, mood, t),
    layer([
      ...brows(spec, mood, t),
      ...nose(spec, t),
      ...mouth(spec, mood, t),
      ...extras(spec, mood, t),
    ]),
  ];
  return part('face', 0, spec.eyeY, items);
}
