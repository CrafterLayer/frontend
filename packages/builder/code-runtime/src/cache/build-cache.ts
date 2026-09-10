import type { BuildCache, CompiledPageArtifact } from '../contracts';

/** Bounded content-addressed LRU; callers cannot mutate a cached result by alias. */
export function createBuildCache(capacity = 16): BuildCache {
  if (!Number.isSafeInteger(capacity) || capacity < 1)
    throw new RangeError('Cache capacity must be positive.');
  const entries = new Map<string, CompiledPageArtifact>();
  return {
    get(key) {
      const artifact = entries.get(key);
      if (artifact === undefined) return Promise.resolve(undefined);
      entries.delete(key);
      entries.set(key, artifact);
      return Promise.resolve(structuredClone(artifact));
    },
    put(key, artifact) {
      if (key !== artifact.artifactId)
        return Promise.reject(new Error('Cache key must match artifact identity.'));
      entries.delete(key);
      entries.set(key, structuredClone(artifact));
      if (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      return Promise.resolve();
    },
  };
}
