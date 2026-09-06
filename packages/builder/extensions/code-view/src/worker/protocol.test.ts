import { describe, expect, it } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';
import type { BuilderSite } from '@craftkit/builder-schema';
import { defaultDesignSystem } from '@craftkit/builder-schema';
import { SITE_MANIFEST_PROJECTION_ID } from '@craftkit/builder-transforms';

import {
  isSerializableValue,
  isTransformDocumentMessage,
  isTransformRequest,
  isTransformResult,
  isTransformScope,
  type TransformRequest,
} from './protocol';
import { acceptDocument, handleRequest } from './transform-worker';

/**
 * The protocol guards are the boundary itself (§3 w1): everything crossing the
 * worker edge is CHECKED, never asserted. A guard that says yes to a shape the
 * other side cannot handle is the same defect as no guard at all, so each one
 * is proven to refuse — not merely to accept.
 */
describe('worker protocol guards (011 §3)', () => {
  it('refuses values that cannot be structured-cloned, however deeply they hide', () => {
    expect(isSerializableValue({ ok: true })).toBe(true);
    expect(isSerializableValue({ nested: [1, { fn: () => undefined }] })).toBe(false);
    expect(isSerializableValue(undefined)).toBe(false);
    expect(isSerializableValue(new Date(0))).toBe(false);

    // A GETTER is the trap: reading it once proves nothing, because
    // postMessage will read it again on the other side.
    const trap = {};
    Object.defineProperty(trap, 'lazy', { enumerable: true, get: () => 1 });
    expect(isSerializableValue(trap)).toBe(false);
  });

  it('refuses a document message that is not one', () => {
    expect(isTransformDocumentMessage(null)).toBe(false);
    expect(isTransformDocumentMessage('document')).toBe(false);
    expect(isTransformDocumentMessage({ kind: 'document' })).toBe(false);
    expect(isTransformDocumentMessage({ kind: 'request', baseRevision: 1, payload: '{}' })).toBe(
      false,
    );
    expect(isTransformDocumentMessage({ kind: 'document', baseRevision: 1, payload: '{}' })).toBe(
      true,
    );
  });

  it('refuses a request with a wrong shape, an unknown operation, or an extra key', () => {
    const valid = {
      operation: 'project',
      requestId: 1,
      generation: 1,
      baseRevision: 1,
      scope: { kind: 'document' },
      projectionId: 'canonical-json',
      payload: null,
    };
    expect(isTransformRequest(valid)).toBe(true);
    expect(isTransformRequest({ ...valid, operation: 'compile' })).toBe(false);
    expect(isTransformRequest({ ...valid, extra: 1 })).toBe(false);
    expect(isTransformRequest({ ...valid, scope: { kind: 'node' } })).toBe(false);
    expect(isTransformRequest([valid])).toBe(false);
  });

  it('refuses a result that carries a patch the other side could not apply', () => {
    // A result carries only its CONTEXT — the envelope's ids live one level up.
    const base = { baseRevision: 1, scope: { kind: 'document' } };
    expect(isTransformResult({ ...base, kind: 'parsed', ok: true, patches: [] })).toBe(true);
    expect(
      isTransformResult({
        ...base,
        kind: 'parsed',
        ok: true,
        patches: [{ op: 'replace', path: ['nodes', 'a'], value: { ok: true }, extra: 1 }],
      }),
    ).toBe(false);
    expect(
      isTransformResult({ ...base, kind: 'parsed', ok: true, patches: [{ op: 'nope', path: [] }] }),
    ).toBe(false);
    expect(isTransformResult({ ...base, kind: 'parsed', ok: true, patches: ['patch'] })).toBe(
      false,
    );
    expect(isTransformResult({ kind: 'projected', text: 'x' })).toBe(false);
  });
});

/**
 * The two site scopes (013 T042).
 *
 * A scope is the only thing that says WHAT a request is about, so a guard that
 * waved through `{ kind: 'page' }` with no page id would hand the worker a
 * request it could only answer about a page called "undefined".
 */
