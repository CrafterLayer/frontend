import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { coreCommands, createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import {
  isJsonValue,
  type BuilderDocument,
  type JsonValue,
  type RegisteredCommand,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import {
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
} from '@craftkit/builder-transforms';

import type {
  TransformPatch,
  TransformRequest,
  TransformResponse,
  TransformScope,
} from '../worker/protocol';
import type {
  TransformRequestInput,
  TransformWorkerClient,
  TransformWorkerClientSnapshot,
} from '../worker/client';
import { CodeViewPanel, type CodeViewKernel, type CodeViewKernelSnapshot } from './CodeViewPanel';

const APPLY_COMMAND = 'test.apply-code-patches';
const DEBOUNCE_MS = 10;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fixtureDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: {},
        slots: { default: ['p1', 'p2'] },
      },
      p1: { id: 'p1', type: 'text', props: { content: 'Start' } },
      p2: { id: 'p2', type: 'text', props: { content: 'Second' } },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPatches(args: unknown): TransformPatch[] {
  if (!isRecord(args) || !Array.isArray(args['patches'])) {
    throw new Error('Code edits require a patches array.');
  }
  return args['patches'].map((value: unknown) => {
    if (
      !isRecord(value) ||
      (value['op'] !== 'add' && value['op'] !== 'remove' && value['op'] !== 'replace') ||
      !Array.isArray(value['path']) ||
      !value['path'].every((segment) => typeof segment === 'string' || typeof segment === 'number')
    ) {
      throw new Error('Code edit carried an invalid patch.');
    }
    const patch: TransformPatch = { op: value['op'], path: value['path'] };
    if (Object.hasOwn(value, 'value')) {
      if (!isJsonValue(value['value'])) {
        throw new Error('Code edit carried a non-JSON value.');
      }
      return { ...patch, value: value['value'] };
    }
    return patch;
  });
}

function applyPropertyPatch(document: BuilderDocument, patch: TransformPatch): void {
  const [nodes, nodeId, props, propKey] = patch.path;
  if (
    nodes !== 'nodes' ||
    typeof nodeId !== 'string' ||
    props !== 'props' ||
    typeof propKey !== 'string' ||
    patch.path.length !== 4
  ) {
    throw new Error('The test door accepts node property patches only.');
  }
  const node = document.nodes[nodeId];
  if (node === undefined) {
    throw new Error(`Node "${nodeId}" does not exist.`);
  }
  if (patch.op === 'remove') {
    Reflect.deleteProperty(node.props, propKey);
    return;
  }
  if (patch.value === undefined) {
    throw new Error('A property write requires a value.');
  }
  if (patch.value === 'Forbidden') {
    throw new Error('Policy refused the word Forbidden.');
  }
  if (patch.value === 'String refusal') {
    throwReason('Policy supplied a string refusal.');
  }
  node.props[propKey] = patch.value;
}

function throwReason(reason: unknown): never {
  throw reason;
}

const applyCodePatches: RegisteredCommand = {
  // Tests exercise `apply`; the public schema remains present for registry documentation.
  argsSchema: coreCommands.setProp.argsSchema,
  apply: (args) => {
    const patches = readPatches(args);
    return (document) => {
      for (const patch of patches) {
        applyPropertyPatch(document, patch);
      }
    };
  },
};

const testDoor: TrustedExtensionManifest = {
  tier: 1,
  name: 'test.code-view-door',
  version: '1.0.0',
  contributes: { commands: { [APPLY_COMMAND]: applyCodePatches } },
};

interface KernelHarness {
  readonly kernel: BuilderKernel;
  readonly port: CodeViewKernel;
  readonly counts: { dispatches: number };
  readonly externalSet: (nodeId: string, content: string) => void;
  readonly dispose: () => void;
}

function createKernelHarness(document: BuilderDocument = fixtureDocument()): KernelHarness {
  const kernel = createBuilder({ document, extensions: [testDoor] });
  const counts = { dispatches: 0 };
  let revision = 0;
  let state = kernel.context.store.getState();
  let snapshot: CodeViewKernelSnapshot = {
    document: state.doc,
    selection: state.selection,
    revision,
    blockTypes: ['page', 'text'],
  };
  const listeners = new Set<() => void>();
  const unsubscribe = kernel.context.store.subscribe((next) => {
    if (!Object.is(state.doc, next.doc)) {
      revision += 1;
    }
    state = next;
    snapshot = {
      document: next.doc,
      selection: next.selection,
      revision,
      blockTypes: ['page', 'text'],
    };
    for (const listener of [...listeners]) {
      listener();
    }
  });
  const dispatch = (patches: readonly TransformPatch[]) => {
    counts.dispatches += 1;
    kernel.dispatch(APPLY_COMMAND, { patches }, 'codeview');
  };
  return {
    kernel,
    counts,
    port: {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getSnapshot: () => snapshot,
      dispatch,
    },
    externalSet: (nodeId, content) => {
      kernel.dispatch(
        APPLY_COMMAND,
        {
          patches: [{ op: 'replace', path: ['nodes', nodeId, 'props', 'content'], value: content }],
        },
        'user',
      );
    },
    dispose: unsubscribe,
  };
}

function contentFromText(text: string, scope: TransformScope): JsonValue | undefined {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !isRecord(parsed['nodes'])) {
    return undefined;
  }
  const nodeId = scope.kind === 'node' ? scope.nodeId : 'p1';
  const node = parsed['nodes'][nodeId];
  if (!isRecord(node) || !isRecord(node['props'])) {
    return undefined;
  }
  const content = node['props']['content'];
  return isJsonValue(content) ? content : undefined;
}

