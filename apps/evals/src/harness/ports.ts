import type { AiValidationPorts } from './builder';

/**
 * Deterministic capabilities for an eval run.
 *
 * The kernel takes ids and timestamps from injected ports and from nowhere
 * else, which is the property that makes an eval comparable across runs at
 * all: the same corpus case must produce the same node ids today and next
 * month, or a diff between two model versions is drowned in nanoid noise.
 *
 * They are written here rather than borrowed from `@craftkit/builder/testing`
 * because that door also carries jsdom-flavoured fixtures this package has no
 * business loading, and because a four-line closure is cheaper than the
 * coupling.
 */
export function seededIdPort(prefix: string): { newId: () => string } {
  let issued = 0;
  return {
    newId() {
      issued += 1;
      return `${prefix}-${issued.toString().padStart(4, '0')}`;
    },
  };
}

/** A clock that advances one millisecond per read, so ordering stays observable. */
export function steppedClockPort(startMs = 1_700_000_000_000): { now: () => number } {
  let current = startMs;
  return {
    now() {
      current += 1;
      return current;
    },
  };
}

/**
 * The ports validation rehearses on. The kernel's own ports are NEVER reused
 * for preflight — a rehearsal that burned the live id sequence would hand the
 * real dispatch a different id than the one it validated.
 */
export function evalValidationPorts(): AiValidationPorts {
  return { clock: steppedClockPort(), ids: seededIdPort('preflight') };
}
