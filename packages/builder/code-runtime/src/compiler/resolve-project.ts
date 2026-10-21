import { posix } from 'node:path';
import type { CodeFile } from '@craftkit/builder-schema';
import type { ManagedCatalog, RuntimeSnapshot } from '../contracts';

export interface ResolvedModule {
  readonly kind: 'project' | 'managed';
  readonly path: string;
  readonly file: CodeFile;
}

function admitsLockedVersion(
  catalog: ManagedCatalog,
  packageId: string,
  version: string,
  lockedVersion: string | undefined,
): boolean {
  return (
    lockedVersion !== undefined &&
    (version === lockedVersion ||
      catalog.compatibleLockVersions?.[packageId]?.includes(lockedVersion) === true)
  );
}

export function validateModulePath(path: string): void {
  if (
    path === '' ||
    path.includes('\\') ||
    /[\u0000-\u001f?#:%]/u.test(path) ||
    path.startsWith('/') ||
    path
      .split('/')
      .some(
        (part) =>
          part === '' ||
          part === '.' ||
          part === '..' ||
          ['__proto__', 'prototype', 'constructor'].includes(part),
      )
  ) {
    throw new Error(`Invalid project module path: ${path}`);
  }
}

export function validateManagedCatalog(snapshot: RuntimeSnapshot, catalog: ManagedCatalog): void {
  const lock = snapshot.project.dependencyLock;
  if (
    lock.catalogVersion !== catalog.manifest.catalogVersion ||
    // Serialized inputs cross the worker boundary and still require a runtime discriminator check.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    snapshot.project.runtimeProfile !== catalog.manifest.runtimeProfile
  ) {
    throw new Error(
      'The project runtime/catalog lock does not match the supplied managed catalog.',
    );
  }
  if (
    lock.packages['react'] !== undefined &&
    lock.packages['react-dom'] !== undefined &&
    lock.packages['react'] !== lock.packages['react-dom']
  ) {
    throw new Error('Managed React and React DOM locks must use identical versions.');
  }
  for (const [packageId, version] of Object.entries(lock.packages)) {
    if (
      !catalog.manifest.packages.some(
        (entry) =>
          entry.packageId === packageId &&
          admitsLockedVersion(catalog, packageId, entry.version, version),
      )
    ) {
      throw new Error(`Managed dependency is unavailable: ${packageId}@${version}`);
    }
  }
  for (const path of Object.keys(snapshot.project.files)) validateModulePath(path);
  validateModulePath(snapshot.entry);
}

/** Resolve only the supplied virtual files; never fall through to Node resolution. */
export function resolveProjectModule(
  snapshot: RuntimeSnapshot,
  catalog: ManagedCatalog,
  specifier: string,
  importer?: string,
): ResolvedModule {
  if (
    specifier.includes('\\') ||
    specifier.includes('\0') ||
    /[?#:%]/u.test(specifier) ||
    specifier.startsWith('/')
  ) {
    throw new Error(`Import is not a managed or project module: ${specifier}`);
  }
  if (specifier.startsWith('.')) {
    if (importer === undefined || importer.startsWith('managed:'))
      throw new Error(`Relative import has no project owner: ${specifier}`);
    const normalized = posix.normalize(posix.join(posix.dirname(importer), specifier));
    validateModulePath(normalized);
    for (const candidate of [
      normalized,
      ...[
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
        '.css',
        '/index.ts',
        '/index.tsx',
        '/index.js',
        '/index.jsx',
      ].map((extension) => normalized + extension),
    ]) {
      const file = snapshot.project.files[candidate];
      if (file !== undefined) return { kind: 'project', path: candidate, file };
    }
    throw new Error(`Project import does not exist: ${specifier} from ${importer}`);
  }
  if (importer === undefined) {
    validateModulePath(specifier);
    const file = snapshot.project.files[specifier];
    if (file !== undefined) return { kind: 'project', path: specifier, file };
  }
  const packageEntry = catalog.manifest.packages.find((entry) =>
    entry.importSpecifiers.includes(specifier),
  );
  if (
    packageEntry === undefined ||
    !admitsLockedVersion(
      catalog,
      packageEntry.packageId,
      packageEntry.version,
      snapshot.project.dependencyLock.packages[packageEntry.packageId],
    )
  ) {
    throw new Error(`Import is not in the locked managed catalog: ${specifier}`);
  }
  const file = catalog.modules[specifier];
  if (file === undefined) throw new Error(`Managed artifact is unavailable: ${specifier}`);
  return { kind: 'managed', path: specifier, file };
}
