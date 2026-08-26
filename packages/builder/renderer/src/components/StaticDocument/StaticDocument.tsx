import type { BuilderDocument, RegisteredBlock } from '@craftkit/builder-schema';

import type { RenderBreakpoint } from '../../resolve/responsive';
import { StaticNode } from './StaticNode';

export interface StaticDocumentProps {
  document: BuilderDocument;
  /** Block lookup (003 `RegistryRead.block` shape) — no kernel required. */
  blocks: (type: string) => RegisteredBlock | undefined;
  breakpoint?: RenderBreakpoint;
}

/**
 * Publish-grade rendering: a PURE function of (document, blocks, breakpoint) —
 * identical input, identical output, no subscriptions, no kernel (FR-006).
 */
export function StaticDocument({ document, blocks, breakpoint = 'desktop' }: StaticDocumentProps) {
  return (
    <StaticNode document={document} id={document.rootId} blocks={blocks} breakpoint={breakpoint} />
  );
}
