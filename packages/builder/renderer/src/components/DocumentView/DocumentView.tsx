import { useCallback } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

import type { RenderBreakpoint } from '../../resolve/responsive';
import { useKernelSelector } from '../../subscribe';
import { CustomCodeRegistryContext } from '../CustomCode';
import { StaticDocument } from '../StaticDocument';
import { NodeView, type InlineEditSeam } from './NodeView';

export type { InlineEditSeam };

export interface DocumentViewProps {
  /** Layer law: the kernel arrives BY PROP — this package never imports builder-react. */
  kernel: BuilderKernel;
  breakpoint?: RenderBreakpoint | undefined;
  /** Test/dev instrumentation (SC-002); no-op in production usage. */
  onBlockRender?: ((nodeId: NodeId) => void) | undefined;
  /** Edit-mode geometry attachment (005 contract §2); see NodeViewProps. */
  attachNodeElement?: ((id: NodeId, element: HTMLElement | null) => void) | undefined;
  /** Inline editing seam (009 §7): forwarded to the ONE node it names. */
  inlineEdit?: InlineEditSeam | undefined;
  /** False for preview: blocks stop rendering their editing-only scaffolding. */
  isCanvas?: boolean | undefined;
  /**
   * The shared regions this page references, in the order they should render.
   *
   * Resolved by the caller and handed in as DOCUMENTS, not as kernels, and the
   * distinction is the whole design (FR-004). A region belongs to the site, not
   * to any page: it has no page lens, and giving it one would make the same
   * header N editable trees whose divergence nobody would notice until two
   * pages disagreed.
   *
   * So a page RENDERS its regions and never owns them. One footer edit reaches
   * every page because every page was reading the same document all along —
   * not because N pages were rewritten.
   */
  regions?: readonly SharedRegionView[] | undefined;
}

export interface SharedRegionView {
  readonly id: string;
  readonly kind: 'header' | 'footer';
  readonly document: BuilderDocument;
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
  isCanvas,
  regions,
}: DocumentViewProps) {
  const rootId = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc.rootId,
      [],
    ),
  );
  /*
    Bound to the KERNEL, not to a render pass: the identity is stable for as
    long as this kernel is, so providing it never re-renders the tree. Runtime
    registration (FR-013) still lands, because `registry.block` reads through
    to whatever is registered at call time — `NodeView` subscribes to the
    registry epoch and re-renders, and this lookup then answers freshly.
  */
  const blockLookup = useCallback((type: string) => kernel.context.registry.block(type), [kernel]);
  const before = (regions ?? []).filter((region) => region.kind === 'header');
  const after = (regions ?? []).filter((region) => region.kind === 'footer');

  return (
    <CustomCodeRegistryContext.Provider value={blockLookup}>
      {before.map((region) => (
        <StaticDocument
          key={region.id}
          document={region.document}
          blocks={blockLookup}
          breakpoint={breakpoint}
        />
      ))}
      <NodeView
        kernel={kernel}
        id={rootId}
        breakpoint={breakpoint}
        onBlockRender={onBlockRender}
        attachNodeElement={attachNodeElement}
        inlineEdit={inlineEdit}
        isCanvas={isCanvas}
      />
      {after.map((region) => (
        <StaticDocument
          key={region.id}
          document={region.document}
          blocks={blockLookup}
          breakpoint={breakpoint}
        />
      ))}
    </CustomCodeRegistryContext.Provider>
  );
}
