/**
 * The Send slot's machine (SPEC §4.17), tested over EVERY input it can be given: three
 * run lives × empty or not × queued or not, with whitespace drafts on top. The table is
 * the spec's own table, row for row; the second half proves the one rule the old panel
 * broke (SPEC Appendix A.2): Stop is never in the Send slot, in any state, under any label.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { SendState } from './view-types';
import {
  RUN_LIVES,
  SEND_SLOT,
  SEND_STATES,
  sendState,
  type RunLife,
  type SendInputs,
  type SendSlot,
} from './send-state';

/** Every combination of the machine's three inputs, with a draft for each emptiness. */
function everyInput(): readonly SendInputs[] {
  const inputs: SendInputs[] = [];
  for (const run of RUN_LIVES) {
    for (const draft of ['', '   \n\t', 'Make the header sticky']) {
      for (const queued of [false, true]) {
        inputs.push({ run, draft, queued });
      }
    }
  }
  return inputs;
}

describe('sendState: SPEC §4.17, row by row', () => {
  it.each<[string, SendInputs, SendState]>([
    ['idle-empty: no run, empty draft', { run: 'idle', draft: '', queued: false }, 'idle-empty'],
    [
      'idle-ready: no run, draft',
      { run: 'idle', draft: 'A café page', queued: false },
      'idle-ready',
    ],
    [
      'running-empty: run live, empty draft',
      { run: 'live', draft: '', queued: false },
      'running-empty',
    ],
    [
      'running-ready: run live, draft, nothing queued',
      { run: 'live', draft: 'Make the header sticky', queued: false },
      'running-ready',
    ],
    [
      'running-queued: run live, the draft IS the queued request',
      { run: 'live', draft: 'Make the header sticky', queued: true },
      'running-queued',
    ],
    [
      'stopping, nothing queued: as running-ready',
      { run: 'stopping', draft: 'Make the header sticky', queued: false },
      'running-ready',
    ],
    [
      'stopping, queued: as running-queued',
      { run: 'stopping', draft: 'Make the header sticky', queued: true },
      'running-queued',
    ],
  ])('%s', (_name, inputs, expected) => {
    expect(sendState(inputs)).toBe(expected);
  });

  it('reads a whitespace-only draft as empty, because Enter would send nothing', () => {
    expect(sendState({ run: 'idle', draft: ' \n\t ', queued: false })).toBe('idle-empty');
    expect(sendState({ run: 'live', draft: '\n', queued: false })).toBe('running-empty');
  });

  it('lets an empty draft win over a queued flag: an empty request cannot be queued', () => {
    // The queued request IS the composer's text (SPEC §3.9), so clearing the box leaves
    // nothing that could run. The controller drops the queue; the slot must not say Queued.
    expect(sendState({ run: 'live', draft: '', queued: true })).toBe('running-empty');
    expect(sendState({ run: 'stopping', draft: '  ', queued: true })).toBe('running-empty');
  });

  it('ignores the queued flag while idle: a paused queue keeps its own text (SPEC §3.10)', () => {
    expect(sendState({ run: 'idle', draft: '', queued: true })).toBe('idle-empty');
    expect(sendState({ run: 'idle', draft: 'Add a pricing section', queued: true })).toBe(
      'idle-ready',
    );
  });

  it('treats stopping exactly as live for every draft and queue combination', () => {
    for (const draft of ['', 'x']) {
      for (const queued of [false, true]) {
        expect(sendState({ run: 'stopping', draft, queued })).toBe(
          sendState({ run: 'live', draft, queued }),
        );
      }
    }
  });

  it('is total: every input maps to one of the five states, and every state is reachable', () => {
    const reached = new Set(everyInput().map((input) => sendState(input)));
    expect([...reached].sort()).toEqual([...SEND_STATES].sort());
  });
});

describe('SEND_SLOT: what the slot shows and what Enter does, per state', () => {
  it.each<[SendState, SendSlot]>([
    ['idle-empty', { label: 'send', disabled: true, enter: 'nothing' }],
    ['idle-ready', { label: 'send', disabled: false, enter: 'send' }],
    ['running-empty', { label: 'send', disabled: true, enter: 'nothing' }],
    ['running-ready', { label: 'queue', disabled: false, enter: 'queue' }],
    ['running-queued', { label: 'queued', disabled: true, enter: 'announceQueued' }],
  ])('%s', (state, slot) => {
    expect(SEND_SLOT[state]).toEqual(slot);
  });

  it('has exactly one entry per state', () => {
    expect(Object.keys(SEND_SLOT).sort()).toEqual([...SEND_STATES].sort());
  });

  it('never yields Stop, under any input: not as a state, a label or an Enter action', () => {
    for (const input of everyInput()) {
      const state = sendState(input);
      const slot = SEND_SLOT[state];
      expect(state).not.toMatch(/stop/iu);
      expect(slot.label).not.toMatch(/stop/iu);
      expect(slot.enter).not.toMatch(/stop/iu);
    }
    // A double press on Send can never stop the run it started (SPEC Appendix A.2).
    expect(SEND_STATES).not.toContain('stopping');
  });

  it('types the Send slot so a Stop label cannot be added without a compile error', () => {
    expectTypeOf<SendSlot['label']>().toEqualTypeOf<'send' | 'queue' | 'queued'>();
    expectTypeOf<RunLife>().toEqualTypeOf<'idle' | 'live' | 'stopping'>();
    // @ts-expect-error: Stop is its own button (SPEC §4.17 StopButton), never a Send label.
    const stop: SendSlot['label'] = 'stop';
    expect(stop).toBe('stop');
  });
});
