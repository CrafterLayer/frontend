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

import { mixColor, resolveEase, type EaseFn } from './easing';
import { readNumber, resolveProp, writeNumber, type PropRef } from './props';

export const MAX_TWEENS = 512;
const MAX_DURATION = 60;
const MAX_REPEAT = 10_000;

export interface TweenOptions {
  duration?: number;
  delay?: number;
  ease?: string | EaseFn;
  /** Extra plays after the first; -1 repeats until killed. */
  repeat?: number;
  /** Play every other repeat backwards. */
  yoyo?: boolean;
  /** Keys interpolated as 0xRRGGBB colours (e.g. ['tint']). */
  colors?: readonly string[];
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  readonly done: boolean;
  readonly progress: number;
  readonly finished: Promise<void>;
  pause(): void;
  resume(): void;
  /** Stop now; `complete` jumps to the end values first. */
  kill(complete?: boolean): void;
}

interface Channel {
  readonly ref: PropRef;
  from: number;
  readonly to: number;
  readonly color: boolean;
}

interface Runner {
  readonly target: unknown;
  /** Returns false when the runner has finished and can be dropped. */
  step(dt: number): boolean;
  finish(): void;
  cancel(): void;
}

function clampDuration(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(MAX_DURATION, n));
}

function clampRepeat(value: unknown): number {
  if (value === -1) return Infinity;
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(MAX_REPEAT, n));
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function readProps(props: unknown): [string, number][] {
  if (typeof props !== 'object' || props === null) {
    throw new TypeError('anim: props must be an object of numbers');
  }
  const entries: [string, number][] = [];
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`anim: "${key}" must be a finite number`);
    }
    entries.push([key, value]);
  }
  return entries;
}

function bindChannels(
  target: unknown,
  props: [string, number][],
  colors: readonly string[] | undefined,
  fromValues?: Readonly<Record<string, number>>,
): Channel[] {
  const channels: Channel[] = [];
  for (const [key, to] of props) {
    const ref = resolveProp(target, key);
    if (ref === undefined) continue;
    const from = fromValues?.[key] ?? readNumber(ref);
    if (from === undefined) continue;
    channels.push({ ref, from, to, color: colors?.includes(key) === true });
  }
  return channels;
}

function apply(channels: readonly Channel[], k: number): void {
  for (const channel of channels) {
    const value = channel.color
      ? mixColor(channel.from, channel.to, k)
      : channel.from + (channel.to - channel.from) * k;
    writeNumber(channel.ref, value);
  }
}

class Tween implements Runner, TweenHandle {
  private channels: Channel[] | undefined;
  private elapsed = 0;
  private paused = false;
  private finishedFlag = false;
  private played = 0;
  private readonly ease: EaseFn;
  private readonly duration: number;
  private readonly delay: number;
  private readonly repeat: number;
  private readonly signal = deferred();
  progress = 0;

  constructor(
    readonly target: unknown,
    private readonly props: [string, number][],
    private readonly options: TweenOptions,
    private readonly fromValues: Readonly<Record<string, number>> | undefined,
  ) {
    this.ease = resolveEase(options.ease ?? 'outCubic');
    this.duration = clampDuration(options.duration, 0.5);
    this.delay = clampDuration(options.delay, 0);
    this.repeat = clampRepeat(options.repeat);
    // A `from` tween shows its start values at once, not after its delay.
    if (fromValues !== undefined) this.bind();
  }

  get done(): boolean {
    return this.finishedFlag;
  }

  get finished(): Promise<void> {
    return this.signal.promise;
  }

  private bind(): Channel[] {
    this.channels ??= bindChannels(this.target, this.props, this.options.colors, this.fromValues);
    if (this.fromValues !== undefined) apply(this.channels, 0);
    return this.channels;
  }

  step(dt: number): boolean {
    if (this.finishedFlag) return false;
    if (this.paused) return true;
    this.elapsed += dt;
    const local = this.elapsed - this.delay;
    if (local < 0) return true;
    const channels = this.bind();
    const span = this.duration === 0 ? 0 : local / this.duration;
    const cycle = Math.floor(span);
    if (cycle > this.played) {
      if (this.played + 1 > this.repeat) {
        this.finish();
        return false;
      }
      this.played = Math.min(cycle, this.repeat);
    }
    const reverse = this.options.yoyo === true && this.played % 2 === 1;
    const raw = this.duration === 0 ? 1 : Math.min(1, span - this.played);
    const k = this.ease(reverse ? 1 - raw : raw);
    this.progress = raw;
    apply(channels, k);
    this.options.onUpdate?.(raw);
    if (this.duration === 0 && this.repeat === 0) {
      this.finish();
      return false;
    }
    return true;
  }

