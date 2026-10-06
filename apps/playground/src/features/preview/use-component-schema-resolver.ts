import { useEffect } from 'react';

import { setCustomCodeComponentSchemaResolver, type BuilderKernel } from '@craftkit/builder';

/**
 * Judge a registered block placed INSIDE a custom-code tree by that block's
 * own props schema (style-manager DESIGN.md P11 fix pass).
 *
 * The schema package is layer 0 and cannot see the registry, so the tree door
 * accepted any JSON as a component's props until a host installed a resolver;
 * nothing did, and a wrong prop surfaced as an UnknownBlock three screens
 * later. While the editor is open the page's registry answers; an unknown
 * type is left to the AI door, which names it.
 */
export function useComponentSchemaResolver(kernel: BuilderKernel | undefined): void {
  useEffect(() => {
    if (kernel === undefined) return undefined;
    const registry = kernel.context.registry;
    setCustomCodeComponentSchemaResolver((type) => registry.block(type)?.schema.props);
    return () => {
      setCustomCodeComponentSchemaResolver(undefined);
    };
  }, [kernel]);
}
