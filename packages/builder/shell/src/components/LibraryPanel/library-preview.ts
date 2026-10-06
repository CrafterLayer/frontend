import type { BuilderKernel } from '@craftkit/builder-core';
import { renderStaticMarkup } from '@craftkit/builder-renderer';
import type { BuilderDocument, ContentDirection, CustomCodeNode, CustomCodeRoot, JsonValue } from '@craftkit/builder-schema';

import { customCodeTreeKey } from '../../custom-code/element-at';
import { regionBlockType } from './library-insert';

/*
  Library thumbnails: the entry rendered by the SAME static renderer the
  export uses, inside a scaled, sandboxed `srcdoc` iframe — no script runs in
  it (`sandbox=""`), it never takes focus, and it is only built once the tile
  scrolls into view.
*/

/** Every class name a tree uses, for a one-shot compile of exactly those. */
export function treeClassNames(tree: CustomCodeRoot): string[] {
  const names = new Set<string>();
  const visit = (node: CustomCodeNode): void => {
    for (const name of (node.kind === 'component' ? '' : (node.className ?? '')).split(/\s+/u)) {
      if (name !== '') names.add(name);
    }
    if (node.kind !== 'icon') for (const child of node.children ?? []) visit(child);
  };
  for (const node of tree.children) visit(node);
  return [...names];
}

/** The tree as static markup inside the editor's own region block, or undefined when none exists. */
export function previewMarkup(
  kernel: BuilderKernel,
  tree: CustomCodeRoot,
  css: string | undefined,
  dir: ContentDirection,
): string | undefined {
  const type = regionBlockType(kernel);
  const key = type === undefined ? undefined : customCodeTreeKey(kernel, type);
  if (type === undefined || key === undefined) return undefined;
  const props: Record<string, JsonValue> = { [key]: tree as unknown as JsonValue };
  if (css !== undefined) props['css'] = css;
  const document: BuilderDocument = {
    schemaVersion: kernel.getDocument().schemaVersion,
    surface: kernel.getDocument().surface,
    dir,
    rootId: 'library-preview',
    nodes: { 'library-preview': { id: 'library-preview', type, props } },
  };
  try {
    return renderStaticMarkup(document, { blocks: (name) => kernel.context.registry.block(name) });
  } catch {
    return undefined;
  }
}

/** The whole iframe document: markup, styles, the page direction, scaled to a thumbnail. */
export function previewSrcdoc(options: {
  readonly markup: string;
  readonly css: string;
  readonly dir: ContentDirection;
  readonly lang: string;
}): string {
  const css = options.css.replace(/<\/style/giu, '<\\/style');
  return [
    '<!doctype html>',
    `<html dir="${options.dir}" lang="${options.lang}">`,
    '<head><meta charset="utf-8">',
    `<style>${css}</style>`,
    '<style>html,body{margin:0;overflow:hidden;background:transparent}',
    'body{padding:24px;inline-size:1040px;transform:scale(.25);transform-origin:top left}',
    '[dir=rtl] body{transform-origin:top right}</style>',
    `</head><body>${options.markup}</body></html>`,
  ].join('');
}
