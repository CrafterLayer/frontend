import type { AiBatchJobRecord, AiBatchJobStore } from './types';

/**
 * Job records in memory: for tests, and for a host that persists elsewhere. A panel that
 * must find its jobs again after a reload gives the runner a store over IndexedDB or its
 * server instead — the records are plain JSON, so any store that keeps JSON keeps them.
 */
export function createMemoryBatchJobStore(
  initial: readonly AiBatchJobRecord[] = [],
): AiBatchJobStore {
  const records = new Map(initial.map((record) => [record.id, record]));
  return {
    list: () => Promise.resolve([...records.values()]),
    get: (id) => Promise.resolve(records.get(id)),
    put: (record) => {
      records.set(record.id, record);
      return Promise.resolve();
    },
    remove: (id) => {
      records.delete(id);
      return Promise.resolve();
    },
  };
}
