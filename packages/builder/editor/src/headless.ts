/**
 * The headless RUNTIME door: everything a Node service needs to own a live
 * document, and nothing that needs a browser.
 *
 * `@craftkit/builder/wire` (T276) opened the first door on this package, but it
 * is types-and-data only — the plan contract and the class vocabulary a prompt
 * has to state. That is enough for a service that merely relays plans to a
 * model. It is not enough for one that has to HOLD a document: an MCP server, a
 * batch renderer, a migration job all need the kernel itself, the registry the
 * kernel validates against, and the AI plan door that turns a proposal into one
 * transaction.
 *
 * The main entry cannot supply those. It re-exports the editor surface and so
 * reaches `packages/builder/shell`, whose code calls `querySelector` on an
 * `HTMLElement`; a Node service's tsconfig has no `lib: dom` and must not
 * acquire one to satisfy a package boundary (ADR 0003 §"one door per member"
 * is not worth a lie about the runtime). So this is a SECOND narrow door on the
 * same package, exactly as `wire` was a first.
 *
 * ## What may pass through it
 *
 * Only `@craftkit/builder-core`, `@craftkit/builder-schema` and
 * `@craftkit/builder-ai`, whose manifests carry no browser runtime — plus this
 * package's own PURE schema modules (`components/Page/schema`,
 * `components/Page/examples`), which import zod and the schema package and
 * nothing else. Deliberately absent: every block pack. They all depend on
 * `@craftkit/builder-renderer`, which imports `react-dom` and reads DOM globals
 * (`CanvasFrame` mounts a portal into an iframe), so a single re-export from
 * one of them would fail a Node typecheck on the first `HTMLElement` and defeat
 * the entire point of this file. `headless.node.test.ts` fails the moment that
 * stops being true.
 *
 * ## The consequence for block vocabulary, stated plainly
 *
 * A headless host therefore starts with the structural root only
 * (`craftkitHeadlessBlocks`). Anything richer is REGISTERED BY THE HOST, which
 * is why `headlessBlockManifest` is exported rather than hidden: a host that
 * has React hands it the schemas it already owns, and a host that does not
 * hands it schemas of its own. The registry, not this file, is the source of
 * truth for what a document may contain — so a service that reports its own
 * catalog from `kernel.context.registry` is telling the truth in both cases.
 */
