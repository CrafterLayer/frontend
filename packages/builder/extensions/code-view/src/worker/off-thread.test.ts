import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';
import {
  defaultDesignSystem,
  LATEST_SITE_VERSION,
  type BuilderDocument,
  type BuilderSite,
} from '@craftkit/builder-schema';
import {
  CANONICAL_JSON_PROJECTION_ID,
  SITE_MANIFEST_PROJECTION_ID,
  projectDocument,
} from '@craftkit/builder-transforms';

import { createTransformWorkerClient, type WorkerLike } from './client';
import type { TransformRequestInput } from './client';
import { acceptDocument, handleRequest } from './transform-worker';
import type { TransformRequest } from './protocol';

/**
 * SC-005 — the codec never runs on the path that renders the canvas.
 *
 * This is the law FR-009 exists for, and it is the one a reviewer cannot take
 * on trust: "we put it in a worker" is a claim about a file, not about what
 * actually executes. So it is proven twice, from opposite directions.
 *
 *   STATICALLY — the main-thread modules must not even be able to reach the
 *   codec: if `@craftkit/builder-transforms` appears nowhere in their import
 *   graph, no bundler can place it on the rendering path, and no future edit
 *   can quietly call it there without this test noticing.
 *
 *   DYNAMICALLY — a burst of typing through the real client must produce ZERO
 *   codec invocations in this (main-thread) realm, no matter how many messages
 *   it posts.
 *
 * Timing is deliberately absent. A wall-clock budget would rot in CI; a call
 * count of zero cannot.
 */

const sourceOf = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** The modules that run on the main thread. The worker entry is NOT one of them. */
const MAIN_THREAD_MODULES = ['./client.ts', './protocol.ts'] as const;

const silentWorker = (): WorkerLike & { posted: unknown[] } => {
  const posted: unknown[] = [];
  return {
    posted,
    postMessage: (message: unknown) => {
      posted.push(message);
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    terminate: () => undefined,
  };
};

const parseInput = (generation: number, payload: string): TransformRequestInput => ({
  operation: 'parse',
  generation,
  baseRevision: 1,
  scope: { kind: 'document' },
  projectionId: CANONICAL_JSON_PROJECTION_ID,
  payload,
});

/**
 * Fire an input the way typing does — and SWALLOW the supersede rejection.
 * A coalesced request is rejected by design (that is `w2` working), so an
 * unhandled rejection here would be the test lying about the client, not a
 * defect in it.
 */
const type = (
  client: { request: (input: TransformRequestInput) => Promise<unknown> },
  input: TransformRequestInput,
): void => {
  client.request(input).catch(() => undefined);
};

describe('SC-005 — the codec never runs on the rendering path', () => {
  it.each(MAIN_THREAD_MODULES)(
    'STATIC: %s cannot reach the transforms package at all',
    (module) => {
      // Not a style rule — a placement guarantee. What a module cannot import,
      // a bundler cannot put on the main thread.
      expect(sourceOf(module)).not.toContain('builder-transforms');
    },
  );

  it('STATIC: only the worker entry imports the codec, and it does so downward', () => {
    // The single legitimate importer. If this ever stops being true, the law
    // has moved and someone must say so deliberately.
    expect(sourceOf('./transform-worker.ts')).toContain('@craftkit/builder-transforms');
  });

  it('DYNAMIC: a typing burst posts messages and invokes the codec ZERO times here', async () => {
    // Spy on the real module: if any main-thread code path called it, the
    // counter would move. It must not, however many keystrokes arrive.
    const codec = await import('@craftkit/builder-transforms');
    const project = vi.spyOn(codec, 'projectDocument');
    const parse = vi.spyOn(codec, 'parseDocument');

    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(1000), blockTypes: [] }));

    for (let keystroke = 1; keystroke <= 24; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }

    expect(project).toHaveBeenCalledTimes(0);
    expect(parse).toHaveBeenCalledTimes(0);
    // …and the work really was dispatched, so the zero above is not vacuous.
    expect(worker.posted.length).toBeGreaterThan(0);
    project.mockRestore();
    parse.mockRestore();
    client.terminate();
  });

  it('DYNAMIC: the 1,000-node document crosses ONCE, and typing carries text only (w4)', () => {
    // Trap 6: cloning the whole document per keystroke stalls a large page even
    // though the parse itself is off-thread. Counted in messages, not bytes-per-
    // second, so the gate cannot drift with hardware.
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    const snapshot = JSON.stringify({ document: stressDocument(1000), blockTypes: [] });

    client.setDocument(1, snapshot);
    for (let keystroke = 1; keystroke <= 12; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }
    // Re-sending the SAME revision is a no-op: the worker already holds it.
    client.setDocument(1, snapshot);

    const counts = client.getSnapshot().counts;
    expect(counts.documentPosts).toBe(1);
    expect(counts.requestPosts).toBeGreaterThan(0);
    client.terminate();
  });

  it('DYNAMIC: one ENORMOUS paste is one coalesced request, not per-character work', () => {
    // Spec edge case 2 (analysis C5): a paste is a single input event carrying a
    // large payload — it must never be amplified into per-character requests.
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(50), blockTypes: [] }));

    const huge = `{"pasted": "${'x'.repeat(200_000)}"}`;
    type(client, parseInput(1, huge));

    const snapshot = client.getSnapshot();
    // One active request; nothing queued behind it, and no fan-out by length.
    expect(snapshot.active).not.toBeNull();
    expect(snapshot.coalesced).toBeNull();
    expect(snapshot.counts.requestPosts).toBe(1);
    client.terminate();
  });

  it('DYNAMIC: a burst holds at most ONE active plus ONE coalesced, whatever its size', () => {
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(50), blockTypes: [] }));

    for (let keystroke = 1; keystroke <= 40; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }

    const snapshot = client.getSnapshot();
    expect(snapshot.active).not.toBeNull();
    expect(snapshot.coalesced?.generation).toBe(40); // the NEWEST input survives
    // 40 keystrokes did not become 40 posted requests.
    expect(snapshot.counts.requestPosts).toBeLessThanOrEqual(2);
    client.terminate();
  });
});

