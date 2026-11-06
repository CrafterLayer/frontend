/*
  The creature builder for `s.lib.creatures` (character art, 2026-11-05): a definition becomes a
  tree of joints and shaded primitives in a 120-unit frame (see shapes.ts).

  Proportions follow chibi mascot design: the head is ~57 % of the standing height, the body a
  soft pear tucked under it, with stubby limbs and big low eyes. Shape language stays round
  (round reads friendly); value contrast comes from form shading lit from the upper left, one
  ink outline merged around each silhouette, a contact shadow and a soft top highlight.

  Draw order inside the body joint: tail, wings, legs (tucked behind the torso), torso, scarf,
  head, arms. Blob-bodied kinds (monster, ghost, slime, star, sea) put their limbs behind the
  body instead, so arms appear from behind its edge.
*/

import { mix, shade, tonesOf, type Tones } from './color';
import {
  paletteNumbers,
  rngOf,
  type CreatureDef,
  type CreatureMood,
  type EarStyle,
  type WingStyle,
} from './define';
import { buildFace, type FaceSpec } from './face';
import {
  bellyMarks,
  bodyMarks,
  crest,
  crystal,
  ears,
  headMarks,
  headwear,
  highlight,
  horns,
  makeForm,
  mane,
  mark,
  occlusion,
  scarf,
  tail,
  wings,
  type Ctx,
  type Metrics,
} from './parts';
import {
  FRAME,
  blob,
  bounds,
  curve,
  ellipse,
  glow,
  layer,
  linear,
  mirror,
  part,
  path,
  rounded,
  rrect,
  shift,
  smooth,
  spine,
  tilted,
  tube,
  turn,
  within,
  type Cmd,
  type Layer,
  type Part,
  type Prim,
  type Pt,
  type Shape,
} from './shapes';

export interface Motion {
  /** Hovers above its shadow (ghost, star, sea). */
  readonly float: boolean;
  /** Squashes and stretches like jelly (slime). */
  readonly wobble: boolean;
  readonly wings: WingStyle;
  readonly ears: EarStyle;
  readonly tail: boolean;
  readonly sparkle: boolean;
}

export interface Built {
  readonly def: CreatureDef;
  readonly mood: CreatureMood;
  /** The tree: root → shadow + float → body → … (figure units, feet at 0, 0). */
  readonly root: Part;
  /** Scale that keeps everything inside the frame (1 for most characters). */
  readonly fit: number;
  readonly face: FaceSpec;
  readonly tones: Tones;
  readonly motion: Motion;
}

const OUTLINE = 1.75;
const MERGED = new Set(['monster', 'ghost', 'slime', 'star', 'sea']);

type Foot = 'paw' | 'claw' | 'hoof' | 'talon' | 'boot' | 'bunny' | 'none';
type Hand = 'paw' | 'hoof' | 'robot' | 'nub' | 'tentacle' | 'none';

const FEET: Readonly<Record<string, Foot>> = {
  dragon: 'claw',
  dino: 'claw',
  unicorn: 'hoof',
  griffin: 'talon',
  robot: 'boot',
  bunny: 'bunny',
  ghost: 'none',
  slime: 'none',
  star: 'none',
  sea: 'none',
};

const HANDS: Readonly<Record<string, Hand>> = {
  unicorn: 'hoof',
  robot: 'robot',
  ghost: 'nub',
  slime: 'none',
  star: 'none',
  sea: 'tentacle',
};

function metricsFor(def: CreatureDef, r: () => number): Metrics {
  const jitter = (k: number) => 1 + (r() - 0.5) * k;
  const head = {
    round: { rx: 30, top: 27, bottom: 23.5 },
    wide: { rx: 32.5, top: 26, bottom: 22.5 },
    tall: { rx: 28, top: 29, bottom: 24 },
    box: { rx: 31, top: 25, bottom: 25 },
  }[def.head];
  const torso = {
    pear: { rx: 19, top: 19, bottom: 16.5 },
    round: { rx: 20.5, top: 18, bottom: 16.5 },
    tall: { rx: 17.5, top: 21, bottom: 17 },
    chubby: { rx: 22.5, top: 18, bottom: 16 },
  }[def.body];
  const headRx = head.rx * jitter(0.06);
  const torsoRx = torso.rx * jitter(0.06);
  const headY = -62;
  return {
    headY,
    headRx,
    headTop: head.top * jitter(0.05),
    headBottom: head.bottom,
    neckY: -40,
    torsoY: -25,
    torsoRx,
    torsoTop: torso.top,
    torsoBottom: torso.bottom,
    shoulderX: torsoRx * 0.74,
    shoulderY: -35.5,
    hipX: torsoRx * 0.47,
    hipY: -14.6,
    wingX: torsoRx * 0.5,
    wingY: -40,
    tailX: torsoRx * 0.62,
    tailY: -16,
    // A mushroom's hat sits on its cap, 19 units above the head.
    hatY: headY - head.top - (def.kind === 'mushroom' ? 22 : 0),
  };
}

