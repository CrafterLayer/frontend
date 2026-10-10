/*
  Seeded randomness for the scene kit (pixi-studio §B.2). Every scene is deterministic from its
  seed, so a library thumbnail rendered from the seed matches what the page shows.

  The generator is mulberry32 (public-domain algorithm by Tommy Ettinger; this is our own
  implementation): 32-bit state, period 2^32, fast, and good enough for art.
*/

export interface SeededRandom {
  /** [0, 1) */
  random(): number;
  /** [a, b) */
  rand(a: number, b: number): number;
  /** An integer in [a, b] (both inclusive). */
  int(a: number, b: number): number;
  /** One element; `undefined` only for an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled COPY (Fisher–Yates); the input is not touched. */
  shuffle<T>(items: readonly T[]): T[];
}

/** Fold any seed (number or string) into an unsigned 32-bit integer; never 0 for a given input twice. */
export function seedToInt(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    // Mix the fractional part too, so 1.5 and 1 differ.
    const whole = Math.floor(seed);
    const fraction = Math.round((seed - whole) * 1e6);
    return (Math.imul(whole | 0, 0x9e3779b1) ^ fraction ^ 0x5bd1e995) >>> 0;
  }
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: returns a function giving [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandom(seed: number | string): SeededRandom {
  const next = mulberry32(seedToInt(seed));
  return {
    random: next,
    rand(a: number, b: number): number {
      return a + (b - a) * next();
    },
    int(a: number, b: number): number {
      const low = Math.ceil(Math.min(a, b));
      const high = Math.floor(Math.max(a, b));
      return low + Math.floor(next() * (high - low + 1));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice();
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1));
        const held = copy[index] as T;
        copy[index] = copy[other] as T;
        copy[other] = held;
      }
      return copy;
    },
  };
}
