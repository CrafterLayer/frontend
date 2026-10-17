/*
  Audio bands for audio-reactive visuals (pixi-studio DESIGN §C.1, `s.audio`).

  FFT 256 → 128 bins. Bass is under 250 Hz, mid 250–2000 Hz, treble above. A
  beat is an energy-flux spike: bass above 1.3× its running average (and above
  a floor), at most one per 180 ms. Pure over the spectrum, so a test feeds it
  numbers instead of sound.
*/

import type { SoundBands } from './types';

export const SILENT_BANDS: Readonly<SoundBands> = Object.freeze({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: false,
  active: false,
});

export interface BeatState {
  average: number;
  lastBeat: number;
}

export function createBeatState(): BeatState {
  return { average: 0, lastBeat: -Infinity };
}

/** Bands from byte frequency data (`getByteFrequencyData`), at time `now` (ms). */
export function bandsFromSpectrum(
  bins: Uint8Array,
  sampleRate: number,
  state: BeatState,
  now: number,
): SoundBands {
  const binHz = sampleRate / (bins.length * 2);
  let bass = 0;
  let bassCount = 0;
  let mid = 0;
  let midCount = 0;
  let treble = 0;
  let trebleCount = 0;
  let total = 0;
  for (let index = 0; index < bins.length; index += 1) {
    const value = (bins[index] ?? 0) / 255;
    const hz = (index + 0.5) * binHz;
    total += value;
    if (hz < 250) {
      bass += value;
      bassCount += 1;
    } else if (hz < 2000) {
      mid += value;
      midCount += 1;
    } else {
      treble += value;
      trebleCount += 1;
    }
  }
  const avg = (sum: number, count: number): number => (count === 0 ? 0 : sum / count);
  const bands = {
    level: avg(total, bins.length),
    bass: avg(bass, bassCount),
    mid: avg(mid, midCount),
    treble: avg(treble, trebleCount),
    beat: false,
    active: true,
  };
  if (bands.bass > 0.12 && bands.bass > state.average * 1.3 && now - state.lastBeat > 180) {
    bands.beat = true;
    state.lastBeat = now;
  }
  state.average = state.average * 0.9 + bands.bass * 0.1;
  return bands;
}
