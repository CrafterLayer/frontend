import type { AssistantMode } from './view-types';

/**
 * How eagerly a request may touch the page (SPEC §4.17 ModeMenu, §7.4 `modes.ts`).
 *
 * The union lives in `view-types.ts`, so the menu, the controller and the stories cannot
 * disagree about which modes exist. What this module adds is the POLICY each mode stands
 * for, in one place: v1 spelled `mode === 'auto' ? 'auto' : 'never'` and
 * `mode === 'ask' ? { onPlanned } : {}` inline at four call sites of a 1,685-line
 * component, and a fifth call site is how Plan once shipped writing to the page.
 *
 * No words here. v1's `MODES` carried `label: 'Ask'` and `hint: 'Propose, then wait for
 * Apply'` in English beside a bilingual catalog; every name and description is now a
 * catalog key (`mode.*`, SPEC §4.17), so this module stays language-free.
 */
export type { AssistantMode };

/** A new conversation's mode (SPEC §7.4: "default `auto`"). */
export const DEFAULT_ASSISTANT_MODE: AssistantMode = 'auto';

/** Every mode once, in the ModeMenu's order (SPEC §4.17: auto, ask, plan). */
export const ASSISTANT_MODES = ['auto', 'ask', 'plan'] as const satisfies readonly AssistantMode[];

export function isAssistantMode(value: unknown): value is AssistantMode {
  return value === 'auto' || value === 'ask' || value === 'plan';
}

/**
 * A stored mode read back, or `fallback` for anything else: a hand-edited store, a
 * future mode this build does not know, or the v1 casing of nothing at all. Reading an
 * unknown value as the default is what keeps a bad store from locking the panel in a
 * mode it cannot render.
 */
export function modeOrDefault(
  value: unknown,
  fallback: AssistantMode = DEFAULT_ASSISTANT_MODE,
): AssistantMode {
  return isAssistantMode(value) ? value : fallback;
}

/**
 * The engine's `apply` for a run started in this mode. Only Auto writes on its own: Ask
 * proposes and waits for Apply or "Build this page", and Plan never writes at all (its
 * skill also leaves it no command to emit, `runs.ts` `skillsForMode`).
 *
 * "Run this plan" on a step plan (SPEC §4.12) runs ONCE with authority to apply while the
 * chosen mode stays as it was; that override is the controller's, per run, and never
 * changes what this answers.
 */
export function applyPolicyFor(mode: AssistantMode): 'auto' | 'never' {
  return mode === 'auto' ? 'auto' : 'never';
}

/**
 * Whether a page build holds at its plan for the person's "Build this page" (the engine's
 * `onPlanned`, SPEC §7.6 E0c). Only Ask waits. Auto has nothing to ask, and Plan has
 * nothing to approve because nothing will be written; an `onPlanned` that always
 * answered "build" would be the same behaviour with a lie in the middle.
 */
export function waitsForApproval(mode: AssistantMode): boolean {
  return mode === 'ask';
}
