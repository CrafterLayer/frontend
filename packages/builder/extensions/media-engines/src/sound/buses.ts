/*
  The mixing graph (pixi-studio DESIGN §C.1):

    voice → bus gain (ui | sfx | ambient | music) → master gain → compressor → destination
                                                                         └→ analyser (tap)

  The compressor keeps sixteen stacked voices from clipping; the analyser taps
  the mix for `s.audio`. Master gain is the mute: 0 when muted.
*/

import type { SoundBus } from './types';

export interface SoundGraph {
  buses: Record<SoundBus, GainNode>;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

/** Per-bus levels: UI sits under effects; ambient beds under both. */
export const BUS_LEVELS: Readonly<Record<SoundBus, number>> = {
  ui: 0.55,
  sfx: 0.8,
  ambient: 0.5,
  music: 0.6,
};

export function createSoundGraph(ctx: BaseAudioContext): SoundGraph {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;
  compressor.connect(ctx.destination);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  compressor.connect(analyser);

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(compressor);

  const bus = (name: SoundBus): GainNode => {
    const gain = ctx.createGain();
    gain.gain.value = BUS_LEVELS[name];
    gain.connect(master);
    return gain;
  };
  return {
    buses: { ui: bus('ui'), sfx: bus('sfx'), ambient: bus('ambient'), music: bus('music') },
    master,
    compressor,
    analyser,
  };
}

/** Glide an AudioParam to `value` over `seconds` (click-free). */
export function glide(param: AudioParam, value: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.005, seconds));
}
