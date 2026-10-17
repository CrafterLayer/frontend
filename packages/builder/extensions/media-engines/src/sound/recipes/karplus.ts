/*
  A plucked string by Karplus–Strong (1983): a burst of noise circulating
  through a delay line one period long, averaged each pass, so the bright attack
  decays into a warm tone — close to an oud's plucked course with a soft risha.
  Rendered once per pitch into a buffer, then played like a sample.
*/

const PLUCKS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** `brightness` 0..1: how much of the high end survives each pass. */
export function pluckBuffer(
  ctx: BaseAudioContext,
  frequency: number,
  brightness: number,
  random: () => number,
): AudioBuffer {
  let byKey = PLUCKS.get(ctx);
  if (byKey === undefined) {
    byKey = new Map();
    PLUCKS.set(ctx, byKey);
  }
  const key = `${frequency.toFixed(2)}:${brightness.toFixed(2)}`;
  const cached = byKey.get(key);
  if (cached !== undefined) return cached;

  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 2.4);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / frequency));
  const ring = new Float32Array(period);
  // A softened excitation (two-tap average of noise): a leather risha, not a pick.
  let previous = 0;
  for (let index = 0; index < period; index += 1) {
    const white = random() * 2 - 1;
    ring[index] = (white + previous) * 0.5;
    previous = white;
  }
  const decay = 0.994 + 0.004 * brightness;
  const blend = 0.5 + 0.35 * brightness;
  let cursor = 0;
  for (let index = 0; index < length; index += 1) {
    const current = ring[cursor] ?? 0;
    const following = ring[(cursor + 1) % period] ?? 0;
    data[index] = current;
    ring[cursor] = (blend * current + (1 - blend) * following) * decay;
    cursor = (cursor + 1) % period;
  }
  // A short fade at the tail so the buffer never ends on a click.
  const tail = Math.floor(rate * 0.05);
  for (let index = 0; index < tail; index += 1) {
    const at = length - tail + index;
    data[at] = (data[at] ?? 0) * (1 - index / tail);
  }
  byKey.set(key, buffer);
  return buffer;
}
