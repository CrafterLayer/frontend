/*
  «أمواج البحر» Ocean waves: one slow swell LFO opens a low-pass on brown noise
  and lifts its gain together, so each wave rises, breaks into foam and drains.
*/
import { recipeKit, span, type Recipe } from './kit';

export const oceanWaves: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone, tempo } = rc.tuning;
  const rate = span(tempo, 0.06, 0.14);
  const swell = k.osc('sine', rate);

  const low = k.filter('lowpass', span(tone, 650, 1100), 0.6);
  const body = k.gain(0.36 * intensity);
  k.chain(k.noise('brown'), low, body, rc.out);
  const cutoffDepth = k.gain(span(tone, 380, 620));
  swell.connect(cutoffDepth);
  cutoffDepth.connect(low.frequency);
  const bodyDepth = k.gain(0.24 * intensity);
  swell.connect(bodyDepth);
  bodyDepth.connect(body.gain);

  const foam = k.gain(0.05 * intensity);
  k.chain(k.noise('pink'), k.filter('highpass', span(tone, 1300, 2200)), foam, rc.out);
  const foamDepth = k.gain(0.05 * intensity);
  swell.connect(foamDepth);
  foamDepth.connect(foam.gain);
  return k;
};
