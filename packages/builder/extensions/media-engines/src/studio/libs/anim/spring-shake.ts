/*
  The anim library's spring and shake runners (split from tween.ts, 2026-10-12): a
  critically damped follow-through and a decaying screen shake, both on the scene clock.
*/

import { readNumber, writeNumber, type PropRef } from './props';
import { clampDuration, deferred, type Runner, type TweenHandle } from './tween-core';

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

export class SpringRunner implements Runner, Spring {
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

export class ShakeRunner implements Runner, TweenHandle {
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
