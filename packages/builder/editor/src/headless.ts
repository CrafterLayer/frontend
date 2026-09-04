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
import type { BlockRenderComponent, BlockSchema, TrustedExtensionManifest } from '@craftkit/builder-schema';

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
  type OpenDocumentOptions,
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
  createLocalAiPlanProvider,
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
