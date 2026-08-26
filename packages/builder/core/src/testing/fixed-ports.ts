import type { ClockPort, IdPort } from '@craftkit/builder-schema';

/** Deterministic clock: `start`, then +`step` per read. Bit-for-bit replayable. */
export function fixedClock(start = 0, step = 1): ClockPort {
  let last = start - step;
  return {
    now() {
      last += step;
      return last;
    },
  };
}

/** Deterministic ids: `${seed}-0001`, `${seed}-0002`, … Same seed ⇒ same sequence. */
export function seededIds(seed: string): IdPort {
  let counter = 0;
  return {
    newId() {
      counter += 1;
      return `${seed}-${counter.toString(36).padStart(4, '0')}`;
    },
  };
}