/* ------------------------------------------------------------------ limbs */

/* Hooves: a muted, deeper version of the accent (a soft lilac, rose or gold), never grey. */
function hoofTone(t: Tones): number {
  return shade(mix(t.accent, t.belly, 0.15), -0.12, -0.03);
}

function legParts(c: Ctx, foot: Foot): Part[] {
  if (foot === 'none') return [];
  const { t, m, ol } = c;
  const hx = m.hipX;
  const hy = m.hipY;
  const skin = c.form(t.body);
  const shapes: Prim[] = [];
  const details: Prim[] = [];
  const fx = hx + 1.6;
  const fy = hy + 10.2;
  switch (foot) {
    case 'hoof':
      // A short leg flaring into a rounded hoof.
      shapes.push({ shape: blob(hx, hy + 2, 5.4, 7, 6, 3, 0.55, 0.6), fill: skin });
      shapes.push({
        shape: blob(hx + 0.4, hy + 10.6, 7, 4.6, 4, 1.4, 0.7, 0.62),
        fill: c.form(hoofTone(t)),
      });
      break;
    case 'talon': {
      const toe = c.form(t.warm);
      shapes.push({ shape: rrect(hx - 3.2, hy - 5, 6.4, 13, 3.2), fill: toe });
      for (const a of [-0.9, 0, 0.9]) {
        const end: Pt = [hx + Math.sin(a) * 7.4, hy + 8.6 + Math.cos(a) * 5.4];
        shapes.push({ shape: tube([[hx, hy + 8.6], end], 3.6, 3.2), fill: toe });
      }
      break;
    }
    case 'boot':
      shapes.push({
        shape: rrect(hx - 4.4, hy - 5, 8.8, 12, 4.4),
        fill: c.form(mix(t.body, t.ink, 0.15)),
      });
      shapes.push({ shape: rrect(hx - 7, hy + 4.8, 14.6, 10, 5), fill: c.form(t.accent) });
      details.push({
        shape: rrect(hx - 6.4, hy + 11.6, 13.4, 2.4, 1.2),
        fill: t.accentShade,
        alpha: 0.8,
      });
      break;
    default: {
      shapes.push({ shape: rrect(hx - 5, hy - 5, 10, 13, 5), fill: skin });
      const bunny = foot === 'bunny';
      shapes.push({
        shape: ellipse(fx + (bunny ? 1.6 : 0), fy, bunny ? 9.8 : 8.2, 5.3),
        fill: skin,
      });
      if (foot === 'claw') {
        for (const dx of [-3.4, 0.2, 3.8]) {
          const x = fx + dx;
          details.push({
            shape: rounded(
              [
                [x - 1.5, fy + 2],
                [x + 1.5, fy + 2],
                [x + 0.2, fy + 5.6],
              ],
              0.6,
            ),
            fill: c.form(t.belly),
          });
        }
      } else {
        for (const dx of [-2.4, 2.4]) {
          const x = fx + dx + (bunny ? 1.6 : 0);
          details.push({
            shape: curve([x, fy + 1.6], [x + 0.3, fy + 3.6], [x, fy + 5]),
            line: { w: 1.1, c: t.ink, a: 0.55 },
          });
        }
      }
    }
  }
  return [
    part('legR', -hx, hy, [layer(mirror(shapes), ol), layer(mirror(details))]),
    part('legL', hx, hy, [layer(shapes, ol), layer(details)]),
  ];
}

