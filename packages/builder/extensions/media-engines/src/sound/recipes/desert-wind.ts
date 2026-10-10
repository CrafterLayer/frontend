/*
  «رياح الصحراء» Desert wind: a deep brown-noise roar with long gusts, a resonant
  whistle that slides like wind over dunes, and a fine sand hiss on top.
*/
import { recipeKit, span, type Recipe } from './kit';

export const desertWind: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone } = rc.tuning;
  const roarBand = k.filter('bandpass', span(tone, 200, 520), 1.2);
  const roar = k.gain(0.55 * intensity);
  k.chain(k.noise('brown'), roarBand, roar, rc.out);
  k.lfo(0.04, 160, roarBand.frequency);
  k.lfo(0.09, 0.25 * intensity, roar.gain);
  const whistleBand = k.filter('bandpass', span(tone, 1500, 2700), 14);
  const whistle = k.gain(0.06 * intensity);
  k.chain(k.noise('pink'), whistleBand, whistle, k.pan(-0.3), rc.out);
  k.lfo(0.13, 320, whistleBand.frequency);
  k.lfo(0.06, 0.045 * intensity, whistle.gain);
  const sand = k.gain(0.025 * intensity);
  k.chain(k.noise('white'), k.filter('highpass', 5200), sand, k.pan(0.35), rc.out);
  k.lfo(0.21, 0.02 * intensity, sand.gain);
  return k;
};
