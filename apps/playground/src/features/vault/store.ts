/*
  The vault's ONLY contact with browser storage: a tiny async key/value port.

  Everything above it — the persistence adapter, the snapshot shelf — is pure
  logic over this interface, which is why the whole vault is testable against
  `createMemoryVaultStore` and never against a real IndexedDB (there is no
  fake-indexeddb in this repo, and none is wanted).
*/

import type { PersistenceAck } from '@craftkit/builder';

export interface VaultStore {
  get<T>(key: string): Promise<T | undefined>;
  set(
    key: string,
    value: unknown,
    sequence?: number,
    options?: VaultWriteOptions,
  ): Promise<PersistenceAck | undefined>;
  remove(key: string, sequence?: number): Promise<PersistenceAck | undefined>;
  keys(prefix: string): Promise<readonly string[]>;
  /** Current storage tier, after any connection or write fallback has been observed. */
  persistence?(sequence?: number): PersistenceAck;
  /** Forget a failed connection so the next write can attempt durable storage again. */
  retryPersistence?(): void;
}

export interface VaultWriteOptions {
  /** Completed run checkpoints disable fallback so a memory copy cannot claim durable completion. */
  readonly allowSessionFallback?: boolean | undefined;
}

const DEFAULT_DATABASE_NAME = 'craftkit-vault';
const OBJECT_STORE = 'entries';
const MEMORY_ONLY_REASON =
  'Persistent storage is unavailable. This session keeps its work in memory only.';

function sessionOnly(sequence: number, reason = MEMORY_ONLY_REASON): PersistenceAck {
  return { kind: 'session-only', sequence, reason };
}

function failed(sequence: number, error: unknown, recoverable: boolean): PersistenceAck {
  return {
    kind: 'failed',
    sequence,
    reason: reasonOf(error),
    recoverable,
  };
}

/** Normalize legacy/test ports that predate explicit storage acknowledgements. */
export function vaultWriteAcknowledgement(
  store: VaultStore,
  acknowledgement: PersistenceAck | undefined,
  sequence: number,
): PersistenceAck {
  return (
    acknowledgement ??
    store.persistence?.(sequence) ??
    sessionOnly(sequence, 'This storage port did not provide durable acknowledgement.')
  );
}

/**
 * The in-memory reference: the same contract over a `Map`, used by every test
 * and story. It clones on BOTH sides exactly as structured-clone storage does,
 * so a caller can never mutate what it stored (or what it read) by accident —
 * a memory store that handed out live references would let tests pass that a
 * real IndexedDB would fail.
 */
