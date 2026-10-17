import {
  liftDocumentSession,
  siteFromDocument,
  type BuilderSite,
  type PersistedSession,
} from '@craftkit/builder';

import type { VaultStore } from './store';
import { sessionKey } from './persistence';

/** What a first site boot found, so the caller can SAY which of the three it was. */
export type SiteSeedOrigin =
  /** An existing single-document session was lifted into a one-page site. */
  | 'lifted'
  /** Nothing was stored at all; the fixture became the home page. */
  | 'fixture';

export interface SiteSeedResult {
  readonly site: BuilderSite;
  readonly origin: SiteSeedOrigin;
}

/**
 * The site's FIRST-BOOT answer (FR-007).
 *
 * Order matters and is the whole point: before falling back to a fixture, look
 * for a document session this person already has and LIFT it. Someone who has
 * been building a page since before sites existed must find that page as their
 * home page — not an empty starter beside it, and not a fixture that silently
 * replaced their work.
 *
 * `liftDocumentSession` replays the stored tail before lifting, so what arrives
 * is the page as they last saw it rather than the older snapshot. The document
 * session is left in place, untouched: this reads, it does not migrate. If the
 * lift or the site is somehow invalid the caller gets the throw — a first boot
 * that quietly discarded someone's page would be the worst possible failure.
 */
export async function seedSiteFrom(
  store: VaultStore,
  docId: string,
  fixture: () => BuilderSite,
): Promise<SiteSeedResult> {
  const stored = await store.get<PersistedSession>(sessionKey(docId));
  if (stored === undefined) {
    return { site: fixture(), origin: 'fixture' };
  }
  return { site: liftDocumentSession(stored), origin: 'lifted' };
}

/** The fixture as a one-page site, for a person with nothing stored at all. */
export function siteFromFixture(document: Parameters<typeof siteFromDocument>[0]): BuilderSite {
  return siteFromDocument(document);
}
