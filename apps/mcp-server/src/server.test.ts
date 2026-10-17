import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  defineBlockSchema,
  headlessBlockManifest,
  type ClockPort,
  type IdPort,
} from '@craftkit/builder/headless';

import { createMemoryDocumentStore, type DocumentStore } from './document-store';
import { createCraftkitMcpServer } from './server';

/**
 * The tests drive the server through a REAL MCP client over a linked in-memory
 * transport, so every call goes through the same request handlers, the same
 * zod input parsing, and the same result envelope a Claude Desktop connection
 * would. Calling the tool callbacks directly would skip exactly the layer most
 * likely to be wrong — an input schema that does not accept what the tool's
 * own description tells a model to send.
 */

/** A deterministic id source that also says how many ids it handed out. */
function countingIds(prefix: string): IdPort & { used: () => number } {
  let issued = 0;
  return {
    newId: () => {
      issued += 1;
      return `${prefix}-${String(issued)}`;
    },
    used: () => issued,
  };
}

/** A clock that only ever moves when someone asks it, and remembers its answer. */
function countingClock(): ClockPort & { last: () => number } {
  let ticks = 0;
  let latest = 0;
  return {
    now: () => {
      ticks += 1;
      latest = 1_700_000_000_000 + ticks * 1000;
      return latest;
    },
    last: () => latest,
  };
}

/*
  A block a headless host registers for itself. It stands in for everything the
  Node build cannot import — the marketing pack and the rest all reach react-dom
  through the renderer — and it is 'hero' because the page root's slot already
  admits that type, so the registration is enough to make inserts legal.
*/
const headlessHero = headlessBlockManifest('test-hero', '1.0.0', [
  defineBlockSchema({
    type: 'hero',
    description: 'A headless stand-in for the hero section, used to prove inserts work.',
    props: z.object({ headline: z.string().max(120).default('') }),
    examples: [{ prompt: 'a hero', node: { type: 'hero', props: { headline: 'Hi' } } }],
  }),
]);

interface Harness {
  readonly client: Client;
  readonly store: DocumentStore;
  readonly liveIds: IdPort & { used: () => number };
  readonly preflightIds: IdPort & { used: () => number };
  readonly clock: ClockPort & { last: () => number };
}

const openHarnesses: Client[] = [];

