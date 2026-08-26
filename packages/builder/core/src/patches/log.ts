import type { Transaction } from '@craftkit/builder-schema';

/**
 * Append-only in-memory transaction list — the session's source for replay.
 * Persistence coalescing/flush wiring arrives with the persistence story (US4).
 */
export class TransactionLog {
  private readonly entries: Transaction[] = [];

  append(tx: Transaction): void {
    this.entries.push(tx);
  }

  all(): readonly Transaction[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }
}
