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

export class Tween implements Runner, TweenHandle {
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