/* ── The site half of the same two laws (013 T044, T045) ──────────────────── */

/**
 * A site whose pages are individually large and individually IDENTIFIABLE.
 *
 * The marker matters more than the size. "Editing one page does not
 * re-serialise the site" is only checkable if a reader can tell one page's text
 * from another's, so every page's root carries a title nothing else carries.
 */
const MARKED_PAGES = ['home', 'about', 'work', 'contact'] as const;

function markedPage(id: string): BuilderDocument {
  const document = stressDocument(250);
  const root = document.nodes[document.rootId];
  if (root === undefined) {
    throw new Error('the stress fixture must have a root');
  }
  return {
    ...document,
    dir: 'ltr',
    nodes: { ...document.nodes, [document.rootId]: { ...root, props: { title: `marker-${id}` } } },
  };
}

function markedSite(): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: MARKED_PAGES.map((id, index) => ({
      id,
      address: index === 0 ? '/' : `/${id}`,
      title: id,
      purpose: id,
      audience: id,
      document: markedPage(id),
      regions: [],
    })),
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

const siteRequest = (over: Partial<TransformRequest>): TransformRequest => ({
  operation: 'project',
  requestId: 1,
  generation: 1,
  baseRevision: 1,
  scope: { kind: 'site' },
  projectionId: SITE_MANIFEST_PROJECTION_ID,
  payload: null,
  ...over,
});

describe('SC-005 at SITE scope — the site codec never runs on the rendering path', () => {
  it('DYNAMIC: a typing burst in a site pane invokes the site codec ZERO times here', async () => {
    const codec = await import('@craftkit/builder-transforms');
    const projectManifest = vi.spyOn(codec, 'projectSiteManifest');
    const parseManifest = vi.spyOn(codec, 'parseSiteManifest');
    const parsePage = vi.spyOn(codec, 'parseSitePage');

    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ site: markedSite(), blockTypes: [] }));

    for (let keystroke = 1; keystroke <= 24; keystroke += 1) {
      type(client, {
        operation: 'parse',
        generation: keystroke,
        baseRevision: 1,
        scope: keystroke % 2 === 0 ? { kind: 'site' } : { kind: 'page', pageId: 'about' },
        projectionId:
          keystroke % 2 === 0 ? SITE_MANIFEST_PROJECTION_ID : CANONICAL_JSON_PROJECTION_ID,
        payload: `{"typed": ${String(keystroke)}}`,
      });
    }

    expect(projectManifest).toHaveBeenCalledTimes(0);
    expect(parseManifest).toHaveBeenCalledTimes(0);
    expect(parsePage).toHaveBeenCalledTimes(0);
    // …and the work really was dispatched, so the zeros above are not vacuous.
    expect(worker.posted.length).toBeGreaterThan(0);
    projectManifest.mockRestore();
    parseManifest.mockRestore();
    parsePage.mockRestore();
    client.terminate();
  });

  it('the four-page site crosses ONCE, and typing carries text only', () => {
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    const snapshot = JSON.stringify({ site: markedSite(), blockTypes: [] });
    client.setDocument(1, snapshot);

    for (let keystroke = 1; keystroke <= 12; keystroke += 1) {
      type(client, {
        operation: 'parse',
        generation: keystroke,
        baseRevision: 1,
        scope: { kind: 'page', pageId: 'about' },
        projectionId: CANONICAL_JSON_PROJECTION_ID,
        payload: `{"typed": ${String(keystroke)}}`,
      });
    }

    const snapshots = worker.posted.filter(
      (message) => typeof message === 'object' && message !== null && 'kind' in message,
    );
    expect(snapshots).toHaveLength(1);
    /* Requests really were posted, so the size check below is not an empty loop. */
    expect(worker.posted.length).toBeGreaterThan(1);
    for (const message of worker.posted.slice(1)) {
      expect(JSON.stringify(message).length).toBeLessThan(snapshot.length / 10);
    }
    client.terminate();
  });
});

