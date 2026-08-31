import { coreCommands, createBuilder } from '@craftkit/builder-core';
import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  BlockRenderComponent,
  RegisteredCommand,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type {
  AiPlan,
  AiPlanStep,
  AiPlanValidationIssue,
  AiPlanValidationResult,
  AiValidationPorts,
} from '../types';

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
    // A human title is carried when it is one; anything else is dropped, not fatal.
    const title = rawCommand['title'];
    commands.push({
      command,
      args: rawCommand['args'],
      ...(typeof title === 'string' && title.trim() !== '' ? { title } : {}),
    });
  }
  // A staged-work suggestion rides along when it is a real sentence.
  const followUp = candidate['followUp'];
  return {
    ok: true,
    plan: {
      rationale,
      commands,
      ...(typeof followUp === 'string' && followUp.trim() !== '' ? { followUp } : {}),
    },
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
  for (const [index, step] of plan.commands.entries()) {
    try {
      scratch.dispatch(step.command, step.args, 'ai');
    } catch (cause) {
      return {
        ok: false,
        issues: [
          {
            code: 'door-rejected',
            message: `Step ${String(index)} was rejected by the kernel door: ${errorMessage(cause)}`,
            step: index,
          },
        ],
      };
    }
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
): AiPlanValidationResult {
  const parsed = parsePlan(candidate);
  if (!parsed.ok) {
    return parsed;
  }
  const issues = commandIssues(parsed.plan, kernel);
  return issues.length > 0 ? { ok: false, issues } : dryRun(parsed.plan, kernel, ports);
}

export function assertValidAiPlan(
  candidate: unknown,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
): AiPlan {
  const result = validateAiPlan(candidate, kernel, ports);
  if (!result.ok) {
    throw new AiPlanRejectedError(result.issues);
  }
  return result.plan;
}
