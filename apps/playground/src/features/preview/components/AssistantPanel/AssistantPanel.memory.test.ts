import type { AiMemoryRecordV1, AiValidatedProposal } from '@craftkit/builder';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppliedChangeMemory } from './AssistantPanel.memory';

/** A proposal is only ever noted AFTER it passed the door, so a stub is enough. */
function proposalWith(commands: readonly string[]): AiValidatedProposal {
  return {
    schemaVersion: 1,
    plan: { rationale: '', commands: commands.map((command) => ({ command, args: {} })) },
    policy: { allowedCommands: [], maxCommands: 0, maxOperations: 0 },
    skillActivations: [],
    contextFingerprint: 'sha256-context',
    proposalFingerprint: 'sha256-proposal',
  } as unknown as AiValidatedProposal;
}

const memoryOf = () => renderHook(() => useAppliedChangeMemory()).result;

/** The ledger as it stands. */
const collected = (memory: ReturnType<typeof memoryOf>): readonly AiMemoryRecordV1[] =>
  memory.current.records();

describe('useAppliedChangeMemory', () => {
  it('starts empty', () => {
    expect(memoryOf().current.hasRecords()).toBe(false);
  });

  it('records an applied change as a host-authored, reviewed fact', () => {
    const memory = memoryOf();
    memory.current.note(proposalWith(['insertNode', 'setProp']));
    const [record] = collected(memory);
    expect(record).toMatchObject({
      schemaVersion: 1,
      source: 'host',
      kind: 'applied-change',
      trust: 'reviewed',
    });
  });

  it('keeps the command NAMES and nothing the model wrote', () => {
    const memory = memoryOf();
    memory.current.note(proposalWith(['insertNode', 'setProp']));
    const [record] = collected(memory);
    expect(record?.commandNames).toEqual(['insertNode', 'setProp']);
    expect(JSON.stringify(record)).not.toContain('rationale');
  });

  it('names each command once, however many times the plan used it', () => {
    const memory = memoryOf();
    memory.current.note(proposalWith(['setProp', 'setProp', 'setProp']));
    expect(collected(memory)[0]?.commandNames).toEqual(['setProp']);
  });

  it('counts the commands, in the singular when there was one', () => {
    const memory = memoryOf();
    memory.current.note(proposalWith(['insertNode']));
    memory.current.note(proposalWith(['insertNode', 'setProp']));
    const summaries = collected(memory).map((record) => record.summary);
    expect(summaries[0]).toBe('Applied 1 validated Builder command.');
    expect(summaries[1]).toBe('Applied 2 validated Builder commands.');
  });

  it('carries at most twenty, dropping the OLDEST — a session must not grow a list forever', () => {
    const memory = memoryOf();
    for (let index = 0; index < 25; index += 1) {
      memory.current.note(proposalWith([`command-${String(index)}`]));
    }
    const records = collected(memory);
    expect(records).toHaveLength(20);
    expect(records[0]?.commandNames).toEqual(['command-5']);
    expect(records.at(-1)?.commandNames).toEqual(['command-24']);
  });

  it('hands out a COPY, so a reader cannot append to the panel’s own ledger', () => {
    const memory = memoryOf();
    memory.current.note(proposalWith(['insertNode']));
    /*
      Written onto exactly what `records()` handed back, cast past `readonly`
      on purpose. Copying it here first would make this test pass against a
      live handle too — which is the mistake, not the guard.
    */
    const borrowed = memory.current.records() as AiMemoryRecordV1[];
    borrowed.push(borrowed[0]!);
    expect(memory.current.records()).toHaveLength(1);
  });

  it('survives a re-render with its records intact', () => {
    const { result, rerender } = renderHook(() => useAppliedChangeMemory());
    result.current.note(proposalWith(['insertNode']));
    rerender();
    expect(result.current.hasRecords()).toBe(true);
    expect(collected(result)).toHaveLength(1);
  });
});
