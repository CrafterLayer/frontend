import type { EvalDirection, EvalFixture } from '../corpus/types';

import {
  createBuilder,
  emptyDocument,
  type BuilderKernel,
  type TrustedExtensionManifest,
} from './builder';
import {
  catalogFor,
  resolveEvalCatalog,
  STARTER_SECTION_PREFERENCES,
  type EvalCatalogName,
} from './catalog';
import { seededIdPort, steppedClockPort } from './ports';

/** Node id of the first section in the `starter` fixture. Corpus cases name it. */
export const STARTER_HERO_ID = 'ev-0001';

/** Node id of the second section in the `starter` fixture. */
export const STARTER_FEATURES_ID = 'ev-0002';

export interface CreateEvalKernelOptions {
  catalog?: EvalCatalogName;
  /** Register vocabulary the catalog cannot supply. The seam described in catalog.ts. */
  extraBlocks?: readonly TrustedExtensionManifest[];
}

/** Every block type the kernel will actually accept, for fixture resolution. */
function registeredTypes(kernel: BuilderKernel): ReadonlySet<string> {
  return new Set(kernel.context.registry.blocks().map(({ schema }) => schema.type));
}

/**
 * Build the kernel a case starts from.
 *
 * The `starter` document is produced by DISPATCHING inserts rather than by
 * hand-writing node props, and that is deliberate. Hand-written props go stale
 * the moment a block schema gains a required field, and they go stale silently
 * — the fixture keeps parsing and the eval quietly starts measuring a document
 * no editor would ever produce. Building it through the same door the editor
 * uses means zod fills every default and the fixture cannot drift.
 *
 * The seeded id port is what makes `STARTER_HERO_ID` a constant a corpus case
 * can name: the first insert is always `ev-0001`. Determinism is not a nicety
 * here — a diff between two model versions is unreadable if the node ids move.
 */
export function createEvalKernel(
  fixture: EvalFixture,
  dir: EvalDirection = 'ltr',
  options: CreateEvalKernelOptions = {},
): BuilderKernel {
  const kernel = createBuilder({
    document: emptyDocument('site', dir),
    extensions: [
      ...catalogFor(options.catalog ?? resolveEvalCatalog()),
      ...(options.extraBlocks ?? []),
    ],
    ports: { clock: steppedClockPort(), ids: seededIdPort('ev') },
  });

  if (fixture !== 'starter') return kernel;

  const available = registeredTypes(kernel);
  for (const preferences of STARTER_SECTION_PREFERENCES) {
    const type = preferences.find((candidate) => available.has(candidate));
    /*
      A catalog that registers neither `hero` nor any section type gets a
      starter document with fewer sections, and the edit cases then fail their
      `requiredTargetNodeIds` clause loudly. That is the correct outcome:
      silently handing the edit cases an empty page would let them pass while
      testing nothing.
    */
    if (type === undefined) continue;
    kernel.dispatch('insertNode', { type, props: {}, parentId: 'root', slot: 'default' });
  }
  return kernel;
}

/** The catalog a kernel ended up with, for a report that has to be honest about it. */
export function evalCatalogTypes(options: CreateEvalKernelOptions = {}): readonly string[] {
  return [...registeredTypes(createEvalKernel('empty', 'ltr', options))].sort();
}
