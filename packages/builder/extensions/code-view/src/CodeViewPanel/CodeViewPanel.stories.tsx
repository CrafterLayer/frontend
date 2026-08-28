import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { BuilderDocument, JsonValue, NodeId } from '@craftkit/builder-schema';
import { projectDocument } from '@craftkit/builder-transforms';

import type { TransformPatch, TransformResponse, TransformScope } from '../worker/protocol';
import type {
  TransformRequestInput,
  TransformWorkerClient,
  TransformWorkerClientSnapshot,
} from '../worker/client';
import { CodeViewPanel, type CodeViewKernel, type CodeViewKernelSnapshot } from './CodeViewPanel';

type StoryMode = 'ready' | 'invalid' | 'busy';

function storyDocument(dir: 'ltr' | 'rtl' = 'ltr'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: {},
        slots: { default: ['p1'] },
      },
      p1: { id: 'p1', type: 'text', props: { content: dir === 'rtl' ? 'مرحبا' : 'Launch' } },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentFromSource(source: string): JsonValue | undefined {
  try {
    const value: unknown = JSON.parse(source);
    if (!isRecord(value)) {
      return undefined;
    }
    const nodes = value['nodes'];
    if (!isRecord(nodes)) {
      return undefined;
    }
    const node = nodes['p1'];
    if (!isRecord(node)) {
      return undefined;
    }
    const props = node['props'];
    if (!isRecord(props)) {
      return undefined;
    }
    const content = props['content'];
    return typeof content === 'string' ? content : undefined;
  } catch {
    return undefined;
  }
}

class StoryKernel implements CodeViewKernel {
  readonly listeners = new Set<() => void>();
  readonly transactionLog: (readonly TransformPatch[])[] = [];
  private snapshot: CodeViewKernelSnapshot;

