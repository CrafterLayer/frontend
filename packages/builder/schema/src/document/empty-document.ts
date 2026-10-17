import {
  LATEST_SCHEMA_VERSION,
  type BuilderDocument,
  type ContentDirection,
  type Surface,
} from './types';

/**
 * The smallest valid document: one `page` root and nothing else.
 *
 * MOVED HERE from `@craftkit/builder-core`'s `create-builder.ts` (feature 013),
 * for the same reason the token vocabulary moved down before it. `addPage` has
 * to mint a page's document, `addPage` lives in `core/src/commands/`, and
 * `create-builder.ts` imports that very directory — so calling it from there
 * would close an import cycle. Declaring a second "empty document" beside the
 * site commands would be worse: two answers to what a new page starts as, and
 * they drift the first time the root node's type or props change.
 *
 * At layer 0 the kernel, the site commands, the fixtures, and the AI pipeline
 * all read one definition. `create-builder.ts` re-exports it, so every existing
 * import kept working.
 */
export function emptyDocument(
  surface: Surface = 'site',
  dir: ContentDirection = 'ltr',
): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface,
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: {} } },
  };
}
