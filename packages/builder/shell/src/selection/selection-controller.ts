import type { SelectionCapability, SelectionTarget, SourceHandle } from '@craftkit/builder-schema';

export type SelectionInvalidReason =
  | 'page-changed'
  | 'revision-unavailable'
  | 'missing-target'
  | 'ambiguous-target'
  | 'capability-changed'
  | 'mixed-pages'
  | 'duplicate-target';

export interface ResolvedSelectionIdentity<TIdentity extends string | SourceHandle> {
  readonly identity: TIdentity;
  readonly capabilities: readonly SelectionCapability[];
}

/**
 * The resolver is the only bridge from selection view state to current document/source truth.
 * Source resolution returns a list because a stale AST identity can become ambiguous after an edit;
 * ambiguity must clear the selection instead of picking the first rendered match.
 */
export interface SelectionIdentityResolver {
  currentRevision(pageId: string): string | undefined;
  resolveNode(pageId: string, nodeId: string): ResolvedSelectionIdentity<string> | null;
  resolveSource(
    pageId: string,
    handle: SourceHandle,
  ): readonly ResolvedSelectionIdentity<SourceHandle>[];
  parentOf?(target: SelectionTarget): SelectionTarget | null;
}

export interface SelectionSnapshot {
  readonly pageId: string;
  readonly targets: readonly SelectionTarget[];
  readonly capabilities: readonly SelectionCapability[];
  readonly invalidReason?: SelectionInvalidReason;
}

export interface SelectionReconciliation {
  readonly targets: readonly SelectionTarget[];
  readonly capabilities: readonly SelectionCapability[];
  readonly invalidReason?: SelectionInvalidReason;
}

export interface SelectionController {
  getSnapshot(): SelectionSnapshot;
  subscribe(listener: () => void): () => void;
  setPage(pageId: string): void;
  select(targets: readonly SelectionTarget[]): SelectionReconciliation;
  reconcile(): SelectionReconciliation;
  selectParent(): boolean;
  clear(reason?: SelectionInvalidReason): void;
  capture(): readonly SelectionTarget[];
}

const CAPABILITY_ORDER: readonly SelectionCapability[] = [
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

function orderedCapabilities(
  capabilities: ReadonlySet<SelectionCapability>,
): readonly SelectionCapability[] {
  return CAPABILITY_ORDER.filter((capability) => capabilities.has(capability));
}

export function intersectSelectionCapabilities(
  targets: readonly Pick<SelectionTarget, 'capabilities'>[],
): readonly SelectionCapability[] {
  const first = targets[0];
  if (first === undefined) return [];
  const common = new Set(first.capabilities);
  for (const target of targets.slice(1)) {
    for (const capability of common) {
      if (!target.capabilities.includes(capability)) common.delete(capability);
    }
  }
  return orderedCapabilities(common);
}

function sameCapabilities(
  left: readonly SelectionCapability[],
  right: readonly SelectionCapability[],
): boolean {
  const normalizedLeft = orderedCapabilities(new Set(left));
  const normalizedRight = orderedCapabilities(new Set(right));
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((capability, index) => capability === normalizedRight[index])
  );
}

function sourceKey(source: string | SourceHandle): string {
  return typeof source === 'string'
    ? `node:${source}`
    : `source:${source.projectId}:${source.modulePath}:${source.astNodeId}:${source.instanceKey ?? ''}`;
}

function copyTarget(target: SelectionTarget): SelectionTarget {
  return {
    ...target,
    sourceOrNodeId:
      typeof target.sourceOrNodeId === 'string'
        ? target.sourceOrNodeId
        : { ...target.sourceOrNodeId },
    capabilities: [...target.capabilities],
  };
}

function refused(invalidReason: SelectionInvalidReason): SelectionReconciliation {
  return { targets: [], capabilities: [], invalidReason };
}

export function reconcileSelection(
  targets: readonly SelectionTarget[],
  resolver: SelectionIdentityResolver,
): SelectionReconciliation {
  if (targets.length === 0) return { targets: [], capabilities: [] };
  const pageId = targets[0]?.pageId;
  if (pageId === undefined || targets.some((target) => target.pageId !== pageId)) {
    return refused('mixed-pages');
  }
  const revision = resolver.currentRevision(pageId);
  if (revision === undefined) return refused('revision-unavailable');

  const reconciled: SelectionTarget[] = [];
  const identities = new Set<string>();
  for (const target of targets) {
    const previousIdentity = target.sourceOrNodeId;
    const resolved =
      typeof previousIdentity === 'string'
        ? resolver.resolveNode(pageId, previousIdentity)
        : (() => {
            const matches = resolver.resolveSource(pageId, previousIdentity);
            if (matches.length > 1) return 'ambiguous' as const;
            return matches[0] ?? null;
          })();
    if (resolved === 'ambiguous') return refused('ambiguous-target');
    if (resolved === null) return refused('missing-target');
    if (!sameCapabilities(target.capabilities, resolved.capabilities)) {
      return refused('capability-changed');
    }
    const identityKey = sourceKey(resolved.identity);
    if (identities.has(identityKey)) return refused('duplicate-target');
    identities.add(identityKey);
    reconciled.push({
      pageId,
      sourceOrNodeId:
        typeof resolved.identity === 'string' ? resolved.identity : { ...resolved.identity },
      revision,
      capabilities: [...orderedCapabilities(new Set(resolved.capabilities))],
    });
  }
  return {
    targets: reconciled,
    capabilities: intersectSelectionCapabilities(reconciled),
  };
}

function sameSnapshot(left: SelectionSnapshot, right: SelectionSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** One source-aware selection state for canvas, layers, inspector, Agent and chrome. */
export function createSelectionController(options: {
  readonly pageId: string;
  readonly resolver: SelectionIdentityResolver;
}): SelectionController {
  const { resolver } = options;
  let snapshot: SelectionSnapshot = {
    pageId: options.pageId,
    targets: [],
    capabilities: [],
  };
  const listeners = new Set<() => void>();

  const publish = (next: SelectionSnapshot) => {
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  const apply = (result: SelectionReconciliation): SelectionReconciliation => {
    publish({ pageId: snapshot.pageId, ...result });
    return result;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setPage(pageId) {
      if (pageId === snapshot.pageId) {
        apply(reconcileSelection(snapshot.targets, resolver));
        return;
      }
      publish({ pageId, targets: [], capabilities: [], invalidReason: 'page-changed' });
    },
    select(targets) {
      if (targets.some((target) => target.pageId !== snapshot.pageId)) {
        return apply(refused('mixed-pages'));
      }
      return apply(reconcileSelection(targets, resolver));
    },
    reconcile() {
      return apply(reconcileSelection(snapshot.targets, resolver));
    },
    selectParent() {
      const target = snapshot.targets.length === 1 ? snapshot.targets[0] : undefined;
      const parent = target === undefined ? null : (resolver.parentOf?.(target) ?? null);
      if (parent === null) return false;
      return this.select([parent]).targets.length === 1;
    },
    clear(reason) {
      publish({
        pageId: snapshot.pageId,
        targets: [],
        capabilities: [],
        ...(reason === undefined ? {} : { invalidReason: reason }),
      });
    },
    capture() {
      return snapshot.targets.map(copyTarget);
    },
  };
}
