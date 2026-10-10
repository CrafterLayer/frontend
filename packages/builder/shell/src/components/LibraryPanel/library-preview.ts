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
  pageCss?: string,
): string | undefined {
  const type = regionBlockType(kernel);
  const key = type === undefined ? undefined : customCodeTreeKey(kernel, type);
  if (type === undefined || key === undefined) return undefined;
  const previewTree: CustomCodeRoot = pageCss === undefined ? tree : {
    kind: 'root',
    children: [{ kind: 'element', tag: 'div', className: 'ck-page-plan', children: tree.children }],
  };
  const props: Record<string, JsonValue> = { [key]: previewTree as unknown as JsonValue };
  // Page-kit selectors (including `> *` tokens) must go through the renderer's CSS scope.
  const regionCss = [pageCss, css].filter((sheet) => sheet !== undefined).join('\n');
  if (regionCss !== '') props['css'] = regionCss;
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
  /*
    A thumbnail never loads a third-party embed (fix pass): a map or video
    iframe here made a network request per tile, logged sandbox errors on
    every open and drew the provider's error page. It is drawn as a poster
    the size the embed's own classes give it.
  */
  const markup = options.markup.replace(
    /<iframe\b([^>]*)>(?:\s*<\/iframe>)?/giu,
    (_tag: string, attributes: string) => {
      const className = /\bclass="([^"]*)"/u.exec(attributes)?.[1] ?? '';
      return `<div class="ck-embed-poster ${className}" aria-hidden="true"></div>`;
    },
  );
  return [
    '<!doctype html>',
    `<html dir="${options.dir}" lang="${options.lang}">`,
    '<head><meta charset="utf-8">',
    `<style>${css}</style>`,
    '<style>html,body{margin:0;overflow:hidden;background:transparent}',
    'html,body{inline-size:100%;min-block-size:100%;box-sizing:border-box}',
    'body{padding:24px}*,*::before,*::after{box-sizing:border-box}',
    '.ck-embed-poster{min-block-size:160px;background:color-mix(in srgb,currentColor 12%,transparent);border-radius:12px}</style>',
    `</head><body>${markup}</body></html>`,
  ].join('');
}