describe('the site and page scopes cross the boundary intact', () => {
  it('accepts exactly the two new shapes and nothing shaped nearly like them', () => {
    expect(isTransformScope({ kind: 'site' })).toBe(true);
    expect(isTransformScope({ kind: 'page', pageId: 'about' })).toBe(true);

    expect(isTransformScope({ kind: 'site', pageId: 'about' })).toBe(false);
    expect(isTransformScope({ kind: 'page' })).toBe(false);
    expect(isTransformScope({ kind: 'page', pageId: 4 })).toBe(false);
    expect(isTransformScope({ kind: 'page', pageId: 'about', extra: 1 })).toBe(false);
    expect(isTransformScope({ kind: 'pages' })).toBe(false);
  });

  it('carries a site scope through a whole request and a whole result', () => {
    const request = {
      operation: 'project',
      requestId: 1,
      generation: 1,
      baseRevision: 3,
      scope: { kind: 'site' },
      projectionId: SITE_MANIFEST_PROJECTION_ID,
      payload: null,
    };
    expect(isTransformRequest(request)).toBe(true);
    expect(isTransformRequest({ ...request, scope: { kind: 'page', pageId: 'about' } })).toBe(true);

    const context = { baseRevision: 3, scope: { kind: 'page', pageId: 'about' } };
    expect(isTransformResult({ ...context, kind: 'projected', text: '{}' })).toBe(true);
    expect(
      isTransformResult({
        ...context,
        kind: 'parsed',
        ok: true,
        patches: [{ op: 'replace', path: ['pages', 1, 'document', 'nodes', 'a'], value: null }],
      }),
    ).toBe(true);
  });
});

/**
 * Staleness under a site-sized payload (013 T042).
 *
 * The revision check is what stops a worker answering from an artifact the host
 * has already replaced, and a site is the payload where it matters most: the
 * base is four documents rather than one, so a stale answer would produce
 * patches rooted in pages that may have moved or gone. Size is not the point —
 * the point is that a big payload changes nothing about the check.
 */
describe('a site snapshot is as stale-checked as a document one', () => {
  const page = (id: string, address: string): BuilderSite['pages'][number] => ({
    id,
    address,
    title: id,
    purpose: id,
    audience: id,
    document: { ...stressDocument(250), dir: 'ltr' },
    regions: [],
  });

  const site: BuilderSite = {
    siteVersion: 1,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about'), page('work', '/work')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };

  const ask = (over: Partial<TransformRequest>): TransformRequest => ({
    operation: 'project',
    requestId: 1,
    generation: 1,
    baseRevision: 11,
    scope: { kind: 'site' },
    projectionId: SITE_MANIFEST_PROJECTION_ID,
    payload: null,
    ...over,
  });

  it('answers at the revision it holds and refuses every other one', () => {
    acceptDocument(11, JSON.stringify({ site, blockTypes: ['page', 'section', 'text'] }));

    const current = handleRequest(ask({}));
    expect(current.result.kind).toBe('projected');

    const stale = handleRequest(ask({ baseRevision: 12 }));
    expect(stale.result.kind).toBe('protocol-error');
    if (stale.result.kind === 'protocol-error') {
      expect(stale.result.code).toBe('stale-document');
      /* The scope comes back on the error, so the caller can drop the right pane. */
      expect(stale.result.scope).toEqual({ kind: 'site' });
    }
  });

  it('refuses a document scope while it holds a site, instead of inventing one', () => {
    acceptDocument(11, JSON.stringify({ site, blockTypes: ['page', 'section', 'text'] }));
    const mismatch = handleRequest(
      ask({ scope: { kind: 'document' }, projectionId: 'canonical-json' }),
    );
    expect(mismatch.result.kind).toBe('protocol-error');
    if (mismatch.result.kind === 'protocol-error') {
      expect(mismatch.result.code).toBe('scope-mismatch');
    }
  });

  it('refuses a site scope asking for the document projection', () => {
    acceptDocument(11, JSON.stringify({ site, blockTypes: ['page', 'section', 'text'] }));
    const wrong = handleRequest(ask({ projectionId: 'canonical-json' }));
    expect(wrong.result.kind).toBe('protocol-error');
    if (wrong.result.kind === 'protocol-error') {
      expect(wrong.result.code).toBe('unknown-projection');
    }
  });
});
