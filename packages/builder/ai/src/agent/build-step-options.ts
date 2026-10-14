import { excludedSkillIdsOf } from './excluded-skills';
import type { RunAiAgentOptions, RunAiBuildOptions } from './types';

/**
 * Everything a step inherits from the caller. `apply`, `label`, `runId` and
 * `request` are the orchestrator's to decide; nothing else is reinterpreted.
 *
 * `speaking` gates the steps' events. Once the build has reported its end, a
 * writer that ignored Stop and answered late has nothing left to say: the
 * person was told the build ended, and a step event after that would be a
 * section "working" on a page that already stopped.
 */
export function sharedStepOptions(
  options: RunAiBuildOptions,
  speaking: () => boolean,
): Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'> {
  const isCurrentRun = options.isCurrentRun;
  const onEvent = options.onEvent;
  const excluded = excludedSkillIdsOf(options);
  return {
    clock: options.clock,
    kernel: options.kernel,
    provider: options.provider,
    validationPorts: options.validationPorts,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.selection === undefined ? {} : { selection: options.selection }),
    ...(options.contextProviders === undefined
      ? {}
      : { contextProviders: options.contextProviders }),
    ...(options.additionalContextProviders === undefined
      ? {}
      : { additionalContextProviders: options.additionalContextProviders }),
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(options.skillRegistry === undefined ? {} : { skillRegistry: options.skillRegistry }),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    // The person's switches, the build's own picks already winning (excluded-skills.ts).
    ...(excluded.length === 0 ? {} : { excludedSkillIds: excluded }),
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.composition === undefined ? {} : { composition: options.composition }),
    // Free code mode is the person's, for the whole build: every step's request carries it.
    ...(options.freeCode === true ? { freeCode: true } : {}),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    /*
      A step's run id is NOT the build's, so the caller's lease check would
      reject every step if it were forwarded as-is. It is asked about the one
      id it issued: the build's.
    */
    ...(isCurrentRun === undefined
      ? {}
      : { isCurrentRun: (): boolean => isCurrentRun(options.runId) }),
    ...(onEvent === undefined
      ? {}
      : {
          onEvent: (event) => {
            if (speaking()) onEvent(event);
          },
        }),
  };
}