function responseFor(request: TransformRequest, document: BuilderDocument): TransformResponse {
  if (request.operation === 'project') {
    const text =
      request.scope.kind === 'node'
        ? projectScope(document, request.scope.nodeId).text
        : projectDocument(document).text;
    return {
      requestId: request.requestId,
      generation: request.generation,
      result: {
        kind: 'projected',
        baseRevision: request.baseRevision,
        scope: request.scope,
        text,
      },
    };
  }

  const parsed =
    request.scope.kind === 'node'
      ? parseScope(request.payload ?? '', document, request.scope.nodeId, {
          blockExists: () => true,
        })
      : parseDocument(request.payload ?? '', document, { blockExists: () => true });
  if (!parsed.ok) {
    return {
      requestId: request.requestId,
      generation: request.generation,
      result: {
        kind: 'parsed',
        ok: false,
        baseRevision: request.baseRevision,
        scope: request.scope,
        errors: parsed.errors,
      },
    };
  }
  const content = contentFromText(request.payload ?? '', request.scope);
  const patches: TransformPatch[] =
    parsed.patches.length === 0 || content === undefined
      ? []
      : [
          {
            op: 'replace',
            path: [
              'nodes',
              request.scope.kind === 'node' ? request.scope.nodeId : 'p1',
              'props',
              'content',
            ],
            value: content,
          },
        ];
  return {
    requestId: request.requestId,
    generation: request.generation,
    result: {
      kind: 'parsed',
      ok: true,
      baseRevision: request.baseRevision,
      scope: request.scope,
      patches,
    },
  };
}

class FakeTransformClient implements TransformWorkerClient {
  readonly operations: TransformRequest['operation'][] = [];
  readonly scopes: TransformScope[] = [];
  private readonly revisions = new Set<number>();
  private nextRequestId = 1;
  private terminated = false;
  private deferProjection = false;
  private heldProjection: { readonly release: () => void } | null = null;

  constructor(
    private readonly document: () => BuilderDocument,
    private readonly latencyMs = 0,
    private readonly parseFailure?: Error | undefined,
  ) {}

  setDocument(baseRevision: number): void {
    this.revisions.add(baseRevision);
  }

