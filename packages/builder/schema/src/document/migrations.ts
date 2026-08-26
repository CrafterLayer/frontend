import { builderError } from '../errors';
import { LATEST_SCHEMA_VERSION } from './types';

/** Pure step from format version N-1 to N; keyed by the TARGET version. */
export type Migration = (doc: unknown) => unknown;

export interface MigrationRunner {
  /** Migrate a raw stored document step by step to `LATEST_SCHEMA_VERSION`. */
  migrate(raw: unknown): unknown;
}

/**
 * Law M: load = migrate → validate → open. A version gap, a future version, or a
 * malformed version field throws `doc/migration-gap` — the document never
 * half-opens.
 */
export function createMigrationRunner(
  migrations: Readonly<Record<number, Migration>> = {},
): MigrationRunner {
  return {
    migrate(raw: unknown): unknown {
      const version = readVersion(raw);

      if (version > LATEST_SCHEMA_VERSION) {
        throw builderError(
          'doc/migration-gap',
          `Document format v${String(version)} is newer than the supported v${String(LATEST_SCHEMA_VERSION)}.`,
          ['schemaVersion'],
        );
      }

      let current = raw;
      for (let target = version + 1; target <= LATEST_SCHEMA_VERSION; target += 1) {
        const step = migrations[target];
        if (step === undefined) {
          throw builderError(
            'doc/migration-gap',
            `No migration registered for format v${String(target)}; cannot reach v${String(LATEST_SCHEMA_VERSION)} from v${String(version)}.`,
            ['schemaVersion'],
          );
        }
        current = step(current);
        const migratedVersion = readVersion(current);
        if (migratedVersion !== target) {
          throw builderError(
            'doc/migration-gap',
            `Migration to v${String(target)} produced a document claiming v${String(migratedVersion)}.`,
            ['schemaVersion'],
          );
        }
      }

      return current;
    },
  };
}

function readVersion(raw: unknown): number {
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !('schemaVersion' in raw) ||
    typeof raw.schemaVersion !== 'number' ||
    !Number.isInteger((raw as { schemaVersion: number }).schemaVersion) ||
    (raw as { schemaVersion: number }).schemaVersion < 0
  ) {
    throw builderError(
      'doc/migration-gap',
      'Stored document must carry a non-negative integer schemaVersion.',
      ['schemaVersion'],
    );
  }
  return (raw as { schemaVersion: number }).schemaVersion;
}