function armParts(c: Ctx, hand: Hand): Part[] {
  if (hand === 'none' || hand === 'tentacle') return [];
  const { t, m, ol } = c;
  const sx = m.shoulderX;
  const sy = m.shoulderY;
  const skin = c.form(t.body);
  let local: Prim[] = [];
  let details: Prim[] = [];
  const paw = blob(0, 7.4, 4.9, 8.4, 7.6, 2.6, 0.55, 0.62, 0.72);
  switch (hand) {
    case 'hoof': {
      local = [{ shape: paw, fill: skin }];
      const band = within(rrect(-7, 10.6, 14, 8, 0), paw, 0);
      if (band !== undefined) details = [{ shape: band, fill: c.form(hoofTone(t)) }];
      break;
    }
    case 'robot':
      local = [
        {
          shape: tube(
            [
              [0, 0],
              [0, 11.5],
            ],
            4.4,
            4.4,
          ),
          fill: c.form(shade(t.body, -0.16, 0.01)),
        },
        { shape: ellipse(0, 14.6, 5, 4.8), fill: c.form(t.accent) },
      ];
      details = [{ shape: ellipse(0, 0.5, 3.4, 3.4), fill: c.form(t.accent) }];
      break;
    case 'nub':
      local = [{ shape: blob(0, 4.6, 4.4, 5.6, 6.2, 1.2, 0.6, 0.62, 0.8), fill: skin }];
      break;
    default:
      local = [{ shape: paw, fill: skin }];
  }
  const angle = hand === 'nub' ? 0.5 : 0.42;
  const place = (prims: Prim[]) => shift(turn(prims, -angle, 0, 0), sx, sy);
  const right = place(local);
  const rightDetails = place(details);
  return [
    part('armR', -sx, sy, [layer(mirror(right), ol), layer(mirror(rightDetails))]),
    part('armL', sx, sy, [layer(right, ol), layer(rightDetails)]),
  ];
}

/* ------------------------------------------------------------------ heads */

interface Skull {
  shape: Shape;
  /** Overlays drawn over the skull (no outline): muzzle, marks, highlight. */
  over: Prim[];
}

function faceSpec(c: Ctx, base: Partial<FaceSpec> = {}): FaceSpec {
  const { def, m, r } = c;
  const eyeY = m.headY + 3.5;
  const nose: FaceSpec['nose'] =
    def.kind === 'bear'
      ? 'button'
      : def.kind === 'fox'
        ? 'small'
        : def.kind === 'bunny'
          ? 'bunny'
          : def.kind === 'unicorn' || def.kind === 'dragon' || def.kind === 'dino'
            ? 'nostrils'
            : 'none';
  const k = 1 + (r() - 0.5) * 0.08;
  return {
    eyeY,
    eyeDx: m.headRx * 0.385 * (1 + (r() - 0.5) * 0.06),
    eyeRx: 6 * k,
    eyeRy: 7.25 * k,
    mouthY: nose === 'none' ? eyeY + 10.5 : eyeY + 13,
    cheekDx: m.headRx * 0.64,
    cheekY: eyeY + 7.6,
    nose,
    noseY: nose === 'nostrils' ? eyeY + 8.4 : eyeY + 7.2,
    screen: false,
    beak: def.mouth === 'beak',
    fang: def.mouth === 'fang',
    eyes: def.eyes,
    blush: true,
    glasses: def.accessory === 'glasses',
    mouthScale: 1,
    ...base,
  };
}

function skullFor(c: Ctx, spec: FaceSpec): Skull {
  const { def, t, m } = c;
  const over: Prim[] = [];
  let shape: Shape;
  if (def.head === 'box') {
    shape = rrect(-m.headRx, m.headY - m.headTop, m.headRx * 2, m.headTop + m.headBottom, 15);
  } else if (def.kind === 'alien') {
    shape = blob(0, m.headY, m.headRx, m.headTop, m.headBottom, -3, 0.62, 0.5);
  } else {
    const wide = def.head === 'wide' ? 4 : 3.5;
    shape = blob(0, m.headY, m.headRx, m.headTop, m.headBottom, wide, 0.58, 0.66);
  }
  over.push(occlusion(shape, t.bodyDeep, 0.0));
  over.push(...headMarks(c, shape));
  over.push(...mark(c));
  // Muzzles in the belly colour, for kinds with a snout.
  const muzzleY = (spec.noseY + spec.mouthY) / 2 + 0.6;
  const belly = c.form(t.belly);
  if (def.kind === 'bear' || def.kind === 'bunny') {
    const s = blob(0, muzzleY, def.kind === 'bunny' ? 8.6 : 10.6, 6.4, 6.6, 0.6, 0.6, 0.62);
    over.push({ shape: s, fill: belly });
  } else if (def.kind === 'unicorn' || def.kind === 'dragon' || def.kind === 'dino') {
    const s = within(blob(0, spec.noseY + 2.6, 13, 6.4, 7.4, 1.4, 0.62, 0.66), shape, 0.2);
    if (s !== undefined) over.push({ shape: s, fill: belly });
  } else if (def.pattern === 'mask' || def.kind === 'fox') {
    const ey = spec.eyeY;
    const maskShape = within(
      smooth([
        [-m.headRx * 1.05, ey + 4],
        [-m.headRx * 0.62, ey + 1.5],
        [-m.headRx * 0.22, ey + 6.5],
        [0, ey + 5],
        [m.headRx * 0.22, ey + 6.5],
        [m.headRx * 0.62, ey + 1.5],
        [m.headRx * 1.05, ey + 4],
        [m.headRx * 0.7, ey + 20],
        [0, ey + 24],
        [-m.headRx * 0.7, ey + 20],
      ]),
      shape,
      0.3,
    );
    if (maskShape !== undefined) over.push({ shape: maskShape, fill: belly });
  }
  if (def.head === 'box') {
    // The robot's face is a dark glass screen with a sheen.
    const screen = rrect(
      -m.headRx + 6.5,
      m.headY - m.headTop + 7,
      m.headRx * 2 - 13,
      m.headTop + m.headBottom - 17,
      10,
    );
    over.push({
      shape: screen,
      fill: linear(mix(t.ink, t.eyes, 0.22), shade(t.ink, -0.06)),
      line: { w: 1.4, c: shade(t.body, -0.2) },
    });
    const sheen = within(
      polyShape([
        [-m.headRx + 4, m.headY - m.headTop + 18],
        [-m.headRx + 22, m.headY - m.headTop + 4],
        [-m.headRx + 30, m.headY - m.headTop + 4],
        [-m.headRx + 4, m.headY - m.headTop + 28],
      ]),
      screen,
      1,
    );
    if (sheen !== undefined) over.push({ shape: sheen, fill: 0xffffff, alpha: 0.1 });
    over.push({
      shape: rrect(-m.headRx + 3, m.headY - m.headTop + 2.4, 18, 3, 1.5),
      fill: 0xffffff,
      alpha: 0.35,
    });
  } else {
    over.push(highlight(-m.headRx * 0.42, m.headY - m.headTop * 0.62, 7.5, 4.2, 0.55));
  }
  return { shape, over };
}

