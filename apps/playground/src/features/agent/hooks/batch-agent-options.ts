/**
 * The options a background job asks and lands each page with (2026-10-12): what a live run
 * on that page would take from this panel (`commonRunOptions`), minus what only a live run
 * has — its kernel, provider, signal, selection, the conversation's ledger and history.
 * The runner needs the same options to submit and to apply: they decide the context the
 * model is shown and the door its answer meets.
 */
import type { AiBatchAgentOptions } from '@craftkit/builder';

import { catalogPolicyFor } from '../../preview/components/AssistantPanel/catalogPolicyFor';
import type { UseAgentControllerOptions } from './agent-controller/options';

import { preflightPorts } from '../model/runs';

/** The panel's options a background job reads. */
export type BatchAgentSource = Pick<
  UseAgentControllerOptions,
  | 'skillRegistry'
  | 'selectedSkillIds'
  | 'hostSkillIdsFor'
  | 'extraContextProviders'
  | 'freeCode'
  | 'editModel'
  | 'editEffort'
  | 'agentPolicy'
>;

/**
 * A batch is always answered by the assistant server, so it always takes the remote catalog
 * policy (names, not schemas), whatever answers the live panel.
 */
export function batchAgentOptions(source: BatchAgentSource, request: string): AiBatchAgentOptions {
  const providers = source.extraContextProviders ?? [];
  return {
    validationPorts: preflightPorts(),
    ...(source.skillRegistry === undefined ? {} : { skillRegistry: source.skillRegistry }),
    ...(source.selectedSkillIds === undefined ? {} : { selectedSkillIds: source.selectedSkillIds }),
    ...(source.hostSkillIdsFor === undefined
      ? {}
      : { hostSkillIds: source.hostSkillIdsFor(request) }),
    ...(providers.length === 0 ? {} : { additionalContextProviders: providers }),
    ...catalogPolicyFor('remote', [], source.agentPolicy),
    ...(source.freeCode === true ? { freeCode: true } : {}),
    ...(source.editModel === undefined || source.editModel === ''
      ? {}
      : { editModel: source.editModel }),
    ...(source.editEffort === undefined ? {} : { editEffort: source.editEffort }),
  };
}