async function connect(): Promise<Harness> {
  const store = createMemoryDocumentStore();
  const liveIds = countingIds('live');
  const preflightIds = countingIds('scratch');
  const clock = countingClock();

  const server = createCraftkitMcpServer({
    store,
    ports: { ids: liveIds, clock },
    preflightPorts: () => ({ clock, ids: preflightIds }),
    extensions: [headlessHero],
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  openHarnesses.push(client);

  return { client, store, liveIds, preflightIds, clock };
}

/**
 * The SDK types a tool result as a union that still admits the pre-2025
 * `toolResult` shape, which this server never returns. Narrowing it once here
 * keeps every assertion below about the payload rather than about the envelope.
 */
interface ToolCallResult {
  content?: { type: string; text?: string }[];
  isError?: boolean;
}

/** The one text block every tool in this server returns, parsed back to JSON. */
async function call(
  harness: Harness,
  name: string,
  args: Record<string, unknown>,
): Promise<{ body: Record<string, unknown>; isError: boolean }> {
  const result = (await harness.client.callTool({ name, arguments: args })) as ToolCallResult;
  const first = result.content?.[0];
  if (first?.type !== 'text' || first.text === undefined) {
    throw new Error(`Expected a text result, got ${JSON.stringify(result)}`);
  }
  return {
    body: JSON.parse(first.text) as Record<string, unknown>,
    isError: result.isError === true,
  };
}

async function openDocument(harness: Harness): Promise<string> {
  const { body } = await call(harness, 'craftkit_open_document', {});
  return body['documentId'] as string;
}

afterEach(async () => {
  await Promise.all(openHarnesses.splice(0).map((client) => client.close()));
});

describe('the catalog a host gets with no configuration', () => {
  /*
    Every other test in this file overrides `extensions` with a single toy
    block, which is right for exercising the tools and blind to the question
    that decides whether this server is worth connecting at all: what vocabulary
    does a client get out of the box? It used to be the page root alone — a
    builder that can frame a page and put nothing in it. This test is the guard
    on that not regressing.
  */
  it('ships the real marketing vocabulary, not just the page root', async () => {
    const server = createCraftkitMcpServer({ store: createMemoryDocumentStore() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'default-catalog', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    openHarnesses.push(client);

    const result = (await client.callTool({
      name: 'craftkit_catalog',
      arguments: {},
    })) as ToolCallResult;
    const first = result.content?.[0];
    if (first?.type !== 'text' || first.text === undefined) {
      throw new Error(`Expected a text result, got ${JSON.stringify(result)}`);
    }
    const body = JSON.parse(first.text) as { blocks: { type: string }[] };
    const types = new Set(body.blocks.map(({ type }) => type));

    expect(types.has('page')).toBe(true);
    // The four a real request is answered with, and the ones a page-root-only
    // catalog could never offer.
    for (const type of ['hero', 'pricing', 'faq', 'testimonials']) {
      expect(types.has(type), type).toBe(true);
    }
    expect(types.size).toBeGreaterThan(30);
  });
});

describe('the CraftKit MCP server', () => {
  it('advertises every tool with an input schema a client can read', async () => {
    const harness = await connect();

    const { tools } = await harness.client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'craftkit_apply_plan',
      'craftkit_catalog',
      'craftkit_document',
      'craftkit_history',
      'craftkit_open_document',
      'craftkit_undo',
    ]);
    for (const tool of tools) {
      expect(tool.description ?? '', tool.name).not.toBe('');
      expect(tool.inputSchema.type, tool.name).toBe('object');
    }
  });

  it('reports the block vocabulary and command shapes without a document', async () => {
    const harness = await connect();

    const { body } = await call(harness, 'craftkit_catalog', {});

    const blocks = body['blocks'] as { type: string; props: unknown; slots: unknown }[];
    const page = blocks.find((block) => block.type === 'page');
    const hero = blocks.find((block) => block.type === 'hero');

    // The registry is the source of truth, so a host-registered block appears
    // beside the built-in root with no code change in the catalog tool.
    expect(hero).toBeDefined();
    // `expect.arrayContaining` is typed `any`; parking it in an `unknown` keeps
    // the matcher's meaning while satisfying no-unsafe-assignment.
    const allowsHero: unknown = expect.arrayContaining(['hero']);
    expect(page?.slots).toMatchObject({ default: { allow: allowsHero } });
    // The props arrive as JSON Schema, not as an opaque zod object.
    expect(page?.props).toMatchObject({ type: 'object' });
    expect(hero?.props).toMatchObject({ properties: { headline: { type: 'string' } } });

    const commands = body['commands'] as { name: string; args: unknown }[];
    const insertNode = commands.find((command) => command.name === 'insertNode');
    expect(insertNode?.args).toMatchObject({ properties: { parentId: { type: 'string' } } });
  });

  it('opens a document with ids and timestamps from the injected ports', async () => {
    const harness = await connect();

    const { body } = await call(harness, 'craftkit_open_document', {});

    // Not a nanoid: the id came from the port this test supplied, which is what
    // makes the whole server reproducible for a caller that needs it to be.
    expect(body['documentId']).toBe('live-1');
    expect(body['openedAt']).toBe(harness.clock.last());
    expect(body['document']).toMatchObject({ rootId: 'root', nodes: { root: { type: 'page' } } });
    expect(harness.store.ids()).toEqual(['live-1']);
  });

  it('reads back the document it is holding, and says so when the id is unknown', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);

    const found = await call(harness, 'craftkit_document', { documentId });
    expect(found.isError).toBe(false);
    expect(found.body['document']).toMatchObject({ rootId: 'root' });

    const missing = await call(harness, 'craftkit_document', { documentId: 'nope' });
    expect(missing.isError).toBe(true);
    expect(missing.body['error']).toBe('unknown-document');
    // The ids that DO exist come back, so the client can recover in one step.
    expect(missing.body['openDocumentIds']).toEqual([documentId]);
  });

  it('refuses a supplied document that the registry cannot accept, and opens nothing', async () => {
    const harness = await connect();

    const { body, isError } = await call(harness, 'craftkit_open_document', {
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: {
          root: { id: 'root', type: 'page', props: {}, slots: { default: ['ghost'] } },
          ghost: { id: 'ghost', type: 'notARegisteredType', props: {} },
        },
      },
    });

    expect(isError).toBe(true);
    expect(body['error']).toBe('invalid-document');
    /*
      Every reason, not the first: the unregistered type is refused twice over —
      once as an unknown node type and once as a child the page slot does not
      admit — and a client repairing the document needs both.
    */
    const errors = body['errors'] as { code: string; message: string }[];
    expect(errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['doc/unknown-type', 'doc/slot-not-allowed']),
    );
    expect(errors[0]?.message).toContain('notARegisteredType');
    expect(harness.store.ids()).toEqual([]);
  });

  it('applies a multi-command plan as ONE transaction', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);

    const { body, isError } = await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Title the page and give it a hero.',
        commands: [
          { command: 'setProp', args: { id: 'root', key: 'title', value: 'Home' } },
          {
            command: 'insertNode',
            args: { type: 'hero', parentId: 'root', props: { headline: 'Welcome' } },
          },
        ],
      },
    });

    expect(isError).toBe(false);
    // Two commands, one transaction: the "one change, one undo" promise, as a
    // number rather than a sentence.
    expect(body['transactionsAdded']).toBe(1);
    expect((body['applied'] as unknown[]).length).toBe(1);

    const document = body['document'] as { nodes: Record<string, { type: string }> };
    const heroId = Object.keys(document.nodes).find((id) => document.nodes[id]?.type === 'hero');
    expect(heroId).toBeDefined();
    // The node id came from the LIVE port, never from the preflight one.
    expect(heroId?.startsWith('live-')).toBe(true);
    expect(document.nodes['root']).toMatchObject({ props: { title: 'Home' } });
  });

  it('rehearses on scratch ports so the dry run never claims a live id', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);
    const liveBefore = harness.liveIds.used();

    const { body } = await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Add a hero.',
        commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
      },
    });

    // The rehearsal really happened: the plan door replayed the plan on a
    // scratch kernel, which minted ids from the port supplied for that purpose.
    expect(harness.preflightIds.used()).toBeGreaterThan(0);
    /*
      And not one of them landed. The live source advanced by exactly two — the
      transaction's own id and the inserted node's — while every scratch id it
      rehearsed with stayed in the scratch kernel. A server that handed ONE port
      to both would have burned the rehearsal's ids off the live counter, and
      the document would be carrying ids the next insert also believes are free.
    */
    expect(harness.liveIds.used()).toBe(liveBefore + 2);
    expect(JSON.stringify(body)).not.toContain('scratch-');
  });

  it("returns the validator's own reasons for a rejected plan, and changes nothing", async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);

    const { body, isError } = await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Do something the kernel does not know how to do.',
        commands: [
          { command: 'setProp', args: { id: 'root', key: 'title', value: 'Home' } },
          { command: 'teleportNode', args: { id: 'root' } },
        ],
      },
    });

    expect(isError).toBe(true);
    expect(body['error']).toBe('plan-rejected');
    // Verbatim: the code, the step index, and the message the kernel door
    // itself wrote. A client repairs the plan from these words.
    expect(body['issues']).toEqual([
      {
        code: 'unknown-command',
        step: 1,
        message: 'Step 1 names unknown command "teleportNode".',
      },
    ]);

    // Atomic: the legal first command did not land either.
    const after = await call(harness, 'craftkit_document', { documentId });
    expect(after.body['document']).toMatchObject({ nodes: { root: { props: {} } } });
    const history = await call(harness, 'craftkit_history', { documentId });
    expect(history.body['transactions']).toEqual([]);
  });

  it('rejects malformed command arguments with the schema message attached', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);

    const { body, isError } = await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Insert a hero into a parent that is not named.',
        commands: [{ command: 'insertNode', args: { type: 'hero' } }],
      },
    });

    expect(isError).toBe(true);
    const issues = body['issues'] as { code: string; message: string }[];
    expect(issues[0]?.code).toBe('invalid-args');
    expect(issues[0]?.message).toContain('Step 0 has invalid arguments for "insertNode"');
  });

  it('rejects a plan that would leave the document invalid, not just a malformed one', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);

    const { body, isError } = await call(harness, 'craftkit_apply_plan', {
      documentId,
      // 'page' is the root type; the slot list does not admit a second one.
      plan: {
        rationale: 'Nest a page inside the page.',
        commands: [{ command: 'insertNode', args: { type: 'page', parentId: 'root' } }],
      },
    });

    expect(isError).toBe(true);
    const issues = body['issues'] as { code: string; message: string }[];
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.message).not.toBe('');
  });

  it('reports history and undoes a whole plan in one step', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);
    await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Title the page and give it a hero.',
        commands: [
          { command: 'setProp', args: { id: 'root', key: 'title', value: 'Home' } },
          { command: 'insertNode', args: { type: 'hero', parentId: 'root' } },
        ],
      },
    });

    const history = await call(harness, 'craftkit_history', { documentId });
    const transactions = history.body['transactions'] as {
      id: string;
      author: string;
      ts: number;
      patchCount: number;
    }[];
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.author).toBe('ai');
    // The timestamp came from the injected clock, not from Date.now().
    expect(transactions[0]?.ts).toBeLessThanOrEqual(harness.clock.last());
    expect(transactions[0]?.ts).toBeGreaterThan(1_700_000_000_000);
    expect(transactions[0]?.patchCount).toBeGreaterThan(1);
    expect(history.body['canUndo']).toBe(true);

    const undone = await call(harness, 'craftkit_undo', { documentId });
    expect(undone.body['undone']).toBe(true);
    expect(undone.body['canRedo']).toBe(true);
    // BOTH commands are gone: the plan was one history entry.
    expect(undone.body['document']).toMatchObject({ nodes: { root: { props: {} } } });
    expect(Object.keys((undone.body['document'] as { nodes: object }).nodes)).toEqual(['root']);

    const empty = await call(harness, 'craftkit_undo', { documentId });
    expect(empty.body['undone']).toBe(false);
  });

  it('resets a document when opened again under the same id', async () => {
    const harness = await connect();
    const documentId = await openDocument(harness);
    await call(harness, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Title the page.',
        commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Home' } }],
      },
    });

    const reopened = await call(harness, 'craftkit_open_document', { documentId });

    expect(reopened.body['documentId']).toBe(documentId);
    expect(reopened.body['document']).toMatchObject({ nodes: { root: { props: {} } } });
    const history = await call(harness, 'craftkit_history', { documentId });
    expect(history.body['transactions']).toEqual([]);
    expect(harness.store.ids()).toEqual([documentId]);
  });
});
