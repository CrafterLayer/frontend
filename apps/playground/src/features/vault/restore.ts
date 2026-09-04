import type { BuilderDocument, BuilderKernel, CoreCommands, JsonValue } from '@craftkit/builder';

/*
  The projection the code-view extension registers. The literal is written by
  hand because `CANONICAL_JSON_PROJECTION_ID` lives in @craftkit/builder-
  transforms, which an application may not reach past the preset (ADR 0003).
*/
const CANONICAL_JSON_PROJECTION = 'canonical-json';

export type RestoreOutcome =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly reason: string };

/**
 * The ONLY legal revert: project the target document to canonical text, parse
 * it against the LIVE document, and send the resulting diff through the
 * kernel's `applyPatches` door as one transaction — exactly the route the code
 * view already takes for a textual edit.
 *
 * It never writes to storage, and it never loops `undo()`: the stored inverse
 * patches cannot be replayed safely (undo/redo record no transaction, so the
 * log and the history disagree about what has been reverted), which is why the
 * revert has to be expressed as a NEW forward change. One transaction also
 * means one undo — a person who restores by mistake presses ctrl-Z once.
 *
 * The parse is registry-aware through `blockExists`: the CALLER owns the
 * registry, so restoring a document whose vocabulary is no longer registered is
 * refused with a readable reason instead of corrupting the session.
 */
export function restoreDocument(kernel: BuilderKernel, document: BuilderDocument): RestoreOutcome {
  const projection = kernel.context.registry.projection(CANONICAL_JSON_PROJECTION);
  if (projection === undefined) {
    return {
      ok: false,
      reason:
        'This session cannot restore: the canonical-json projection is not registered (the code-view extension supplies it).',
    };
  }

  try {
    const text = projection.project(document);
    const parsed = projection.parse(text, kernel.getDocument(), {
      blockExists: (type) => kernel.context.registry.block(type) !== undefined,
    });

    if (!parsed.ok) {
      return { ok: false, reason: readable(parsed.errors) };
    }
    // A no-op revert parses cleanly to zero patches, and `applyPatches` refuses
    // an empty batch. Nothing to do is not an error.
    if (parsed.patches.length === 0) {
      return { ok: true, changed: false };
    }

    /*
      Mapped explicitly, and ANNOTATED. `dispatch` has an untyped overload, so
      handing it a shape the typed one rejects compiles silently with no
      argument checking at all; naming the command's own argument type keeps the
      typed door. `exactOptionalPropertyTypes` forbids writing `value:
      undefined`, hence the conditional spread rather than a plain assignment.
    */
    const patches: CoreCommands['applyPatches']['patches'] = parsed.patches.map((patch) => ({
      op: patch.op,
      path: [...patch.path],
      ...(patch.value === undefined ? {} : { value: patch.value as JsonValue }),
    }));

    kernel.dispatch('applyPatches', { patches }, 'codeview');
    return { ok: true, changed: true };
  } catch (error) {
    // `applyPatches` revalidates the WHOLE document registry-aware and throws
    // `doc/invalid-patch` when the restore would leave it invalid; a throw
    // leaves the document, log and history untouched.
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'The document could not be restored.',
    };
  }
}

function readable(errors: readonly { line: number; message: string }[]): string {
  if (errors.length === 0) {
    return 'The document could not be restored.';
  }
  return errors.map(({ line, message }) => `line ${String(line)}: ${message}`).join(' ');
}