function polyShape(points: readonly Pt[]): Shape {
  return rounded(points, 0);
}

function headPart(c: Ctx, spec: FaceSpec, mood: CreatureMood): Part {
  const { t, m, ol } = c;
  const skull = skullFor(c, spec);
  const manes = mane(c);
  const items: (Layer | Part)[] = [
    ...ears(c),
    ...horns(c),
    ...crest(c),
    ...manes.back,
    layer([{ shape: skull.shape, fill: c.form(c.def.kind === 'mushroom' ? t.belly : t.body) }], ol),
    layer(skull.over),
    buildFace(spec, mood, t),
    ...crystal(c),
    ...manes.front,
    ...headwear(c),
  ];
  if (c.def.kind === 'mushroom')
    items.splice(items.length - headwear(c).length, 0, ...mushroomCap(c));
  return part('head', 0, m.neckY, items);
}

/* ------------------------------------------------------------------ torso */

function torsoLayers(c: Ctx, foot: Foot): Layer[] {
  const { t, m, ol, def } = c;
  const kind = def.kind;
  const robot = kind === 'robot';
  const k = def.body === 'chubby' ? 0.66 : 0.62;
  const topW = def.body === 'round' ? 0.9 : def.body === 'chubby' ? 0.82 : 0.72;
  const shape = robot
    ? rrect(-m.torsoRx, m.torsoY - m.torsoTop, m.torsoRx * 2, m.torsoTop + m.torsoBottom, 13)
    : blob(
        0,
        m.torsoY,
        m.torsoRx,
        m.torsoTop,
        m.torsoBottom,
        def.body === 'round' ? 2 : 5,
        0.55,
        k,
        topW,
      );
  const skinTone = kind === 'mushroom' ? t.belly : t.body;
  const over: Prim[] = [occlusion(shape, shade(skinTone, -0.2), 0.5, 0.42)];
  over.push(...bodyMarks(c, shape));
  const by = m.torsoY + 3.5;
  const bw = m.torsoRx * 0.64;
  const bh = m.torsoTop * 0.62;
  if (robot) {
    const panel = rrect(-9.5, by - 8.5, 19, 14, 4);
    over.push({
      shape: panel,
      fill: linear(mix(t.ink, t.eyes, 0.2), t.ink),
      line: { w: 1.2, c: shade(t.body, -0.2) },
    });
    [t.accent, t.blush, t.eyes].forEach((tone, i) => {
      over.push({
        shape: ellipse(-5 + i * 5, by - 1.5, 1.8, 1.8),
        fill: glow(shade(tone, 0.1), 1),
      });
    });
  } else if (kind !== 'mushroom') {
    const belly = blob(0, by, bw, bh, m.torsoBottom * 0.7, 2, 0.58, 0.62);
    over.push({ shape: belly, fill: linear(shade(t.belly, 0.02), t.bellyShade) });
    over.push(...bellyMarks(c, belly, 0, by, bw, bh));
  }
  over.push(highlight(-m.torsoRx * 0.5, m.torsoY - m.torsoTop * 0.2, 3.2, 5.4, 0.35));
  void foot;
  return [layer([{ shape, fill: c.form(skinTone) }], ol), layer(over)];
}

