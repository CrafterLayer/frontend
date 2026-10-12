/*
  The `anim` Studio library's tween, timeline and spring engine (creative engines, 2026-10-12).

  One Animator per scene, advanced by the scene's own clock:

    const anim = s.lib.anim.create({ reducedMotion: s.reducedMotion });
    s.tick((time) => anim.update(time.dt));
    s.dispose(() => anim.dispose());

  - No timers, no requestAnimationFrame, no global ticker: nothing moves unless `update(dt)` runs,
    so the editor's still frame and reduced motion stay in the host's control.
  - Reduced motion lands every tween on its final value immediately and completes it.
  - Bounded: at most MAX_TWEENS live tweens and springs; durations are clamped to 0..60 s.
*/

import { readNumber, resolveProp } from './props';

import {
  MAX_TWEENS,
  Tween,
  readProps,
  type Runner,
  type TweenHandle,
  type TweenOptions,
} from './tween-core';
import { TimelineRunner, type Timeline } from './timeline';
import {
  ShakeRunner,
  SpringRunner,
  type ShakeOptions,
  type Spring,
  type SpringOptions,
} from './spring-shake';
export type { ShakeOptions, Spring, SpringOptions } from './spring-shake';

export type { Timeline } from './timeline';

export { MAX_TWEENS } from './tween-core';
export type { TweenHandle, TweenOptions } from './tween-core';

export interface AnimatorOptions {
  reducedMotion?: boolean;
  /** Global time scale (slow motion < 1 < fast forward), 0..4. */
  timeScale?: number;
}

/** A per-frame runner registered with `add` (a character rig, a sprite animator…). */
export interface CustomRunner {
  step(dt: number): boolean;
  cancel(): void;
  target?: unknown;
}

export interface Animator {
  readonly active: number;
  readonly reducedMotion: boolean;
  timeScale: number;
  update(dtSeconds: number): void;
  to(target: unknown, props: Record<string, number>, options?: TweenOptions): TweenHandle;
  from(target: unknown, props: Record<string, number>, options?: TweenOptions): TweenHandle;
  fromTo(
    target: unknown,
    from: Record<string, number>,
    to: Record<string, number>,
    options?: TweenOptions,
  ): TweenHandle;
  timeline(options?: { repeat?: number; onComplete?: () => void }): Timeline;
  delay(seconds: number, fn: () => void): TweenHandle;
  spring(target: unknown, key: string, options?: SpringOptions): Spring;
  shake(target: unknown, options?: ShakeOptions): TweenHandle;
  /** Stop every runner animating this target (`complete` lands them on their end values). */
  killOf(target: unknown, complete?: boolean): void;
  pause(): void;
  resume(): void;
  /** Register a custom per-frame runner, e.g. a character rig. Returns its remover. */
  add(runner: CustomRunner): () => void;
  dispose(): void;
}

export function createAnimator(options: AnimatorOptions = {}): Animator {
  const runners: Runner[] = [];
  const reducedMotion = options.reducedMotion === true;
  let paused = false;
  let disposed = false;
  let scale = Math.max(0, Math.min(4, options.timeScale ?? 1));

  function admit<T extends Runner>(runner: T): T {
    if (disposed) {
      runner.cancel();
      return runner;
    }
    if (runners.length >= MAX_TWEENS) {
      runner.cancel();
      throw new RangeError(`anim: at most ${String(MAX_TWEENS)} live animations`);
    }
    runners.push(runner);
    if (reducedMotion && !(runner instanceof SpringRunner)) {
      runners.pop();
      runner.finish();
    }
    return runner;
  }

  const animator: Animator = {
    get active() {
      return runners.length;
    },
    reducedMotion,
    get timeScale() {
      return scale;
    },
    set timeScale(value: number) {
      if (Number.isFinite(value)) scale = Math.max(0, Math.min(4, value));
    },
    update(dtSeconds) {
      if (disposed || paused) return;
      const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? Math.min(dtSeconds, 1) * scale : 0;
      for (let index = 0; index < runners.length;) {
        const runner = runners[index];
        if (runner === undefined) break;
        let alive = false;
        try {
          alive = runner.step(dt);
        } finally {
          if (!alive) runners.splice(index, 1);
        }
        if (alive) index += 1;
      }
    },
    to(target, props, tweenOptions = {}) {
      return admit(new Tween(target, readProps(props), tweenOptions, undefined));
    },
    from(target, props, tweenOptions = {}) {
      const entries = readProps(props);
      const ends: [string, number][] = [];
      for (const [key] of entries) {
        const ref = resolveProp(target, key);
        const now = ref === undefined ? undefined : readNumber(ref);
        if (now !== undefined) ends.push([key, now]);
      }
      return admit(new Tween(target, ends, tweenOptions, Object.fromEntries(entries)));
    },
    fromTo(target, from, to, tweenOptions = {}) {
      return admit(
        new Tween(target, readProps(to), tweenOptions, Object.fromEntries(readProps(from))),
      );
    },
    timeline(timelineOptions = {}) {
      const timeline = new TimelineRunner({ ...timelineOptions });
      // Entries are added after creation, so reduced motion is applied on the first update.
      if (disposed) {
        timeline.cancel();
        return timeline;
      }
      if (runners.length >= MAX_TWEENS) throw new RangeError('anim: live animation limit reached');
      runners.push(
        reducedMotion
          ? {
              target: undefined,
              step: () => {
                timeline.finish();
                return false;
              },
              finish: () => {
                timeline.finish();
              },
              cancel: () => {
                timeline.cancel();
              },
            }
          : timeline,
      );
      return timeline;
    },
    delay(seconds, fn) {
      if (typeof fn !== 'function') throw new TypeError('anim: delay needs a function');
      return admit(new Tween({}, [], { duration: 0, delay: seconds, onComplete: fn }, undefined));
    },
    spring(target, key, springOptions = {}) {
      const ref = resolveProp(target, key);
      if (ref === undefined || readNumber(ref) === undefined) {
        throw new TypeError(`anim: spring needs a numeric "${key}"`);
      }
      return admit(new SpringRunner(target, ref, springOptions, reducedMotion));
    },
    shake(target, shakeOptions = {}) {
      const xRef = resolveProp(target, 'x');
      const yRef = resolveProp(target, 'y');
      if (xRef === undefined || yRef === undefined)
        throw new TypeError('anim: shake needs x and y');
      for (const runner of runners) {
        if (runner instanceof ShakeRunner && runner.target === target) runner.finish();
      }
      return admit(new ShakeRunner(target, xRef, yRef, shakeOptions));
    },
    killOf(target, complete = false) {
      for (const runner of runners.slice()) {
        if (runner.target !== target) continue;
        if (complete) runner.finish();
        else runner.cancel();
        runners.splice(runners.indexOf(runner), 1);
      }
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    // Authored scene code is plain JavaScript, so the runner may be missing or malformed.
    add(runner: CustomRunner | null | undefined) {
      if (typeof runner?.step !== 'function' || typeof runner.cancel !== 'function') {
        throw new TypeError('anim: add needs { step(dt), cancel() }');
      }
      const wrapped: Runner = {
        target: runner.target,
        step: (dt) => runner.step(dt),
        finish: () => {
          runner.cancel();
        },
        cancel: () => {
          runner.cancel();
        },
      };
      admit(wrapped);
      return () => {
        const at = runners.indexOf(wrapped);
        if (at >= 0) runners.splice(at, 1);
        runner.cancel();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const runner of runners.splice(0)) runner.cancel();
    },
  };
  return animator;
}
