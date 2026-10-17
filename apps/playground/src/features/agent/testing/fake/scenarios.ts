/**
 * The fake controller's scenario list and defaults: every SPEC §3 state a fake view can
 * show, the fixed clock (`FAKE_NOW`) and the capabilities a fake reports by default.
 */
import type { AgentCapabilities } from '../../model/view-types';

/* ── The scenarios ────────────────────────────────────────────────────────────── */

/** Every state a fake view can show, grouped by the SPEC §3 frame it draws. */
export const FAKE_SCENARIOS = [
  // §3.1 empty
  'empty',
  'emptyHasContent',
  // creative agent (2026-10-12): free code on, the creative starters' note says so.
  'emptyCreative',
  'emptySelection',
  // §3.2 composing
  'composing',
  'mention',
  // §3.3 to §3.5 page build
  'skeleton',
  'building',
  // creative agent (2026-10-12): a platformer build, its record carrying the creative brief.
  'buildingCreative',
  'blocked',
  'built',
  'builtPartial',
  'builtCollapsed',
  // §3.10 stopping and stopped, and the other build endings (§4.8)
  'stopping',
  'stopped',
  'stoppedBudget',
  'stoppedMaxTasks',
  'interrupted',
  'buildFailed',
  'buildUndone',
  'buildRevived',
  // §3.6 edits
  'editRunning',
  'editDone',
  'editNoChange',
  'editUndone',
  'editStopped',
  // §4.10, §4.12 words-only answers and change plans
  'answer',
  'stepPlan',
  // §3.7 the page plan
  'planDrafting',
  'planReady',
  'planEdited',
  'planInvalid',
  'planApproval',
  'planReadOnly',
  // §3.8 Ask proposals
  'proposalDrafting',
  'proposal',
  'proposalPartial',
  'proposalPreviewing',
  'proposalApplied',
  'proposalDiscarded',
  // §3.9 the queue
  'queueTyping',
  'queued',
  'queueStale',
  'queueMissing',
  'queuePaused',
  // §3.11 errors
  'error',
  'errorKept',
  'errorSkeleton',
  // §3.12, §3.13
  'long',
  'conversations',
  // Improve and clarify (owner request, view-types EnhancementView / ClarifyView)
  'enhanceUnavailable',
  'enhancing',
  'enhanced',
  'enhanceFailed',
  'clarifyAsking',
  'clarifyPartly',
  'clarifyRewriting',
] as const;

export type FakeScenario = (typeof FAKE_SCENARIOS)[number];

/** 2026-09-28 09:00 UTC: a fixed "now" so a fake view is the same in every test run. */
export const FAKE_NOW = Date.UTC(2026, 8, 28, 9, 0, 0);

/**
 * The capabilities a fake controller reports by default: the engine as it stands on
 * 2026-09-28 (SPEC §7.6), without E3 (`undoBuild`, `restore`) or the canvas stage (E8). A
 * story of a fallback overrides one flag.
 */
export const FAKE_CAPABILITIES: AgentCapabilities = {
  rowUndo: true,
  undoBuild: false,
  restore: false,
  facts: true,
  failureClasses: true,
  editablePlan: true,
  structuredDirection: true,
  estimate: true,
  canvasStage: false,
};

export interface FakeViewOptions {
  /** Epoch ms a live run is measured to (default `FAKE_NOW`). */
  readonly now?: number | undefined;
}
