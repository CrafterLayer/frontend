/*
  The building blocks every ambient recipe is made of (pixi-studio DESIGN §C.1):
  looping noise in three colours, oscillators, filters, gains, slow LFOs and
  engine-owned timers. A recipe only wires them; `stop()` releases everything
  it made, so a bed leaves no node, timer or source behind.
*/

import type { SoundRecipeId } from '@craftkit/builder-schema';

/** Resolved tuning, each 0..1 (`maqam`: < 0.5 hijaz, otherwise rast). */
export interface RecipeTuning {
  intensity: number;
  tone: number;
  tempo: number;
  maqam: number;
}

export interface RecipeContext {
  ctx: BaseAudioContext;
  /** The bed's own gain; the engine fades it in and out. */
  out: AudioNode;
  tuning: RecipeTuning;
  random: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
}

export interface RecipeVoice {
  stop(): void;
}

export type Recipe = (rc: RecipeContext) => RecipeVoice;
export type RecipeTable = Readonly<Record<SoundRecipeId, Recipe>>;

export type NoiseColour = 'white' | 'pink' | 'brown';

const NOISE_CACHE = new WeakMap<BaseAudioContext, Map<NoiseColour, AudioBuffer>>();

/** A 4-second looping noise buffer, made once per context and colour. */
export function noiseBuffer(
  ctx: BaseAudioContext,
  colour: NoiseColour,
  random: () => number,
): AudioBuffer {
  let byColour = NOISE_CACHE.get(ctx);
  if (byColour === undefined) {
    byColour = new Map();
    NOISE_CACHE.set(ctx, byColour);
  }
  const cached = byColour.get(colour);
  if (cached !== undefined) return cached;
  const length = Math.floor(ctx.sampleRate * 4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Paul Kellet's economy pink filter; brown is integrated white.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = random() * 2 - 1;
    if (colour === 'white') {
      data[i] = white * 0.5;
    } else if (colour === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
  }
  byColour.set(colour, buffer);
  return buffer;
}

export interface RecipeKit {
  ctx: BaseAudioContext;
  noise(colour: NoiseColour): AudioBufferSourceNode;
  osc(type: OscillatorType, frequency: number, detune?: number): OscillatorNode;
  filter(type: BiquadFilterType, frequency: number, q?: number): BiquadFilterNode;
  gain(value: number): GainNode;
  pan(value: number): AudioNode;
  /** A slow LFO: `param` moves ±`depth` around its value at `rate` Hz. */
  lfo(rate: number, depth: number, param: AudioParam, type?: OscillatorType): OscillatorNode;
  /** Connect in order; returns the last node. */
  chain(...nodes: AudioNode[]): AudioNode;
  /** Run `fn` after `ms`, unless the bed stopped first. */
  later(fn: () => void, ms: number): void;
  /** A source made outside the kit (a pluck, a droplet) that stop() must also end. */
  track(source: AudioScheduledSourceNode): void;
  stop(): void;
}

export function recipeKit(rc: RecipeContext): RecipeKit {
  const { ctx } = rc;
  const sources = new Set<AudioScheduledSourceNode>();
  const nodes: AudioNode[] = [];
  const timers = new Set<number>();
  let stopped = false;

  const keep = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const start = <T extends AudioScheduledSourceNode>(source: T): T => {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
    };
    source.start();
    return keep(source);
  };

  const kit: RecipeKit = {
    ctx,
    noise(colour) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, colour, rc.random);
      source.loop = true;
      return start(source);
    },
    osc(type, frequency, detune = 0) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      return start(osc);
    },
    filter(type, frequency, q = 0.7) {
      const filter = keep(ctx.createBiquadFilter());
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      return filter;
    },
    gain(value) {
      const gain = keep(ctx.createGain());
      gain.gain.value = value;
      return gain;
    },
    pan(value) {
      if (typeof ctx.createStereoPanner !== 'function') return kit.gain(1);
      const panner = keep(ctx.createStereoPanner());
      panner.pan.value = value;
      return panner;
    },
    lfo(rate, depth, param, type = 'sine') {
      const osc = kit.osc(type, rate);
      const amount = kit.gain(depth);
      osc.connect(amount);
      amount.connect(param);
      return osc;
    },
    chain(...list) {
      return list.reduce((previous, node, index) => {
        if (index > 0) previous.connect(node);
        return node;
      });
    },
    later(fn, ms) {
      if (stopped) return;
      const id = rc.setTimer(() => {
        timers.delete(id);
        if (!stopped) fn();
      }, ms);
      timers.add(id);
    },
    track(source) {
      sources.add(source);
      const previous = source.onended;
      source.onended = function ended(this: AudioScheduledSourceNode, event: Event) {
        sources.delete(source);
        if (previous !== null) previous.call(this, event);
      };
    },
    stop() {
      stopped = true;
      for (const id of timers) rc.clearTimer(id);
      timers.clear();
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
      }
      sources.clear();
      for (const node of nodes) node.disconnect();
      nodes.length = 0;
    },
  };
  return kit;
}

/** `value` scaled from 0..1 into `low..high`. */
export function span(value: number, low: number, high: number): number {
  return low + (high - low) * value;
}
