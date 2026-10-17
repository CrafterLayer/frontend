import type { BuilderKernel } from '@craftkit/builder/headless';

/**
 * One open document, and the kernel that owns every change to it.
 *
 * The kernel is kept rather than the document JSON because the document is a
 * DERIVED value here: `kernel.getDocument()` is the only reader, and history,
 * undo and the AI plan door all live on the same object. A store that held
 * plain JSON would force every tool to rebuild a kernel per call, and a rebuilt
 * kernel has no transaction log — the `craftkit_history` and undo tools would
 * silently answer about a session that had just been born.
 */
export interface DocumentSession {
  readonly id: string;
  readonly kernel: BuilderKernel;
  /** From the injected clock, never `Date.now()` — this is reported to clients. */
  readonly openedAt: number;
}

/**
 * Where open documents live, as a PORT.
 *
 * It is a port and not a `Map` in a module scope for two reasons. A test has to
 * be able to hand the server a store it can inspect and pre-seed, and a
 * deployment that wants one document per client connection has to be able to
 * scope the store to that connection rather than to the process. Both are the
 * same requirement: the lifetime of a document is the HOST's decision, not this
 * package's.
 */
export interface DocumentStore {
  get(id: string): DocumentSession | undefined;
  /** Replaces any session already under this id — `open` doubles as `reset`. */
  put(session: DocumentSession): void;
  /** Open ids, in insertion order, so a client can find a document it forgot. */
  ids(): readonly string[];
}

/**
 * The default store: a plain in-process map.
 *
 * Deliberately not persistent. An MCP server holds a document for the length of
 * a conversation; anything that must outlive it is the host's business, and the
 * host swaps this out for a store of its own rather than asking this package to
 * grow a database.
 */
export function createMemoryDocumentStore(): DocumentStore {
  const sessions = new Map<string, DocumentSession>();
  return {
    get: (id) => sessions.get(id),
    put: (session) => {
      sessions.set(session.id, session);
    },
    ids: () => [...sessions.keys()],
  };
}