  request(input: TransformRequestInput): Promise<TransformResponse> {
    const request: TransformRequest = { ...input, requestId: this.nextRequestId };
    this.nextRequestId += 1;
    this.operations.push(request.operation);
    this.scopes.push(request.scope);
    const parseFailure = this.parseFailure;
    if (request.operation === 'parse' && parseFailure !== undefined) {
      return new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(parseFailure);
        }, this.latencyMs);
      });
    }
    const response = responseFor(request, this.document());
    if (request.operation === 'project' && this.deferProjection) {
      this.deferProjection = false;
      return new Promise((resolve) => {
        this.heldProjection = {
          release: () => {
            resolve(response);
          },
        };
      });
    }
    return this.latencyMs === 0
      ? Promise.resolve(response)
      : new Promise((resolve) => {
          setTimeout(() => {
            resolve(response);
          }, this.latencyMs);
        });
  }

  getSnapshot(): TransformWorkerClientSnapshot {
    const requestPosts = this.operations.length;
    return {
      busy: false,
      terminated: this.terminated,
      documentRevision: this.revisions.size === 0 ? null : Math.max(...this.revisions),
      active: null,
      coalesced: null,
      counts: {
        posts: requestPosts + this.revisions.size,
        requestPosts,
        documentPosts: this.revisions.size,
        responses: requestPosts,
        staleDrops: 0,
        applications: requestPosts,
        rejections: 0,
        teardowns: 0,
        terminationErrors: 0,
      },
    };
  }

  terminate(): void {
    this.terminated = true;
  }

  count(operation: TransformRequest['operation']): number {
    return this.operations.filter((entry) => entry === operation).length;
  }

  deferNextProjection(): void {
    this.deferProjection = true;
  }

  releaseDeferredProjection(): void {
    const heldProjection = this.heldProjection;
    if (heldProjection === null) {
      return;
    }
    this.heldProjection = null;
    heldProjection.release();
  }
}

function mount(
  options: {
    selectedId?: string | undefined;
    latencyMs?: number | undefined;
    parseFailure?: Error | undefined;
  } = {},
) {
  const harness = createKernelHarness();
  if (options.selectedId !== undefined) {
    harness.kernel.setSelection([options.selectedId]);
  }
  const client = new FakeTransformClient(
    () => harness.kernel.getDocument(),
    options.latencyMs,
    options.parseFailure,
  );
  const view = render(
    <CodeViewPanel kernel={harness.port} workerClient={client} debounceMs={DEBOUNCE_MS} />,
  );
  return { ...harness, client, view };
}

async function textareaReady(expected = 'Start'): Promise<HTMLTextAreaElement> {
  const textarea = screen.getByRole('textbox', { name: 'Document code' });
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Code view must expose a native textarea.');
  }
  await waitFor(() => {
    expect(textarea.value).toContain(expected);
  });
  return textarea;
}

async function replaceDraft(textarea: HTMLTextAreaElement, text: string): Promise<void> {
  const user = userEvent.setup();
  await user.clear(textarea);
  await user.paste(text);
}

function describedByIds(textarea: HTMLTextAreaElement): string[] {
  const describedBy = textarea.getAttribute('aria-describedby');
  if (describedBy === null) {
    throw new Error('The code textarea must have an aria-describedby relationship.');
  }
  return describedBy.split(/\s+/u).filter((id) => id.length > 0);
}

function expectDescribedByIdsToResolve(textarea: HTMLTextAreaElement): void {
  for (const id of describedByIds(textarea)) {
    expect(document.getElementById(id)).not.toBeNull();
  }
}

function editedDocument(content: string): BuilderDocument {
  const document = fixtureDocument();
  const node = document.nodes['p1'];
  if (node === undefined) {
    throw new Error('Fixture p1 must exist.');
  }
  node.props['content'] = content;
  return document;
}

