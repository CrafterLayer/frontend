export interface FixedStepOptions {
  /** Simulation seconds per update, 1/240..0.1; default 1/60. */
  step?: number;
  /** Catch-up limit per rendered frame, 1..8; default 5. */
  maxSteps?: number;
}

/** Fixed-step simulation, independent from the renderer. Excess backlog is dropped. */
export function createFixedStep(fn: (dtSeconds: number) => void, options: FixedStepOptions = {}) {
  const step = options.step ?? 1 / 60;
  const maxSteps = options.maxSteps ?? 5;
  if (typeof fn !== 'function') throw new TypeError('fixedTick requires a callback');
  if (!Number.isFinite(step) || step < 1 / 240 || step > 0.1)
    throw new RangeError('fixedTick step must be 1/240..0.1 seconds');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 8)
    throw new RangeError('fixedTick maxSteps must be 1..8');
  let pending = 0;
  let disposed = false;
  function isDisposed(): boolean {
    return disposed;
  }
  return {
    advance(dtSeconds: number): void {
      if (disposed || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
      pending = Math.min(pending + dtSeconds, step * maxSteps);
      let steps = 0;
      while (!isDisposed() && pending + 1e-10 >= step && steps < maxSteps) {
        pending = Math.max(0, pending - step);
        steps += 1;
        fn(step);
      }
    },
    dispose(): void {
      disposed = true;
      pending = 0;
    },
  };
}
