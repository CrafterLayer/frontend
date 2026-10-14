/*
  The anim library's timeline (split from tween.ts, 2026-10-12): tweens sequenced and
  overlapped on one clock, with labels, repeat and yoyo.

  Mural stories (2026-10-14) gave it the GSAP-style controls a scrubbed story needs, still as
  plain JavaScript on the scene's own clock:
  - `from` / `fromTo` entries (shown at their start values at once) and `stagger` over an array;
  - positions: seconds, '<' / '>' (start / end of the previous entry), a label, each with an
    optional offset ('+=0.5', '<0.2', 'beat2-=0.3'), and '+=n' / '-=n' from the timeline's end;
  - `seek(seconds | label)`, `progress(p)` and `time(t)`, so `tl.progress(s.scroll.progress)`
    scrubs a paused timeline both ways: entries not reached yet unwind, latest first, so a key
    tweened twice lands on its first start value, and calls fire again once passed again.
*/

import { resolveEase } from './easing';
import {
  MAX_TWEENS,
  apply,
  bindChannels,
  clampDuration,
  clampRepeat,
  currentValues,
  Playback,
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

export interface TimelineOptions {
  /** Extra plays after the first; -1 repeats until killed. */
  repeat?: number;
  /** Play every other repeat backwards. */
  yoyo?: boolean;
  /** Start paused: drive it with seek / progress (e.g. from s.scroll.progress). */
  paused?: boolean;
  onComplete?: () => void;
}

/** Seconds, '<' / '>' / a label with an optional offset, or '+=n' / '-=n' from the end. */
export type TimelinePosition = number | string;

type Props = Record<string, number>;

export interface Timeline extends Omit<TweenHandle, 'progress'> {
  readonly duration: number;
  to(target: unknown, props: Props, options?: TweenOptions, at?: TimelinePosition): Timeline;
  from(target: unknown, props: Props, options?: TweenOptions, at?: TimelinePosition): Timeline;
  fromTo(
    target: unknown,
    from: Props,
    to: Props,
    options?: TweenOptions,
    at?: TimelinePosition,
  ): Timeline;
  call(fn: () => void, at?: TimelinePosition): Timeline;
  wait(seconds: number): Timeline;
  /** Name a time (the end by default) for positions and seek. */
  label(name: string, at?: TimelinePosition): Timeline;
  /** Jump to a time or label and render it there (calls up to it fire). */
  seek(position: TimelinePosition): Timeline;
  /** 0..1 through one play; `progress(p)` seeks there. */
  progress(): number;
  progress(value: number): Timeline;
  /** Seconds into one play; `time(t)` seeks there. */
  time(): number;
  time(seconds: number): Timeline;
}

const POSITION = /^(<|>|[A-Za-z_]\w*)?(?:([+-]?)=?(\d+(?:\.\d+)?))?$/u;

export class TimelineRunner extends Playback implements Runner, Timeline {
  // Assigned in the constructor, not as class fields: each field initializer costs the lazy
  // bundle a defineProperty call, and its gzip budget is tight.
  declare private readonly entries: TimelineEntry[];
  declare private readonly labels: Map<string, number>;
  declare private cursor: number;
  declare private lastStart: number;
  declare private lastEnd: number;
  declare private clock: number;
  declare private local: number;
  declare private readonly repeat: number;
  declare private readonly options: TimelineOptions;
  declare readonly target: undefined;

  constructor(options: TimelineOptions) {
    super();
    this.options = options;
    this.entries = [];
    this.labels = new Map();
    this.cursor = this.lastStart = this.lastEnd = this.clock = this.local = 0;
    this.paused = options.paused === true;
    this.repeat = clampRepeat(options.repeat);
  }

  get duration(): number {
    return this.entries.reduce((max, entry) => Math.max(max, entry.end), this.cursor);
  }

  private resolve(at: TimelinePosition | undefined): number {
    if (typeof at === 'number') return Number.isFinite(at) ? Math.max(0, at) : this.cursor;
    const match = typeof at === 'string' ? POSITION.exec(at.trim()) : null;
    if (match === null) return this.cursor;
    const [, base, sign, amount] = match;
    const from =
      base === '<'
        ? this.lastStart
        : base === '>'
          ? this.lastEnd
          : ((base === undefined ? undefined : this.labels.get(base)) ?? this.cursor);
    return Math.max(0, from + (sign === '-' ? -1 : 1) * Number(amount ?? 0));
  }

  private place(at: TimelinePosition | undefined, length: number): number {
    const start = this.resolve(at);
    this.lastStart = start;
    this.lastEnd = start + length;
    this.cursor = Math.max(this.cursor, this.lastEnd);
    return start;
  }

  private push(entry: TimelineEntry): void {
    if (this.entries.length >= MAX_TWEENS)
      throw new RangeError('anim: timeline entry limit reached');
    this.entries.push(entry);
  }

  /** One entry per target (an array staggers), `from` values shown at once. */
  private add(
    target: unknown,
    to: Props | undefined,
    from: Props | undefined,
    options: TweenOptions,
    at: TimelinePosition | undefined,
  ): Timeline {
    const targets: unknown[] = Array.isArray(target) ? target : [target];
    const duration = clampDuration(options.duration, 0.5);
    const delay = clampDuration(options.delay, 0);
    const stagger = clampDuration(options.stagger, 0);
    const fromProps = from === undefined ? undefined : readProps(from);
    const toProps = to === undefined ? undefined : readProps(to);
    const start =
      this.place(at, delay + duration + stagger * Math.max(0, targets.length - 1)) + delay;
    targets.forEach((item, index) => {
      const begin = start + index * stagger;
      const props = toProps ?? currentValues(item, fromProps ?? []);
      const entry: TimelineEntry = {
        start: begin,
        end: begin + duration,
        target: item,
        props,
        options,
      };
      if (fromProps !== undefined) {
        entry.channels = bindChannels(item, props, options.colors, Object.fromEntries(fromProps));
        apply(entry.channels, 0);
      }
      this.push(entry);
    });
    return this;
  }

  to(target: unknown, props: Props, options: TweenOptions = {}, at?: TimelinePosition): Timeline {
    return this.add(target, props, undefined, options, at);
  }

  from(target: unknown, props: Props, options: TweenOptions = {}, at?: TimelinePosition): Timeline {
    return this.add(target, undefined, props, options, at);
  }

  fromTo(
    target: unknown,
    from: Props,
    to: Props,
    options: TweenOptions = {},
    at?: TimelinePosition,
  ): Timeline {
    return this.add(target, to, from, options, at);
  }

  call(fn: () => void, at?: TimelinePosition): Timeline {
    if (typeof fn !== 'function') throw new TypeError('anim: timeline.call needs a function');
    const start = this.place(at, 0);
    this.push({ start, end: start, call: fn });
    return this;
  }

  wait(seconds: number): Timeline {
    this.cursor += clampDuration(seconds, 0);
    return this;
  }

  // Authored scene code is plain JavaScript: a label may arrive as a number.
  label(name: unknown, at?: TimelinePosition): Timeline {
    this.labels.set(String(name), this.resolve(at));
    return this;
  }

  seek(position: TimelinePosition): Timeline {
    const time = typeof position === 'number' ? position : this.resolve(position);
    if (Number.isFinite(time)) {
      this.clock = Math.max(0, Math.min(this.duration, time));
      this.render(this.clock);
    }
    return this;
  }

  progress(): number;
  progress(value: number): Timeline;
  progress(value?: number): number | Timeline {
    const total = this.duration;
    if (value === undefined) return total === 0 ? Number(this.finishedFlag) : this.local / total;
    return this.seek(Math.max(0, Math.min(1, value)) * total);
  }

  time(): number;
  time(seconds: number): Timeline;
  time(seconds?: number): number | Timeline {
    return seconds === undefined ? this.local : this.seek(seconds);
  }

  private render(time: number): void {
    this.local = time;
    const entries = this.entries;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry === undefined || time >= entry.start) continue;
      entry.fired = false;
      if (entry.channels !== undefined) apply(entry.channels, 0);
    }
    for (const entry of entries) {
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

  /** Whether this play runs backwards (yoyo). */
  private flipped(cycle: number): boolean {
    return this.options.yoyo === true && cycle % 2 === 1;
  }

  step(dt: number): boolean {
    if (this.finishedFlag) return false;
    if (this.paused) return true;
    const total = this.duration;
    const before = total === 0 ? 0 : Math.floor(this.clock / total);
    this.clock += dt;
    if (total === 0 || this.clock >= total * (this.repeat + 1)) {
      this.finish();
      return false;
    }
    const cycle = Math.floor(this.clock / total);
    if (cycle !== before) {
      this.render(this.flipped(before) ? 0 : total);
      if (!this.flipped(cycle)) for (const entry of this.entries) entry.fired = false;
    }
    const time = this.clock - cycle * total;
    this.render(this.flipped(cycle) ? total - time : time);
    return true;
  }

  finish(): void {
    if (this.finishedFlag) return;
    this.render(this.flipped(this.repeat) ? 0 : this.duration);
    this.finishedFlag = true;
    this.signal.resolve();
    this.options.onComplete?.();
  }
}
