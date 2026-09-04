/**
 * The ONE module in this package that names the builder family.
 *
 * ADR 0003 says an application reaches the builder only through the
 * `@craftkit/builder` preset or one of its narrow subpath doors. This package
 * uses two of them and no other import path exists anywhere under `apps/evals`:
 *
 *   - `@craftkit/builder/headless` — the node-safe RUNTIME door: the kernel,
 *     the registry, the AI plan door and the agent runner. The main entry
 *     re-exports the editor surface and so reaches `packages/builder/shell`,
 *     whose code calls `querySelector` on an `HTMLElement`; this package
 *     compiles with `lib: ["ES2024"]` and must not acquire a DOM to satisfy a
 *     package boundary.
 *   - `@craftkit/builder/wire` — the plan HTTP contract, for live mode.
 *
 * Centralised because the headless door is young. When a symbol moves the
 * harness must break in one file with one fix, not in nine files with nine.
 */
export {
  classifyAiRunFailure,
  craftkitHeadlessBlocks,
  createBuilder,
  createLocalAiPlanProvider,
  createRemoteAiPlanProvider,
  emptyDocument,
  headlessBlockManifest,
  marketingBlockSchemas,
  isAiProviderError,
  isBuilderError,
  runAiAgent,
  validateAiPlan,
  AiPlanRejectedError,
  AiProviderError,
} from '@craftkit/builder/headless';

export type {
  AiEffectiveCommandPolicy,
  AiPlan,
  AiRunFailure,
  AiRunFailureCode,
  AiRunFailureSource,
  AiPlanProvider,
  AiPlanStep,
  AiPlanValidationIssue,
  AiPlanValidationResult,
  AiValidationPorts,
  AssembledAiContext,
  BlockSchema,
  BuilderDocument,
  RemoteAiPlanProviderOptions,
  BuilderKernel,
  ContentDirection,
  Node,
  TrustedExtensionManifest,
} from '@craftkit/builder/headless';

export { AI_PLAN_WIRE_VERSION } from '@craftkit/builder/wire';
export type { AiPlanWireRequest, AiPlanWireResponse } from '@craftkit/builder/wire';

/*
  The kernel's own fixture vocabulary, reached through the preset's testing
  door. It is here — and NOT in `builder.ts`'s runtime block above — because it
  is the stand-in catalog, not the real one. See `catalog.ts` for why a
  stand-in is currently the best this package can do and what would replace it.
*/
export { fixtureBlocks } from '@craftkit/builder/testing';