/**
 * D6's mitigation, proven rather than asserted (013 T045).
 *
 * The risk the mitigation exists for is concrete: if a site pane were the only
 * grain, every keystroke in one page would print all four pages and diff all
 * four, and a four-page site would be four times slower to type in than a
 * one-page document — which is the opposite of what a site is supposed to buy.
 *
 * Both halves are counted, not timed. The TEXT handed to a page pane contains
 * that page and no other; the PATCHES a page edit produces name that page's
 * slot and no other.
 */
describe('editing one page does not re-serialise the site', () => {
  const site = markedSite();
  const blockTypes = ['page', 'section', 'text'];

  const install = (): void => {
    acceptDocument(1, JSON.stringify({ site, blockTypes }));
  };

  it("hands a page pane exactly that page's text, and no other page's", () => {
    install();
    const response = handleRequest(
      siteRequest({
        scope: { kind: 'page', pageId: 'about' },
        projectionId: CANONICAL_JSON_PROJECTION_ID,
      }),
    );
    expect(response.result.kind).toBe('projected');
    if (response.result.kind !== 'projected') return;

    const about = site.pages[1];
    if (about === undefined) throw new Error('the fixture must have a second page');
    expect(response.result.text).toBe(projectDocument(about.document).text);
    expect(response.result.text).toContain('marker-about');
    for (const id of MARKED_PAGES) {
      if (id === 'about') continue;
      expect(response.result.text).not.toContain(`marker-${id}`);
    }
  });

  it('turns a page edit into patches under that page alone', () => {
    install();
    const about = site.pages[1];
    if (about === undefined) throw new Error('the fixture must have a second page');
    const root = about.document.nodes[about.document.rootId];
    if (root === undefined) throw new Error('the fixture page must have a root');

    const edited = projectDocument({
      ...about.document,
      nodes: {
        ...about.document.nodes,
        [about.document.rootId]: { ...root, props: { title: 'marker-about-edited' } },
      },
    }).text;

    const response = handleRequest(
      siteRequest({
        operation: 'parse',
        scope: { kind: 'page', pageId: 'about' },
        projectionId: CANONICAL_JSON_PROJECTION_ID,
        payload: edited,
      }),
    );
    expect(response.result.kind).toBe('parsed');
    if (response.result.kind !== 'parsed' || !response.result.ok) {
      throw new Error('a page edit projected from the site must parse back');
    }

    expect(response.result.patches.length).toBeGreaterThan(0);
    for (const patch of response.result.patches) {
      expect(patch.path.slice(0, 3)).toEqual(['pages', 1, 'document']);
    }
    /* Nothing at the site's own grain moved: no page list, no design system. */
    expect(response.result.patches.some((patch) => patch.path.length <= 2)).toBe(false);
  });

  it('refuses a page the site does not have, instead of answering about another', () => {
    install();
    const response = handleRequest(
      siteRequest({
        scope: { kind: 'page', pageId: 'ghost' },
        projectionId: CANONICAL_JSON_PROJECTION_ID,
      }),
    );
    expect(response.result.kind).toBe('protocol-error');
    if (response.result.kind === 'protocol-error') {
      expect(response.result.code).toBe('unknown-page');
    }
  });
});
