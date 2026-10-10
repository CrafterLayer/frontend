/*
  «صراصير الليل» Night crickets: two crickets, left and right, each chirping in
  trains of three or four pulses (a high sine gated by its gain), over a faint
  night air bed.
*/
import { recipeKit, span, type Recipe } from './kit';

export const nightCrickets: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone, tempo } = rc.tuning;
  const { ctx } = rc;
  k.chain(k.noise('pink'), k.filter('lowpass', 700), k.gain(0.035 * intensity), rc.out);

  const cricket = (pitch: number, side: number): void => {
    const gate = k.gain(0);
    const osc = k.osc('sine', pitch);
    k.chain(osc, gate, k.pan(side), rc.out);
    const chirp = (): void => {
      const now = ctx.currentTime;
      const pulses = 3 + Math.floor(rc.random() * 2);
      const level = span(rc.random(), 0.035, 0.07) * intensity;
      for (let index = 0; index < pulses; index += 1) {
        const at = now + index * 0.045;
        gate.gain.setValueAtTime(0, at);
        gate.gain.linearRampToValueAtTime(level, at + 0.006);
        gate.gain.linearRampToValueAtTime(0, at + 0.03);
      }
      osc.frequency.setValueAtTime(pitch * span(rc.random(), 0.985, 1.015), now);
      k.later(chirp, span(rc.random(), 450, 1400) / span(tempo, 0.6, 1.5));
    };
    k.later(chirp, rc.random() * 600);
  };
  cricket(span(tone, 3900, 4800), -0.45);
  cricket(span(tone, 4300, 5200), 0.5);
  return k;
};
