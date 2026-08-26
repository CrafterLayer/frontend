import { useCallback } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { RenderBreakpoint } from '../../resolve/responsive';
import { useKernelSelector } from '../../subscribe';
import { NodeView, type InlineEditSeam } from './NodeView';

export type { InlineEditSeam };

export interface DocumentViewProps {
  /** Layer law: the kernel arrives BY PROP — this package never imports builder-react. */
  kernel: BuilderKernel;
  breakpoint?: RenderBreakpoint;
  /** Test/dev instrumentation (SC-002); no-op in production usage. */
  onBlockRender?: ((nodeId: NodeId) => void) | undefined;
  /** Edit-mode geometry attachment (005 contract §2); see NodeViewProps. */
  attachNodeElement?: ((id: NodeId, element: HTMLElement | null) => void) | undefined;
  /** Inline editing seam (009 §7): forwarded to the ONE node it names. */
  inlineEdit?: InlineEditSeam | undefined;
}

/**
 * The live document tree: renders the root NodeView and lets per-node
 * subscriptions do the rest — a change to one node re-renders exactly one block
 * view (FR-002/FR-003).
 */
export function DocumentView({
  kernel,
  breakpoint = 'desktop',
  onBlockRender,
  attachNodeElement,
  inlineEdit,
}: DocumentViewProps) {
  const rootId = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc.rootId,
      [],
    ),
  );
  return (
    <NodeView
      kernel={kernel}
      id={rootId}
      breakpoint={breakpoint}
      onBlockRender={onBlockRender}
      attachNodeElement={attachNodeElement}
      inlineEdit={inlineEdit}
    />
  );
}
