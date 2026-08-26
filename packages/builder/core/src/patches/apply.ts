import type { Patch as ImmerPatch } from 'immer';

import type { BuilderDocument, Patch } from '@craftkit/builder-schema';

import { applyPatches } from './immer';

/**
 * Replay a change set against a document. Used by undo/redo and by log replay;
 * the schema `Patch` shape is immer-compatible by contract (verified v11 shape).
 */
export function applyPatchSet(doc: BuilderDocument, patches: Patch[]): BuilderDocument {
  return applyPatches(doc, patches as ImmerPatch[]);
}
