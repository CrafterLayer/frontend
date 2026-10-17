import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  applyAiPlan,
  blockPropsJsonSchema,
  commandArgsJsonSchema,
  craftkitHeadlessBlocks,
  headlessBlockManifest,
  marketingBlockSchemas,
  createBuilder,
  resolveAiCommandPolicy,
  systemClock,
  systemIds,
  validateAiPlan,
  type AiValidationPorts,
  type BuilderDocument,
  type BuilderError,
  type BuilderKernel,
  type ClockPort,
  type IdPort,
  type RegisteredBlock,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder/headless';
// script-servers additions (2026-10-08): tool, editTree and script.run steps over MCP (agent-script DESIGN §A.13).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createNodeScriptRunner,
  expandAgentTools,
  expandScriptSteps,
  expandTreeEdits,
  type AiEffectiveCommandPolicy,
  type AiPlanValidationIssue,
  type ScriptRunner,
  type ScriptRunReport,
} from '@craftkit/builder/headless';
// end script-servers additions

import {
  createMemoryDocumentStore,
  type DocumentSession,
  type DocumentStore,
} from './document-store';

export interface CraftkitMcpServerOptions {
  /** Where open documents live. Defaults to an in-process map. */
  store?: DocumentStore;
  /**
   * The LIVE kernel's deterministic capabilities (Law D). Document ids and
   * every node id come from `ids`; every transaction timestamp and the
   * `openedAt` a client is told come from `clock`. Nothing in this package
   * calls `Date.now()` or `Math.random()` itself, which is what makes a test
   * able to assert on an exact id and an exact timestamp.
   */
  ports?: { ids?: IdPort; clock?: ClockPort };
  /**
   * A SEPARATE capability set for the AI preflight, called once per rehearsal.
   *
   * The plan door validates by replaying the plan on a scratch kernel. That
   * kernel must not borrow the live one's id source: a shared DETERMINISTIC
   * source hands the rehearsal the very ids the real document is about to
   * claim, so the safety check corrupts the thing it exists to protect. The
   * default returns the system ports, whose ids never repeat.
   */
  preflightPorts?: () => AiValidationPorts;
  /**
   * Block vocabulary REPLACING the default, for a host that wants its own.
   *
   * The default is the page root plus the thirty-two marketing schemas — the
   * vocabulary the product actually ships — reached through
   * `@craftkit/builder-blocks-marketing/schemas`, a schema-only entry on that
   * pack whose own guard test pins its entire import graph to
   * `@craftkit/builder-schema` and `zod`. Before that entry existed this server
   * could offer a client a page root and nothing to put inside it, which is a
   * builder that cannot build.
   *
   * `craftkit_catalog` reports whatever ends up in the registry rather than a
   * hard-coded list, so the answer stays true under any override.
   */
  extensions?: readonly TrustedExtensionManifest[];
  // script-servers additions (2026-10-08)
  /**
   * The `worker_threads` file the `script.run` sandbox runs in. The built
   * server finds its own `dist/script-worker.mjs` (vite.config.ts emits it next
   * to `main.js`); run from source (tests), builder-ai's `sandbox-worker.node.mjs`
   * is used. A host bundling this server elsewhere passes its own.
   */
  scriptWorkerUrl?: URL;
  /**
   * A script runner used INSTEAD of the server's own Node worker runner. Only
   * for an embedding host that already owns one: an in-thread runner has no
   * hard stop and must never run plans from an untrusted client.
   */
  scriptRunner?: ScriptRunner;
  // end script-servers additions
}

/** The document-shaped half of every tool's input, described once. */
const documentIdArg = z.string().min(1).describe('The id returned by craftkit_open_document.');

const planArg = z
  .object({
    rationale: z
      .string()
      .describe('Why this change, in one sentence. The kernel refuses an empty rationale.'),
    commands: z
      .array(
        z.object({
          command: z
            .string()
            .describe('A registered kernel command, e.g. insertNode, setProp, removeNode.'),
          args: z
            .unknown()
            .describe('The command arguments, as JSON. Shapes come from craftkit_catalog.'),
          title: z.string().optional().describe('Optional human sentence for this step.'),
        }),
      )
      .describe('The steps, in order. They are applied as ONE transaction or not at all.'),
    followUp: z
      .string()
      .optional()
      .describe(
        'Optional wording for the next request when this plan is one stage of a larger job.',
      ),
  })
  .describe('An AI plan: exactly the shape @craftkit/builder-ai providers emit.');

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/**
 * A refusal the CLIENT is expected to read and act on, not a transport fault.
 *
 * `isError` is what tells an MCP client to hand the text back to the model
 * instead of surfacing a crash, which is the whole point of a rejected plan:
 * the reasons are the repair instructions.
 */
