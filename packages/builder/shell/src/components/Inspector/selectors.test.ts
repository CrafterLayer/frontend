import { describe, expect, it } from 'vitest';

import type { BuilderDocument } from '@craftkit/builder-schema';

import { selectDir, selectSelectedId, selectSelectedLabel, selectSelectedType } from './selectors';
import type { KernelState } from './types';

const doc: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'rtl',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['a', 'b'] } },
    a: { id: 'a', type: 'card', props: { label: 'Named' } },
    b: { id: 'b', type: 'card', props: { label: 7 } },
  },
};

const state = (selection: string[]): KernelState => ({
  doc,
  selection,
  elementFocus: null,
  seq: 0,
});

describe('selectors', () => {
  it('selects the first id, its type and its string label', () => {
    expect(selectSelectedId(state(['a', 'b']))).toBe('a');
    expect(selectSelectedType(state(['a']))).toBe('card');
    expect(selectSelectedLabel(state(['a']))).toBe('Named');
  });

  it('answers null for no selection, a stale id and a non-string label', () => {
    expect(selectSelectedId(state([]))).toBeNull();
    expect(selectSelectedType(state([]))).toBeNull();
    expect(selectSelectedType(state(['gone']))).toBeNull();
    expect(selectSelectedLabel(state(['gone']))).toBeNull();
    expect(selectSelectedLabel(state(['b']))).toBeNull();
    expect(selectSelectedLabel(state(['root']))).toBeNull();
  });

  it('reads the document direction', () => {
    expect(selectDir(state([]))).toBe('rtl');
  });
});
