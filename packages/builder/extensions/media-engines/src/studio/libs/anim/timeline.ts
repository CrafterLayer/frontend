/*
  The anim library's timeline (split from tween.ts, 2026-10-12): tweens sequenced and
  overlapped on one clock, with labels, repeat and yoyo.
*/

import { resolveEase } from './easing';
import {
  MAX_TWEENS,
  apply,
  bindChannels,
  clampDuration,
  clampRepeat,
  deferred,
  readProps,
  type Channel,
  type Runner,
  type TweenHandle,
  type TweenOptions,
} from './tween-core';

export interface TimelineEntry {
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

export class TimelineRunner implements Runner, Timeline {
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