function refusal(value: unknown): CallToolResult {
  return { ...jsonResult(value), isError: true };
}

function serializeError(error: BuilderError): unknown {
  return {
    code: error.code,
    message: error.message,
    ...(error.path === undefined ? {} : { path: error.path }),
  };
}

function serializeTransaction(tx: Transaction): unknown {
  return {
    id: tx.id,
    command: tx.command,
    author: tx.author,
    ts: tx.ts,
    /*
      The patch COUNT rather than the patches. A grouped AI plan produces one
      transaction carrying every write it made, and a ten-section page is
      thousands of patch entries — a history tool that inlined them would blow
      a model's context to answer "what happened so far?".
    */
    patchCount: tx.patches.length,
  };
}

/**
 * What a block accepts, as JSON a remote caller can actually read.
 *
 * The props are a live zod object in the registry, which cannot cross a wire;
 * `blockPropsJsonSchema` is the projection the builder already uses to teach a
 * model the same thing, so the MCP catalog and the AI context can never
 * disagree about what a block takes.
 */
function serializeBlock(block: RegisteredBlock): unknown {
  const { schema } = block;
  return {
    type: schema.type,
    description: schema.description,
    props: blockPropsJsonSchema(schema),
    slots: Object.fromEntries(
      Object.entries(schema.slots ?? {}).map(([name, decl]) => [
        name,
        { allow: decl.allow, ...(decl.max === undefined ? {} : { max: decl.max }) },
      ]),
    ),
    examples: schema.examples,
  };
}

// script-servers additions (2026-10-08)
/**
 * The worker the BUILT server ships: `dist/script-worker.mjs`, next to the
 * bundle this line ends up in (vite.config.ts). Run from source there is no
 * such file beside `src/server.ts`, and the runner's own default — builder-ai's
 * `sandbox-worker.node.mjs`, plain ESM Node loads as it is — applies.
 */
function builtScriptWorker(): URL | undefined {
  const url = new URL('./script-worker.mjs', import.meta.url);
  return existsSync(fileURLToPath(url)) ? url : undefined;
}

/** A plan with its script, tool and editTree steps turned into kernel steps, or why it could not be. */
type ExpandedPlan =
  | { readonly ok: true; readonly plan: unknown; readonly scripts: readonly ScriptRunReport[] }
  | { readonly ok: false; readonly issues: readonly AiPlanValidationIssue[] };
// end script-servers additions

