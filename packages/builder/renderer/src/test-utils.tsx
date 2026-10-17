import type { BlockRenderProps, TrustedExtensionManifest } from '@craftkit/builder-schema';

/**
 * Test-only helper: wrap a trusted manifest's block SCHEMAS with pass-through
 * renderers that actually render their slots (embedding resolved props as a data
 * attribute), so tree-walk, re-render-count, and breakpoint tests can observe the
 * full document. The kernel's own fixtures stay headless by design — their null
 * renderers never mount children.
 */
export function withPassThroughRenderers(
  manifest: TrustedExtensionManifest,
): TrustedExtensionManifest {
  function PassThroughBlock({ node, props, slots }: BlockRenderProps) {
    return (
      <div data-node-id={node.id} data-node-type={node.type} data-props={JSON.stringify(props)}>
        {Object.values(slots)}
      </div>
    );
  }

  return {
    ...manifest,
    name: `${manifest.name}-passthrough`,
    contributes: {
      ...manifest.contributes,
      blocks: (manifest.contributes?.blocks ?? []).map((contribution) => ({
        schema: contribution.schema,
        render: PassThroughBlock,
      })),
    },
  };
}
