/*
  Ready L-systems for `s.lib.lsys` (mural libraries 2, 2026-10-13). Plants follow Prusinkiewicz &
  Lindenmayer, "The Algorithmic Beauty of Plants" (1990), figures 1.24 and 1.6 (fern, bush, the
  Koch snowflake, the dragon curve), with our own stochastic tree, vine and arabesque scroll; the
  Hilbert curve is the classic two-rule form. Each is plain data a scene can spread and change:

    s.lib.lsys.grow({ ...s.lib.lsys.presets.fern, iterations: 4, angle: 25 })

  Turtle symbols: F and G draw a step (`draw` names others), f moves without drawing, + turns
  left and - right by `angle` (degrees, on screen), | turns back, " multiplies the step by
  `shrink`, [ and ] save and restore the turtle (a branch). Other symbols only rewrite.
*/

export type LsysChoice = string | { readonly to: string; readonly p?: number };
export type LsysRule = string | readonly LsysChoice[];

export interface LsysDefinition {
  readonly axiom: string;
  readonly rules: Readonly<Record<string, LsysRule>>;
  /** Degrees per + or -. */
  readonly angle: number;
  readonly iterations: number;
  /** Degrees; -90 grows up the screen, 0 toward the inline end (mirrored with dir: -1). */
  readonly heading: number;
  /** Seeded wobble added to every turn, in degrees. */
  readonly jitter?: number;
  /** What " multiplies the step by. */
  readonly shrink?: number;
  /** Symbols that draw a step (default 'FG'). */
  readonly draw?: string;
}

const plant = (definition: Omit<LsysDefinition, 'heading'>): LsysDefinition => ({
  heading: -90,
  ...definition,
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** Deeply frozen: spread one into grow()'s options to change it. */
export const LSYS_PRESETS = deepFreeze({
  /** ABOP fig. 1.24f: a fern-like plant, leaning, with bracketed fronds. */
  fern: plant({
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: 22.5,
    iterations: 5,
  }),
  /** A seeded branching tree: three rules for its buds, so every seed grows its own crown. */
  tree: plant({
    axiom: 'X',
    rules: {
      X: [
        { to: 'F[+X][-X]FX', p: 0.5 },
        { to: 'F[-X]FX', p: 0.25 },
        { to: 'F[+X]FX', p: 0.25 },
      ],
      F: 'FF',
    },
    angle: 24,
    iterations: 6,
    jitter: 5,
  }),
  /** ABOP fig. 1.24d: a dense bush of drooping twigs. */
  bush: plant({ axiom: 'F', rules: { F: 'FF-[-F+F+F]+[+F-F-F]' }, angle: 22.5, iterations: 4 }),
  /** A trailing vine: a wandering stem toward the inline end with curled tendrils on both sides. */
  vine: {
    axiom: 'A',
    rules: {
      A: [
        { to: 'F[+B]F[-B]A', p: 0.5 },
        { to: 'F[-B]F[+B]A', p: 0.5 },
      ],
      B: 'F"+F"+F"+F',
    },
    angle: 32,
    iterations: 10,
    heading: 0,
    jitter: 9,
    shrink: 0.78,
  },
  /**
   * An arabesque (rinceau) scroll: a waving stem whose side shoots curl into tightening spirals,
   * the older ones longer — mirror it for a symmetric panel.
   */
  arabesque: {
    axiom: 'A',
    rules: { A: 'F[+S]-F[-T]+A', S: 'F"+S', T: 'F"-T' },
    angle: 30,
    iterations: 9,
    heading: 0,
    shrink: 0.86,
  },
  /** ABOP fig. 1.6: the Koch snowflake. */
  koch: {
    axiom: 'F--F--F',
    rules: { F: 'F+F--F+F' },
    angle: 60,
    iterations: 4,
    heading: 0,
  },
  /** The Heighway dragon curve. */
  dragon: {
    axiom: 'FX',
    rules: { X: 'X+YF+', Y: '-FX-Y' },
    angle: 90,
    iterations: 10,
    heading: 0,
  },
  /** The Hilbert space-filling curve. */
  hilbert: {
    axiom: 'A',
    rules: { A: '+BF-AFA-FB+', B: '-AF+BFB+FA-' },
    angle: 90,
    iterations: 5,
    heading: 0,
  },
} satisfies Record<string, LsysDefinition>);

export type LsysPresetName = keyof typeof LSYS_PRESETS;
export const LSYS_PRESET_NAMES = Object.freeze(Object.keys(LSYS_PRESETS) as LsysPresetName[]);