describe('CodeViewPanel — failure surfaces (011 §4 p5)', () => {
  it('surfaces a worker rejection that is NOT a supersession, and changes nothing', async () => {
    // A superseded request is the client working as designed and must stay
    // silent; a real failure must reach the author instead of vanishing.
    const { kernel, view, dispose } = mount({ parseFailure: new Error('Worker exploded.') });
    const before = kernel.getDocument();
    const beforeTransactions = kernel.transactions().length;
    const textarea = await textareaReady();

    await replaceDraft(textarea, projectDocument(editedDocument('Never applied')).text);

    await waitFor(() => {
      expect(screen.getByText(/Worker exploded\./)).toBeInTheDocument();
    });
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
    // The author's text is theirs — a failure never rewrites the draft.
    expect(textarea.value).toContain('Never applied');
    expectDescribedByIdsToResolve(textarea);
    view.unmount();
    dispose();
  });

  it('names a NON-Error rejection rather than showing an empty reason', async () => {
    // Rejections cross a worker boundary; a thrown string is not exotic there.
    const { kernel, view, dispose } = mount({
      parseFailure: 'the worker refused' as unknown as Error,
    });
    const before = kernel.transactions().length;
    const textarea = await textareaReady();

    await replaceDraft(textarea, projectDocument(editedDocument('Also never')).text);

    await waitFor(() => {
      expect(screen.getByText(/the worker refused/)).toBeInTheDocument();
    });
    expect(kernel.transactions()).toHaveLength(before);
    view.unmount();
    dispose();
  });

  it('counts errors in the singular and the plural, never "1 errors"', async () => {
    const { view, dispose } = mount();
    const textarea = await textareaReady();

    await replaceDraft(textarea, '{ "schemaVersion": 1, "surface": "site" }');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Document code' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
    // The panel's own description, not the error list's summary.
    const description =
      document.getElementById(describedByIds(textarea)[0] ?? '')?.textContent ?? '';
    expect(description).toMatch(/\b1 code error\b|\b\d+ code errors\b/);
    expect(description).not.toMatch(/\b1 code errors\b/);
    view.unmount();
    dispose();
  });
});

