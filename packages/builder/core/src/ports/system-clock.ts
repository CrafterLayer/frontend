import type { ClockPort } from '@craftkit/builder-schema';

/** The ONLY file in the kernel allowed to read the system clock (Law D). */
export const systemClock: ClockPort = {
  now: () => Date.now(),
};
