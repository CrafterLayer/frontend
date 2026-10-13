/**
 * The headless door: everything a NODE service needs from the builder family,
 * and nothing that needs a browser.
 *
 * The main entry (`@craftkit/builder`) re-exports the editor surface, so it
 * reaches React and `packages/builder/shell` — and a server that imports it
 * fails to compile with `Property 'querySelector' does not exist`, because a
 * Node service's tsconfig has no `lib: dom` and must not acquire one to
 * satisfy a package boundary. That is why `apps/ai-server` had grown direct
 * dependencies on `builder-ai` and `builder-schema`: the alternative was a lie
 * about its runtime.
 *
 * The contract stays one door per member; this is a second door on the SAME
 * package, narrow by construction. It re-exports only the plan wire and the
 * class vocabulary a prompt has to state — every symbol here is data or a
 * type, so the module graph reaches zod and nothing else. `wire.node.test.ts`
 * fails the moment that stops being true.
 */
export {
  AI_PLAN_WIRE_VERSION,
  DESIGN_LIBRARY_TEACHING,
  DESIGN_QUALITY_TEACHING,
  AUTHORED_DESIGN_TEACHING,
  PIXI_CREATIVE_SKILLS,
  PIXI_GAME_EXAMPLE,
  PIXI_GAME_CONTROLS,
  PIXI_STORY_EXAMPLE,
  PIXI_STORY_CONTROLS,
  PIXI_MURAL_EXAMPLE,
  // creative agent (2026-10-12): the engine playbooks' exact examples, for evals fixtures.
  CREATIVE_ENGINE_SKILLS,
  CREATIVE_ANIMATION_CONTROLS,
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_EFFECTS_CONTROLS,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_CONTROLS,
  CREATIVE_TILEMAP_EXAMPLE,
  AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH,
  boundAiPlanWireInvalidOutputMessage,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireAttempt,
  type AiPlanWireInvalidOutputResponse,
  type AiPlanWireRequest,
  type AiPlanWireResponse,
  // T230: the site-plan task's page limit, which the ai-server's answer schema holds to.
  AI_SITE_PLAN_WIRE_MAX_PAGES,
  // visual self-review (2026-10-13): the scene review's route, limits and readers.
  AI_SCENE_REVIEW_MAX_FINDINGS,
  AI_SCENE_REVIEW_PATH,
  readAiSceneReviewFindings,
  readAiSceneReviewWireRequest,
  type AiSceneReviewFinding,
  type AiSceneReviewWireImage,
  type AiSceneReviewWireRequest,
  // background batches (2026-10-12): the routes and limits the ai-server holds a batch to.
  AI_BATCH_ITEM_ID_PATTERN,
  AI_BATCH_MAX_ITEMS,
  AI_BATCH_PATH,
  type AiBatchWireItem,
  type AiBatchWireRequest,
  type AiBatchWireResultItem,
  type AiBatchWireResults,
  type AiBatchWireState,
} from '@craftkit/builder-ai';

export {
  UTILITY_VOCABULARY,
  utilityVocabulary,
  type ContextFragment,
  type ContextFragmentKind,
  type ContextFragmentTrust,
} from '@craftkit/builder-schema';

export type { AssembledAiContext, AiPlan, AiProviderUsage } from '@craftkit/builder-ai';