export function createCraftkitMcpServer(options: CraftkitMcpServerOptions = {}): McpServer {
  const store = options.store ?? createMemoryDocumentStore();
  const ids = options.ports?.ids ?? systemIds;
  const clock = options.ports?.clock ?? systemClock;
  const preflightPorts = options.preflightPorts ?? (() => ({ clock: systemClock, ids: systemIds }));
  /*
    Two manifests, not one merged list: the root contributes `page` and the
    pack contributes only sections, and two manifests declaring the same block
    type is a registry conflict rather than a merge.
  */
  const extensions: TrustedExtensionManifest[] = [
    craftkitHeadlessBlocks,
    ...(options.extensions ?? [
      headlessBlockManifest('blocks-marketing-schemas', '0.1.0', marketingBlockSchemas),
    ]),
  ];

  function newKernel(document?: BuilderDocument): BuilderKernel {
    return createBuilder({
      extensions,
      ports: { clock, ids },
      ...(document === undefined ? {} : { document }),
    });
  }

  /**
   * Resolve a document id to its session, or produce the refusal to return.
   *
   * Every tool but `craftkit_open_document` needs this, and each one needs the
   * SAME answer: an unknown id is a client mistake that the client can fix by
   * opening a document, so it comes back as readable text listing the ids that
   * do exist rather than as a thrown error.
   */
  function session(id: string): DocumentSession | CallToolResult {
    const found = store.get(id);
    if (found !== undefined) return found;
    return refusal({
      error: 'unknown-document',
      message: `No open document with id "${id}". Call craftkit_open_document first.`,
      openDocumentIds: store.ids(),
    });
  }

  function isSession(value: DocumentSession | CallToolResult): value is DocumentSession {
    return 'kernel' in value;
  }

  // script-servers additions (2026-10-08)
  /*
    ONE script runner per server, started by the first `script.run` step: the
    QuickJS sandbox in a `worker_threads` worker with a 1 s interrupt, a 3 s
    hard stop and a 16 MB heap (builder-ai `createNodeScriptRunner`). Never the
    in-thread runner: plans here come from a remote client. A plan without a
    script never starts it, and it is disposed with the connection below.
  */
  const scriptWorkerUrl = options.scriptWorkerUrl ?? builtScriptWorker();
  let scriptWorker: ScriptRunner | undefined;
  const scriptRunner: ScriptRunner = options.scriptRunner ?? {
    run: (request) => {
      scriptWorker ??= createNodeScriptRunner(
        scriptWorkerUrl === undefined ? {} : { workerUrl: scriptWorkerUrl },
      );
      return scriptWorker.run(request);
    },
    dispose: () => {
      scriptWorker?.dispose();
      scriptWorker = undefined;
    },
  };

  /**
   * The plan's non-kernel steps expanded BEFORE the door, in the editor's own
   * order (generate-plan.ts): `script.run` first, whose queued writes become
   * ordinary kernel steps (coalesced per node and prop, still one plan); then
   * the agent tool steps; then `editTree`. Each issue is an `invalid-args`
   * whose message is the repair instruction — a script's carries its `E_*`
   * code — so a refusal hands the client exactly what to fix.
   */
  async function expandPlan(
    plan: unknown,
    kernel: BuilderKernel,
    policy: AiEffectiveCommandPolicy,
  ): Promise<ExpandedPlan> {
    const scripts = await expandScriptSteps(plan, kernel, { runner: scriptRunner, policy });
    if (scripts.issues.length > 0) return { ok: false, issues: scripts.issues };
    const tools = expandAgentTools(scripts.plan, kernel);
    const trees = expandTreeEdits(tools.plan, kernel);
    const issues = [...tools.issues, ...trees.issues];
    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, plan: trees.plan, scripts: scripts.runs };
  }
  // end script-servers additions

  const server = new McpServer(
    { name: 'craftkit-builder', version: '0.1.0' },
    {
      instructions:
        'Create and edit CraftKit documents through the builder kernel. Read craftkit_catalog ' +
        'first: it lists the block types this server has registered and the JSON each command ' +
        'takes. Then open a document, and change it with craftkit_apply_plan — every plan is ' +
        'validated by the same door the CraftKit editor uses, and a rejected plan comes back ' +
        'with the reasons, which are the repair instructions.',
    },
  );
  // script-servers additions (2026-10-08): a live worker keeps Node running, so it ends with the connection.
  const closeConnection = server.server.onclose;
  server.server.onclose = () => {
    closeConnection?.();
    scriptWorker?.dispose();
    scriptWorker = undefined;
  };
  // end script-servers additions

  server.registerTool(
    'craftkit_catalog',
    {
      title: 'CraftKit catalog',
      description:
        'The block types this server can put in a document, what props each accepts (as JSON ' +
        'Schema), which types each slot allows, and the kernel commands a plan may use with ' +
        'their argument schemas. Read this before writing a plan.',
      inputSchema: {
        documentId: documentIdArg
          .optional()
          .describe(
            "An open document, to report ITS registry. Omit for the server's default vocabulary.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    ({ documentId }) => {
      let kernel: BuilderKernel;
      if (documentId === undefined) {
        kernel = newKernel();
      } else {
        const found = session(documentId);
        if (!isSession(found)) return found;
        kernel = found.kernel;
      }
      const registry = kernel.context.registry;
      return jsonResult({
        blocks: registry.blocks().map(serializeBlock),
        commands: registry.commandNames().map((name) => {
          const command = registry.command(name);
          return {
            name,
            /*
              A name with no schema cannot happen — `commandNames()` reads the
              same table `command()` does — but the lookup is typed as
              possibly-absent, and inventing a non-null assertion here would be
              a lie the type system is right to refuse.
            */
            args: command === undefined ? null : commandArgsJsonSchema(command),
          };
        }),
      });
    },
  );

  server.registerTool(
    'craftkit_open_document',
    {
      title: 'Open a CraftKit document',
      description:
        'Start a new in-memory document, or reset an existing one. Pass `document` to load ' +
        'existing document JSON; it is validated against the registry before it is accepted, ' +
        'so a document that could not be edited safely is never opened. Returns the id every ' +
        'other tool takes, and the document JSON.',
      inputSchema: {
        documentId: documentIdArg
          .optional()
          .describe('Reuse or reset this id. Omit to mint a new one from the injected id port.'),
        /*
          `.optional()` is load-bearing: zod 4 treats a bare `z.unknown()` as a
          REQUIRED key, so without it the SDK refuses `{}` — "expected
          nonoptional, received undefined at document" — and starting a blank
          document, the commonest call this server takes, is impossible.
        */
        document: z
          .unknown()
          .optional()
          .describe('Existing CraftKit document JSON to load. Omit to start from an empty page.'),
        surface: z
          .string()
          .optional()
          .describe("The surface a new document targets. Defaults to 'site'."),
        dir: z.enum(['ltr', 'rtl']).optional().describe("Content direction. Defaults to 'ltr'."),
      },
    },
    ({ documentId, document, surface, dir }) => {
      let kernel: BuilderKernel;
      if (document === undefined) {
        kernel = createBuilder({
          extensions,
          ports: { clock, ids },
          ...(surface === undefined ? {} : { surface }),
          ...(dir === undefined ? {} : { dir }),
        });
      } else {
        /*
          The cast is the narrow point where untrusted JSON becomes a document,
          and it is immediately paid for: `kernel.validate()` runs the same
          structural AND registry-aware check the editor runs on load, and a
          document with even one error is refused before it reaches the store.
          Nothing downstream ever sees an unvalidated document.
        */
        try {
          kernel = newKernel(document as BuilderDocument);
        } catch (cause) {
          return refusal({
            error: 'unreadable-document',
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
        const errors: BuilderError[] = kernel.validate();
        if (errors.length > 0) {
          return refusal({
            error: 'invalid-document',
            message:
              'The supplied document is not valid against this registry; nothing was opened.',
            errors: errors.map(serializeError),
          });
        }
      }

      const id = documentId ?? ids.newId();
      const openedAt = clock.now();
      store.put({ id, kernel, openedAt });
      return jsonResult({ documentId: id, openedAt, document: kernel.getDocument() });
    },
  );

  server.registerTool(
    'craftkit_document',
    {
      title: 'Read a CraftKit document',
      description: 'The current JSON of an open document, exactly as the kernel holds it.',
      inputSchema: { documentId: documentIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ documentId }) => {
      const found = session(documentId);
      if (!isSession(found)) return found;
      return jsonResult({
        documentId: found.id,
        openedAt: found.openedAt,
        document: found.kernel.getDocument(),
      });
    },
  );

  server.registerTool(
    'craftkit_apply_plan',
    {
      title: 'Apply a CraftKit plan',
      description:
        'Run a plan through the REAL CraftKit validator and, if it passes, apply every command ' +
        'as ONE transaction — one history entry, one undo, all-or-nothing. A plan that names an ' +
        'unknown command, sends malformed arguments, or would leave the document invalid is ' +
        "REFUSED, and the validator's own reasons come back unchanged so they can be repaired " +
        'and resubmitted. Nothing is half-applied.' +
        // script-servers additions (2026-10-08): tool and script steps (agent-script DESIGN §A.13).
        ' Besides kernel commands, a step may be an agent tool the server expands before the door, ' +
        '{"command":"tool","args":{"name":"theme.apply","input":{"accent":"emerald-700"}}}, or ONE ' +
        'edit script for the same change on many elements or content built from data: ' +
        '{"command":"tool","args":{"name":"script.run","input":{"code":"ck.style(ck.find({kind:' +
        "'button'}),{borderRadius:'full'})\"}}}. The code is plain JavaScript run once in a " +
        'sandbox (no import, await, network or DOM; 1 s of CPU). It reads the page with ' +
        'ck.find({kind?,text?,section?}) -> [{id,kind,text,node,section,part?,index?,src?,href?}] ' +
        'and ck.pages(), queues writes with ck.set(els,{text?,href?,src?,alt?}), ' +
        "ck.style(els,{borderRadius:'full',textColor:'accent'}) and ck.tool(name,input), and " +
        'gets ck.photos(topic,n), ck.fmt.num/money and ck.note(text). Its writes join THIS plan: ' +
        'still one transaction and one undo. A refused script names an E_* code and how to fix ' +
        'it. editTree steps are expanded here too.',
      // end script-servers additions
      inputSchema: {
        documentId: documentIdArg,
        plan: planArg,
        label: z
          .string()
          .optional()
          .describe("History label for the transaction. Defaults to 'AI: <rationale>'."),
      },
    },
    async ({ documentId, plan, label }) => {
      const found = session(documentId);
      if (!isSession(found)) return found;
      const { kernel } = found;

      const policy = resolveAiCommandPolicy({
        registeredCommands: [...kernel.context.registry.commandNames()],
      });
      // script-servers additions (2026-10-08): script, tool and editTree steps become kernel steps first.
      const expanded = await expandPlan(plan, kernel, policy);
      if (!expanded.ok) {
        return refusal({
          error: 'plan-rejected',
          message:
            'A script, tool or editTree step could not be expanded into kernel steps. Nothing was applied.',
          issues: expanded.issues,
        });
      }
      // end script-servers additions
      /*
        The plan is handed over as it arrived. `validateAiPlan` takes `unknown`
        on purpose — it is the parser as well as the checker — so re-shaping it
        here would mean writing a second parser whose disagreements with the
        real one would show up as plans this server accepted and the editor
        would not.
      */
      const verdict = validateAiPlan(expanded.plan, kernel, preflightPorts(), policy);
      if (!verdict.ok) {
        return refusal({
          error: 'plan-rejected',
          message: 'The plan did not pass the kernel door. Nothing was applied.',
          issues: verdict.issues,
        });
      }

      const before = kernel.transactions().length;
      const applied = applyAiPlan({
        kernel,
        validationPorts: preflightPorts(),
        plan: verdict.plan,
        policy,
        ...(label === undefined ? {} : { label }),
      });
      return jsonResult({
        documentId: found.id,
        applied: applied.transactions.map(serializeTransaction),
        /*
          Proof of the one-transaction promise, stated as a number the client
          can check rather than as a sentence it has to believe.
        */
        transactionsAdded: kernel.transactions().length - before,
        // script-servers additions (2026-10-08): each script's notes and summary, for the person.
        ...(expanded.scripts.length === 0 ? {} : { scripts: expanded.scripts }),
        // end script-servers additions
        document: kernel.getDocument(),
      });
    },
  );

  server.registerTool(
    'craftkit_history',
    {
      title: 'CraftKit history',
      description:
        'The transactions applied to an open document, oldest first, plus whether undo and redo ' +
        'are currently available.',
      inputSchema: { documentId: documentIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ documentId }) => {
      const found = session(documentId);
      if (!isSession(found)) return found;
      const { kernel } = found;
      return jsonResult({
        documentId: found.id,
        transactions: kernel.transactions().map(serializeTransaction),
        canUndo: kernel.canUndo(),
        canRedo: kernel.canRedo(),
      });
    },
  );

  server.registerTool(
    'craftkit_undo',
    {
      title: 'Undo the last CraftKit change',
      description:
        'Step one entry back in the document history. A plan applied through craftkit_apply_plan ' +
        'is a single entry however many commands it carried, so one undo removes all of it. ' +
        'Reports `undone: false` when there is nothing to undo.',
      inputSchema: { documentId: documentIdArg },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ documentId }) => {
      const found = session(documentId);
      if (!isSession(found)) return found;
      const { kernel } = found;
      const undone = kernel.undo();
      return jsonResult({
        documentId: found.id,
        undone,
        canUndo: kernel.canUndo(),
        canRedo: kernel.canRedo(),
        document: kernel.getDocument(),
      });
    },
  );

  return server;
}