describe('CodeViewPanel — T018/T022 US2 acceptance', () => {
  it('AC0: open → read → scroll → close records transactions +0 at the PANEL level', async () => {
    const { kernel, view, dispose } = mount();
    const before = kernel.transactions().length;
    const textarea = await textareaReady();

    textarea.scrollTop = 32;
    expect(textarea.scrollTop).toBe(32);
    view.unmount();

    expect(kernel.transactions()).toHaveLength(before);
    dispose();
  });

  it('close-race guard: an in-flight parse cannot dispatch after the panel unmounts', async () => {
    const { kernel, counts, client, view, dispose } = mount({ latencyMs: 40 });
    const before = kernel.getDocument();
    const beforeTransactions = kernel.transactions().length;
    const textarea = await textareaReady();

    await replaceDraft(textarea, projectDocument(editedDocument('Too late')).text);
    await waitFor(() => {
      expect(client.count('parse')).toBe(1);
    });
    view.unmount();
    await new Promise((resolve) => {
      setTimeout(resolve, 80);
    });

    expect(counts.dispatches).toBe(0);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
    dispose();
  });

  it('AC1: invalid → document unchanged + an error naming the line', async () => {
    const { kernel, counts, client, dispose } = mount();
    const before = kernel.getDocument();
    const beforeTransactions = kernel.transactions().length;
    const textarea = await textareaReady();

    await replaceDraft(textarea, '{\n  "broken":');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /line 2/i })).toBeInTheDocument();
    });
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
    expect(counts.dispatches).toBe(0);
    await new Promise((resolve) => {
      setTimeout(resolve, DEBOUNCE_MS * 2);
    });
    expect(client.count('parse')).toBe(1);
    expect(textarea).toHaveValue('{\n  "broken":');
    dispose();
  });

  it('AC2: valid → canvas document updates + history +1 through exactly ONE kernel dispatch', async () => {
    const { kernel, counts, dispose } = mount();
    const beforeTransactions = kernel.transactions().length;
    const textarea = await textareaReady();

    await replaceDraft(textarea, projectDocument(editedDocument('Changed')).text);

    await waitFor(() => {
      expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Changed');
    });
    expect(kernel.transactions()).toHaveLength(beforeTransactions + 1);
    expect(kernel.transactions().at(-1)?.author).toBe('codeview');
    expect(counts.dispatches).toBe(1);
    dispose();
  });

  it('AC3: one undo restores the exact pre-code-edit document', async () => {
    const { kernel, dispose } = mount();
    const before = structuredClone(kernel.getDocument());
    const textarea = await textareaReady();
    await replaceDraft(textarea, projectDocument(editedDocument('Undo me')).text);
    await waitFor(() => {
      expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Undo me');
    });

    expect(kernel.undo()).toBe(true);

    expect(kernel.getDocument()).toEqual(before);
    dispose();
  });

  it('AC4 / p3 debounce mutation guard: a valid typing burst applies at most once, counted', async () => {
    const { kernel, counts, client, dispose } = mount();
    const textarea = await textareaReady();
    const user = userEvent.setup();
    await user.click(textarea);
    const insertion = textarea.value.indexOf('Start') + 'Start'.length;
    textarea.setSelectionRange(insertion, insertion);

    await user.type(textarea, 'ABC', { skipClick: true });

    await waitFor(() => {
      expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('StartABC');
    });
    expect(counts.dispatches).toBe(1);
    expect(client.count('parse')).toBe(1);
    dispose();
  });

  it('w4 counted cache regression: three parses on one revision serialize the document exactly once', async () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const { counts, client, dispose } = mount();
    const textarea = await textareaReady();
    const documentSerializationCount = () =>
      stringify.mock.calls.filter(
        ([value]) =>
          isRecord(value) && Object.hasOwn(value, 'document') && Object.hasOwn(value, 'blockTypes'),
      ).length;

    await replaceDraft(textarea, '{');
    await waitFor(() => {
      expect(client.count('parse')).toBe(1);
    });
    await replaceDraft(textarea, '{\n  "first":');
    await waitFor(() => {
      expect(client.count('parse')).toBe(2);
    });
    await replaceDraft(textarea, '{\n  "second":');
    await waitFor(() => {
      expect(client.count('parse')).toBe(3);
    });

    expect(counts.dispatches).toBe(0);
    expect(documentSerializationCount()).toBe(1);
    dispose();
  });

  it('AC5: a door refusal surfaces its exact reason and changes nothing', async () => {
    const { kernel, counts, dispose } = mount();
    const before = kernel.getDocument();
    const beforeTransactions = kernel.transactions().length;
    const textarea = await textareaReady();
    const describedBy = textarea.getAttribute('aria-describedby');

    await replaceDraft(textarea, projectDocument(editedDocument('Forbidden')).text);

    await waitFor(() => {
      expect(screen.getByText('Policy refused the word Forbidden.')).toBeInTheDocument();
    });
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
    expect(counts.dispatches).toBe(1);
    expect(textarea.value).toContain('Forbidden');
    expect(textarea.getAttribute('aria-describedby')).toBe(describedBy);
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      'Policy refused the word Forbidden.',
    );
    dispose();
  });

  it('p5: a non-Error door refusal still surfaces its exact reason', async () => {
    const { kernel, dispose } = mount();
    const before = kernel.getDocument();
    const textarea = await textareaReady();

    await replaceDraft(textarea, projectDocument(editedDocument('String refusal')).text);

    await waitFor(() => {
      expect(screen.getByText('Policy supplied a string refusal.')).toBeInTheDocument();
    });
    expect(kernel.getDocument()).toBe(before);
    expect(textarea.value).toContain('String refusal');
    dispose();
  });

  it('p4 dirty-pin mutation guard: selection movement reports conflict and sends zero parses', async () => {
    const { kernel, counts, client, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    const exactDraft = textarea.value.replace('Start', 'Pinned draft');

    await replaceDraft(textarea, exactDraft);
    kernel.setSelection(['p2']);

    await waitFor(() => {
      expect(
        screen.getByText(/selection or document changed underneath this draft/i),
      ).toBeInTheDocument();
    });
    await new Promise((resolve) => {
      setTimeout(resolve, DEBOUNCE_MS * 2);
    });
    expect(textarea).toHaveValue(exactDraft);
    expect(client.count('parse')).toBe(0);
    expect(counts.dispatches).toBe(0);
    expect(kernel.getDocument().nodes['p2']?.props['content']).toBe('Second');
    dispose();
  });

  it('p4: a document revision underneath a dirty draft conflicts and retains the exact text', async () => {
    const { externalSet, client, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    const exactDraft = textarea.value.replace('Start', 'Revision-pinned');

    await replaceDraft(textarea, exactDraft);
    externalSet('p2', 'External update');

    await waitFor(() => {
      expect(
        screen.getByText(/selection or document changed underneath this draft/i),
      ).toBeInTheDocument();
    });
    expect(textarea).toHaveValue(exactDraft);
    expect(client.count('parse')).toBe(0);
    dispose();
  });

  it('p4 stale-baseline regression: an R1 draft typed after an R2 external edit conflicts without reverting R2', async () => {
    const { kernel, externalSet, counts, client, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    const authorDraft = textarea.value.replace('Start', 'Author draft from R1');
    client.deferNextProjection();

    externalSet('p1', 'External edit from R2');
    await waitFor(() => {
      expect(client.count('project')).toBe(2);
    });
    fireEvent.change(textarea, { target: { value: authorDraft } });

    await screen.findByRole('button', { name: 'Discard draft and reload' });
    await new Promise((resolve) => {
      setTimeout(resolve, DEBOUNCE_MS * 2);
    });
    expect(screen.getByText('conflict')).toBeInTheDocument();
    expect(textarea).toHaveValue(authorDraft);
    expect(client.count('parse')).toBe(0);
    expect(counts.dispatches).toBe(0);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('External edit from R2');
    client.releaseDeferredProjection();
    dispose();
  });

  it('p4 in-flight guard: a revision change after parse posts conflicts and dispatches zero', async () => {
    const { kernel, externalSet, counts, client, dispose } = mount({
      selectedId: 'p1',
      latencyMs: 40,
    });
    const textarea = await textareaReady();
    const exactDraft = textarea.value.replace('Start', 'Posted draft');

    await replaceDraft(textarea, exactDraft);
    await waitFor(() => {
      expect(client.count('parse')).toBe(1);
    });
    externalSet('p2', 'External after post');
    await screen.findByRole('button', { name: 'Discard draft and reload' });
    await new Promise((resolve) => {
      setTimeout(resolve, 80);
    });

    expect(textarea).toHaveValue(exactDraft);
    expect(counts.dispatches).toBe(0);
    expect(kernel.getDocument().nodes['p2']?.props['content']).toBe('External after post');
    dispose();
  });

  it('late-rejection guard: an obsolete parse failure cannot announce over a newer conflict', async () => {
    const { kernel, counts, client, dispose } = mount({
      selectedId: 'p1',
      latencyMs: 40,
      parseFailure: new Error('Obsolete worker failure.'),
    });
    const textarea = await textareaReady();
    const exactDraft = textarea.value.replace('Start', 'Rejected too late');

    await replaceDraft(textarea, exactDraft);
    await waitFor(() => {
      expect(client.count('parse')).toBe(1);
    });
    kernel.setSelection(['p2']);
    await screen.findByRole('button', { name: 'Discard draft and reload' });
    await new Promise((resolve) => {
      setTimeout(resolve, 80);
    });

    expect(textarea).toHaveValue(exactDraft);
    expect(counts.dispatches).toBe(0);
    expect(screen.getByRole('status', { name: 'Code view messages' })).not.toHaveTextContent(
      'The code check failed.',
    );
    expect(screen.queryByText('Obsolete worker failure.')).not.toBeInTheDocument();
    dispose();
  });

  it('p4: restoring a conflicted draft to its baseline clears the pin and follows selection', async () => {
    const { kernel, counts, client, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    const baseline = textarea.value;

    await replaceDraft(textarea, baseline.replace('Start', 'Temporary draft'));
    kernel.setSelection(['p2']);
    await screen.findByRole('button', { name: 'Discard draft and reload' });

    await replaceDraft(textarea, baseline);

    await waitFor(() => {
      expect(textarea.value).toContain('"rootId": "p2"');
    });
    expect(counts.dispatches).toBe(0);
    expect(client.count('parse')).toBe(0);
    dispose();
  });

  it('analysis C2: a CLEAN draft re-projects freely and follows the selected node', async () => {
    const { kernel, client, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady('p1');

    kernel.setSelection(['p2']);

    await waitFor(() => {
      expect(textarea.value).toContain('"rootId": "p2"');
    });
    expect(textarea.value).toContain('Second');
    expect(client.count('project')).toBe(2);
    dispose();
  });

  it('owner guard: a dirty draft conflicts instead of retargeting to a same-revision kernel', async () => {
    const first = createKernelHarness();
    first.kernel.setSelection(['p1']);
    const firstClient = new FakeTransformClient(() => first.kernel.getDocument());
    const view = render(
      <CodeViewPanel kernel={first.port} workerClient={firstClient} debounceMs={DEBOUNCE_MS} />,
    );
    const textarea = await textareaReady();
    const exactDraft = textarea.value.replace('Start', 'Owned by first');
    await replaceDraft(textarea, exactDraft);

    const second = createKernelHarness();
    second.kernel.setSelection(['p1']);
    const secondClient = new FakeTransformClient(() => second.kernel.getDocument());
    view.rerender(
      <CodeViewPanel kernel={second.port} workerClient={secondClient} debounceMs={DEBOUNCE_MS} />,
    );

    await screen.findByRole('button', { name: 'Discard draft and reload' });
    await new Promise((resolve) => {
      setTimeout(resolve, DEBOUNCE_MS * 2);
    });
    expect(textarea).toHaveValue(exactDraft);
    expect(first.counts.dispatches).toBe(0);
    expect(second.counts.dispatches).toBe(0);
    expect(secondClient.count('parse')).toBe(0);
    first.dispose();
    second.dispose();
  });

  it('owner guard: a clean draft re-projects from a replacement same-revision kernel', async () => {
    const first = createKernelHarness();
    first.kernel.setSelection(['p1']);
    const firstClient = new FakeTransformClient(() => first.kernel.getDocument());
    const view = render(
      <CodeViewPanel kernel={first.port} workerClient={firstClient} debounceMs={DEBOUNCE_MS} />,
    );
    const textarea = await textareaReady();

    const second = createKernelHarness(editedDocument('Replacement kernel'));
    second.kernel.setSelection(['p1']);
    const secondClient = new FakeTransformClient(() => second.kernel.getDocument());
    view.rerender(
      <CodeViewPanel kernel={second.port} workerClient={secondClient} debounceMs={DEBOUNCE_MS} />,
    );

    await waitFor(() => {
      expect(textarea.value).toContain('Replacement kernel');
    });
    expect(secondClient.count('project')).toBe(1);
    first.dispose();
    second.dispose();
  });

  it('p4/p6 conflict announcement regression: entering conflict updates the single polite live region exactly once', async () => {
    const { kernel, port, client, view, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    const status = screen.getByRole('status', { name: 'Code view messages' });
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => {
      records.push(...mutations);
    });
    fireEvent.change(textarea, {
      target: { value: textarea.value.replace('Start', 'Conflict announcement draft') },
    });
    observer.observe(status, { characterData: true, childList: true, subtree: true });

    kernel.setSelection(['p2']);

    await waitFor(() => {
      expect(status).toHaveTextContent(
        'Draft conflict. The selection or document changed. Nothing was applied.',
      );
    });
    await waitFor(() => {
      expect(records).toHaveLength(1);
    });
    expect(screen.getAllByRole('status', { name: 'Code view messages' })).toHaveLength(1);

    view.rerender(<CodeViewPanel kernel={port} workerClient={client} debounceMs={DEBOUNCE_MS} />);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    observer.disconnect();
    expect(records).toHaveLength(1);
    dispose();
  });

  it('p6 error association regression: every described-by id resolves and the error-list id exists only with errors', async () => {
    const { dispose } = mount();
    const textarea = await textareaReady();
    const baseline = textarea.value;
    const cleanIds = describedByIds(textarea);
    expect(cleanIds).toHaveLength(1);
    expectDescribedByIdsToResolve(textarea);
    expect(screen.queryByRole('list', { name: 'Code errors' })).not.toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-invalid', 'false');

    await replaceDraft(textarea, '{');

    const errorList = await screen.findByRole('list', { name: 'Code errors' });
    const errorListId = errorList.id;
    const invalidIds = describedByIds(textarea);
    expect(errorListId).not.toBe('');
    expect(invalidIds).toContain(cleanIds[0]);
    expect(invalidIds).toContain(errorListId);
    expectDescribedByIdsToResolve(textarea);
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('status', { name: 'Code view messages' })).toHaveLength(1);

    await replaceDraft(textarea, baseline);

    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Code errors' })).not.toBeInTheDocument();
    });
    expect(describedByIds(textarea)).toEqual(cleanIds);
    expect(describedByIds(textarea)).not.toContain(errorListId);
    expectDescribedByIdsToResolve(textarea);
    dispose();
  });

  it('p6 focus regression: discarding a conflict reloads the current scope and returns focus exactly to the textarea', async () => {
    const { kernel, dispose } = mount({ selectedId: 'p1' });
    const textarea = await textareaReady();
    await replaceDraft(textarea, textarea.value.replace('Start', 'Discard me'));
    kernel.setSelection(['p2']);
    const user = userEvent.setup();
    const discard = await screen.findByRole('button', { name: 'Discard draft and reload' });

    await user.click(discard);

    await waitFor(() => {
      expect(textarea.value).toContain('Second');
    });
    expect(textarea.value).not.toContain('Discard me');
    expect(textarea).toHaveFocus();
    dispose();
  });

  it('p6 RTL chrome regression: the panel inherits host direction while its JSON textarea stays LTR', async () => {
    const ltrDocumentHarness = createKernelHarness();
    const ltrDocumentClient = new FakeTransformClient(() =>
      ltrDocumentHarness.kernel.getDocument(),
    );
    const rtlHost = render(
      <div dir="rtl">
        <CodeViewPanel
          kernel={ltrDocumentHarness.port}
          workerClient={ltrDocumentClient}
          debounceMs={DEBOUNCE_MS}
        />
      </div>,
    );
    const rtlChrome = screen.getByRole('region', { name: 'Code view' });
    const rtlHostTextarea = await textareaReady();

    expect(window.getComputedStyle(rtlChrome).direction).toBe('rtl');
    expect(window.getComputedStyle(rtlHostTextarea).direction).toBe('ltr');
    rtlHost.unmount();
    ltrDocumentHarness.dispose();

    const rtlDocument = fixtureDocument();
    rtlDocument.dir = 'rtl';
    const rtlDocumentHarness = createKernelHarness(rtlDocument);
    const rtlDocumentClient = new FakeTransformClient(() =>
      rtlDocumentHarness.kernel.getDocument(),
    );
    render(
      <div dir="ltr">
        <CodeViewPanel
          kernel={rtlDocumentHarness.port}
          workerClient={rtlDocumentClient}
          debounceMs={DEBOUNCE_MS}
        />
      </div>,
    );
    const ltrChrome = screen.getByRole('region', { name: 'Code view' });
    const ltrHostTextarea = await textareaReady();

    expect(window.getComputedStyle(ltrChrome).direction).toBe('ltr');
    expect(window.getComputedStyle(ltrHostTextarea).direction).toBe('ltr');
    rtlDocumentHarness.dispose();
  });
});
