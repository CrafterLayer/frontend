import type { Node, NodeId } from '../document/types';
import {
  assetEntrySchema,
  assetRefSchema,
  type AssetEntry,
  type AssetId,
  type AssetRef,
} from './types';

export interface AssetEntryValidationIssue {
  code: 'invalid-asset-entry';
  message: string;
  path: readonly (string | number)[];
}

export type AssetEntryValidationResult =
  { ok: true; entry: AssetEntry } | { ok: false; issues: readonly AssetEntryValidationIssue[] };

export interface CollectedAssetRef {
  nodeId: NodeId;
  propPath: readonly (string | number)[];
  ref: AssetRef;
}

export interface AssetReferenceIssue {
  code: 'unresolved-asset-reference';
  message: string;
  nodeId: NodeId;
  propPath: readonly (string | number)[];
  assetId: AssetId;
}

type FlatNodeMap = Readonly<Record<NodeId, Pick<Node, 'props' | 'responsive'>>>;

export function isAssetRef(value: unknown): value is AssetRef {
  /*
    A cheap necessary condition first, the schema still decides (2026-10-12).
    `collectFromValue` asks this of EVERY value in every prop tree — strings,
    numbers, arrays, nested objects — and nearly all of them fail. A failing
    `safeParse` builds a whole ZodError, which made this one call ~90% of
    `validateSite` and `validateSite` the cost of every site dispatch (measured
    in Node: 234 of 264 ms on a 20-page landing site, 7.6 of 9.5 ms on one).
    A value that is not an object, or whose `assetId` is not a string, can never
    pass `z.strictObject({ assetId: z.string() })`, so skipping the parse for it
    changes no answer.
  */
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (typeof (value as { readonly assetId?: unknown }).assetId !== 'string') return false;
  return assetRefSchema.safeParse(value).success;
}

export function validateAssetEntry(value: unknown): AssetEntryValidationResult {
  const parsed = assetEntrySchema.safeParse(value);
  if (parsed.success) {
    return { ok: true, entry: parsed.data };
  }

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      code: 'invalid-asset-entry',
      message: `Asset entry is malformed: ${issue.message}`,
      /*
        zod types a path segment as PropertyKey, which admits `symbol`. A symbol
        can never address anything inside an AssetEntry: the entry is JSON, and
        JSON has no symbol keys. Narrowing here keeps `symbol` out of this
        package's public issue type rather than leaking it to every consumer.
      */
      path: issue.path.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number',
      ),
    })),
  };
}

/** Finds asset references in base props and breakpoint-specific prop overrides. */
export function collectAssetRefs(nodes: FlatNodeMap): readonly CollectedAssetRef[] {
  const refs: CollectedAssetRef[] = [];

  for (const [nodeId, node] of Object.entries(nodes)) {
    collectFromValue(node.props, nodeId, [], refs, new Set());
    for (const [breakpoint, override] of Object.entries(node.responsive ?? {})) {
      collectFromValue(override, nodeId, ['responsive', breakpoint], refs, new Set());
    }
  }

  return refs;
}

export function validateAssetReferences(
  nodes: FlatNodeMap,
  assets: Readonly<Record<AssetId, AssetEntry>>,
): readonly AssetReferenceIssue[] {
  return unresolvedAssetReferences(collectAssetRefs(nodes), assets);
}

/**
 * The references among `refs` that `assets` does not hold. Split from
 * `validateAssetReferences` (2026-10-12) so the site door can reuse an
 * unchanged page's collected refs and still answer against the CURRENT table.
 */
export function unresolvedAssetReferences(
  refs: readonly CollectedAssetRef[],
  assets: Readonly<Record<AssetId, AssetEntry>>,
): readonly AssetReferenceIssue[] {
  return refs.flatMap(({ ref, nodeId, propPath }) => {
    const { assetId } = ref;
    if (Object.hasOwn(assets, assetId)) {
      return [];
    }
    return [
      {
        code: 'unresolved-asset-reference' as const,
        message: `Node "${nodeId}" references unknown asset "${assetId}" at ${formatPropPath(propPath)}.`,
        nodeId,
        propPath,
        assetId,
      },
    ];
  });
}

function collectFromValue(
  value: unknown,
  nodeId: NodeId,
  propPath: readonly (string | number)[],
  refs: CollectedAssetRef[],
  ancestors: Set<object>,
): void {
  if (isAssetRef(value)) {
    refs.push({ nodeId, propPath, ref: value });
    return;
  }
  if (value === null || typeof value !== 'object' || ancestors.has(value)) {
    return;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        collectFromValue(item, nodeId, [...propPath, index], refs, ancestors);
      });
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      collectFromValue(item, nodeId, [...propPath, key], refs, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function formatPropPath(path: readonly (string | number)[]): string {
  return path.join('.');
}
