import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, ClockPort, NodeId } from '@craftkit/builder-schema';

import type { AppliedAiPlan } from '../plan/apply-plan';
import type { AiValidatedProposal } from '../plan/validated-proposal';
import type { AiRunFailure } from './errors';
import type {
  AiCommandPolicy,
  AiEffectiveCommandPolicy,
  AiPreparedSkillContext,
  AiSkillActivationPin,
  AiSkillOmission,
  AiSkillRegistry,
} from '../skills';
import type {
  AiChatTurn,
  AiPlan,
  AiPlanProvider,
  AiValidationPorts,
  AssembledAiContext,
} from '../types';

export interface AiAgentPolicy extends AiCommandPolicy {
  maxActiveSkills: number;
  maxSkillTokens: number;
  maxContextTokens: number;
  allowUntrustedSkills: boolean;
}

export interface RunAiAgentOptions {
  runId: string;
  clock: ClockPort;
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  selection?: readonly NodeId[];
  /** Backward-compatible additive alias. */
  contextProviders?: readonly AiContextProvider[];
  additionalContextProviders?: readonly AiContextProvider[];
  history?: readonly AiChatTurn[];
  skillRegistry?: AiSkillRegistry;
  selectedSkillIds?: readonly string[];
  policy?: Partial<AiAgentPolicy>;
  apply?: 'never' | 'auto';
  label?: string;
  signal?: AbortSignal;
  /**
   * Synchronous host lease check. Once a newer run owns the surface/session,
   * return false for this run id so no stale cached/provider result can apply.
   */
  isCurrentRun?: (runId: string) => boolean;
  onEvent?: (event: AiAgentEvent) => void;
}

export interface AiAgentEventBase {
  runId: string;
  seq: number;
  at: number;
}

export type AiAgentRunState =
  | 'started'
  | 'resolving-skills'
  | 'gathering-context'
  | 'proposing'
  | 'validating'
  | 'proposed'
  | 'applying'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type AiAgentEvent =
  | (AiAgentEventBase & { type: 'run.started'; apply: 'never' | 'auto' })
  | (AiAgentEventBase & { type: 'skills.resolving' })
  | (AiAgentEventBase & {
      type: 'skills.resolved';
      activations: readonly AiSkillActivationPin[];
      omitted: readonly AiSkillOmission[];
      totalTokens: number;
    })
  | (AiAgentEventBase & { type: 'context.gathering' })
  | (AiAgentEventBase & {
      type: 'context.ready';
      fragmentCount: number;
      totalTokens: number;
    })
  | (AiAgentEventBase & { type: 'plan.proposing' })
  | (AiAgentEventBase & { type: 'plan.progress'; text: string })
  | (AiAgentEventBase & { type: 'plan.validating'; attempt: 1 | 2 })
  | (AiAgentEventBase & { type: 'plan.repairing'; issues: readonly string[] })
  | (AiAgentEventBase & {
      type: 'plan.proposed';
      plan: AiPlan;
      proposal: AiValidatedProposal;
    })
  | (AiAgentEventBase & { type: 'plan.applying' })
  | (AiAgentEventBase & { type: 'run.completed'; status: 'proposed' | 'applied' })
  | (AiAgentEventBase & { type: 'run.cancelled'; error: AiRunFailure })
  | (AiAgentEventBase & { type: 'run.failed'; error: AiRunFailure });

export interface AiAgentRunResult {
  runId: string;
  status: 'proposed' | 'applied';
  proposal: AiValidatedProposal;
  plan: AiPlan;
  context: AssembledAiContext;
  skills?: AiPreparedSkillContext;
  policy: AiEffectiveCommandPolicy;
  applied?: AppliedAiPlan;
}
