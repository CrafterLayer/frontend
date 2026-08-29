// Applications and their tests reach the builder's deterministic fixtures through
// the preset — never through deeper packages (ADR 0003).
export * from '@craftkit/builder-core/testing';

// Worker plumbing for jsdom tests (loopback + raw client) — test-only surface,
// kept off the production preset so unopened sessions load none of it.
export {
  createLoopbackWorkerLike,
  createTransformWorkerClient,
} from '@craftkit/builder-code-view/testing';

// The AI engine's deterministic provider, for the same reason as the above:
// applications reach every builder fixture through the preset.
export { createScriptedAiPlanProvider } from '@craftkit/builder-ai/testing';
