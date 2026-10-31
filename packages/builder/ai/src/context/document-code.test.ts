import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  customJs,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { serializeTreeMarkup } from '../plan/tree-markup';
import { assembleAiContext } from './assemble-context';

/*
  documentCode (2026-10-31). A language version's translation run sent the whole page — every
  region's tree, CSS and JavaScript — though page.translate only ever writes texts and never
  reads code. On a built free-code page the code is most of the request (a ten-section page
  measured 53k of 64k estimated tokens, 14.5k without its code), so after a site build of up to
  fifteen minutes the translation was refused before it left: «الصفحة كبيرة على الطلب».
  `documentCode: 'omitted'` keeps every word the page shows and states each code prop's size.
*/

const NullRender: BlockRenderComponent = () => null;

const PAGE_CSS = ':root{--t-accent:#0f766e}\nbody{font-family:system-ui}';
const HERO_CSS = '.hero{display:grid;gap:24px;padding:48px;background:#0f172a}';
const HERO_JS = "const el=ck.root.querySelector('.hero');el.classList.add('in');";

function heroTree(): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        className: 'hero',
        children: [
          { kind: 'element', tag: 'h1', text: 'عيادة الابتسامة', children: [] },
          { kind: 'element', tag: 'p', text: 'احجز موعدك اليوم', children: [] },
        ],
      },
    ],
  };
}

const extension: TrustedExtensionManifest = {
  tier: 1,
  name: 'document-code-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default(''), pageCss: customCss(20_000) }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(24_000),
            js: customJs(),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function kernel() {
  const document = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'الرئيسية', pageCss: PAGE_CSS },
        slots: { default: ['hero', 'plain'] },
      },
      hero: {
        id: 'hero',
        type: 'customCode',
        props: { label: 'Hero', tree: heroTree(), css: HERO_CSS, js: HERO_JS },
      },
      plain: {
        id: 'plain',
        type: 'customCode',
        props: { label: 'Plain', tree: heroTree(), css: '' },
      },
    },
  } as unknown as BuilderDocument;
  return createBuilder({
    document,
    extensions: [extension],
    ports: { clock: fixedClock(1), ids: seededIds('document-code') },
  });
}

function propsOf(context: ReturnType<typeof assembleAiContext>, id: string) {
  return context.document.nodes.find((node) => node.id === id)?.props;
}

describe('documentCode', () => {
  it('quotes every code prop by default, so a restyle can read what it changes', () => {
    const context = assembleAiContext(kernel().context);

    expect(propsOf(context, 'root')?.['pageCss']).toBe(PAGE_CSS);
    expect(propsOf(context, 'hero')?.['css']).toBe(HERO_CSS);
    expect(propsOf(context, 'hero')?.['js']).toBe(HERO_JS);
  });

  it("'omitted' states each code prop's size instead of its body", () => {
    const context = assembleAiContext(kernel().context, {
      composition: { documentCode: 'omitted' },
    });

    expect(propsOf(context, 'root')?.['pageCss']).toBe(
      `[pageCss: ${String(PAGE_CSS.length)} characters, not shown]`,
    );
    expect(propsOf(context, 'hero')?.['css']).toBe(
      `[css: ${String(HERO_CSS.length)} characters, not shown]`,
    );
    expect(propsOf(context, 'hero')?.['js']).toBe(
      `[js: ${String(HERO_JS.length)} characters, not shown]`,
    );
    expect(JSON.stringify(context.document)).not.toContain('querySelector');
  });

  it("'omitted' keeps every word the page shows, and an empty code prop says it is empty", () => {
    const context = assembleAiContext(kernel().context, {
      composition: { documentCode: 'omitted' },
    });

    expect(propsOf(context, 'hero')?.['tree']).toBe(serializeTreeMarkup(heroTree()));
    expect(propsOf(context, 'hero')?.['label']).toBe('Hero');
    expect(propsOf(context, 'root')?.['title']).toBe('الرئيسية');
    expect(propsOf(context, 'plain')?.['css']).toBe('');
  });

  it("'omitted' holds for a focused edit's document too", () => {
    const context = assembleAiContext(kernel().context, {
      composition: { documentCode: 'omitted', documentFocus: { nodeIds: ['hero'], kind: 'edit' } },
    });

    expect(propsOf(context, 'hero')?.['tree']).toBe(serializeTreeMarkup(heroTree()));
    expect(propsOf(context, 'hero')?.['css']).toBe(
      `[css: ${String(HERO_CSS.length)} characters, not shown]`,
    );
    expect(propsOf(context, 'root')?.['pageCss']).toBe(
      `[pageCss: ${String(PAGE_CSS.length)} characters, not shown]`,
    );
  });
});
