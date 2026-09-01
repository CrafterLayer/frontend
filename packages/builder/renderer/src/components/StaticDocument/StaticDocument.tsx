import type { CSSProperties } from 'react';

import type { BuilderDocument, RegisteredBlock } from '@craftkit/builder-schema';

import type { RenderBreakpoint } from '../../resolve/responsive';
import { type Theme, tokenCssName } from '../../resolve/theme';
import { CustomCodeRegistryContext } from '../CustomCode';
import { StaticNode } from './StaticNode';

export interface StaticDocumentProps {
  document: BuilderDocument;
  /** Block lookup (003 `RegistryRead.block` shape) — no kernel required. */
  blocks: (type: string) => RegisteredBlock | undefined;
  breakpoint?: RenderBreakpoint;
  /**
   * The design system this page is published with.
   *
   * Optional, and the omission is meaningful rather than lazy: a page rendered
   * without one falls back to the defaults baked into the Tailwind theme
   * bridge, which is what a fragment embedded in a host page that already owns
   * its tokens should do.
   */
  theme?: Theme;
}

/**
 * Turn a theme into inline custom properties.
 *
 * Inline, not a `<style>` rule, because this render is a FRAGMENT. A rule has
 * to name a selector, and the only selector that reaches the whole fragment is
 * `:root` — which would reach the host page too and restyle whatever it was
 * embedded in. Inline properties cascade down and stop at the fragment's edge.
 */
function themeCustomProperties(theme: Theme): CSSProperties {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme)) {
    style[tokenCssName(name as keyof Theme)] = value;
  }
  return style;
}

/**
 * Publish-grade rendering: a PURE function of (document, blocks, breakpoint,
 * theme) — identical input, identical output, no subscriptions, no kernel
 * (FR-006).
 *
 * ## Why the theme is rendered here at all
 *
 * `--t-*` used to be written by exactly one thing in the product:
 * `CanvasFrame`, into the EDITOR's preview frame. Publishing emitted none, and
 * that was survivable only for as long as the blocks were styled by
 * stylesheets reading `var(--t-space-unit, 4px)` — the fallbacks in those
 * files were quietly holding a published page together. The Tailwind migration
 * deleted the stylesheets, and the theme bridge now carries the same fallbacks
 * so that a page still lays out. But a fallback is a DEFAULT: it can keep a
 * page from collapsing, and it cannot express the design system a site
 * generated for itself. Without this, every published page was the starter
 * palette regardless of what the document was designed with.
 */
export function StaticDocument({
  document,
  blocks,
  breakpoint = 'desktop',
  theme,
}: StaticDocumentProps) {
  /*
    The same `blocks` lookup this path already takes IS what a custom-code
    tree needs to resolve a component reference — which is why the context
    carries a lookup function rather than a kernel. Publishing therefore
    resolves references identically to the canvas, with no kernel present.
  */
  const tree = (
    <CustomCodeRegistryContext.Provider value={blocks}>
      <StaticNode document={document} id={document.rootId} blocks={blocks} breakpoint={breakpoint} />
    </CustomCodeRegistryContext.Provider>
  );

  if (theme === undefined) {
    return tree;
  }

  /*
    `display: contents` removes this element's own box from layout entirely —
    its children lay out exactly as if the wrapper were not there — while
    custom properties still inherit through it. A plain wrapper would have
    become a block box between the page root and its first section and changed
    the geometry of every published page.
  */
  return <div style={{ display: 'contents', ...themeCustomProperties(theme) }}>{tree}</div>;
}
