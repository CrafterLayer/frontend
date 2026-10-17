import {
  builderError,
  migrateSite,
  siteFromDocument,
  validateSite,
  type BuilderSite,
  type PersistedSession,
  type SitePersistenceAdapter,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applyPatchSet, applySitePatchSet } from '../patches/apply';
import {
  createSiteBuilder,
  type BuilderSiteKernel,
  type CreateSiteBuilderOptions,
} from './create-site-builder';

export interface OpenSiteOptions {
  extensions?: readonly TrustedExtensionManifest[];
  ports?: CreateSiteBuilderOptions['ports'];
  coalesceEvery?: number;
}

/**
 * Law M load path for a site: load(snapshot + tail) → migrate → replay the tail
 * → validate → open. Any failure throws BEFORE a kernel exists, so a site never
 * half-opens; the returned kernel is bound to the adapter at the loaded
 * position.
 *
 * The order is not interchangeable. Migrating BEFORE the replay is what makes a
 * stored tail of old-format transactions replayable at all, and validating
 * AFTER the replay is what catches a tail that was written by a version whose
 * invariants no longer hold.
 */
export async function openSite(
  adapter: SitePersistenceAdapter,
  siteId: string,
  options: OpenSiteOptions = {},
): Promise<BuilderSiteKernel> {
  const session = await adapter.load(siteId);

  const migrated = migrateSite(session.site);
  const site = session.tail.reduce<BuilderSite>(
    (current, tx) => applySitePatchSet(current, tx.patches),
    migrated,
  );

  /*
    Validated here as well as inside `createSiteBuilder`. The kernel's check is
    the law; this one exists so the error a caller sees names LOADING as the
    context — "this stored site cannot be opened" is a different problem from
    "this site you just built is invalid", and they are fixed in different
    places.
  */
  const result = validateSite(site);
  if (!result.ok) {
    const first = result.issues[0];
    throw builderError(
      'site/structural-violation',
      `Stored site "${siteId}" cannot be opened: ${first?.message ?? 'unknown violation'}`,
    );
  }

  return createSiteBuilder({
    site: result.site,
    extensions: options.extensions ?? [],
    ports: options.ports ?? {},
    persistence: {
      adapter,
      siteId,
      ...(options.coalesceEvery === undefined ? {} : { coalesceEvery: options.coalesceEvery }),
    },
    initialSeq: session.seq,
  });
}

/**
 * Lift an existing single-document session into a one-page site, byte for byte
 * (FR-007).
 *
 * This is the migration path for every document a person already has: a
 * playground vault full of pages built before sites existed. The document that
 * comes out of the lift is IDENTICAL to the one that went in — same nodes, same
 * ids, same order, same `schemaVersion` — because the alternative is a silent
 * rewrite of somebody's work at the moment they upgrade.
 *
 * The tail is replayed FIRST, at the document level, so the lifted site is the
 * document as the person last saw it and not the older snapshot. The site's own
 * log then starts empty: the document's transactions are not site-rooted and
 * replaying them against a site would address paths that do not exist. That is
 * a real, stated cost — history before the lift is not undoable after it — and
 * it is the honest one, because the alternative is a history that silently
 * fails to apply.
 */
export function liftDocumentSession(session: PersistedSession): BuilderSite {
  const document = session.tail.reduce(
    (current, tx) => applyPatchSet(current, tx.patches),
    session.doc,
  );
  const site = siteFromDocument(document);

  const result = validateSite(site);
  if (!result.ok) {
    const first = result.issues[0];
    throw builderError(
      'site/structural-violation',
      `This document cannot be lifted into a site: ${first?.message ?? 'unknown violation'}`,
    );
  }
  return result.site;
}
