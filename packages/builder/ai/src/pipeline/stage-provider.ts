import type { RequestFor, ResponseFor, SiteStage } from './wire';

/**
 * How a stage is asked. One port, five stages, three implementations.
 *
 * Shaped after `AiProposeOptions` deliberately — signal and progress mean the
 * same things they mean on the plan path, so a host that already wires
 * cancellation to one wires it to the other without learning a second idiom.
 */
export interface StageOptions {
  readonly signal?: AbortSignal | undefined;
  /**
   * The provider's own words about what it is doing, as it streams them.
   *
   * The same channel the plan path uses for `plan.progress`. A site build is
   * minutes long across five stages; without it a person watches a spinner
   * with no idea which stage is slow.
   */
  readonly onProgress?: ((text: string) => void) | undefined;
}

/**
 * The port every stage goes through.
 *
 * ONE method, discriminated by the request's own `stage`, rather than five
 * named methods. Two reasons, and the second is the load-bearing one: an
 * implementation cannot accidentally support four stages and quietly omit the
 * fifth, and the orchestrator's retry, timeout and progress plumbing is written
 * once instead of five times.
 */
export interface SiteStageProvider {
  run<S extends SiteStage>(request: RequestFor<S>, options?: StageOptions): Promise<ResponseFor<S>>;
}
