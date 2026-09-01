import { coreCommands, createBuilder } from '@craftkit/builder-core';
import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  BlockRenderComponent,
  JsonValue,
  RegisteredCommand,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { isJsonValue } from '@craftkit/builder-schema';

import type {
  AiPlan,
  AiPlanStep,
  AiPlanValidationIssue,
  AiPlanValidationResult,
  AiValidationPorts,
} from '../types';
import type { AiEffectiveCommandPolicy } from '../skills';

const NullRender: BlockRenderComponent = () => null;

export class AiPlanRejectedError extends Error {
  override readonly name = 'AiPlanRejectedError';

  constructor(readonly issues: readonly AiPlanValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidPlan(message: string): AiPlanValidationResult {
  return { ok: false, issues: [{ code: 'invalid-plan', message }] };
}

function detachedFrozenJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    const clone = value.map(detachedFrozenJson);
    Object.freeze(clone);
    return clone;
  }
  if (typeof value !== 'object' || value === null) return value;
  const clone = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, detachedFrozenJson(child)]),
  );
  Object.freeze(clone);
  return clone;
}

function parsePlan(candidate: unknown): AiPlanValidationResult {
  if (!isRecord(candidate)) {
    return invalidPlan('An AI plan must be an object.');
  }
  const rationale = candidate['rationale'];
  const rawCommands = candidate['commands'];
  if (typeof rationale !== 'string' || rationale.trim() === '') {
    return invalidPlan('An AI plan needs a non-empty rationale.');
  }
  if (!Array.isArray(rawCommands) || rawCommands.length === 0) {
    return invalidPlan('An AI plan needs at least one command.');
  }

  const commands: AiPlanStep[] = [];
  for (const [step, rawCommand] of rawCommands.entries()) {
    if (!isRecord(rawCommand)) {
      return invalidPlan(`AI plan step ${String(step)} must be an object.`);
    }
    const command = rawCommand['command'];
    if (typeof command !== 'string' || command.trim() === '') {
      return invalidPlan(`AI plan step ${String(step)} needs a command name.`);
    }
    if (!Object.hasOwn(rawCommand, 'args')) {
      return invalidPlan(`AI plan step ${String(step)} needs command arguments.`);
    }
    const args = rawCommand['args'];
    if (!isJsonValue(args)) {
      return invalidPlan(`AI plan step ${String(step)} arguments must be JSON data.`);
    }
    // A human title is carried when it is one; anything else is dropped, not fatal.
    const title = rawCommand['title'];
    commands.push(
      Object.freeze({
        command,
        args: detachedFrozenJson(args),
        ...(typeof title === 'string' && title.trim() !== '' ? { title } : {}),
      }),
    );
  }
  // A staged-work suggestion rides along when it is a real sentence.
  const followUp = candidate['followUp'];
  return {
    ok: true,
    plan: Object.freeze({
      rationale,
      commands: Object.freeze(commands),
      ...(typeof followUp === 'string' && followUp.trim() !== '' ? { followUp } : {}),
    }),
  };
}

function commandIssues(plan: AiPlan, kernel: BuilderKernel): readonly AiPlanValidationIssue[] {
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    const registered = kernel.context.registry.command(step.command);
    if (registered === undefined) {
      issues.push({
        code: 'unknown-command',
        message: `Step ${String(index)} names unknown command "${step.command}".`,
        step: index,
      });
      return;
    }
    const parsed = registered.argsSchema.safeParse(step.args);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      issues.push({
        code: 'invalid-args',
        message: `Step ${String(index)} has invalid arguments for "${step.command}"${first === undefined ? '.' : `: ${first.message}`}`,
        step: index,
      });
    }
  });
  return issues;
}

function policyIssues(
  plan: AiPlan,
  policy: AiEffectiveCommandPolicy | undefined,
): readonly AiPlanValidationIssue[] {
  if (policy === undefined) return [];
  if (plan.commands.length > policy.maxCommands) {
    return [commandLimitIssue(plan.commands.length, policy.maxCommands)];
  }

  const allowed = new Set(policy.allowedCommands);
  return plan.commands.flatMap((step, index) =>
    allowed.has(step.command)
      ? []
      : [
          {
            code: 'policy-rejected' as const,
            message: `Step ${String(index)} command "${step.command}" is not allowed by the active AI policy.`,
            step: index,
          },
        ],
  );
}

function commandLimitIssue(commandCount: number, maxCommands: number): AiPlanValidationIssue {
  return {
    code: 'policy-rejected',
    message: `The active AI policy allows at most ${String(maxCommands)} command${maxCommands === 1 ? '' : 's'}; the plan contains ${String(commandCount)}.`,
  };
}

