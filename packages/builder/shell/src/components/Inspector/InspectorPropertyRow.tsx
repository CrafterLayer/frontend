import { memo } from 'react';

import type { z } from 'zod';

import { InspectorRowBody } from './InspectorRowBody';
import { effectiveValue } from './schema-facts';
import type { InspectorRowScope } from './types';
import { usePropertyValue } from './use-property-value';

export interface InspectorPropertyRowProps {
  readonly scope: InspectorRowScope;
  readonly propKey: string;
  readonly schema: z.ZodType;
  /** Explicitly declared caption for this cell when its block groups it into a pair. */
  readonly pairItemLabel?: string | undefined;
}

/**
 * The ONE memo boundary on rows. It subscribes to its own property (per-node
 * listener, three primitive reads) and hands document truth to the plain body;
 * a parent render with the same scope/propKey/schema/pairItemLabel never
 * reaches the body, and a write to another property never reaches this.
 */
export const InspectorPropertyRow = memo(function InspectorPropertyRow({
  scope,
  propKey,
  schema,
  pairItemLabel,
}: InspectorPropertyRowProps) {
  const { stored, override, hasOverride } = usePropertyValue(
    scope.kernel,
    scope.nodeId,
    propKey,
    scope.bucket,
  );
  const baseValue = effectiveValue(stored, schema);
  const value = scope.bucket === 'base' ? baseValue : override;
  return (
    <InspectorRowBody
      kernel={scope.kernel}
      nodeId={scope.nodeId}
      propKey={propKey}
      schema={schema}
      propertyKind={scope.declarations?.[propKey]?.kind}
      palette={scope.palette}
      onRetheme={scope.onRetheme}
      bucket={scope.bucket}
      value={value}
      baseValue={baseValue}
      hasOverride={hasOverride}
      catalogVersion={scope.catalogVersion}
      announce={scope.announce}
      dir={scope.dir}
      pairItemLabel={pairItemLabel}
      responsiveCapable
    />
  );
});
