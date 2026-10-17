/*
  The anim library's tween core (split from tween.ts, 2026-10-12): limits, the runner
  contract, property channels and the Tween class every timeline and animator builds on.
*/

import { mixColor, resolveEase, type EaseFn } from './easing';
import { readNumber, resolveProp, writeNumber, type PropRef } from './props';

export const MAX_TWEENS = 512;
export const MAX_DURATION = 60;
export const MAX_REPEAT = 10_000;

export interface TweenOptions {
  duration?: number;
  delay?: number;
  ease?: string | EaseFn;
  /** Extra plays after the first; -1 repeats until killed. */
  repeat?: number;
  /** Play every other repeat backwards. */
  yoyo?: boolean;
  /** Timeline entries on an array of targets: seconds between each one's start. */
  stagger?: number;
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

export interface Channel {
  readonly ref: PropRef;
  from: number;
  readonly to: number;
  readonly color: boolean;
}

export interface Runner {
  readonly target: unknown;
  /** Returns false when the runner has finished and can be dropped. */
  step(dt: number): boolean;
  finish(): void;
  cancel(): void;
}

export function clampDuration(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(MAX_DURATION, n));
}

export function clampRepeat(value: unknown): number {
  if (value === -1) return Infinity;
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(MAX_REPEAT, n));
}

export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function readProps(props: unknown): [string, number][] {
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

/** The current value of each key the target has (a `from` tween's end values). */
export function currentValues(target: unknown, props: [string, number][]): [string, number][] {
  const values: [string, number][] = [];
  for (const [key] of props) {
    const ref = resolveProp(target, key);
    const now = ref === undefined ? undefined : readNumber(ref);
    if (now !== undefined) values.push([key, now]);
  }
  return values;
}

export function bindChannels(
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

export function apply(channels: readonly Channel[], k: number): void {
  for (const channel of channels) {
    const value = channel.color
      ? mixColor(channel.from, channel.to, k)
      : channel.from + (channel.to - channel.from) * k;
    writeNumber(channel.ref, value);
  }
}

/**
 * What a tween, a timeline and a shake share: done, finished, pause / resume, cancel, kill.
 * Runner fields are `declare`d and assigned in constructors: a class-field initializer costs the
 * lazy bundle a defineProperty call each, and its gzip budget is tight.
 */
export abstract class Playback {
  declare protected paused: boolean;
  declare protected finishedFlag: boolean;
  declare protected readonly signal: ReturnType<typeof deferred>;

  constructor() {
    this.paused = this.finishedFlag = false;
    this.signal = deferred();
  }

  get done(): boolean {
    return this.finishedFlag;
  }

  get finished(): Promise<void> {
    return this.signal.promise;
  }

  abstract finish(): void;

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

export class Tween extends Playback implements Runner, TweenHandle {
  declare private channels: Channel[] | undefined;
  declare private elapsed: number;
  declare private played: number;
  declare private readonly ease: EaseFn;
  declare private readonly duration: number;
  declare private readonly delay: number;
  declare private readonly repeat: number;
  declare readonly target: unknown;
  declare private readonly props: [string, number][];
  declare private readonly options: TweenOptions;
  declare private readonly fromValues: Readonly<Record<string, number>> | undefined;
  declare progress: number;

  constructor(
    target: unknown,
    props: [string, number][],
    options: TweenOptions,
    fromValues: Readonly<Record<string, number>> | undefined,
  ) {
    super();
    this.target = target;
    this.props = props;
    this.options = options;
    this.fromValues = fromValues;
    this.elapsed = this.played = this.progress = 0;
    this.ease = resolveEase(options.ease ?? 'outCubic');
    this.duration = clampDuration(options.duration, 0.5);
    this.delay = clampDuration(options.delay, 0);
    this.repeat = clampRepeat(options.repeat);
    // A `from` tween shows its start values at once, not after its delay.
    if (fromValues !== undefined) this.bind();
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
}
