import { describe, expect, it, vi } from 'vitest';

import type { SelectionCapability, SelectionTarget, SourceHandle } from '@craftkit/builder-schema';

import {
  createSelectionController,
  intersectSelectionCapabilities,
  reconcileSelection,
  type SelectionIdentityResolver,
} from './selection-controller';

const ALL: readonly SelectionCapability[] = [
  'inspect',
  'editText',
  'editProps',
  'editClasses',
  'editSource',
  'duplicate',
  'move',
  'delete',
  'insertInside',
];

const source = (revision = 'source-1'): SourceHandle => ({
  projectId: 'project',
  modulePath: 'pages/home/Page.tsx',
  sourceRevision: revision,
  astNodeId: 'hero-title',
  instanceKey: 'home-hero',
});

const target = (
  sourceOrNodeId: string | SourceHandle = 'hero',
  capabilities: readonly SelectionCapability[] = ALL,
): SelectionTarget => ({
  pageId: 'home',
  sourceOrNodeId,
  revision: 'site-1',
  capabilities: [...capabilities],
});

function resolver(): SelectionIdentityResolver & {
  siteRevision: string;
  nodes: Set<string>;
  sourceMatches: SourceHandle[];
  capabilities: readonly SelectionCapability[];
} {
  const state = {
    siteRevision: 'site-1',
    nodes: new Set(['hero', 'page']),
    sourceMatches: [source()],
    capabilities: ALL,
  };
  return {
    ...state,
    currentRevision: () => state.siteRevision,
    resolveNode: (_pageId, nodeId) =>
      state.nodes.has(nodeId) ? { identity: nodeId, capabilities: state.capabilities } : null,
    resolveSource: () =>
      state.sourceMatches.map((identity) => ({ identity, capabilities: state.capabilities })),
    parentOf: () => target('page'),
    get siteRevision() {
      return state.siteRevision;
    },
    set siteRevision(value: string) {
      state.siteRevision = value;
    },
    get nodes() {
      return state.nodes;
    },
    set nodes(value: Set<string>) {
      state.nodes = value;
    },
    get sourceMatches() {
      return state.sourceMatches;
    },
    set sourceMatches(value: SourceHandle[]) {
      state.sourceMatches = value;
    },
    get capabilities() {
      return state.capabilities;
    },
    set capabilities(value: readonly SelectionCapability[]) {
      state.capabilities = value;
    },
  };
}

describe('source-aware selection reconciliation', () => {
  it('updates site and source revisions only after one stable source identity resolves', () => {
    const truth = resolver();
    truth.siteRevision = 'site-2';
    truth.sourceMatches = [source('source-2')];
    const result = reconcileSelection([target(source())], truth);

    expect(result.invalidReason).toBeUndefined();
    expect(result.targets[0]).toMatchObject({
      revision: 'site-2',
      sourceOrNodeId: { astNodeId: 'hero-title', sourceRevision: 'source-2' },
    });
  });

  it.each([
    ['removed', [], 'missing-target'],
    ['ambiguous', [source('source-2'), source('source-2')], 'ambiguous-target'],
  ] as const)('clears a %s stale source instead of redirecting it', (_label, matches, reason) => {
    const truth = resolver();
    truth.sourceMatches = [...matches];
    expect(reconcileSelection([target(source())], truth)).toEqual({
      targets: [],
      capabilities: [],
      invalidReason: reason,
    });
  });

  it('clears a target when its live capability contract changed', () => {
    const truth = resolver();
    truth.capabilities = ['inspect', 'editSource'];
    expect(reconcileSelection([target('hero')], truth).invalidReason).toBe('capability-changed');
  });

  it('intersects capabilities for a multi-selection in stable command order', () => {
    expect(
      intersectSelectionCapabilities([
        target('a', ['delete', 'inspect', 'move']),
        target('b', ['inspect', 'delete']),
      ]),
    ).toEqual(['inspect', 'delete']);
  });

  it('keeps a captured request independent when a page switch clears visual selection', () => {
    const truth = resolver();
    const controller = createSelectionController({ pageId: 'home', resolver: truth });
    controller.select([target('hero')]);
    const captured = controller.capture();

    controller.setPage('about');

    expect(controller.getSnapshot()).toMatchObject({
      pageId: 'about',
      targets: [],
      invalidReason: 'page-changed',
    });
    expect(captured).toEqual([target('hero')]);
    expect(captured).not.toBe(controller.getSnapshot().targets);
  });

  it('publishes one state to every subscriber and selects a revalidated parent', () => {
    const truth = resolver();
    const controller = createSelectionController({ pageId: 'home', resolver: truth });
    const listener = vi.fn();
    controller.subscribe(listener);

    expect(controller.select([target('hero')]).targets).toHaveLength(1);
    expect(controller.selectParent()).toBe(true);
    expect(controller.getSnapshot().targets[0]?.sourceOrNodeId).toBe('page');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
