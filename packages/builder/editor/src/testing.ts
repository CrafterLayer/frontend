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
export {
  FIXED_ASSETS,
  createFixedAssetLibrary,
  type FixedAssetLibraryOptions,
  createScriptedAiPlanProvider,
  createScriptedSiteStageProvider,
  type ScriptedStage,
  type ScriptedStageProvider,
  type ScriptedStageProviderOptions,
} from '@craftkit/builder-ai/testing';

/*
  The site fixtures, at layer 0 and reachable only through here: ADR 0003 lets
  an application depend on `@craftkit/builder` and nothing deeper, so a
  playground test that wants a valid five-page site has no other route to one.
*/
export { fivePageSite, onePageSite, siteWithSharedRegions } from '@craftkit/builder-schema/testing';
