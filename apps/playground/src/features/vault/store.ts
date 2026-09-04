/*
  The vault's ONLY contact with browser storage: a tiny async key/value port.

  Everything above it — the persistence adapter, the snapshot shelf — is pure
  logic over this interface, which is why the whole vault is testable against
  `createMemoryVaultStore` and never against a real IndexedDB (there is no
  fake-indexeddb in this repo, and none is wanted).
*/

export interface VaultStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix: string): Promise<readonly string[]>;
}

const DEFAULT_DATABASE_NAME = 'craftkit-vault';
const OBJECT_STORE = 'entries';

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
    set(key, value) {
      entries.set(key, structuredClone(value));
      return Promise.resolve();
    },
    remove(key) {
      entries.delete(key);
      return Promise.resolve();
    },
    keys(prefix) {
      return Promise.resolve(
        [...entries.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort((a, b) => a.localeCompare(b)),
      );
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

  const warnOnce = (reason: string): void => {
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
      const db = await connect();
      if (db === undefined) {
        return fallback.get<T>(key);
      }
      try {
        const value = await request<unknown>(db, 'readonly', (objects) => objects.get(key));
        return value as T | undefined;
      } catch (error) {
        warnOnce(reasonOf(error));
        return fallback.get<T>(key);
      }
    },
    async set(key, value) {
      const db = await connect();
      if (db === undefined) {
        return fallback.set(key, value);
      }
      try {
        await request<IDBValidKey>(db, 'readwrite', (objects) => objects.put(value, key));
      } catch (error) {
        warnOnce(reasonOf(error));
        await fallback.set(key, value);
      }
    },
    async remove(key) {
      const db = await connect();
      if (db === undefined) {
        return fallback.remove(key);
      }
      try {
        await request<undefined>(db, 'readwrite', (objects) => objects.delete(key));
      } catch (error) {
        warnOnce(reasonOf(error));
        await fallback.remove(key);
      }
    },
    async keys(prefix) {
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
    pending.onsuccess = () => {
      resolve(pending.result);
    };
    pending.onerror = () => {
      reject(pending.error ?? new Error('the storage request failed'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('the storage transaction was aborted'));
    };
  });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'an unknown storage failure';
}
