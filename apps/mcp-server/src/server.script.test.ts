import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryDocumentStore } from './document-store';
import { createCraftkitMcpServer } from './server';

/**
 * Tool steps and edit scripts over MCP (agent-script DESIGN §A.13).
 *
 * `craftkit_apply_plan` used to hand a plan straight to the door, so a
 * `{"command":"tool"}` step — and with it every `script.run` — was refused as
 * an unknown command. These drive the server through a real MCP client, as
 * server.test.ts does, with the DEFAULT vocabulary (the marketing schemas)
 * and the server's own Node worker runner: the QuickJS sandbox in a real
 * `worker_threads` worker, not an in-thread stand-in.
 */

interface ToolCallResult {
  content?: { type: string; text?: string }[];
  isError?: boolean;
}

interface DocumentJson {
  readonly rootId: string;
  readonly nodes: Record<string, { type: string; props: Record<string, unknown> }>;
}

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function connect(): Promise<Client> {
  const server = createCraftkitMcpServer({ store: createMemoryDocumentStore() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'script-test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  clients.push(client);
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ body: Record<string, unknown>; isError: boolean }> {
  const result = (await client.callTool({ name, arguments: args })) as ToolCallResult;
  const first = result.content?.[0];
  if (first?.type !== 'text' || first.text === undefined) {
    throw new Error(`Expected a text result, got ${JSON.stringify(result)}`);
  }
  return {
    body: JSON.parse(first.text) as Record<string, unknown>,
    isError: result.isError === true,
  };
}

/** A hero with two action buttons and a closing button: three buttons in three nodes. */
const PAGE_WITH_BUTTONS = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero-1', 'cta-c'] } },
    'hero-1': {
      id: 'hero-1',
      type: 'hero',
      props: { heading: 'Ship pages faster' },
      slots: { actions: ['cta-a', 'cta-b'] },
    },
    'cta-a': { id: 'cta-a', type: 'cta', props: { label: 'Start free' } },
    'cta-b': { id: 'cta-b', type: 'cta', props: { label: 'Book a demo', emphasis: 'secondary' } },
    'cta-c': { id: 'cta-c', type: 'cta', props: { label: 'Talk to sales' } },
  },
};

const BUTTONS = ['cta-a', 'cta-b', 'cta-c'] as const;

async function openWithButtons(client: Client): Promise<{ id: string; document: DocumentJson }> {
  const { body, isError } = await call(client, 'craftkit_open_document', {
    document: PAGE_WITH_BUTTONS,
  });
  expect(isError, JSON.stringify(body)).toBe(false);
  return { id: body['documentId'] as string, document: body['document'] as DocumentJson };
}

function scriptStep(code: string): unknown {
  return { command: 'tool', args: { name: 'script.run', input: { code } } };
}

describe('craftkit_apply_plan with agent tool steps', () => {
  it('expands a theme.apply step and applies it as ONE transaction', async () => {
    const client = await connect();
    const opened = await call(client, 'craftkit_open_document', {});
    const documentId = opened.body['documentId'] as string;

    const { body, isError } = await call(client, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Make the accent emerald.',
        commands: [
          { command: 'tool', args: { name: 'theme.apply', input: { accent: 'emerald-700' } } },
        ],
      },
    });

    expect(isError, JSON.stringify(body)).toBe(false);
    expect(body['transactionsAdded']).toBe(1);
    expect(body['applied']).toHaveLength(1);
    // The tool became the kernel step it stands for: the page kit, written on the root.
    const root = (body['document'] as DocumentJson).nodes['root'];
    expect(typeof root?.props['pageCss']).toBe('string');
    expect(String(root?.props['pageCss'])).toContain('--ck-');
    // No script ran, so no script report rides along.
    expect(body['scripts']).toBeUndefined();
  });
});

describe('craftkit_apply_plan with an edit script', () => {
  it('rounds every button in ONE transaction, and craftkit_undo reverts all of it', async () => {
    const client = await connect();
    const { id: documentId, document: before } = await openWithButtons(client);

    const { body, isError } = await call(client, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Round every button.',
        commands: [scriptStep("ck.style(ck.find({kind:'button'}),{borderRadius:'full'})")],
      },
    });

    expect(isError, JSON.stringify(body)).toBe(false);
    expect(body['transactionsAdded']).toBe(1);
    expect(body['applied']).toHaveLength(1);
    const after = body['document'] as DocumentJson;
    // Every button changed, and nothing but the buttons did.
    for (const id of BUTTONS) {
      expect(after.nodes[id]?.props, id).not.toEqual(before.nodes[id]?.props);
      expect(JSON.stringify(after.nodes[id]?.props), id).toContain('full');
    }
    expect(after.nodes['hero-1']).toEqual(before.nodes['hero-1']);
    expect(after.nodes['root']).toEqual(before.nodes['root']);
    // The run is reported for the person: one script, coalesced to one write per button.
    const scripts = body['scripts'] as { step: number; steps: number }[];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.step).toBe(0);
    expect(scripts[0]?.steps).toBe(BUTTONS.length);

    const undone = await call(client, 'craftkit_undo', { documentId });
    expect(undone.body['undone']).toBe(true);
    expect(undone.body['document']).toEqual(before);
    expect(undone.body['canUndo']).toBe(false);
  }, 30_000);

  it('refuses a script that does not parse with an E_SYNTAX repair message, and applies nothing', async () => {
    const client = await connect();
    const { id: documentId, document: before } = await openWithButtons(client);

    const { body, isError } = await call(client, 'craftkit_apply_plan', {
      documentId,
      plan: {
        rationale: 'Round every button.',
        commands: [scriptStep("ck.style(ck.find({kind:'button'}),{borderRadius:'full'}")],
      },
    });

    expect(isError).toBe(true);
    expect(body['error']).toBe('plan-rejected');
    const issues = body['issues'] as { code: string; message: string; step?: number }[];
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.code).toBe('invalid-args');
    expect(issues[0]?.message).toContain('E_SYNTAX');
    expect(issues[0]?.step).toBe(0);

    const history = await call(client, 'craftkit_history', { documentId });
    expect(history.body['transactions']).toEqual([]);
    const now = await call(client, 'craftkit_document', { documentId });
    expect(now.body['document']).toEqual(before);
  }, 30_000);
});
