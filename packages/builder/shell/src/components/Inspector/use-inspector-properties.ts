import { useCallback, useMemo } from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import { useKernelSelector } from '@craftkit/builder-renderer';
import {
  blockPartsOf,
  type BlockSchema,
  type FieldTypeDef,
  type NodeId,
} from '@craftkit/builder-schema';

import { fieldSiblingsOf, isFieldRowHidden } from '../../fields/field-visibility';
import { propsShapeOf, resolveField } from '../../fields/resolve-field';
import type { ErasedPropertyGroups, InspectorProperty, KernelState } from './types';

interface Candidate {
  readonly property: InspectorProperty;
  /** The `hidden` rule of the field type this row resolves to, if any. */
  readonly hidden: FieldTypeDef['hidden'];
}

const NO_CANDIDATES: readonly Candidate[] = [];

/** A contribution's match, contained like resolveField's: a throw is no match. */
function matches(def: FieldTypeDef, schema: z.ZodType): boolean {
  try {
    return def.match(schema) > 0;
  } catch {
    return false;
  }
}

/**
 * The selected block's rows, in declaration order, minus the props a field
 * type leaves out (`FieldTypeDef.hidden`): Studio-written data that is never
 * edited as fields, or a group of controls with nothing to control yet.
 *
 * A prop that a hiding field type matches is resolved exactly as its row
 * would resolve it (declared kind, part bindings, contributions), once per
 * block and catalog generation; no other prop is resolved here at all. A
 * value-dependent rule is read as ONE primitive — the hidden keys — so a prop
 * edit renders the panel only when it shows or hides a row, never otherwise.
 */
export function useInspectorProperties(
  kernel: BuilderKernel,
  blockSchema: BlockSchema | undefined,
  nodeId: NodeId | null,
  catalogVersion: number,
): readonly InspectorProperty[] {
  const candidates = useMemo<readonly Candidate[]>(() => {
    void catalogVersion; // the memo's real dependency: a late registration
    if (blockSchema === undefined) return NO_CANDIDATES;
    const registry = kernel.context.registry;
    const hiders = registry.fieldTypes().filter((def) => (def.hidden ?? false) !== false);
    const parts = blockPartsOf(blockSchema);
    const groups = blockSchema.propertyGroups as ErasedPropertyGroups | undefined;
    return Object.entries(propsShapeOf(blockSchema.props)).map(([key, schema]) => {
      // Only a prop some hiding field type matches is resolved here; every
      // other row resolves once, when it mounts (the render-count contract).
      if (!hiders.some((def) => matches(def, schema))) {
        return { property: [key, schema] as const, hidden: undefined };
      }
      const resolved = resolveField(registry, schema, groups?.[key]?.kind, {
        parts,
        propPath: [key],
      });
      return {
        property: [key, schema] as const,
        hidden: resolved.kind === 'contributed' ? resolved.def.hidden : undefined,
      };
    });
  }, [kernel, blockSchema, catalogVersion]);

  const selectHidden = useCallback(
    (state: KernelState): string => {
      const props = nodeId === null ? undefined : state.doc.nodes[nodeId]?.props;
      const shape = blockSchema === undefined ? {} : propsShapeOf(blockSchema.props);
      const hidden = candidates
        .filter(({ property: [key], hidden: rule }) =>
          isFieldRowHidden(rule, () => ({
            value: props?.[key],
            siblings: fieldSiblingsOf(shape, props, key),
          })),
        )
        .map(({ property: [key] }) => key);
      return JSON.stringify(hidden);
    },
    [candidates, nodeId, blockSchema],
  );
  const hiddenKeys = useKernelSelector(kernel, selectHidden);

  return useMemo(() => {
    const hidden = new Set(JSON.parse(hiddenKeys) as string[]);
    return candidates
      .filter(({ property: [key] }) => !hidden.has(key))
      .map(({ property }) => property);
  }, [candidates, hiddenKeys]);
}
