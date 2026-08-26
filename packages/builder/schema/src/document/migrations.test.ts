import { describe, expect, it } from 'vitest';

import { BuilderError } from '../errors';
import { createMigrationRunner } from './migrations';
import { LATEST_SCHEMA_VERSION } from './types';

describe('createMigrationRunner', () => {
  it('passes a current-version document through untouched', () => {
    const runner = createMigrationRunner();
    const document = { schemaVersion: LATEST_SCHEMA_VERSION, rootId: 'r', nodes: {} };
    expect(runner.migrate(document)).toBe(document);
  });

  it('migrates step by step to the latest version', () => {
    const runner = createMigrationRunner({
      1: (raw) => ({ ...(raw as object), schemaVersion: 1, upgraded: true }),
    });
    const migrated = runner.migrate({ schemaVersion: 0 }) as { upgraded: boolean };
    expect(migrated.upgraded).toBe(true);
  });

  it('fails loudly on a version gap', () => {
    const runner = createMigrationRunner({});
    expect(() => runner.migrate({ schemaVersion: 0 })).toThrow(BuilderError);
    try {
      runner.migrate({ schemaVersion: 0 });
    } catch (error) {
      expect((error as BuilderError).code).toBe('doc/migration-gap');
    }
  });

  it('rejects documents newer than the supported format', () => {
    const runner = createMigrationRunner();
    expect(() => runner.migrate({ schemaVersion: LATEST_SCHEMA_VERSION + 1 })).toThrow(
      /newer than the supported/,
    );
  });

  it('rejects malformed version fields', () => {
    const runner = createMigrationRunner();
    for (const raw of [
      null,
      {},
      { schemaVersion: 'one' },
      { schemaVersion: 1.5 },
      { schemaVersion: -1 },
    ]) {
      expect(() => runner.migrate(raw)).toThrow(BuilderError);
    }
  });

  it('rejects a migration that lies about its produced version', () => {
    const runner = createMigrationRunner({
      1: (raw) => ({ ...(raw as object), schemaVersion: 99 }),
    });
    expect(() => runner.migrate({ schemaVersion: 0 })).toThrow(/claiming v99/);
  });
});
