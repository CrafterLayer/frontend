import { describe, expect, it } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  LATEST_SCHEMA_VERSION,
  type AssetEntry,
  type BlockRenderProps,
  type BuilderDocument,
  type JsonValue,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { CustomCode } from '../components/CustomCode';
import { createAssetFileWriter } from './asset-files';
import { exportStaticSite } from './export-static-site';

/*
  page-defects (2026-10-06): an uploaded picture is published as a file in
  assets/images/, referenced from the page and the stylesheet, never inlined
  as a data URL in the HTML.
*/

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = `data:image/png;base64,${PNG_BASE64}`;
const SVG_TEXT = "<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='4'/></svg>";
const SVG = `data:image/svg+xml;base64,${btoa(SVG_TEXT)}`;

function bytesOf(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

describe('createAssetFileWriter', () => {
  it('writes one file per distinct picture, named by its bytes, and points every reference at it', () => {
    const writer = createAssetFileWriter();
    const html = writer.rewrite(`<img src="${PNG}" alt="a"><img srcset="${PNG} 640w, ${PNG} 1024w">`, '../assets/');
    const files = writer.files();
    expect(files).toHaveLength(1);
    const [file] = files;
    expect(file?.path).toMatch(/^assets\/images\/[0-9a-f]{16}\.png$/u);
    expect(file?.content).toBe('');
    expect(file?.bytes).toEqual(bytesOf(PNG_BASE64));
    const name = file?.path.slice('assets/'.length) ?? '';
    expect(html).toBe(`<img src="../assets/${name}" alt="a"><img srcset="../assets/${name} 640w, ../assets/${name} 1024w">`);
    expect(html).not.toContain('data:');
    // The same bytes from a stylesheet: the same file, referenced beside it in assets/.
    expect(writer.rewrite(`.hero{background-image:url(${PNG})}`, '')).toBe(`.hero{background-image:url(${name})}`);
    expect(writer.files()).toHaveLength(1);
  });

  it('reads a data URL inside an escaped style attribute, and writes an SVG as text', () => {
    const writer = createAssetFileWriter();
    const html = writer.rewrite(
      `<div style="background-image:url(&quot;${PNG}&quot;)"></div><img src="${SVG}">`,
      'assets/',
    );
    expect(html).not.toContain('data:');
    expect(html).toMatch(/url\(&quot;assets\/images\/[0-9a-f]{16}\.png&quot;\)/u);
    const svg = writer.files().find((file) => file.path.endsWith('.svg'));
    expect(svg?.content).toContain("<rect width='4' height='4'/>");
    expect(svg?.bytes).toBeUndefined();
  });

  it('leaves what it cannot decode, text data URLs and other types as they were', () => {
    const writer = createAssetFileWriter();
    const broken = '<img src="data:image/png;base64,A">';
    const text = `<img src="data:image/svg+xml,${encodeURIComponent(SVG_TEXT)}">`;
    const other = '<a href="data:text/plain;base64,aGVsbG8=">x</a>';
    expect(writer.rewrite(broken, '')).toBe(broken);
    expect(writer.rewrite(text, '')).toBe(text);
    expect(writer.rewrite(other, '')).toBe(other);
    expect(writer.files()).toEqual([]);
  });

  it('gives two different pictures two names', () => {
    const writer = createAssetFileWriter();
    const other = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    writer.rewrite(`<img src="${PNG}"><img src="${other}">`, '');
    const paths = writer.files().map((file) => file.path);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
  });
});

/* ── Through the exporter: a tree image that names an uploaded asset ── */

const anySchema =
  (fixtureBlocks.contributes?.blocks ?? []).find(({ schema }) => schema.type === 'hero')?.schema ??
  (() => {
    throw new Error('Fixture is missing the "hero" block.');
  })();

function PageRoot({ slots }: BlockRenderProps) {
  return <main>{slots['default']}</main>;
}

function Code({ node }: BlockRenderProps) {
  return <CustomCode hostId={node.id} tree={node.props['tree']} />;
}

const registry: Record<string, RegisteredBlock> = {
  page: { schema: anySchema, render: PageRoot as NonNullable<RegisteredBlock['render']> },
  code: { schema: anySchema, render: Code as NonNullable<RegisteredBlock['render']> },
};

function codeDoc(tree: JsonValue): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'مطعم الياسمين', lang: 'ar' }, slots: { default: ['c'] } },
      c: { id: 'c', type: 'code', props: { tree } },
    },
  };
}

const upload: AssetEntry = {
  id: 'up1',
  url: PNG,
  description: 'طبق منسف',
  mood: [],
  palette: [],
  alt: 'طبق منسف',
  width: 1,
  height: 1,
};

describe('exportStaticSite — uploaded pictures', () => {
  it('publishes an uploaded picture as assets/images/<hash>.png on every page that shows it', async () => {
    const tree: JsonValue = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'img', attributes: { src: '/ck-assets/up1', alt: 'طبق منسف' } }],
    };
    const { files } = await exportStaticSite({
      pages: [
        { pageId: 'home', address: '/', document: codeDoc(tree) },
        { pageId: 'menu', address: '/قائمة-الطعام', document: codeDoc(tree) },
      ],
      blocks: (type: string) => registry[type],
      compileCss: () => Promise.resolve(`.hero{background-image:url("${PNG}")}`),
      assets: { up1: upload },
    });
    const html = (path: string) => files.find((file) => file.path === path)?.content ?? '';
    const images = files.filter((file) => file.path.startsWith('assets/images/'));
    expect(images).toHaveLength(1);
    const [image] = images;
    expect(image?.bytes).toEqual(bytesOf(PNG_BASE64));
    for (const file of files) expect(file.content, file.path).not.toContain('data:image');
    expect(html('index.html')).toContain(`src="${image?.path ?? ''}"`);
    expect(html('قائمة-الطعام/index.html')).toContain(`src="../${image?.path ?? ''}"`);
    expect(html('assets/site.css')).toContain(`url("${image?.path.slice('assets/'.length) ?? ''}")`);
  });
});
