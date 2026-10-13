/*
  What ONE build remembers between its sections (2026-10-13): the lessons its repairs taught
  (build-lessons.ts) and the scene sections it has already looked at (scene-review.ts). Kept
  beside the build's options object rather than on the build's own state, so the modules that
  read it — the section providers, the section check, the repair round — need nothing from
  run-build.ts but the options they are already handed. A build is its options object AND its
  run id: an options object reused for another run starts with an empty memory.
*/

export interface BuildMemory {
  /** Lesson key (code + gist) → the one-line lesson, in the order they were learned. */
  readonly lessons: Map<string, string>;
  /** Section keys whose scene this build has claimed its one look at. */
  readonly looked: Set<string>;
}

const MEMORIES = new WeakMap<object, { readonly runId: string; readonly memory: BuildMemory }>();

/** The memory of the build `options` belongs to (created on first use). */
export function buildMemoryOf(options: { readonly runId: string }): BuildMemory {
  const held = MEMORIES.get(options);
  if (held?.runId === options.runId) return held.memory;
  const memory: BuildMemory = { lessons: new Map(), looked: new Set() };
  MEMORIES.set(options, { runId: options.runId, memory });
  return memory;
}
