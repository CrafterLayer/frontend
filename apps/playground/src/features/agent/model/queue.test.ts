/**
 * The one queued request (SPEC §3.9, FR-025/026/054): revalidated against the page before
 * it runs. A target that is gone (or became another kind of block) is `missing` and cannot
 * run; one that changed is `stale` and runs, rechecked; a paused request waits for Continue.
 */
import { describe, expect, it } from 'vitest';

import { createEditKernel } from '../testing/scripted-engine';
import { contextChips, queueRequest, queueStatus, queueView, revalidateQueue } from './queue';

describe('the queued request', () => {
  it('is editable while its target is unchanged, stale once it changed, missing once gone', () => {
    const kernel = createEditKernel();
    const queue = queueRequest(
      'make it darker',
      [{ kind: 'selection', id: 'selected-hero', label: 'Hero' }],
      kernel.getDocument(),
    );
    expect(queueStatus(queue, kernel.getDocument())).toBe('editable');
    expect(revalidateQueue(queue, kernel.getDocument())).toBe('ready');

    kernel.dispatch('setProp', { id: 'selected-hero', key: 'heading', value: 'Changed' });
    expect(queueStatus(queue, kernel.getDocument())).toBe('stale');

    kernel.dispatch('removeNode', { id: 'selected-hero' });
    expect(queueStatus(queue, kernel.getDocument())).toBe('missing');
    expect(queueView(queue, kernel.getDocument()).chips).toEqual([
      { kind: 'selection', id: 'selected-hero', label: 'Hero', stale: true },
    ]);
  });

  it('pauses over everything else, and a whole-page request has nothing to go missing', () => {
    const kernel = createEditKernel();
    const queue = queueRequest('add a pricing section', [{ kind: 'page' }], kernel.getDocument());
    expect(queue.targets).toEqual([]);
    kernel.dispatch('removeNode', { id: 'selected-hero' });
    expect(queueStatus(queue, kernel.getDocument())).toBe('editable');
    expect(queueStatus({ ...queue, paused: true }, kernel.getDocument())).toBe('paused');
    expect(contextChips([], kernel.getDocument())).toEqual([{ kind: 'page', id: 'page' }]);
  });
});
