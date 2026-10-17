import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveRunLease } from './AssistantPanel.runs';
import type { QueuedAssistantRequest } from './AssistantPanel.types';
import { createAssistantKernel } from './AssistantPanel.test-helpers';
import { useRunQueue, type RunQueueInputs } from './use-run-queue';
import type { SiteRunSeam } from './use-site-run';

function setup(overrides: Partial<RunQueueInputs> = {}) {
  const activeRunRef: { current: ActiveRunLease | null } = { current: null };
  let seam: SiteRunSeam | null = null;
  const inputs: RunQueueInputs = {
    kernel: createAssistantKernel(),
    ask: vi.fn(() => Promise.resolve()),
    busy: false,
    setBusy: vi.fn(),
    queuedRequest: null,
    setQueuedRequest: vi.fn(),
    queuePaused: false,
    setQueuePaused: vi.fn(),
    activeRunRef,
    onSiteSeam: (next) => {
      seam = next;
    },
    ...overrides,
  };
  const hook = renderHook((props: RunQueueInputs) => useRunQueue(props), { initialProps: inputs });
  return { ...hook, inputs, activeRunRef, seam: () => seam };
}

const queued = (
  selection: readonly string[],
  targetTypes: readonly string[],
): QueuedAssistantRequest => ({
  request: 'add a pricing section',
  context: 'the whole page',
  selection,
  targetTypes,
  state: 'editable',
});

describe('useRunQueue (one run lease)', () => {
  it('hands the host ONE lease: a second claim is refused until the owner releases it', () => {
    const { seam, inputs, activeRunRef } = setup();
    const lease = seam();
    expect(lease).not.toBeNull();
    const controller = new AbortController();
    expect(lease?.claim('site-1', controller)).toBe(true);
    expect(inputs.setBusy).toHaveBeenLastCalledWith(true);
    expect(lease?.claim('site-2', new AbortController())).toBe(false);
    lease?.release('someone-else');
    expect(activeRunRef.current?.runId).toBe('site-1');
    lease?.release('site-1');
    expect(activeRunRef.current).toBeNull();
    expect(inputs.setBusy).toHaveBeenLastCalledWith(false);
  });

  it('Stop aborts whichever run holds the lease, and pauses a queued request', () => {
    const controller = new AbortController();
    const { result, inputs, activeRunRef } = setup({ busy: true, queuedRequest: queued([], []) });
    activeRunRef.current = { runId: 'run-1', controller };
    result.current();
    expect(controller.signal.aborted).toBe(true);
    expect(inputs.setQueuePaused).toHaveBeenCalledWith(true);
  });

  it('runs the queued request once the panel is free, with the selection it was asked about', () => {
    const request = queued(['selected-hero'], ['hero']);
    const { inputs } = setup({ queuedRequest: request });
    expect(inputs.setQueuedRequest).toHaveBeenCalledWith(null);
    expect(inputs.ask).toHaveBeenCalledWith('add a pricing section', 'typed', ['selected-hero']);
  });

  it('never runs a queued request whose target is gone — it is marked missing instead', () => {
    const { inputs } = setup({ queuedRequest: queued(['vanished'], ['hero']) });
    expect(inputs.ask).not.toHaveBeenCalled();
    expect(inputs.setQueuedRequest).toHaveBeenCalledTimes(1);
  });

  it('holds the queue while a run is busy or the person paused it', () => {
    const busy = setup({ busy: true, queuedRequest: queued([], []) });
    expect(busy.inputs.ask).not.toHaveBeenCalled();
    const paused = setup({ queuePaused: true, queuedRequest: queued([], []) });
    expect(paused.inputs.ask).not.toHaveBeenCalled();
  });
});
