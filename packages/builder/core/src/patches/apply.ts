import type { Patch as ImmerPatch } from 'immer';

import type { BuilderDocument, BuilderSite, Patch } from '@craftkit/builder-schema';

import { applyPatches } from './immer';

/**
 * Replay a change set against a document. Used by undo/redo and by log replay;
 * the schema `Patch` shape is immer-compatible by contract (verified v11 shape).
 */
export function applyPatchSet(doc: BuilderDocument, patches: Patch[]): BuilderDocument {
  return applyPatches(doc, patches as ImmerPatch[]);
}

/**
 * The same replay against a SITE root.
 *
 * S1's recorded finding: `applyPatchSet` is typed to `BuilderDocument`, so the
 * site kernel — whose history holds site-rooted patches — could not use it.
 * This is the small addition the spike said the delivery needs, not a new
 * mechanism: both are typed wrappers over immer's generic `applyPatches`, and
 * they stay two named functions rather than one generic so a caller cannot
 * silently replay a document's patches onto a site.
 */
export function applySitePatchSet(site: BuilderSite, patches: Patch[]): BuilderSite {
  return applyPatches(site, patches as ImmerPatch[]);
}