  finish(): void {
    if (this.finishedFlag) return;
    const channels = this.bind();
    const reverse = this.options.yoyo === true && this.repeat % 2 === 1 && this.repeat !== Infinity;
    apply(channels, reverse ? 0 : 1);
    this.progress = 1;
    this.finishedFlag = true;
    this.signal.resolve();
    this.options.onComplete?.();
  }

  cancel(): void {
    if (this.finishedFlag) return;
    this.finishedFlag = true;
    this.signal.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  kill(complete = false): void {
    if (complete) this.finish();
    else this.cancel();
  }
}

interface TimelineEntry {
  readonly start: number;
  readonly end: number;
  readonly target?: unknown;
  readonly props?: [string, number][];
  readonly options?: TweenOptions;
  readonly call?: () => void;
  channels?: Channel[];
  fired?: boolean;
}

export interface Timeline extends TweenHandle {
  readonly duration: number;
  to(
    target: unknown,
    props: Record<string, number>,
    options?: TweenOptions,
    at?: number | string,
  ): Timeline;
  call(fn: () => void, at?: number | string): Timeline;
  wait(seconds: number): Timeline;
}

class TimelineRunner implements Runner, Timeline {
  private readonly entries: TimelineEntry[] = [];
  private cursor = 0;
  private lastStart = 0;
  private time = 0;
  private paused = false;
  private finishedFlag = false;
  private readonly signal = deferred();
  readonly target = undefined;
  progress = 0;

  constructor(private readonly options: { repeat?: number; onComplete?: () => void }) {}

  get duration(): number {
    return this.entries.reduce((max, entry) => Math.max(max, entry.end), this.cursor);
  }

  get done(): boolean {
    return this.finishedFlag;
  }

  get finished(): Promise<void> {
    return this.signal.promise;
  }

  private place(at: number | string | undefined, length: number): number {
    let start = this.cursor;
    if (typeof at === 'number' && Number.isFinite(at)) start = Math.max(0, at);
    else if (at === '<') start = this.lastStart;
    else if (typeof at === 'string' && /^[+-]=\d+(\.\d+)?$/u.test(at)) {
      start = Math.max(0, this.cursor + Number(at.replace('=', '')));
    }
    this.lastStart = start;
    this.cursor = Math.max(this.cursor, start + length);
    if (this.entries.length >= MAX_TWEENS)
      throw new RangeError('anim: timeline entry limit reached');
    return start;
  }

  to(
    target: unknown,
    props: Record<string, number>,
    options: TweenOptions = {},
    at?: number | string,
  ): Timeline {
    const duration = clampDuration(options.duration, 0.5);
    const start = this.place(at, duration + clampDuration(options.delay, 0));
    this.entries.push({
      start: start + clampDuration(options.delay, 0),
      end: start + clampDuration(options.delay, 0) + duration,
      target,
      props: readProps(props),
      options,
    });
    return this;
  }

  call(fn: () => void, at?: number | string): Timeline {
    if (typeof fn !== 'function') throw new TypeError('anim: timeline.call needs a function');
    const start = this.place(at, 0);
    this.entries.push({ start, end: start, call: fn });
    return this;
  }

  wait(seconds: number): Timeline {
    this.cursor += clampDuration(seconds, 0);
    return this;
  }

  private render(time: number): void {
    for (const entry of this.entries) {
      if (time < entry.start) continue;
      if (entry.call !== undefined) {
        if (entry.fired !== true) {
          entry.fired = true;
          entry.call();
        }
        continue;
      }
      entry.channels ??= bindChannels(entry.target, entry.props ?? [], entry.options?.colors);
      const length = entry.end - entry.start;
      const raw = length === 0 ? 1 : Math.min(1, (time - entry.start) / length);
      apply(entry.channels, resolveEase(entry.options?.ease ?? 'outCubic')(raw));
    }
  }

  step(dt: number): boolean {
    if (this.finishedFlag) return false;
    if (this.paused) return true;
    this.time += dt;
    const total = this.duration;
    if (this.time >= total) {
      const repeat = clampRepeat(this.options.repeat);
      if (repeat > 0) {
        this.render(total);
        this.options.repeat = repeat === Infinity ? -1 : repeat - 1;
        this.time = total === 0 ? 0 : this.time % total;
        for (const entry of this.entries) {
          entry.fired = false;
          if (entry.channels !== undefined) apply(entry.channels, 0);
        }
        return true;
      }
      this.finish();
      return false;
    }
    this.progress = total === 0 ? 1 : this.time / total;
    this.render(this.time);
    return true;
  }

