import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AssembledAiContext,
} from '../types';
import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from './wire';

export interface RemoteAiPlanProviderOptions {
  /** Absolute URL of the plan endpoint. One POST per proposal. */
  endpoint: string;
  /** Extra headers, e.g. authorization. Content type is always set by the provider. */
  headers?: Readonly<Record<string, string>>;
  /** Injected for tests and non-browser hosts; defaults to the ambient fetch. */
  fetch?: typeof fetch;
  /** Whole-request deadline. The request is aborted when it elapses. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The message a human sees in the refusal bubble. Server refusals pass through
 * verbatim; transport failures get one plain sentence each.
 */
export class RemoteAiProviderError extends Error {
  override readonly name = 'RemoteAiProviderError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Shallow shape check only: enough to tell "a plan" from "garbage" so the
 * error names the server instead of confusing the kernel-door validator. The
 * real per-command validation still happens in `assertValidAiPlan`.
 */
function parseWireResponse(payload: unknown): AiPlan {
  if (isRecord(payload) && typeof payload['refusal'] === 'string') {
    throw new RemoteAiProviderError(payload['refusal']);
  }
  if (
    isRecord(payload) &&
    typeof payload['rationale'] === 'string' &&
    Array.isArray(payload['commands'])
  ) {
    return { rationale: payload['rationale'], commands: payload['commands'] as AiPlan['commands'] };
  }
  throw new RemoteAiProviderError(
    'The assistant server answered with something that is not a plan or a refusal.',
  );
}

/**
 * `AiPlanProvider` backed by one HTTP endpoint speaking the wire contract in
 * `wire.ts`. The provider proposes; it never applies. Everything it returns
 * still has to survive the live registry and the scratch-kernel dry run.
 */
export function createRemoteAiPlanProvider(options: RemoteAiPlanProviderOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetch ?? fetch;

  async function post(body: AiPlanWireRequest): Promise<AiPlan> {
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(options.endpoint, {
        method: 'POST',
        headers: { ...options.headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new RemoteAiProviderError(
          `The assistant server timed out after ${String(timeoutMs)}ms.`,
        );
      }
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`);
    } finally {
      clearTimeout(deadline);
    }

    if (!response.ok) {
      throw new RemoteAiProviderError(
        `The assistant server answered with status ${String(response.status)}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new RemoteAiProviderError('The assistant server answer was not valid JSON.');
    }
    return parseWireResponse(payload);
  }

  const provider = {
    propose(request: string, context: AssembledAiContext): Promise<AiPlan> {
      return post({ version: AI_PLAN_WIRE_VERSION, request, context });
    },
    repair(
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
    ): Promise<AiPlan> {
      return post({ version: AI_PLAN_WIRE_VERSION, request, context, attempt: { plan, issues } });
    },
  } satisfies AiPlanProvider & Record<'repair', unknown>;

  return provider;
}
