/**
 * Completed independent writers, consumed by ONE serial kernel lander. Subscribe only
 * after the final-plan gate: reconciliation may replace a speculative slot's promise.
 * Reports and document positions are ordered separately from completion.
 */
export async function* readySections<T>(
  promises: readonly Promise<T>[],
): AsyncGenerator<readonly [number, T]> {
  const pending = new Map(
    promises.map((promise, index) => [index, promise.then((value) => [index, value] as const)]),
  );
  while (pending.size > 0) {
    const next = await Promise.race(pending.values());
    pending.delete(next[0]);
    yield next;
  }
}