import type {
  BlockRenderComponent,
  BlockSchema,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { pageExamples } from './components/Page/examples';
import { pageSchema } from './components/Page/schema';

// ── Kernel construction and the command vocabulary ──────────────────────────
export {
  createBuilder,
  defineCommand,
  emptyDocument,
  insertedNodeId,
  openDocument,
  applyPatchSet,
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  /*
    The SITE surface (013, T046). A headless host is the caller that most needs
    it: the AI pipeline builds a whole site on a scratch kernel with its own
    ports, and `applySitePatchSet` is what replays a stored tail. `siteCommands`
    and `isSiteCommandName` ship too, because a service that reports its own
    command vocabulary has to be able to name the site half of it.
  */
  applySitePatchSet,
  createSiteBuilder,
  defineSiteCommand,
  isSiteCommandName,
  liftDocumentSession,
  openSite,
  siteCommands,
  // The deterministic PORTS a headless host supplies when it needs its own
  // clock or id source. A service that runs several documents at once MUST be
  // able to name them: the AI preflight rehearses on a scratch kernel, and a
  // scratch kernel sharing the live id source hands out ids the real document
  // then claims. Law D says ports are injected, never ambient.
  systemClock,
  systemIds,
  type BuilderKernel,
  type CoreCommandName,
  type CoreCommands,
  type CreateBuilderOptions,
  type GroupStep,
  type GroupedDispatchOptions,
  type BuilderSiteKernel,
  type CreateSiteBuilderOptions,
  type OpenDocumentOptions,
  type OpenSiteOptions,
  type SiteCommandName,
  type SiteCommands,
  type SiteGroupStep,
} from '@craftkit/builder-core';

// ── Document contracts, projection and parsing ──────────────────────────────
/*
  `validateDocument` + `canonicalizeJsonValue` are the parse half: a document
  arriving from a client is untrusted JSON until both have run, and a kernel
  must never be built around one that has not. `blockPropsJsonSchema` and
  `commandArgsJsonSchema` are the projection half — they turn a live registry
  into the JSON contract a remote caller can actually read, which is how a
  headless service answers "what blocks exist and what does each accept?"
  without shipping zod objects over a wire.
*/
export {
  blockPropsJsonSchema,
  builderError,
  canonicalizeJsonValue,
  commandArgsJsonSchema,
  defineBlockSchema,
  isBuilderError,
  isJsonValue,
  validateDocument,
  LATEST_SCHEMA_VERSION,
  type Author,
  type BlockRenderComponent,
  type BlockSchema,
  type Breakpoint,
  type BuilderDocument,
  type BuilderError,
  type ClockPort,
  type ContentDirection,
  type IdPort,
  type JsonValue,
  type Node,
  type NodeId,
  type Patch,
  type PersistedSession,
  type PersistenceAdapter,
  type RegisteredBlock,
  type RegistryRead,
  type SlotDecl,
  type SlotName,
  type Surface,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

// ── AI: plan validation, application, and the agent runner ──────────────────
export {
  applyAiPlan,
  assembleAiContext,
  assertValidAiPlan,
  /*
    A run that THREW is not automatically a run that failed: a provider
    refusing an impossible request and a provider that could not be reached are
    the same exception type to JavaScript and opposite events to anyone
    measuring the agent. `classifyAiRunFailure` is the only place that
    distinction survives, so a headless harness that reports outcomes needs it
    as much as the editor does.
  */
  classifyAiRunFailure,
  createLocalAiPlanProvider,
  /*
    The REMOTE provider belongs on this door too. It reaches a model over
    `fetch`, which Node has had as a global since 18 — nothing here touches a
    document or a DOM — and without it a headless service can only talk to the
    deterministic local provider, which is to say it can never be measured
    against a real model.
  */
  createRemoteAiPlanProvider,
  generateAiPlan,
  previewAiPlan,
  resolveAiCommandPolicy,
  runAiAgent,
  runAiBuild,
  validateAiPlan,
  AiPlanRejectedError,
  AiProviderError,
  isAiProviderError,
  type AiAgentEvent,
  type AiAgentRunResult,
  type AiBuildRunResult,
  type AiEffectiveCommandPolicy,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanStep,
  type AiPlanValidationIssue,
  type AiPlanValidationResult,
  type AiValidationPorts,
  type AppliedAiPlan,
  type ApplyAiPlanOptions,
  type AssembledAiContext,
  type AiRunFailure,
  type AiRunFailureCode,
  type AiRunFailureSource,
  type RemoteAiPlanProviderOptions,
  type RunAiAgentOptions,
  type RunAiBuildOptions,
} from '@craftkit/builder-ai';

// The preset's structural root, as DATA. Identical to the schema the browser
// build registers — same file, so the two can never disagree about which
// section types a page accepts.
export { pageExamples, pageSchema };

/**
 * The renderer a headless registration stands in for.
 *
 * `TrustedBlockContribution.render` is required, because in the browser a
 * registered block that cannot be drawn is a bug. In Node nothing is ever
 * drawn, so the honest value is a component that renders nothing — the same
 * trick `validateAiPlan` already plays when it builds its rehearsal kernel.
 * It is a value rather than a type, but React appears only in the TYPE of
 * `BlockRenderComponent`, which is erased at compile time; no react runtime
 * enters this module graph.
 */
const headlessRender: BlockRenderComponent = () => null;

/**
 * Turn block SCHEMAS into a registerable manifest for a service that will
 * never render them.
 *
 * A headless host cannot import a block pack (see the file comment), so the
 * only way it acquires vocabulary is by being handed schemas. This is the
 * function that accepts them, and it exists so that every headless host
 * registers vocabulary the SAME way — a service that hand-rolled its own
 * manifest would sooner or later omit `tier` or invent a second `render`
 * placeholder, and the registry would then hold two different notions of what
 * "registered but not drawable" means.
 */
export function headlessBlockManifest(
  name: string,
  version: string,
  schemas: readonly BlockSchema[],
): TrustedExtensionManifest {
  return {
    tier: 1,
    name,
    version,
    contributes: {
      blocks: schemas.map((schema) => ({ schema, render: headlessRender })),
    },
  };
}

/**
 * The headless twin of `defaultBlocks`: the structural starter set, minus the
 * React renderer the preset attaches to it.
 *
 * A document has to have a root before anything can be inserted into it, so
 * this is the one registration every headless host needs and none can supply
 * for itself.
 */
export const craftkitHeadlessBlocks: TrustedExtensionManifest = headlessBlockManifest(
  'builder-headless-blocks',
  '0.1.0',
  [{ ...pageSchema, examples: pageExamples }],
);

/*
  The REAL block vocabulary, and the one thing this door could not offer until
  now.

  Every block pack pairs its schemas with the components that draw them, so its
  main entry reaches `@craftkit/builder-renderer` and its DOM globals — which is
  why no pack appears in the runtime block above, and why a headless host was
  left registering the kernel's six test fixtures and calling it a catalog. An
  eval scored against that measures the fixture, not the product; an MCP server
  built on it can offer a client a page root and nothing to put inside it.

  `@craftkit/builder-blocks-marketing/schemas` is a second entry on that pack
  carrying the thirty-two schemas alone. Its own `schemas.node.test.ts` walks
  the barrel's real import graph and pins the full external set to
  `@craftkit/builder-schema` and `zod`, so the guarantee is proved where the
  code lives rather than assumed here. `headlessBlockManifest` turns these into
  something `createBuilder` accepts.
*/
export { marketingBlockSchemas } from '@craftkit/builder-blocks-marketing/schemas';

// script-servers additions (2026-10-08)
/*
  Tool steps and edit scripts for a headless host (agent-script DESIGN §A.13).

  A plan the editor accepts may carry steps that are not kernel commands:
  agent tools `{"command":"tool"}`, `editTree`, and `script.run` — a short
  script whose queued writes become ordinary kernel steps. The editor expands
  them before its door in one order (generate-plan.ts): scripts, then tools,
  then editTree. A host that validates plans itself (mcp-server
  `craftkit_apply_plan`) needs the same three expansions, or it refuses every
  plan the editor would apply.

  `createNodeScriptRunner` runs the QuickJS sandbox in a `worker_threads`
  worker with a hard stop. It ships on builder-ai's `script-node` subpath so
  browser bundles never see `node:worker_threads`; this door is the Node one by
  definition (every importer is a Node service), so it re-exports it. A host
  that bundles itself emits builder-ai's `sandbox-worker.node.mjs` as an entry
  and passes its URL as `workerUrl` (apps/mcp-server/vite.config.ts).
*/
export {
  EDIT_TREE_COMMAND,
  expandAgentTools,
  expandScriptSteps,
  expandTreeEdits,
  SCRIPT_TOOL_NAME,
  type AgentToolExpansion,
  type ScriptExpansion,
  type ScriptExpansionOptions,
  type ScriptRunner,
  type ScriptRunReport,
  type ScriptRunResult,
  type TreeEditExpansion,
} from '@craftkit/builder-ai';
export {
  createNodeScriptRunner,
  type NodeScriptRunnerOptions,
} from '@craftkit/builder-ai/script-node';
// end script-servers additions
// background-batches additions (2026-10-12)
/*
  Background batches: the same request on many pages of a site, sent as one Message Batches
  job at half price and applied page by page through the live door — one Undo per page. A
  Node host (and the ai-server's end-to-end test) drives the same runner a panel does.
*/
export {
  AiBatchJobError,
  createAiBatchRunner,
  createMemoryBatchJobStore,
  createRemoteBatchClient,
  isAiBatchJobError,
  type AiBatchAgentOptions,
  type AiBatchClient,
  type AiBatchItemResult,
  type AiBatchJobRecord,
  type AiBatchJobStore,
  type AiBatchPageOutcome,
  type AiBatchRunner,
  type AiBatchState,
  type RemoteBatchClientOptions,
} from '@craftkit/builder-ai';
// end background-batches additions
