/*
  «وسادة دافئة» Warm pad: four-note chords, each note a triangle and a sine
  detuned apart, under a soft low-pass; the chord glides to the next every few
  seconds (Am7 → Fmaj7 → Cmaj7 → G6).
*/
import { recipeKit, span, type Recipe } from './kit';

const CHORDS: readonly (readonly number[])[] = [
  [220, 261.63, 329.63, 392],
  [174.61, 220, 261.63, 329.63],
  [196, 246.94, 261.63, 329.63],
  [196, 246.94, 293.66, 329.63],
];

export const warmPad: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone, tempo } = rc.tuning;
  const { ctx } = rc;
  const low = k.filter('lowpass', span(tone, 600, 1500), 0.7);
  const body = k.gain(0.075 * intensity);
  k.chain(low, body, rc.out);
  k.lfo(0.05, span(tone, 180, 420), low.frequency);
  k.lfo(span(tempo, 0.15, 0.45), 0.012 * intensity, body.gain);
  const first = CHORDS[0] ?? [];
  const pairs = first.map((frequency, index) => {
    const pan = k.pan(index % 2 === 0 ? -0.25 : 0.25);
    const a = k.osc('triangle', frequency, -7);
    const b = k.osc('sine', frequency, 7);
    a.connect(pan);
    b.connect(pan);
    pan.connect(low);
    return [a, b] as const;
  });
  let chord = 0;
  const next = (): void => {
    chord = (chord + 1) % CHORDS.length;
    const notes = CHORDS[chord] ?? first;
    const now = ctx.currentTime;
    pairs.forEach(([a, b], index) => {
      const frequency = notes[index] ?? 220;
      a.frequency.setTargetAtTime(frequency, now, 0.6);
      b.frequency.setTargetAtTime(frequency, now, 0.6);
    });
    k.later(next, span(1 - tempo, 4500, 8000));
  };
  k.later(next, span(1 - tempo, 4500, 8000));
  return k;
};
