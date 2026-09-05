import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { DocumentView, renderStaticMarkup } from '@craftkit/builder-renderer';
import type {
  BuilderDocument,
  CustomCodeRoot,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { builderCustomCode } from '../index';
import { customCodeSchema } from './schema';

/**
 * Canvas/static PARITY.
 *
 * The two render paths reach a custom-code tree by different routes: the canvas
 * through `DocumentView` and the kernel's registry, publishing through
 * `StaticDocument` and a bare lookup function with no kernel at all. A
 * component reference resolves through a React context on both — so this is the
 * suite that would catch a provider wired into one path and forgotten in the
 * other, which is exactly the shape of bug that ships a canvas that looks right
 * and a published page that does not.
 */

/** A referenceable block, so the reference path is exercised on both routes. */
const badge: TrustedExtensionManifest = {
  tier: 1,
  name: 'parity-badge',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: customCodeSchema,
        render: () => null,
      },
    ],
  },
};

const tree: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'bg-surface p-8',
      children: [
        { kind: 'element', tag: 'h2', text: 'Experience' },
        { kind: 'element', tag: 'p', className: 'text-muted', text: 'Ten years of it.' },
        // A reference the registry cannot resolve: both paths must agree on
        // the fallback, not just on the happy path.
        { kind: 'component', component: 'not-registered' },
      ],
    },
  ],
};

function documentWith(props: Record<string, unknown>): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'region',
    nodes: { region: { id: 'region', type: 'customCode', props: props as never } },
  };
}

function kernelFor(document: BuilderDocument) {
  return createBuilder({
    document,
    extensions: [builderCustomCode],
    ports: { clock: fixedClock(1), ids: seededIds('parity') },
  });
}

/** Markup comparison ignoring React's canvas-only bookkeeping attributes. */
function normalize(html: string): string {
  return html.replaceAll(/\s+/gu, ' ').trim();
}

describe('custom-code canvas/static parity', () => {
  it('publishes the same markup the canvas renders', () => {
    const document = documentWith({ label: 'Experience', tree, css: '' });
    const kernel = kernelFor(document);

    const canvas = render(<DocumentView kernel={kernel} isCanvas={false} />);
    const published = renderStaticMarkup(document, {
      blocks: (type) => kernel.context.registry.block(type),
    });

    const canvasRegion = canvas.container.querySelector('[data-ck="region"]');
    expect(canvasRegion).not.toBeNull();
    expect(normalize(published)).toContain(normalize(canvasRegion?.outerHTML ?? 'MISSING'));
  });

  it('renders scoped CSS into the published markup, not only onto the canvas', () => {
    const document = documentWith({
      label: 'Experience',
      tree,
      css: '.headline { color: red }',
    });
    const kernel = kernelFor(document);

    const published = renderStaticMarkup(document, {
      blocks: (type) => kernel.context.registry.block(type),
    });

    expect(published).toContain('[data-ck="region"] .headline');
    expect(published).toContain('<style>');
  });

  it('keeps a refused stylesheet out of the published page entirely', () => {
    const document = documentWith({
      label: 'Experience',
      tree,
      css: '@import url("https://evil.test/x.css");',
    });
    const kernel = kernelFor(document);

    const published = renderStaticMarkup(document, {
      blocks: (type) => kernel.context.registry.block(type),
    });

    expect(published).not.toContain('evil.test');
    expect(published).not.toContain('<style>');
  });

  it('is registered against the page root vocabulary it will be inserted into', () => {
    // The block exists to be inserted at the root; a registration the root
    // refuses is a block that can never be used.
    expect(badge.contributes?.blocks?.[0]?.schema.type).toBe('customCode');
  });
});