export function createMemoryVaultStore(): VaultStore {
  const entries = new Map<string, unknown>();

  const store: VaultStore = {
    get<T>(key: string): Promise<T | undefined> {
      if (!entries.has(key)) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(structuredClone(entries.get(key)) as T);
    },
    set(key, value, sequence = 0, options = {}) {
      if (options.allowSessionFallback === false) return Promise.resolve(sessionOnly(sequence));
      try {
        entries.set(key, structuredClone(value));
        return Promise.resolve(sessionOnly(sequence));
      } catch (error) {
        return Promise.resolve(failed(sequence, error, false));
      }
    },
    remove(key, sequence = 0) {
      entries.delete(key);
      return Promise.resolve(sessionOnly(sequence));
    },
    keys(prefix) {
      return Promise.resolve(
        [...entries.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort((a, b) => a.localeCompare(b)),
      );
    },
    persistence(sequence = 0) {
      return sessionOnly(sequence);
    },
  };
  return store;
}

/**
 * One database, one object store, promisified requests — and NEVER a throw to
 * the caller. A private window, disabled site data, a blocked upgrade or a
 * quota refusal all degrade to an in-memory store with a single console
 * warning: losing persistence must not take the app down, and a builder that
 * refuses to open because it cannot save is worse than one that saves nowhere.
 */
export function createIndexedDbVaultStore(
  databaseName: string = DEFAULT_DATABASE_NAME,
): VaultStore {
  const fallback = createMemoryVaultStore();
  let warned = false;
  let fallbackReason: string | undefined;

  const warnOnce = (reason: string): void => {
    fallbackReason ??= reason;
    if (warned) {
      return;
    }
    warned = true;
    console.warn(
      `[craftkit vault] Persistent storage is unavailable (${reason}). This session keeps its work in memory only, and it will be lost on reload.`,
    );
  };

  const factory = readIndexedDb();
  if (factory === undefined) {
    warnOnce('this browser exposes no indexedDB');
    return fallback;
  }

  let connecting: Promise<IDBDatabase | undefined> | undefined;
  const connect = (): Promise<IDBDatabase | undefined> => {
    connecting ??= openDatabase(factory, databaseName).catch((error: unknown) => {
      warnOnce(reasonOf(error));
      return undefined;
    });
    return connecting;
  };

  const store: VaultStore = {
    async get<T>(key: string): Promise<T | undefined> {
      if (fallbackReason !== undefined) return fallback.get<T>(key);
      const db = await connect();
      if (db === undefined) {
        return fallback.get<T>(key);
      }
      try {
        const value = await request<unknown>(db, 'readonly', (objects) => objects.get(key));
        if (value !== undefined) await fallback.set(key, value);
        return value as T | undefined;
      } catch (error) {
        warnOnce(reasonOf(error));
        return fallback.get<T>(key);
      }
    },
    async set(key, value, sequence = 0, options = {}) {
      const db = await connect();
      if (db === undefined) {
        if (options.allowSessionFallback === false) {
          return sessionOnly(sequence, fallbackReason);
        }
        const acknowledgement = await fallback.set(key, value, sequence);
        return acknowledgement?.kind === 'failed'
          ? acknowledgement
          : sessionOnly(sequence, fallbackReason);
      }
      try {
        await request<IDBValidKey>(db, 'readwrite', (objects) => objects.put(value, key));
        await fallback.set(key, value, sequence);
        fallbackReason = undefined;
        return { kind: 'durable', sequence };
      } catch (error) {
        warnOnce(reasonOf(error));
        if (options.allowSessionFallback === false) {
          return sessionOnly(sequence, reasonOf(error));
        }
        const acknowledgement = await fallback.set(key, value, sequence);
        return acknowledgement?.kind === 'failed'
          ? acknowledgement
          : sessionOnly(sequence, reasonOf(error));
      }
    },
    async remove(key, sequence = 0) {
      const db = await connect();
      if (db === undefined) {
        const acknowledgement = await fallback.remove(key, sequence);
        return acknowledgement?.kind === 'failed'
          ? acknowledgement
          : sessionOnly(sequence, fallbackReason);
      }
      try {
        await request<undefined>(db, 'readwrite', (objects) => objects.delete(key));
        await fallback.remove(key, sequence);
        fallbackReason = undefined;
        return { kind: 'durable', sequence };
      } catch (error) {
        warnOnce(reasonOf(error));
        const acknowledgement = await fallback.remove(key, sequence);
        return acknowledgement?.kind === 'failed'
          ? acknowledgement
          : sessionOnly(sequence, reasonOf(error));
      }
    },
    async keys(prefix) {
      if (fallbackReason !== undefined) return fallback.keys(prefix);
      const db = await connect();
      if (db === undefined) {
        return fallback.keys(prefix);
      }
      try {
        const all = await request<IDBValidKey[]>(db, 'readonly', (objects) => objects.getAllKeys());
        return all
          .filter((key): key is string => typeof key === 'string')
          .filter((key) => key.startsWith(prefix))
          .sort((a, b) => a.localeCompare(b));
      } catch (error) {
        warnOnce(reasonOf(error));
        return fallback.keys(prefix);
      }
    },
    persistence(sequence = 0) {
      return fallbackReason === undefined
        ? { kind: 'durable', sequence }
        : sessionOnly(sequence, fallbackReason);
    },
    retryPersistence() {
      connecting = undefined;
      fallbackReason = undefined;
    },
  };
  return store;
}

/*
  Read through an OPTIONAL shape rather than the ambient `indexedDB` binding:
  lib.dom types it as always present, so a plain `=== undefined` check would be
  flagged as unnecessary — while the whole point is that it is often missing.
*/
function readIndexedDb(): IDBFactory | undefined {
  return (globalThis as { indexedDB?: IDBFactory }).indexedDB;
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const opening = factory.open(databaseName, 1);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(OBJECT_STORE)) {
        db.createObjectStore(OBJECT_STORE);
      }
    };
    opening.onsuccess = () => {
      resolve(opening.result);
    };
    opening.onerror = () => {
      reject(opening.error ?? new Error('the database could not be opened'));
    };
    // A blocked upgrade means an older connection in another tab still holds the
    // database. Degrading beats hanging: this promise must always settle.
    opening.onblocked = () => {
      reject(new Error('another tab holds an older version of the database'));
    };
  });
}

function request<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (objects: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(OBJECT_STORE, mode);
    const pending = run(transaction.objectStore(OBJECT_STORE));
    let requestSucceeded = false;
    let result: T;
    pending.onsuccess = () => {
      result = pending.result;
      requestSucceeded = true;
    };
    pending.onerror = () => {
      reject(pending.error ?? new Error('the storage request failed'));
    };
    transaction.oncomplete = () => {
      if (!requestSucceeded) {
        reject(new Error('the storage transaction completed before its request succeeded'));
        return;
      }
      resolve(result);
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('the storage transaction failed'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('the storage transaction was aborted'));
    };
  });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'an unknown storage failure';
}
