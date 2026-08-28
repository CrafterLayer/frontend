import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixtureBlocks } from '@craftkit/builder-core/testing';
import { CANONICAL_JSON_PROJECTION_ID, projectDocument } from '@craftkit/builder-transforms';

afterEach(() => {
  vi.doUnmock('./CodeViewPanel');
  vi.unstubAllGlobals();
});

describe('worker plumbing stays off the production entry (011 T033 finding 8)', () => {
  // A bundler places whatever the entry can STATICALLY reach onto the initial
  // module graph. The production entry may reach ./worker only dynamically
  // (createCodeViewWorkerClient) or as types; the loopback and raw client
  // constructor live on the ./testing subpath. Source-level, like SC-005's
  // static gate: what cannot be imported cannot be bundled eagerly.
  // jsdom serves modules over http, so import.meta.url is not a file URL
  // here; vitest's cwd is the package root, which is all the gate needs.
  const entrySource = readFileSync(join(process.cwd(), 'src', 'index.ts'), 'utf8');

  it('never mentions the loopback', () => {
    expect(entrySource).not.toContain('worker/loopback');
  });

  it('reaches ./worker/client statically for TYPES only', () => {
    // `import type` / `export type` carry no runtime code; a bare
    // `import {`/`export {` from the client would put it back on the graph.
    const staticRuntimeReach = /^(import|export)\s+\{[^}]*\}\s+from\s+'\.\/worker\/client'/m;
    expect(entrySource).not.toMatch(staticRuntimeReach);
    expect(entrySource).toContain("import('./worker/client')"); // the lazy road stays
  });
});

describe('the contributed projection serves BOTH scopes (011 §1 / FR-011)', () => {
  it('projects and parses a single node subtree, not only the whole document', async () => {
    // The manifest is imported here rather than at module scope so the lazy
    // containment suite below keeps owning when `./index` is first evaluated.
    const { codeViewExtension } = await import('./index');
    const kernel = createBuilder();
    kernel.registerExtension(fixtureBlocks);
    kernel.registerExtension(codeViewExtension);
    const projection = kernel.context.registry.projection(CANONICAL_JSON_PROJECTION_ID);
    if (projection === undefined) {
      throw new Error('The canonical JSON projection contribution must be registered.');
    }
    const document = kernel.getDocument();
    const ports = {
      blockExists: (type: string) => kernel.context.registry.block(type) !== undefined,
    };

    // FR-011: the text follows the selection. A scoped projection is a
    // DIFFERENT text from the document one, and it must parse back cleanly.
    const scoped = projection.project(document, { nodeId: document.rootId });
    expect(scoped).not.toBe(projection.project(document));
    const parsed = projection.parse(scoped, document, ports, { nodeId: document.rootId });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error('a scope projected from the document must parse back');
    }
    // Reading changes nothing: the subtree already says what the document says.
    expect(parsed.patches).toEqual([]);
  });
});

describe('code-view lazy containment (011 p7 / SC-006 / trap 14)', () => {
  it('lazy-loader mutation guard: registration loads the panel 0× and first open loads it 1×', async () => {
    vi.resetModules();
    let moduleEvaluations = 0;
    let workerConstructions = 0;
    let workerListenerBalance = 0;
    let workerPosts = 0;
    let workerTerminations = 0;
    class WorkerStub {
      constructor() {
        workerConstructions += 1;
      }

      postMessage(_message: unknown): void {
        workerPosts += 1;
      }

      addEventListener(_type: string, _listener: EventListenerOrEventListenerObject): void {
        workerListenerBalance += 1;
      }

      removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject): void {
        workerListenerBalance -= 1;
      }

      terminate(): void {
        workerTerminations += 1;
      }
    }
    vi.stubGlobal('Worker', WorkerStub);
    vi.doMock('./CodeViewPanel', () => {
      moduleEvaluations += 1;
      return { default: () => null };
    });

    const { codeViewExtension, createCodeViewWorkerClient } = await import('./index');
    expect(moduleEvaluations).toBe(0);
    expect(workerConstructions).toBe(0);

    const kernel = createBuilder();
    // A real vocabulary: the projection's parser now asks the CALLER's registry
    // whether a type exists (T033 finding 5), so an empty registry would refuse
    // every type — correctly, but that is the vocabulary test's job, not this one.
    kernel.registerExtension(fixtureBlocks);
    kernel.registerExtension(codeViewExtension);
    expect(codeViewExtension.contributes?.panels).toHaveLength(1);
    expect(codeViewExtension.contributes?.projections).toHaveLength(1);
    const projection = kernel.context.registry.projection(CANONICAL_JSON_PROJECTION_ID);
    if (projection === undefined) {
      throw new Error('The canonical JSON projection contribution must be registered.');
    }
    const document = kernel.getDocument();
    const projected = projection.project(document);
    expect(projected).toBe(projectDocument(document).text);
    // The registry-owning caller answers `blockExists`; a type may be
    // registered without appearing in the document yet (T033 finding 5).
    const ports = {
      blockExists: (type: string) => kernel.context.registry.block(type) !== undefined,
    };
    expect(projection.parse(projected, document, ports)).toEqual({ ok: true, patches: [] });
    // The port — not the document's contents — decides. A type the REGISTRY
    // knows but the document has never used must parse (the defect this fixed),
    // and a type nobody registered must not (the fail-closed half kept).
    const registered = projection.parse(
      projected.replace('"type": "page"', '"type": "text"'),
      document,
      ports,
    );
    expect(registered.ok).toBe(true);
    const unregistered = projection.parse(
      projected.replace('"type": "page"', '"type": "never-registered"'),
      document,
      ports,
    );
    expect(unregistered.ok).toBe(false);
    expect(moduleEvaluations).toBe(0);
    const panel = kernel.context.registry.panel('code-view');
    if (panel === undefined) {
      throw new Error('The code-view panel contribution must be registered.');
    }
    expect(panel.slot).toBe('bottom');
    const loader = vi.spyOn(panel, 'load');

    expect(loader).not.toHaveBeenCalled();
    expect(moduleEvaluations).toBe(0);
    await panel.load();
    const workerClient = await createCodeViewWorkerClient();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(moduleEvaluations).toBe(1);
    expect(workerConstructions).toBe(1);
    expect(workerListenerBalance).toBe(3);
    expect(workerPosts).toBe(0);
    workerClient.terminate();
    expect(workerListenerBalance).toBe(0);
    expect(workerTerminations).toBe(1);
  });
});