/* ------------------------------------------------------------------ mushroom */

function mushroomCap(c: Ctx): Layer[] {
  const { t, m, ol } = c;
  const top = m.headY - m.headTop;
  const w = m.headRx * 1.42;
  const lip = m.headY - m.headTop * 0.32;
  const cap = smooth([
    [-w, lip + 3],
    [-w * 1.02, lip - 9],
    [-w * 0.78, top - 12],
    [-w * 0.3, top - 19],
    [w * 0.3, top - 19],
    [w * 0.78, top - 12],
    [w * 1.02, lip - 9],
    [w, lip + 3],
    [w * 0.5, lip + 1],
    [0, lip + 2.4],
    [-w * 0.5, lip + 1],
  ]);
  const spots: Prim[] = [];
  const dots: [number, number, number][] = [
    [-0.55, -10, 6.2],
    [0.08, -16.5, 4.6],
    [0.6, -9, 5.4],
    [-0.12, -6.5, 3.2],
    [0.92, -2, 3.4],
    [-0.95, -1.5, 3],
  ];
  if (c.def.pattern !== 'none') {
    for (const [fx, dy, rr] of dots) {
      const s = within(ellipse(fx * w, lip + dy - 4, rr, rr * 0.88), cap, 0.6);
      if (s !== undefined) spots.push({ shape: s, fill: c.form(shade(t.belly, 0.02)) });
    }
  }
  return [
    layer([{ shape: cap, fill: c.form(t.body) }], ol),
    layer([
      occlusion(cap, shade(t.body, 0.12), 0.0),
      ...spots,
      highlight(-w * 0.45, top - 8, 9, 4.2, 0.5),
    ]),
  ];
}

/* ------------------------------------------------------------------ blob bodies */

interface BlobBody {
  shape: Shape;
  over: Prim[];
  spec: Partial<FaceSpec>;
  /** The face's tilt pivot. */
  pivotY: number;
}

