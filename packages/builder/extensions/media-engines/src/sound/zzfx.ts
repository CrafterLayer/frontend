/*
  ZzFX - Zuper Zmall Zound Zynth v1.4.0 by Frank Force
  https://github.com/KilledByAPixel/ZzFX

  ZzFX MIT License

  Copyright (c) 2019 - Frank Force

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

  CraftKit adaptation (2026-10-10, pixi-studio DESIGN §C.1; provenance in
  vendor/zzfx/PROVENANCE.md): `ZZFX.buildSamples` only, as a pure function of
  `(sampleRate, params, random)`, typed. The arithmetic is upstream's, line for
  line. Dropped: the module-scope `new AudioContext` and `play`/`playSamples`,
  because the CraftKit engine owns the one context (created lazily, resumed only
  inside a user gesture) and routes every voice through its buses and mute.
*/

import { zzfxParam, type ZzfxParams } from '@craftkit/builder-schema';

/** Build the mono sample buffer for one ZzFX sound (upstream `buildSamples`). */
export function buildZzfxSamples(
  sampleRate: number,
  params: ZzfxParams,
  random: () => number = Math.random,
): Float32Array {
  const p = (index: number): number => zzfxParam(params, index);
  const volume = p(0);
  const randomness = p(1);
  let frequency = p(2);
  let attack = p(3);
  let sustain = p(4);
  let release = p(5);
  const shape = p(6);
  const shapeCurve = p(7);
  let slide = p(8);
  let deltaSlide = p(9);
  let pitchJump = p(10);
  let pitchJumpTime = p(11);
  let repeatTime = p(12);
  const noise = p(13);
  let modulation = p(14);
  const bitCrush = p(15);
  let delay = p(16);
  const sustainVolume = p(17);
  let decay = p(18);
  const tremolo = p(19);
  const filter = p(20);

  const PI2 = Math.PI * 2;
  const abs = Math.abs;
  const sign = (v: number): number => (v < 0 ? -1 : 1);
  const startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate);
  let startFrequency = (frequency *=
    ((1 + randomness * 2 * random() - randomness) * PI2) / sampleRate);
  let modOffset = 0;
  let repeat = 0;
  let crush = 0;
  let jump = 1;
  let t = 0;
  let i = 0;
  let s = 0;
  let f: number;

  // biquad LP/HP filter
  const quality = 2;
  const w = (PI2 * abs(filter) * 2) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / quality;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0;
  let x1 = 0;
  let y2 = 0;
  let y1 = 0;

  // scale by sample rate
  const minAttack = 9; // prevent pop if attack is 0
  attack = attack * sampleRate || minAttack;
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;

  const length = (attack + decay + sustain + release + delay) | 0;
  const b = new Float32Array(length > 0 ? length : 0);

  for (; i < length; b[i++] = s * volume) {
    if (!(++crush % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? shape > 4
                ? (t / PI2) % 1 < shapeCurve / 2
                  ? 1
                  : -1 // 5 square duty
                : Math.sin(t ** 3) // 4 noise
              : Math.max(Math.min(Math.tan(t), 1), -1) // 3 tan
            : 1 - (((((2 * t) / PI2) % 2) + 2) % 2) // 2 saw
          : 1 - 4 * abs(Math.round(t / PI2) - t / PI2) // 1 triangle
        : Math.sin(t); // 0 sin

      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve) *
        (i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0);

      s = delay
        ? s / 2 +
          (delay > i
            ? 0
            : ((i < length - delay ? 1 : (length - i) / delay) * (b[(i - delay) | 0] ?? 0)) /
              2 /
              volume)
        : s;

      if (filter) {
        const y = b2 * x2 + b1 * x1 + b0 * s - a2 * y2 - a1 * y1;
        x2 = x1;
        x1 = s;
        y2 = y1;
        y1 = y;
        s = y;
      }
    }

    f = (frequency += slide += deltaSlide) * Math.cos(modulation * modOffset++);
    t += f + f * noise * (((i * i * PI2) % 2) - 1);

    if (jump && ++jump > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      jump = 0;
    }

    if (repeatTime && !(++repeat % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      jump ||= 1;
    }
  }

  return b;
}
