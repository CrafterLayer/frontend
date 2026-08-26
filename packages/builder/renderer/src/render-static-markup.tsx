import { renderToStaticMarkup } from 'react-dom/server';

import type { BuilderDocument, RegisteredBlock } from '@craftkit/builder-schema';

import { StaticDocument } from './components/StaticDocument';
import type { RenderBreakpoint } from './resolve/responsive';

export interface RenderStaticOptions {
  blocks: (type: string) => RegisteredBlock | undefined;
  breakpoint?: RenderBreakpoint;
}

/**
 * The string form of the pure static render — the seed of the publish/diff
 * pipeline (and of the round-trip laws in later milestones).
 */
export function renderStaticMarkup(
  document: BuilderDocument,
  options: RenderStaticOptions,
): string {
  return renderToStaticMarkup(
    <StaticDocument
      document={document}
      blocks={options.blocks}
      breakpoint={options.breakpoint ?? 'desktop'}
    />,
  );
}