function rawCommandLimitIssue(
  candidate: unknown,
  policy: AiEffectiveCommandPolicy | undefined,
): AiPlanValidationIssue | undefined {
  if (policy === undefined || !isRecord(candidate)) return undefined;
  const rawCommands = candidate['commands'];
  return Array.isArray(rawCommands) && rawCommands.length > policy.maxCommands
    ? commandLimitIssue(rawCommands.length, policy.maxCommands)
    : undefined;
}

/** @internal Shared with previewAiPlan: the scratch world a plan is rehearsed in. */
export function validationManifest(plan: AiPlan, kernel: BuilderKernel): TrustedExtensionManifest {
  const commands: Record<string, RegisteredCommand> = {};
  for (const step of plan.commands) {
    if (Object.hasOwn(coreCommands, step.command) || Object.hasOwn(commands, step.command)) {
      continue;
    }
    const registered = kernel.context.registry.command(step.command);
    if (registered !== undefined) {
      commands[step.command] = registered;
    }
  }
  return {
    tier: 1,
    name: '@craftkit/builder-ai-validation',
    version: '0.0.0',
    contributes: {
      blocks: kernel.context.registry.blocks().map(({ schema }) => ({
        schema,
        render: NullRender,
      })),
      commands,
    },
  };
}

/** @internal Build the isolated rehearsal kernel with both executable and declarative vocabulary. */
export function createValidationKernel(
  plan: AiPlan,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
): BuilderKernel {
  const scratch = createBuilder({
    document: kernel.getDocument(),
    extensions: [validationManifest(plan, kernel)],
    ports,
  });
  const compositions = kernel.context.registry.compositions();
  if (compositions.length > 0) {
    scratch.extensions.hydrateDeclarative({
      tier: 2,
      name: '@craftkit/builder-ai-validation-compositions',
      version: '0.0.0',
      contributes: { compositions: [...compositions] },
    });
  }
  return scratch;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function dryRun(
  plan: AiPlan,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
): AiPlanValidationResult {
  const scratch = createValidationKernel(plan, kernel, ports);
  /*
    The plan answers for NEW damage only. A live document can already carry a
    violation (a schema evolved after the node was written); charging every
    later plan with that old sin would freeze the assistant on exactly the
    documents that most need editing.
  */
  const priorIssues = new Set(scratch.validate().map((issue) => issue.message));
  try {
    scratch.dispatchGroup(
      plan.commands.map((step) => ({ command: step.command, args: step.args })),
      { author: 'ai', label: 'AI plan validation' },
    );
  } catch (cause) {
    const step = plan.commands.length === 1 ? 0 : undefined;
    return {
      ok: false,
      issues: [
        {
          code: 'door-rejected',
          message: `${step === undefined ? 'The grouped plan' : `Step ${String(step)}`} was rejected by the kernel door: ${errorMessage(cause)}`,
          ...(step === undefined ? {} : { step }),
        },
      ],
    };
  }
  const documentIssues = scratch.validate().filter((issue) => !priorIssues.has(issue.message));
  if (documentIssues.length > 0) {
    return {
      ok: false,
      issues: [
        {
          code: 'door-rejected',
          message: `The plan leaves an invalid document: ${documentIssues[0]?.message ?? 'unknown violation'}`,
        },
      ],
    };
  }
  return { ok: true, plan };
}

/** Parse, validate every command schema, then execute the ordered plan against a scratch kernel. */
export function validateAiPlan(
  candidate: unknown,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
  policy?: AiEffectiveCommandPolicy,
): AiPlanValidationResult {
  const overLimit = rawCommandLimitIssue(candidate, policy);
  if (overLimit !== undefined) return { ok: false, issues: [overLimit] };
  const parsed = parsePlan(candidate);
  if (!parsed.ok) {
    return parsed;
  }
  const issues = commandIssues(parsed.plan, kernel);
  if (issues.length > 0) return { ok: false, issues };
  const rejectedByPolicy = policyIssues(parsed.plan, policy);
  return rejectedByPolicy.length > 0
    ? { ok: false, issues: rejectedByPolicy }
    : dryRun(parsed.plan, kernel, ports);
}

export function assertValidAiPlan(
  candidate: unknown,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
  policy?: AiEffectiveCommandPolicy,
): AiPlan {
  const result = validateAiPlan(candidate, kernel, ports, policy);
  if (!result.ok) {
    throw new AiPlanRejectedError(result.issues);
  }
  return result.plan;
}
