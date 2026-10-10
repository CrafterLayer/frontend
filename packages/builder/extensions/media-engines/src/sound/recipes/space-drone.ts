/*
  «همهمة فضائية» Space drone: a low cluster (sub, root, fifth, octave), slightly
  detuned and drifting, under a slowly breathing low-pass, with a faint high
  shimmer.
*/
import { recipeKit, span, type Recipe } from './kit';

export const spaceDrone: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone } = rc.tuning;
  const low = k.filter('lowpass', span(tone, 320, 900), 1.4);
  const body = k.gain(0.2 * intensity);
  k.chain(low, body, rc.out);
  const voices: [OscillatorType, number, number, number][] = [
    ['sine', 27.5, 0, 0.9],
    ['sine', 55, 0, 0.8],
    ['sawtooth', 82.41, 4, 0.18],
    ['triangle', 110, -6, 0.35],
  ];
  for (const [type, frequency, detune, level] of voices) {
    const osc = k.osc(type, frequency, detune);
    k.chain(osc, k.gain(level), low);
    k.lfo(0.013 + rc.random() * 0.02, 9, osc.detune);
  }
  k.lfo(0.031, span(tone, 160, 420), low.frequency);
  const shimmer = k.gain(0.012 * intensity);
  k.chain(k.osc('sine', 880, 3), shimmer, rc.out);
  k.lfo(0.17, 0.01 * intensity, shimmer.gain);
  return k;
};
