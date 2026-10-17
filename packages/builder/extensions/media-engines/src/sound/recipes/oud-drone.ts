/*
  «عود ومقام» Oud and maqam: a low drone on the tonic and fifth, and plucked
  notes walking the maqam (hijaz, or rast with its quarter tones) — now and then
  a quick tremolo of three plucks, the way an oud player repeats a note with the
  risha. Karplus–Strong strings (karplus.ts), not samples.
*/
import { SOUND_MAQAMS } from '@craftkit/builder-schema';

import { pluckBuffer } from './karplus';
import { recipeKit, span, type Recipe } from './kit';

/** The tonic, D3. */
const TONIC = 146.83;

export const oudDrone: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone, tempo, maqam } = rc.tuning;
  const { ctx } = rc;
  const scale = maqam < 0.5 ? SOUND_MAQAMS.hijaz : SOUND_MAQAMS.rast;

  const drone = k.filter('lowpass', 320, 0.8);
  k.chain(drone, k.gain(0.12 * intensity), rc.out);
  k.chain(k.osc('sine', TONIC / 2), k.gain(0.8), drone);
  k.chain(k.osc('triangle', (TONIC / 2) * 1.5, 3), k.gain(0.35), drone);

  // The oud's bowl: a warm resonance near 220 Hz, then the high end rolled off.
  const body = k.filter('peaking', 220, 1.2);
  body.gain.value = 4;
  k.chain(body, k.filter('lowpass', span(tone, 2200, 5200), 0.5), rc.out);

  let step = 0;
  const pluck = (semitones: number, at: number, level: number): void => {
    const source = ctx.createBufferSource();
    source.buffer = pluckBuffer(ctx, TONIC * 2 ** (semitones / 12), tone, rc.random);
    const gain = ctx.createGain();
    gain.gain.value = level * intensity;
    source.connect(gain);
    gain.connect(body);
    source.onended = () => {
      gain.disconnect();
    };
    k.track(source);
    source.start(at);
  };
  const phrase = (): void => {
    const move = rc.random();
    step = Math.max(0, Math.min(scale.length - 1, step + (move < 0.45 ? -1 : move < 0.9 ? 1 : 0)));
    const semitones = (scale[step] ?? 0) + (rc.random() < 0.12 ? 12 : 0);
    const now = ctx.currentTime;
    const level = span(rc.random(), 0.28, 0.42);
    if (rc.random() < 0.15) {
      for (let index = 0; index < 3; index += 1) pluck(semitones, now + index * 0.085, level * (1 - index * 0.2));
    } else {
      pluck(semitones, now, level);
    }
    // Phrases rest on the tonic now and then.
    if (rc.random() < 0.1) step = 0;
    k.later(phrase, span(rc.random(), 380, 1150) / span(tempo, 0.6, 1.5));
  };
  k.later(phrase, 200);
  return k;
};
