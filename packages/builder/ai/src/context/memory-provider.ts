import type { AiContextProvider } from '@craftkit/builder-schema';

export interface MemoryContextProviderOptions {
  /**
   * Called on every context assembly with no arguments; returns the notes the
   * host wants the planner to remember — applied changes, stated preferences,
   * site facts. WHERE they live (component state, localStorage, a database) is
   * the host's decision; this provider only carries them to the model.
   */
  load: () => readonly string[];
  /** Fragment title; override when a host runs several memories. */
  title?: string;
}

/**
 * Memory as a context provider — the portable pattern: the engine does not own
 * a store, it owns the SEAM. Any host (this playground, another product) plugs
 * its own persistence in through `load` and passes the provider alongside
 * `BUILDER_AI_CONTEXT_PROVIDERS`. The notes ride the same fragments channel as
 * the block catalog, so every provider — local, remote, cached — sees them
 * with zero further wiring.
 */
export function createMemoryContextProvider(
  options: MemoryContextProviderOptions,
): AiContextProvider {
  return {
    id: 'craftkit.session-memory',
    collect() {
      const notes = options.load();
      const body =
        notes.length === 0
          ? 'Nothing recorded yet.'
          : notes.map((note) => `- ${note}`).join('\n');
      return { title: options.title ?? 'Session memory', body };
    },
  };
}
