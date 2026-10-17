/*
  A small finite-state machine for `s.lib.gameai` (game libraries, 2026-10-12): an enemy that
  patrols, chases when it sees the player and returns when it loses them.

    const brain = ai.fsm({
      patrol: { enter: () => guard.patrol(route), update: () => { if (guard.near(hero, 160)) brain.go('chase'); } },
      chase:  { enter: () => guard.chase(hero), update: () => { if (!guard.near(hero, 240)) brain.go('patrol'); } },
    }, 'patrol');

  ai.update(dt) steps every machine it made. A transition requested inside enter/exit runs after
  the current one finishes (never re-entrantly); unknown targets are ignored and reported false.
*/

import { AI_LIMITS } from './grid';

export interface FsmState {
  enter?(previous: string | null): void;
  update?(dt: number, elapsed: number): void;
  exit?(next: string): void;
}

export interface Fsm {
  readonly state: string;
  /** Seconds spent in the current state. */
  readonly elapsed: number;
  go(name: string): boolean;
  is(name: string): boolean;
  update(dt: number): void;
  dispose(): void;
}

const NAME = /^[A-Za-z][\w-]{0,31}$/u;

export function createFsm(
  // Authored scene code is plain JavaScript: the states may be anything.
  input: Readonly<Record<string, FsmState>> | null | undefined,
  initial: string,
): Fsm {
  if (typeof input !== 'object' || input === null) throw new TypeError('gameai.fsm needs states');
  const names = Object.keys(input);
  if (names.length < 1 || names.length > AI_LIMITS.states)
    throw new RangeError(`gameai.fsm: 1..${String(AI_LIMITS.states)} states`);
  const states = new Map<string, FsmState>();
  for (const name of names) {
    if (!NAME.test(name)) throw new TypeError(`gameai.fsm: bad state name "${name}"`);
    const state: unknown = input[name];
    states.set(name, typeof state === 'object' && state !== null ? state : {});
  }
  if (!states.has(initial)) throw new RangeError(`gameai.fsm: unknown initial state "${initial}"`);

  let current = initial;
  let elapsed = 0;
  let switching = false;
  let queued: string | null = null;
  let disposed = false;

  /* Exit, switch, enter; a transition asked for meanwhile follows, at most 16 in a row. */
  function transition(target: string, initialEntry: boolean): void {
    let next: string | null = target;
    let first = initialEntry;
    for (let hops = 0; next !== null && (first || next !== current) && hops < 16; hops += 1) {
      const previous = first ? null : current;
      first = false;
      queued = null;
      switching = true;
      try {
        if (previous !== null) states.get(previous)?.exit?.(next);
        current = next;
        elapsed = 0;
        states.get(next)?.enter?.(previous);
      } finally {
        switching = false;
      }
      next = queued;
    }
    queued = null;
  }

  transition(initial, true);

  return {
    get state() {
      return current;
    },
    get elapsed() {
      return elapsed;
    },
    go(name) {
      if (disposed || !states.has(name)) return false;
      if (switching) {
        queued = name;
        return true;
      }
      if (name !== current) transition(name, false);
      return true;
    },
    is: (name) => current === name,
    update(dt) {
      if (disposed || !(dt > 0)) return;
      elapsed += dt;
      states.get(current)?.update?.(dt, elapsed);
    },
    dispose() {
      disposed = true;
    },
  };
}