  constructor(document: BuilderDocument) {
    this.snapshot = {
      document,
      selection: [],
      revision: 0,
      blockTypes: ['page', 'text'],
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  dispatch = (patches: readonly TransformPatch[]) => {
    // The real codec emits NODE-granular patches (['nodes','p1'] with the whole
    // node — 011 §5's shape guard); the story's fake client fabricates the
    // prop-level shape. The door accepts both, refusing anything else.
    const contentOf = (): string | undefined => {
      for (const patch of patches) {
        const joined = patch.path.join('.');
        if (joined === 'nodes.p1.props.content' && typeof patch.value === 'string') {
          return patch.value;
        }
        if (joined === 'nodes.p1' && isRecord(patch.value)) {
          const props = patch.value['props'];
          if (isRecord(props) && typeof props['content'] === 'string') {
            return props['content'];
          }
        }
      }
      return undefined;
    };
    const contentPatch = { value: contentOf() };
    if (typeof contentPatch.value !== 'string') {
      throw new Error('The story door expected one text-property patch.');
    }
    const document = structuredClone(this.snapshot.document);
    const node = document.nodes['p1'];
    if (node === undefined) {
      throw new Error('The story document lost p1.');
    }
    node.props['content'] = contentPatch.value;
    this.transactionLog.push(patches);
    this.publish(document, this.snapshot.selection);
  };

  moveSelection(selection: readonly NodeId[]): void {
    this.publish(this.snapshot.document, selection);
  }

  private publish(document: Readonly<BuilderDocument>, selection: readonly NodeId[]): void {
    this.snapshot = {
      document,
      selection,
      revision: this.snapshot.revision + (Object.is(document, this.snapshot.document) ? 0 : 1),
      blockTypes: this.snapshot.blockTypes,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function emptyClientSnapshot(documentRevision: number | null): TransformWorkerClientSnapshot {
  return {
    busy: false,
    terminated: false,
    documentRevision,
    active: null,
    coalesced: null,
    counts: {
      posts: 0,
      requestPosts: 0,
      documentPosts: 0,
      responses: 0,
      staleDrops: 0,
      applications: 0,
      rejections: 0,
      teardowns: 0,
      terminationErrors: 0,
    },
  };
}

class StoryWorkerClient implements TransformWorkerClient {
  private documentRevision: number | null = null;

  constructor(
    private readonly readDocument: () => Readonly<BuilderDocument>,
    private readonly mode: StoryMode,
  ) {}

  setDocument(baseRevision: number, _payload: string): void {
    this.documentRevision = baseRevision;
  }

  request(input: TransformRequestInput): Promise<TransformResponse> {
    if (this.mode === 'busy') {
      return Promise.withResolvers<TransformResponse>().promise;
    }
    const scope: TransformScope = input.scope;
    if (input.operation === 'project') {
      return Promise.resolve({
        requestId: 1,
        generation: input.generation,
        result: {
          kind: 'projected',
          baseRevision: input.baseRevision,
          scope,
          text: projectDocument(this.readDocument()).text,
        },
      });
    }
    if (this.mode === 'invalid') {
      return Promise.resolve({
        requestId: 1,
        generation: input.generation,
        result: {
          kind: 'parsed',
          ok: false,
          baseRevision: input.baseRevision,
          scope,
          errors: [{ line: 2, message: 'Expected a property name.' }],
        },
      });
    }
    const content = contentFromSource(input.payload ?? '');
    if (content === undefined) {
      return Promise.resolve({
        requestId: 1,
        generation: input.generation,
        result: {
          kind: 'parsed',
          ok: false,
          baseRevision: input.baseRevision,
          scope,
          errors: [{ line: 1, message: 'The story draft is not valid JSON.' }],
        },
      });
    }
    return Promise.resolve({
      requestId: 1,
      generation: input.generation,
      result: {
        kind: 'parsed',
        ok: true,
        baseRevision: input.baseRevision,
        scope,
        patches: [{ op: 'replace', path: ['nodes', 'p1', 'props', 'content'], value: content }],
      },
    });
  }

  getSnapshot(): TransformWorkerClientSnapshot {
    return emptyClientSnapshot(this.documentRevision);
  }

  terminate(): void {
    // Story clients own no browser worker.
  }
}

function storyFixture(
  mode: StoryMode = 'ready',
  dir: 'ltr' | 'rtl' = 'ltr',
): { kernel: StoryKernel; workerClient: StoryWorkerClient } {
  const document = storyDocument(dir);
  const kernel = new StoryKernel(document);
  return {
    kernel,
    workerClient: new StoryWorkerClient(() => kernel.getSnapshot().document, mode),
  };
}

const cleanFixture = storyFixture();
const typingFixture = storyFixture();
const invalidFixture = storyFixture('invalid');
const conflictFixture = storyFixture();
const busyFixture = storyFixture('busy');
const rtlFixture = storyFixture('ready', 'rtl');

const meta = {
  title: 'Builder/Extensions/CodeViewPanel',
  component: CodeViewPanel,
  args: {
    kernel: cleanFixture.kernel,
    workerClient: cleanFixture.workerClient,
    debounceMs: 20,
    label: 'Document code',
  },
} satisfies Meta<typeof CodeViewPanel>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Clean: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByRole('textbox', { name: 'Document code' });
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Code view must expose a native textarea.');
    }
    const before = cleanFixture.kernel.transactionLog.length;
    const edited = textarea.value.replace('Launch', 'Launch!');
    await userEvent.clear(textarea);
    await userEvent.paste(edited);

    await waitFor(async () => {
      await expect(cleanFixture.kernel.transactionLog).toHaveLength(before + 1);
    });
    // Durable truth only: the "applied" status is TRANSIENT by design (the
    // fresh projection replaces it), so a real browser may never let us read
    // it. What must hold is the document — the re-projected text carries the
    // edit.
    await waitFor(async () => {
      await expect(textarea.value).toContain('Launch!');
    });
  },
};

export const Typing: Story = {
  args: {
    kernel: typingFixture.kernel,
    workerClient: typingFixture.workerClient,
    debounceMs: 60_000,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByRole('textbox', { name: 'Document code' });
    await userEvent.type(textarea, ' ');
    await expect(canvas.getByText('typing')).toBeInTheDocument();
  },
};

export const Invalid: Story = {
  args: {
    kernel: invalidFixture.kernel,
    workerClient: invalidFixture.workerClient,
    debounceMs: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByRole('textbox', { name: 'Document code' });
    await userEvent.type(textarea, 'x');
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: /Line 2:/ })).toBeInTheDocument();
    });
  },
};

export const Conflict: Story = {
  args: {
    kernel: conflictFixture.kernel,
    workerClient: conflictFixture.workerClient,
    debounceMs: 60_000,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    conflictFixture.kernel.moveSelection([]);
    await waitFor(async () => {
      await expect(canvas.getByText('clean')).toBeInTheDocument();
    });
    const textarea = await canvas.findByRole('textbox', { name: 'Document code' });
    await userEvent.type(textarea, ' ');
    conflictFixture.kernel.moveSelection(['p1']);
    await waitFor(async () => {
      await expect(canvas.getByText('conflict')).toBeInTheDocument();
    });
  },
};

export const Busy: Story = {
  args: {
    kernel: busyFixture.kernel,
    workerClient: busyFixture.workerClient,
  },
};

export const RightToLeft: Story = {
  args: {
    kernel: rtlFixture.kernel,
    workerClient: rtlFixture.workerClient,
    label: 'شفرة المستند',
  },
  globals: { direction: 'rtl' },
};