  finish(): void {
    if (this.finishedFlag) return;
    this.render(Infinity);
    this.progress = 1;
    this.finishedFlag = true;
    this.signal.resolve();
    this.options.onComplete?.();
  }

  cancel(): void {
    if (this.finishedFlag) return;
    this.finishedFlag = true;
    this.signal.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  kill(complete = false): void {
    if (complete) this.finish();
    else this.cancel();
  }
}

export interface SpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export interface Spring {
  readonly value: number;
  readonly settled: boolean;
  /** Set a new resting value; the property springs toward it. */
  to(value: number): void;
  /** Jump to a value with no motion. */
  set(value: number): void;
  stop(): void;
}

class SpringRunner implements Runner, Spring {
  private velocity = 0;
  private goal: number;
  private stopped = false;
  private readonly stiffness: number;
  private readonly damping: number;
  private readonly mass: number;

  constructor(
    readonly target: unknown,
    private readonly ref: PropRef,
    options: SpringOptions,
    private readonly instant: boolean,
  ) {
    this.goal = readNumber(ref) ?? 0;
    this.stiffness = Math.max(1, Math.min(2000, options.stiffness ?? 170));
    this.damping = Math.max(0, Math.min(200, options.damping ?? 26));
    this.mass = Math.max(0.1, Math.min(50, options.mass ?? 1));
  }

  get value(): number {
    return readNumber(this.ref) ?? this.goal;
  }

  get settled(): boolean {
    return Math.abs(this.goal - this.value) < 0.001 && Math.abs(this.velocity) < 0.001;
  }

  to(value: number): void {
    if (!Number.isFinite(value)) return;
    this.goal = value;
    if (this.instant) this.set(value);
  }

  set(value: number): void {
    if (!Number.isFinite(value)) return;
    this.goal = value;
    this.velocity = 0;
    writeNumber(this.ref, value);
  }

  step(dt: number): boolean {
    if (this.stopped) return false;
    if (this.settled) return true;
    // Semi-implicit Euler in fixed sub-steps keeps stiff springs stable at low frame rates.
    let remaining = Math.min(dt, 0.1);
    let x = this.value;
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 120);
      const force = -this.stiffness * (x - this.goal) - this.damping * this.velocity;
      this.velocity += (force / this.mass) * h;
      x += this.velocity * h;
      remaining -= h;
    }
    writeNumber(this.ref, x);
    return true;
  }

  finish(): void {
    this.set(this.goal);
  }

  cancel(): void {
    this.stopped = true;
  }

  stop(): void {
    this.stopped = true;
  }
}

export interface ShakeOptions {
  intensity?: number;
  duration?: number;
  frequency?: number;
}

class ShakeRunner implements Runner, TweenHandle {
  private elapsed = 0;
  private finishedFlag = false;
  private readonly baseX: number;
  private readonly baseY: number;
  private readonly signal = deferred();
  private readonly duration: number;
  private readonly intensity: number;
  private readonly frequency: number;
  progress = 0;

  constructor(
    readonly target: unknown,
    private readonly xRef: PropRef,
    private readonly yRef: PropRef,
    options: ShakeOptions,
  ) {
    this.baseX = readNumber(xRef) ?? 0;
    this.baseY = readNumber(yRef) ?? 0;
    this.duration = clampDuration(options.duration, 0.35);
    this.intensity = Math.max(0, Math.min(200, options.intensity ?? 8));
    this.frequency = Math.max(1, Math.min(120, options.frequency ?? 32));
  }

  get done(): boolean {
    return this.finishedFlag;
  }

  get finished(): Promise<void> {
    return this.signal.promise;
  }

  step(dt: number): boolean {
    if (this.finishedFlag) return false;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.finish();
      return false;
    }
    this.progress = this.elapsed / this.duration;
    const fade = 1 - this.progress;
    const phase = this.elapsed * this.frequency;
    writeNumber(this.xRef, this.baseX + Math.sin(phase * 2.1) * this.intensity * fade);
    writeNumber(this.yRef, this.baseY + Math.cos(phase * 1.7) * this.intensity * fade);
    return true;
  }

  finish(): void {
    if (this.finishedFlag) return;
    writeNumber(this.xRef, this.baseX);
    writeNumber(this.yRef, this.baseY);
    this.progress = 1;
    this.finishedFlag = true;
    this.signal.resolve();
  }

  cancel(): void {
    this.finish();
  }

  pause(): void {
    /* a shake is short; pausing it would leave the target displaced */
  }

  resume(): void {
    /* see pause */
  }

  kill(): void {
    this.finish();
  }
}

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