function blobBody(c: Ctx): BlobBody {
  const { def, t, m } = c;
  switch (def.kind) {
    case 'monster': {
      const pts: Pt[] = [];
      const n = 34;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const ry = Math.sin(a) < 0 ? m.headTop : m.headBottom;
        const fuzz = i % 2 === 0 ? 1 : 0.94;
        pts.push([
          Math.cos(a) * m.headRx * fuzz,
          m.headY + Math.sin(a) * ry * fuzz + (Math.sin(a) > 0 ? 3 : 0),
        ]);
      }
      const shape = smooth(pts);
      const belly = blob(0, m.headY + 22, m.headRx * 0.55, 10, 10, 1, 0.6, 0.62);
      const over: Prim[] = [
        { shape: belly, fill: linear(shade(t.belly, 0.02), t.bellyShade), alpha: 0.9 },
      ];
      return {
        shape,
        over,
        spec: {
          eyeY: m.headY - 4,
          eyeDx: 13.6,
          eyeRx: 7.4,
          eyeRy: 8.6,
          mouthY: m.headY + 9.5,
          cheekDx: 22,
          cheekY: m.headY + 6,
          mouthScale: 1.45,
        },
        pivotY: m.headY + 6,
      };
    }
    case 'ghost': {
      const y0 = m.headY;
      const w = m.headRx;
      const bottom = -12;
      // A dome that flares a little into a skirt of four soft scallops.
      const xs = [w + 2, w * 0.5, 0, -w * 0.5, -w - 2];
      const d: Cmd[] = [
        ['M', -w, y0 + 10],
        ['C', -w, y0 - 20, -w * 0.55, y0 - m.headTop, 0, y0 - m.headTop],
        ['C', w * 0.55, y0 - m.headTop, w, y0 - 20, w, y0 + 10],
        ['C', w, y0 + 26, w + 2, bottom - 8, w + 2, bottom - 2],
      ];
      for (let i = 0; i < xs.length - 1; i += 1) {
        const a = xs[i] ?? 0;
        const b = xs[i + 1] ?? 0;
        d.push(['Q', (a + b) / 2, bottom + 5, b, bottom - (i === xs.length - 2 ? 2 : 4)]);
      }
      d.push(['C', -w - 2, bottom - 8, -w, y0 + 26, -w, y0 + 10], ['Z']);
      const shape = path(d);
      const over: Prim[] = [
        {
          shape,
          fill: {
            type: 'linear',
            x1: 0.5,
            y1: 0.45,
            x2: 0.5,
            y2: 1,
            stops: [
              [0, t.accent, 0],
              [1, t.accent, 0.35],
            ],
          },
        },
      ];
      return {
        shape,
        over,
        spec: { eyeY: y0 + 2, mouthY: y0 + 12.5, cheekY: y0 + 9.6, cheekDx: 18.5, eyeDx: 11 },
        pivotY: y0 + 10,
      };
    }
    case 'slime': {
      const shape = smooth([
        [-37, 0],
        [-42, -14],
        [-34, -36],
        [-19, -53],
        [-7, -62],
        [0, -73],
        [7, -62],
        [19, -53],
        [34, -36],
        [42, -14],
        [37, 0],
        [0, 2],
      ]);
      const over: Prim[] = [
        { shape: ellipse(-4, -26, 22, 16), fill: glow(shade(t.body, 0.1, 0.01), 0.7) },
        { shape: tilted(-25, -40, 3.6, 8.6, 0.62), fill: 0xffffff, alpha: 0.75 },
        { shape: ellipse(-17, -53, 2.4, 2.4), fill: 0xffffff, alpha: 0.8 },
        {
          shape: ellipse(24, -14, 2.4, 2.4),
          fill: 0xffffff,
          alpha: 0.28,
          line: { w: 0.9, c: 0xffffff, a: 0.6 },
        },
        {
          shape: ellipse(29, -24, 1.5, 1.5),
          fill: 0xffffff,
          alpha: 0.28,
          line: { w: 0.8, c: 0xffffff, a: 0.6 },
        },
      ];
      return {
        shape,
        over,
        spec: {
          eyeY: -34,
          eyeDx: 12.4,
          eyeRx: 6.4,
          eyeRy: 7.6,
          mouthY: -22,
          cheekDx: 21.5,
          cheekY: -25.5,
          mouthScale: 1.2,
        },
        pivotY: -24,
      };
    }
    case 'star': {
      const cy = -52;
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? 47 : 25;
        pts.push([Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const shape = rounded(pts, [11, 7, 11, 7, 11, 7, 11, 7, 11, 7]);
      return {
        shape,
        over: [highlight(-14, cy - 22, 6, 3.4, 0.6)],
        spec: {
          eyeY: cy - 2,
          eyeDx: 11.2,
          eyeRx: 6.2,
          eyeRy: 7.4,
          mouthY: cy + 9.5,
          cheekDx: 18.5,
          cheekY: cy + 6,
          mouthScale: 1.1,
        },
        pivotY: cy + 10,
      };
    }
    default: {
      // sea: a soft dome over a ring of tentacles.
      const shape = blob(0, m.headY + 4, m.headRx, m.headTop + 2, m.headBottom, 4, 0.6, 0.66);
      return {
        shape,
        over: [],
        spec: {
          eyeY: m.headY + 4,
          eyeDx: 12.4,
          eyeRx: 6.4,
          eyeRy: 7.6,
          mouthY: m.headY + 15,
          cheekDx: 20.5,
          cheekY: m.headY + 11.6,
          mouthScale: 1.15,
        },
        pivotY: m.headY + 18,
      };
    }
  }
}

/* Six short tentacles under the dome, each curling out at the tip: the back pair stays still,
   the outer front pair are the rig's arms and the inner pair its legs. */
function tentacles(c: Ctx): { back: Layer[]; legs: Part[]; arms: Part[] } {
  const { t, m, ol } = c;
  const skin = c.form(t.body);
  const dots = c.form(t.belly);
  const y0 = m.headY + 18;
  const one = (x0: number, side: number, len: number, lean: number): Prim[] => {
    // Down with a slight outward lean, then the tip curls up and out.
    const pts = spine(
      [x0, y0],
      [x0 + side * lean * 0.3, y0 + len * 0.7],
      [x0 + side * lean, y0 + len * 0.92],
      10,
    );
    const [ex, ey] = pts[pts.length - 1] ?? [x0, y0 + len];
    pts.push([ex + side * 3.2, ey - 0.2], [ex + side * 5.2, ey - 2.8], [ex + side * 4.8, ey - 5.6]);
    return [{ shape: tube(pts, 9.4, 3.8), fill: skin }];
  };
  const len = -y0 - 1;
  const suckers = (x0: number, side: number, lean: number): Prim[] => [
    { shape: ellipse(x0 + side * lean * 0.45, y0 + len * 0.66, 1.5, 1.2), fill: dots },
    { shape: ellipse(x0 + side * lean * 0.75, y0 + len * 0.8, 1.3, 1.05), fill: dots },
  ];
  const back = one(13, 1, len - 5, 5);
  const inner = one(4.5, 1, len, 4);
  const outer = one(19, 1, len - 3, 8);
  return {
    back: [layer([...mirror(back), ...back], ol)],
    legs: [
      part('legR', -5, y0, [layer(mirror(inner), ol), layer(mirror(suckers(4.5, 1, 4)))]),
      part('legL', 5, y0, [layer(inner, ol), layer(suckers(4.5, 1, 4))]),
    ],
    arms: [
      part('armR', -19, y0, [layer(mirror(outer), ol), layer(mirror(suckers(19, 1, 8)))]),
      part('armL', 19, y0, [layer(outer, ol), layer(suckers(19, 1, 8))]),
    ],
  };
}

function sparkles(c: Ctx): Layer[] {
  const tone = shade(c.t.accent, 0, 0.05);
  const at: [number, number, number][] = [
    [-44, -90, 5],
    [46, -98, 3.8],
    [50, -32, 3.4],
    [-50, -40, 3],
  ];
  const prims: Prim[] = at.map(([x, y, rr]) => ({
    shape: rounded(
      [
        [x, y - rr * 1.6],
        [x + rr * 0.32, y - rr * 0.32],
        [x + rr * 1.6, y],
        [x + rr * 0.32, y + rr * 0.32],
        [x, y + rr * 1.6],
        [x - rr * 0.32, y + rr * 0.32],
        [x - rr * 1.6, y],
        [x - rr * 0.32, y - rr * 0.32],
      ],
      [0.6, 0.2, 0.6, 0.2, 0.6, 0.2, 0.6, 0.2],
    ),
    fill: tone,
    line: { w: 0.9, c: c.t.accentShade },
  }));
  return [layer(prims, undefined, 'sparkle')];
}

function mergedBody(c: Ctx, mood: CreatureMood): { body: Part; spec: FaceSpec } {
  const { def, t, m, ol } = c;
  const b = blobBody(c);
  const spec = faceSpec(c, { ...b.spec, nose: 'none', noseY: 0 });
  const items: (Layer | Part)[] = [];
  const tl = tail(c);
  if (tl !== undefined) items.push(tl);
  items.push(...wings(c));
  if (def.kind === 'sea') {
    const tent = tentacles(c);
    items.push(...tent.back, ...tent.arms, ...tent.legs);
  } else {
    // A ghost's little arms rest on its sides (in front); other blobs' limbs peek from behind.
    if (def.kind !== 'ghost') items.push(...armParts(c, HANDS[def.kind] ?? 'paw'));
    items.push(...legParts(c, FEET[def.kind] ?? 'paw'));
  }
  items.push(...ears(c), ...horns(c), ...crest(c));
  const over: Prim[] = [occlusion(b.shape, t.bodyDeep, 0)];
  over.push(...headMarks(c, b.shape));
  over.push(...b.over);
  if (def.kind !== 'star' && def.kind !== 'slime') {
    over.push(highlight(-m.headRx * 0.45, m.headY - m.headTop * 0.55, 8, 4.4, 0.55));
  }
  items.push(layer([{ shape: b.shape, fill: c.form(t.body) }], ol), layer(over));
  items.push(...scarf(c));
  if (def.kind === 'ghost') items.push(...armParts(c, 'nub'));
  items.push(
    part('head', 0, b.pivotY, [
      buildFace(spec, mood, t),
      ...crystal(c),
      ...mane(c).front,
      ...headwear(c),
    ]),
  );
  if (def.kind === 'star') items.push(...sparkles(c));
  return { body: part('body', 0, 0, items), spec };
}

/* ------------------------------------------------------------------ assembly */

function metricsForMerged(def: CreatureDef, r: () => number): Metrics {
  const m = mergedShape(def, r);
  return { ...m, hatY: m.headY - m.headTop };
}

function mergedShape(def: CreatureDef, r: () => number): Metrics {
  const base = metricsFor(def, r);
  switch (def.kind) {
    case 'monster':
      return {
        ...base,
        headY: -48,
        headRx: 34 * (1 + (r() - 0.5) * 0.05),
        headTop: 39,
        headBottom: 36,
        shoulderX: 31,
        shoulderY: -38,
        hipX: 15,
        hipY: -13.6,
        wingX: 18,
        wingY: -56,
        tailX: 26,
        tailY: -20,
      };
    case 'ghost':
      return {
        ...base,
        headY: -60,
        headRx: 29,
        headTop: 30,
        headBottom: 20,
        shoulderX: 25,
        shoulderY: -42,
        wingX: 16,
        wingY: -62,
        tailX: 22,
        tailY: -24,
      };
    case 'slime':
      return {
        ...base,
        headY: -36,
        headRx: 38,
        headTop: 36,
        headBottom: 36,
        wingX: 18,
        wingY: -48,
        tailX: 30,
        tailY: -12,
      };
    case 'star':
      return {
        ...base,
        headY: -52,
        headRx: 28,
        headTop: 44,
        headBottom: 30,
        wingX: 12,
        wingY: -58,
        tailX: 22,
        tailY: -30,
      };
    default:
      return {
        ...base,
        headY: -60,
        headRx: 30,
        headTop: 32,
        headBottom: 24,
        wingX: 16,
        wingY: -64,
        tailX: 24,
        tailY: -40,
      };
  }
}

/** The whole creature for a definition, in a mood. */
export function buildCreature(def: CreatureDef, mood: CreatureMood = def.mood): Built {
  const t = tonesOf(paletteNumbers(def));
  const r = rngOf(def.seed ^ 0x5bd1e995);
  const merged = MERGED.has(def.kind);
  const m = merged ? metricsForMerged(def, r) : metricsFor(def, r);
  const c: Ctx = {
    def,
    t,
    r,
    ol: def.outline ? { w: OUTLINE, c: t.ink } : undefined,
    m,
    form: makeForm(),
  };
  let body: Part;
  let spec: FaceSpec;
  if (merged) {
    ({ body, spec } = mergedBody(c, mood));
  } else {
    spec = faceSpec(
      c,
      def.head === 'box'
        ? {
            eyeY: m.headY - 3,
            eyeDx: 10.6,
            eyeRx: 5.2,
            eyeRy: 6.3,
            mouthY: m.headY + 8,
            cheekDx: 18,
            cheekY: m.headY + 5,
            screen: true,
          }
        : def.kind === 'alien'
          ? {
              eyeY: m.headY + 1,
              eyeDx: 13,
              eyeRx: 7,
              eyeRy: 8.4,
              mouthY: m.headY + 13,
              cheekY: m.headY + 10,
            }
          : def.kind === 'mushroom'
            ? {
                eyeY: m.headY + 7,
                eyeDx: 10,
                eyeRx: 5.2,
                eyeRy: 6.2,
                mouthY: m.headY + 16,
                cheekY: m.headY + 13,
                cheekDx: 16,
              }
            : {},
    );
    const items: (Layer | Part)[] = [];
    const tl = tail(c);
    if (tl !== undefined) items.push(tl);
    items.push(...wings(c));
    const foot = FEET[def.kind] ?? 'paw';
    items.push(...legParts(c, foot));
    items.push(...torsoLayers(c, foot));
    items.push(...scarf(c));
    items.push(headPart(c, spec, mood));
    items.push(...armParts(c, HANDS[def.kind] ?? 'paw'));
    body = part('body', 0, 0, items);
  }
  const floaty = def.kind === 'ghost' || def.kind === 'star';
  const shadow = layer(
    [
      {
        shape: ellipse(
          0,
          0.8,
          Math.max(24, m.torsoRx * 1.45) * (floaty ? 0.8 : merged ? 1.25 : 1),
          floaty ? 3.6 : 4.6,
        ),
        fill: glow(t.ink, floaty ? 0.2 : 0.3),
      },
    ],
    undefined,
    'shadow',
  );
  const root = part('root', 0, 0, [shadow, part('float', 0, 0, [body])]);
  const box = bounds(root);
  const pad = 1;
  const fit = Math.min(
    1,
    (FRAME.left + FRAME.width - pad) / Math.max(1, box.maxX),
    (-FRAME.left - pad) / Math.max(1, -box.minX),
    (-FRAME.top - pad) / Math.max(1, -box.minY),
    (FRAME.top + FRAME.height) / Math.max(FRAME.top + FRAME.height, box.maxY),
  );
  return {
    def,
    mood,
    root,
    fit,
    face: spec,
    tones: t,
    motion: {
      float: floaty || def.kind === 'sea',
      wobble: def.kind === 'slime',
      wings: def.wings,
      ears: def.ears,
      tail: def.tail !== 'none',
      sparkle: def.kind === 'star',
    },
  };
}

/** The face part alone (for a mood change on a live character). */
export function rebuildFace(built: Built, mood: CreatureMood): Part {
  return buildFace(built.face, mood, built.tones);
}
