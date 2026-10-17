import { builderError, type Breakpoint, type JsonValue, type Node } from '@craftkit/builder-schema';

export type RenderBreakpoint = 'desktop' | Breakpoint;

const CASCADE: Record<RenderBreakpoint, readonly Breakpoint[]> = {
  desktop: [],
  tablet: ['tablet'],
  // The 003 cascade law: mobile inherits tablet overrides unless it overrides them itself.
  mobile: ['tablet', 'mobile'],
};

/**
 * Resolve a node's props for one breakpoint per the kernel cascade
 * (base ← tablet ← mobile). Desktop is the untouched base. Unknown breakpoints
 * are a caller error, rejected loudly.
 */
export function resolveResponsiveProps(
  node: Node,
  breakpoint: RenderBreakpoint,
): Record<string, JsonValue> {
  const chain = CASCADE[breakpoint] as readonly Breakpoint[] | undefined;
  if (chain === undefined) {
    throw builderError(
      'doc/invalid-props',
      `Unknown breakpoint "${breakpoint as string}"; use desktop, tablet, or mobile.`,
    );
  }
  if (chain.length === 0 || node.responsive === undefined) {
    return node.props;
  }

  let resolved = node.props;
  let copied = false;
  for (const step of chain) {
    const override = node.responsive[step];
    if (override === undefined) {
      continue;
    }
    if (!copied) {
      resolved = { ...resolved };
      copied = true;
    }
    Object.assign(resolved, override);
  }
  return resolved;
}
