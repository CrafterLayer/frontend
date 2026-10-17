/**
 * The static fake controller: every AgentController action recorded in `calls`, over a
 * fixed state (`createFakeController`), and the shared `controllerOf` the live hook uses.
 */
import type { AgentCapabilities, AgentController, AgentViewState } from '../../model/view-types';

import { FAKE_CAPABILITIES } from './scenarios';

/* ── The static controller ────────────────────────────────────────────────────── */

/** Every AgentController action, by name. */
export type FakeAction = {
  [K in keyof AgentController]-?: NonNullable<AgentController[K]> extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof AgentController];

/** One recorded call: the action and the arguments it was given. */
export interface FakeCall {
  readonly action: FakeAction;
  readonly args: readonly unknown[];
}

/** A fake controller, with every call it received. */
export interface FakeController extends AgentController {
  readonly calls: readonly FakeCall[];
}

export interface FakeControllerOptions {
  readonly capabilities?: Partial<AgentCapabilities> | undefined;
  /** Told of every call as it happens (a story's action logger, a test's assertion). */
  readonly onCall?: ((call: FakeCall) => void) | undefined;
}

const ACTIONS: readonly FakeAction[] = [
  'send',
  'stop',
  'removeQueued',
  'continueQueued',
  'apply',
  'discard',
  'build',
  'runSteps',
  'editPlan',
  'undoSection',
  'redoSection',
  'undoBuild',
  'retrySections',
  'finishRest',
  'removeEmpty',
  'tryAgain',
  'reveal',
  'peek',
  'reuse',
  'setDraft',
  'setMode',
  'setModel',
  'setWorkers',
  'setFreeCode',
  'newConversation',
  'openConversation',
  'deleteConversation',
  'redoBuild',
  'undoEdit',
  'redoEdit',
  'togglePreview',
  'viewAsCode',
  'copy',
  'restore',
  'showTechnicalDetails',
  'openPageHistory',
  'removeChip',
  'addMention',
  'enhanceDraft',
  'restoreDraft',
  'answerClarify',
  'sendAsWritten',
  'dismissClarify',
  'setComposerFocused',
];

export type Handlers = Partial<Record<FakeAction, (...args: readonly unknown[]) => void>>;

export function controllerOf(
  state: AgentViewState,
  capabilities: AgentCapabilities,
  record: (call: FakeCall) => void,
  calls: readonly FakeCall[],
  handlers: Handlers = {},
): FakeController {
  const act =
    (action: FakeAction) =>
    (...args: readonly unknown[]): void => {
      record({ action, args });
      handlers[action]?.(...args);
    };
  const entries = Object.fromEntries(ACTIONS.map((action) => [action, act(action)])) as Record<
    FakeAction,
    (...args: readonly unknown[]) => void
  >;
  return {
    ...(entries as unknown as Omit<AgentController, 'state' | 'capabilities' | 'restore'>),
    // Restore answers a promise; the fake always restores.
    restore: (turnId: string) => {
      record({ action: 'restore', args: [turnId] });
      return Promise.resolve('restored' as const);
    },
    state,
    capabilities,
    calls,
  };
}

/**
 * A controller over a fixed state: every action is recorded in `calls` and changes
 * nothing. For component tests ("Retry calls `retrySections` with the row's key") and
 * for stories of one exact frame.
 */
export function createFakeController(
  state: AgentViewState,
  options: FakeControllerOptions = {},
): FakeController {
  const calls: FakeCall[] = [];
  const capabilities = { ...FAKE_CAPABILITIES, ...options.capabilities };
  return controllerOf(
    state,
    capabilities,
    (call) => {
      calls.push(call);
      options.onCall?.(call);
    },
    calls,
  );
}
