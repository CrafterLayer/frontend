import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { withCallLifetime } from './call-lifetime';
import { proposerFor, type AnswerDraft, type ClaudeOptions } from './claude';
import type { HandlerOptions } from './handler';
import { answerBody, type Answered } from './plan-answer';
import type { UsageReport } from './plan-params';
import { callEffort } from './plan-request';

/** Both HTTP transports use one deadline and suppress every callback from expired work. */
export function answer(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
  caller: AbortSignal,
  onProgress?: (text: string) => void,
  onDraft?: (draft: AnswerDraft) => void,
): Promise<Answered> {
  return withCallLifetime(caller, options.callTimeoutMs, async (signal) => {
    let measured: UsageReport | undefined;
    const call: ClaudeOptions = {
      client: options.client,
      signal,
      onUsage: (usage) => {
        if (!signal.aborted) measured = usage;
      },
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.cacheDoctor === undefined ? {} : { cacheDoctor: options.cacheDoctor }),
      ...callEffort(wire, options),
      onAnswer: (text) => {
        if (!signal.aborted) options.onAnswer?.(text);
      },
      onLog: (line) => {
        if (!signal.aborted) options.onLog?.(line);
      },
      onProgress: (text) => {
        if (!signal.aborted) onProgress?.(text);
      },
      ...(onDraft === undefined
        ? {}
        : {
            onDraft: (draft: AnswerDraft) => {
              if (!signal.aborted) onDraft(draft);
            },
          }),
    };
    const outcome = await proposerFor(wire)(wire, call);
    signal.throwIfAborted();
    return answerBody(outcome, measured);
  });
}
