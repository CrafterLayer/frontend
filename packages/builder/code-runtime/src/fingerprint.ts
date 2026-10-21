import type { RuntimeSnapshot, ManagedCatalog } from './contracts';

/** The Tailwind plugins are part of the compiler (compiler/tailwind-plugins.ts): a new one is a new artifact. */
export const COMPILER_VERSION =
  'craftkit-code-1/esbuild-0.28.2/typescript-6.0.3/tailwind-4.3.3/typography-0.5.20/forms-0.5.11';

/** Only JSON is accepted; insertion order does not affect identity. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  function encode(item: unknown): string {
    if (item === null || typeof item === 'boolean' || typeof item === 'string')
      return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || seen.has(item))
      throw new TypeError('Fingerprint input must be acyclic JSON.');
    seen.add(item);
    let result: string;
    if (Array.isArray(item)) result = `[${item.map(encode).join(',')}]`;
    else {
      if (
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null
      ) {
        throw new TypeError('Fingerprint input must contain plain JSON objects.');
      }
      result = `{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode((item as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    }
    seen.delete(item);
    return result;
  }
  return encode(value);
}

export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function projectFingerprints(snapshot: RuntimeSnapshot, catalog: ManagedCatalog) {
  const [
    sourceFingerprint,
    dependencyFingerprint,
    compilerFingerprint,
    runtimeFingerprint,
    catalogFingerprint,
  ] = await Promise.all([
    fingerprint({
      projectId: snapshot.projectId,
      pageId: snapshot.pageId,
      address: snapshot.address,
      entry: snapshot.entry,
      files: snapshot.project.files,
      revision: snapshot.project.revision,
      inputs: snapshot.inputs,
    }),
    fingerprint(snapshot.project.dependencyLock),
    fingerprint(COMPILER_VERSION),
    fingerprint(snapshot.project.runtimeProfile),
    fingerprint({
      manifest: catalog.manifest,
      compatibleLockVersions: catalog.compatibleLockVersions ?? {},
      modules: catalog.modules,
      stylesheet: catalog.stylesheet ?? '',
    }),
  ]);
  const parts = {
    sourceFingerprint,
    dependencyFingerprint,
    compilerFingerprint,
    runtimeFingerprint,
    catalogFingerprint,
  };
  return { ...parts, artifactId: await fingerprint(parts) };
}
