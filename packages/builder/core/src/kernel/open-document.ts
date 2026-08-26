import {
  createMigrationRunner,
  validateDocument,
  type BuilderDocument,
  type Migration,
  type PersistenceAdapter,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applyPatchSet } from '../patches/apply';
import { createBuilder, type BuilderKernel, type CreateBuilderOptions } from './create-builder';

export interface OpenDocumentOptions {
  extensions?: TrustedExtensionManifest[];
  migrations?: Readonly<Record<number, Migration>>;
  ports?: CreateBuilderOptions['ports'];
  coalesceEvery?: number;
}

/**
 * Law M load path: load(snapshot + tail) → migrate step-by-step → validate → open.
 * Any failure throws BEFORE a kernel exists — a document never half-opens. The
 * returned kernel is bound to the adapter at the loaded position.
 */
export async function openDocument(
  adapter: PersistenceAdapter,
  docId: string,
  options: OpenDocumentOptions = {},
): Promise<BuilderKernel> {
  const session = await adapter.load(docId);

  const migrated = createMigrationRunner(options.migrations ?? {}).migrate(
    session.doc,
  ) as BuilderDocument;

  const document = session.tail.reduce((doc, tx) => applyPatchSet(doc, tx.patches), migrated);

  const structuralErrors = validateDocument(document);
  const firstError = structuralErrors[0];
  if (firstError !== undefined) {
    throw firstError;
  }

  const kernel = createBuilder({
    document,
    extensions: options.extensions ?? [],
    ports: options.ports ?? {},
    persistence: {
      adapter,
      docId,
      ...(options.coalesceEvery === undefined ? {} : { coalesceEvery: options.coalesceEvery }),
    },
    initialSeq: session.seq,
  });

  // Registry-aware pass once extensions are active — still before handing over.
  const registryErrors = kernel.validate();
  const firstRegistryError = registryErrors[0];
  if (firstRegistryError !== undefined) {
    throw firstRegistryError;
  }

  return kernel;
}
