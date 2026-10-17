/* «رياح» Wind: pink noise through a wandering band-pass, slow gusts, a thin high whistle. */
import { recipeKit, span, type Recipe } from './kit';

export const wind: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone } = rc.tuning;
  const band = k.filter('bandpass', span(tone, 320, 900), 0.9);
  const body = k.gain(0.5 * intensity);
  k.chain(k.noise('pink'), band, body, rc.out);
  k.lfo(0.07, span(tone, 140, 360), band.frequency);
  k.lfo(0.11, 0.22 * intensity, body.gain);
  const whistle = k.gain(0.05 * intensity);
  k.chain(k.noise('white'), k.filter('bandpass', span(tone, 1800, 3200), 6), whistle, rc.out);
  k.lfo(0.05, 0.04 * intensity, whistle.gain);
  return k;
};
