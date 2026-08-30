import type { BuilderDocument } from '../document/types';
import { LATEST_SITE_VERSION, type BuilderSite, type SiteDesignSystem } from './types';
import { validateSite } from './validate';

type SiteMigration = (site: unknown) => unknown;

/** Pure steps from site version N-1 to N, keyed by the target version. */
const migrations: Readonly<Record<number, SiteMigration>> = {};

/** Migrate a raw stored site step by step to LATEST_SITE_VERSION. */
export function migrateSite(value: unknown): BuilderSite {
  const version = readSiteVersion(value);
  if (version > LATEST_SITE_VERSION) {
    throw new Error(
      `Site format v${String(version)} is newer than the supported v${String(LATEST_SITE_VERSION)}.`,
    );
  }

  let current = value;
  for (let target = version + 1; target <= LATEST_SITE_VERSION; target += 1) {
    const step = migrations[target];
    if (step === undefined) {
      throw new Error(
        `No site migration is registered for v${String(target)}; cannot reach v${String(LATEST_SITE_VERSION)} from v${String(version)}.`,
      );
    }
    current = step(current);
    const migratedVersion = readSiteVersion(current);
    if (migratedVersion !== target) {
      throw new Error(
        `Migration to site v${String(target)} produced a site claiming v${String(migratedVersion)}.`,
      );
    }
  }

  const validation = validateSite(current);
  if (!validation.ok) {
    throw new Error(
      `Migrated site is invalid: ${validation.issues
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  // Match document migrations: a current value passes through by identity.
  return current as BuilderSite;
}

/** FR-007: lift an existing page into a one-page site without changing it. */
export function siteFromDocument(doc: BuilderDocument): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: doc.dir,
    pages: [
      {
        id: 'home',
        address: '/',
        title: 'Home',
        purpose: 'Imported home page',
        audience: 'General',
        document: doc,
        regions: [],
      },
    ],
    sharedRegions: {},
    designSystem: defaultSiteDesignSystem(),
    assets: {},
  };
}

function defaultSiteDesignSystem(): SiteDesignSystem {
  /* Wave 3 replaces this bridge with the schema-owned validated default. */
  return { name: 'Default', tokens: {} };
}

function readSiteVersion(value: unknown): number {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('siteVersion' in value) ||
    typeof value.siteVersion !== 'number' ||
    !Number.isInteger(value.siteVersion) ||
    value.siteVersion < 0
  ) {
    throw new Error('Stored site must carry a non-negative integer siteVersion.');
  }
  return value.siteVersion;
}