/**
 * BROWSER TRUTH (011 quickstart §5, tasks T029) — the one thing every unit
 * test above fakes: the thread hop. `createCodeViewWorkerClient()` constructs
 * the REAL module worker; if bundling, the `type: 'module'` entry, or the
 * message protocol were broken in any way, the projection below would simply
 * never arrive. A loopback cannot stand in for this — it would pass while the
 * real worker failed to boot (B3c §19: fakes prove the destination exists,
 * never that the road there works).
 */
export const RealModuleWorker: Story = {
  render: function RealModuleWorkerStory() {
    const [client, setClient] = useState<TransformWorkerClient | null>(null);
    const kernelRef = useRef<StoryKernel | null>(null);
    kernelRef.current ??= new StoryKernel(storyDocument());
    const kernel = kernelRef.current;
    // The counter must SUBSCRIBE like any other view — a paragraph reading a
    // mutable field re-renders never (the exact bug this story first shipped
    // with, caught by Chromium and kept as a comment on purpose).
    const transactionCount = useSyncExternalStore(
      kernel.subscribe,
      () => kernel.transactionLog.length,
    );
    useEffect(() => {
      let live = true;
      let created: TransformWorkerClient | null = null;
      void import('../index').then(({ createCodeViewWorkerClient }) =>
        createCodeViewWorkerClient().then((next) => {
          created = next;
          if (live) {
            setClient(next);
          } else {
            next.terminate();
          }
          return undefined;
        }),
      );
      return () => {
        live = false;
        created?.terminate();
      };
    }, []);
    if (client === null) {
      return <p>Starting the module worker…</p>;
    }

    return (
      <div style={{ padding: '1rem' }}>
        <CodeViewPanel kernel={kernelRef.current} workerClient={client} debounceMs={80} />
        <p data-testid="tx-count" style={{ font: '12px/1.4 monospace' }}>
          transactions: {transactionCount}
        </p>
        <button type="button">after panel</button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 1. THREAD PLACEMENT: the projection can only appear if the real module
    //    worker booted, received the document, ran the codec, and answered.
    const editor = await waitFor(
      () => {
        const found = canvas.getByRole('textbox');
        if (!(found instanceof HTMLTextAreaElement) || !found.value.includes('"Launch"')) {
          throw new Error('the module worker has not answered yet');
        }
        return found;
      },
      { timeout: 10_000 },
    );

    // 2. A REAL edit through the worker: change the text prop, wait for the
    //    debounced single apply — one transaction, exactly one.
    editor.focus();
    const edited = editor.value.replace('"Launch"', '"Shipped"');
    await userEvent.clear(editor);
    await userEvent.click(editor);
    await userEvent.paste(edited);
    await waitFor(
      async () => {
        await expect(canvas.getByTestId('tx-count')).toHaveTextContent(/transactions: 1/);
      },
      { timeout: 10_000 },
    );

    // 2b. The applied edit moved the document, so the panel re-projects. Until
    //     that lands the displayed text describes the PREVIOUS revision, and
    //     typing on it is a CONFLICT, not a parse error — that is the p4 law,
    //     not a race to paper over. Wait for the panel's own settled state.
    await waitFor(
      async () => {
        const status = canvasElement.querySelector('.bldr-code-view__status');
        await expect(status?.getAttribute('data-status')).toBe('clean');
      },
      { timeout: 10_000 },
    );

    // 3. INVALID text through the real worker: errors arrive, and NOTHING
    //    applies — the count must not move.
    await userEvent.clear(editor);
    await userEvent.click(editor);
    await userEvent.paste('{ "broken');
    await waitFor(
      async () => {
        await expect(editor).toHaveAttribute('aria-invalid', 'true');
      },
      { timeout: 10_000 },
    );
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent('transactions: 1');

    // 4. REAL Tab, with an EXACT destination. `not.toHaveFocus()` was the
    //    original assertion here and it was vacuous: focus falling to `<body>`
    //    — the very defect a focus gate exists to catch — passed it (011 T033
    //    review, finding 10). Every step below names where focus must be.
    editor.focus();
    await expect(editor).toHaveFocus();
    await userEvent.tab();
    // Errors are on screen from step 3, so the next stop is the diagnostics
    // themselves: a keyboard user can reach the line the panel is complaining
    // about, instead of tabbing past it into nothing.
    await expect(canvas.getByRole('button', { name: /Line \d+:/ })).toHaveFocus();

    // Reversible: Shift+Tab returns to the editor, not to the document body.
    await userEvent.tab({ shift: true });
    await expect(editor).toHaveFocus();

    // 5. NO TRAP: walking forward must actually leave the panel. Landing on
    //    `<body>` at any step is a failure, not a pass.
    const exit = canvas.getByRole('button', { name: 'after panel' });
    for (let step = 0; step < 8 && document.activeElement !== exit; step += 1) {
      await expect(document.activeElement).not.toBe(document.body);
      await userEvent.tab();
    }
    await expect(exit).toHaveFocus();
  },
};
