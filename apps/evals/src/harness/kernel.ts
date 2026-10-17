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

/**
 * The node ids the `starter` fixture actually produces, COMPUTED rather than
 * asserted.
 *
 * They were written down as `ev-0001` and `ev-0002` while the harness ran on
 * the kernel's six test fixtures, and the day it switched to the production
 * catalog the second one became `ev-0003` — the real `hero` schema mints an id
 * of its own on the way in. A literal would have been wrong again on the next
 * schema change, and wrong SILENTLY: a corpus case whose
 * `requiredTargetNodeIds` names a node that does not exist is not a failing
 * assistant, it is an eval measuring nothing.
 *
 * So the ids come from building the fixture once and reading the page. The
 * seeded id port makes that deterministic, which is what a diff between two
 * model versions depends on; it is the LITERAL that was never guaranteed.
 */
function starterSectionIds(): readonly string[] {
  const kernel = createEvalKernel('starter');
  const root = kernel.getDocument().nodes['root'];
  return root?.slots?.['default'] ?? [];
}

const STARTER_SECTION_IDS = starterSectionIds();

/** Node id of the first section in the `starter` fixture. Corpus cases name it. */
export const STARTER_HERO_ID = STARTER_SECTION_IDS[0] ?? 'ev-0001';

/** Node id of the second section in the `starter` fixture. */
export const STARTER_FEATURES_ID = STARTER_SECTION_IDS[1] ?? 'ev-0002';

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

/**
 * The extension manifests a run registers, resolved the same way
 * {@link createEvalKernel} resolves them.
 *
 * Exposed because a report that says "the assistant scored 6/10" is unreadable
 * without the vocabulary it was scored against, and because a caller building
 * its own kernel — the promptfoo provider does — must register exactly this
 * list or its plans are validated against a different catalog than the graders
 * assume.
 */
export function evalExtensions(
  options: CreateEvalKernelOptions = {},
): readonly TrustedExtensionManifest[] {
  return [...catalogFor(options.catalog ?? resolveEvalCatalog()), ...(options.extraBlocks ?? [])];
}

/** The catalog a kernel ended up with, for a report that has to be honest about it. */
export function evalCatalogTypes(options: CreateEvalKernelOptions = {}): readonly string[] {
  return [...registeredTypes(createEvalKernel('empty', 'ltr', options))].sort();
}
