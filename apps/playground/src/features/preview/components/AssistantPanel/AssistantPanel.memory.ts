import {
  createMemoryContextProvider,
  type AiMemoryRecordV1,
  type AiValidatedProposal,
} from '@craftkit/builder';
import { useState } from 'react';

/** How many applied changes the assistant carries forward. */
const MEMORY_LIMIT = 20;

export interface AppliedChangeMemory {
  /** Record that a proposal was applied. Host-authored facts only. */
  readonly note: (proposal: AiValidatedProposal) => void;
  /** Whether anything has been applied yet, for a caller deciding what to send. */
  readonly hasRecords: () => boolean;
  /**
   * The ledger as it stands, as a COPY.
   *
   * The provider does its own truncation on the way out, so this is the only
   * place the panel's own bound is visible — and the only way to prove it holds
   * over a long session.
   */
  readonly records: () => readonly AiMemoryRecordV1[];
  /** The provider that feeds those records into the next request's context. */
  readonly provider: ReturnType<typeof createMemoryContextProvider>;
}

/**
 * WHAT WAS ACTUALLY BUILT: bounded, host-authored outcome data only.
 *
 * Every record here is written by this panel from a proposal that already
 * passed the door — command names and a count, nothing else. Model rationale is
 * conversation text and is deliberately absent: it is the model's own words
 * about its own work, and feeding those back as `trust: 'reviewed'` memory
 * would let a run persuade its successors of something no one checked.
 *
 * The list is a plain mutable array owned by the closure, NOT state. Notes feed
 * the next request's context; they never drive a render, and making them state
 * would re-render the whole panel to store something no view reads.
 */
export function useAppliedChangeMemory(): AppliedChangeMemory {
  const [memory] = useState<AppliedChangeMemory>(() => {
    const records: AiMemoryRecordV1[] = [];
    return {
      note: (proposal: AiValidatedProposal) => {
        const commandNames = [...new Set(proposal.plan.commands.map(({ command }) => command))];
        records.push({
          schemaVersion: 1,
          source: 'host',
          kind: 'applied-change',
          trust: 'reviewed',
          summary: `Applied ${String(proposal.plan.commands.length)} validated Builder command${
            proposal.plan.commands.length === 1 ? '' : 's'
          }.`,
          commandNames,
        });
        /*
          Oldest out first, and this is about FOOTPRINT, not about the request.

          `createMemoryContextProvider` already caps what it sends at
          `AI_MEMORY_MAX_RECORDS`, so dropping here changes nothing the model
          sees. What it changes is the array: without it a long session grows a
          list that is read in full on every single request and never shrinks,
          to build a fragment that throws all but the last twenty away.
        */
        if (records.length > MEMORY_LIMIT) {
          records.shift();
        }
      },
      hasRecords: () => records.length > 0,
      records: () => [...records],
      /* A COPY on every load: the provider must not hand out a live handle to
         the ledger, or a consumer could append to the panel's own memory. */
      provider: createMemoryContextProvider({ load: () => [...records] }),
    };
  });
  return memory;
}
