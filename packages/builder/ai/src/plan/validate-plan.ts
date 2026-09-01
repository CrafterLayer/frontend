import { coreCommands, createBuilder } from '@craftkit/builder-core';
import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  BlockRenderComponent,
  JsonValue,
  RegisteredCommand,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import {
  customCodeClassNames,
  customCodeIconNames,
  findRejectedUtilities,
  isJsonValue,
  isLucideIconName,
  unknownUtilityClasses,
} from '@craftkit/builder-schema';

import type {
  AiPlan,
  AiPlanStep,
  AiPlanValidationIssue,
  AiPlanValidationResult,
  AiValidationPorts,
} from '../types';
import { DEFAULT_AI_MAX_OPERATIONS, type AiEffectiveCommandPolicy } from '../skills';
import type { ResolvedAiCompositionPolicy } from '../context/composition-policy';

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
  const operationIssue = operationLimitIssue(plan, policy);
  if (operationIssue !== undefined) return [operationIssue];

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

function operationCount(plan: Pick<AiPlan, 'commands'>): number {
  let count = 0;
  for (const step of plan.commands) {
    if (
      step.command === 'applyPatches' &&
      isRecord(step.args) &&
      Array.isArray(step.args['patches'])
    ) {
      count += step.args['patches'].length;
    } else {
      count += 1;
    }
  }
  return count;
}

function operationLimitIssue(
  plan: Pick<AiPlan, 'commands'>,
  policy: AiEffectiveCommandPolicy,
): AiPlanValidationIssue | undefined {
  const maxOperations = policy.maxOperations ?? DEFAULT_AI_MAX_OPERATIONS;
  const operations = operationCount(plan);
  return operations > maxOperations
    ? {
        code: 'policy-rejected',
        message: `The active AI policy allows at most ${String(maxOperations)} nested operations; the plan requests ${String(operations)}.`,
      }
    : undefined;
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

function rawOperationLimitIssue(
  candidate: unknown,
  policy: AiEffectiveCommandPolicy | undefined,
): AiPlanValidationIssue | undefined {
  if (policy === undefined || !isRecord(candidate)) return undefined;
  const rawCommands = candidate['commands'];
  if (!Array.isArray(rawCommands)) return undefined;
  const maxOperations = policy.maxOperations ?? DEFAULT_AI_MAX_OPERATIONS;
  let operations = 0;
  for (const rawStep of rawCommands) {
    if (
      isRecord(rawStep) &&
      rawStep['command'] === 'applyPatches' &&
      isRecord(rawStep['args']) &&
      Array.isArray(rawStep['args']['patches'])
    ) {
      operations += rawStep['args']['patches'].length;
    } else {
      operations += 1;
    }
    if (operations > maxOperations) {
      return {
        code: 'policy-rejected',
        message: `The active AI policy allows at most ${String(maxOperations)} nested operations; the plan requests more than that bound.`,
      };
    }
  }
  return undefined;
}

function utilityPropertyNamesForType(kernel: BuilderKernel, type: string): ReadonlySet<string> {
  const groups = kernel.context.registry.block(type)?.schema.propertyGroups;
  return new Set(
    Object.entries(groups ?? {}).flatMap(([name, group]) =>
      group?.kind === 'utility-classes' ? [name] : [],
    ),
  );
}

function firstUtilityPropertyInRecord(
  kernel: BuilderKernel,
  type: unknown,
  value: unknown,
): string | undefined {
  if (typeof type !== 'string' || !isRecord(value)) return undefined;
  const utilityProperties = utilityPropertyNamesForType(kernel, type);
  return Object.keys(value).find((name) => utilityProperties.has(name));
}

function firstUtilityPropertyForNode(
  kernel: BuilderKernel,
  nodeTypes: ReadonlyMap<string, string>,
  id: unknown,
  key: unknown,
): string | undefined {
  if (typeof id !== 'string' || typeof key !== 'string') return undefined;
  const type = nodeTypes.get(id);
  return type !== undefined && utilityPropertyNamesForType(kernel, type).has(key) ? key : undefined;
}

function allUtilityPropertyNames(kernel: BuilderKernel): ReadonlySet<string> {
  return new Set(
    kernel.context.registry
      .blocks()
      .flatMap(({ schema }) => [...utilityPropertyNamesForType(kernel, schema.type)]),
  );
}

function firstNestedProperty(
  value: unknown,
  propertyNames: ReadonlySet<string>,
): string | undefined {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (const child of current) pending.push(child);
      continue;
    }
    if (!isRecord(current)) continue;
    for (const [name, child] of Object.entries(current)) {
      if (propertyNames.has(name)) return name;
      pending.push(child);
    }
  }
  return undefined;
}

function utilityPropertyFromPatches(kernel: BuilderKernel, args: unknown): string | undefined {
  if (!isRecord(args) || !Array.isArray(args['patches'])) return undefined;
  const propertyNames = allUtilityPropertyNames(kernel);
  for (const patch of args['patches']) {
    if (!isRecord(patch)) continue;
    const path = patch['path'];
    if (Array.isArray(path)) {
      const pathMatch = path.find(
        (segment): segment is string => typeof segment === 'string' && propertyNames.has(segment),
      );
      if (pathMatch !== undefined) return pathMatch;
    }
    const value = patch['value'];
    const valueMatch = firstNestedProperty(value, propertyNames);
    if (valueMatch !== undefined) return valueMatch;
  }
  return undefined;
}

function replaceShadowNodeTypes(nodeTypes: Map<string, string>, value: unknown): void {
  nodeTypes.clear();
  if (!isRecord(value)) return;
  for (const [id, node] of Object.entries(value)) {
    if (isRecord(node) && typeof node['type'] === 'string') {
      nodeTypes.set(id, node['type']);
    }
  }
}

function updateShadowNodeTypes(nodeTypes: Map<string, string>, args: unknown): void {
  if (!isRecord(args) || !Array.isArray(args['patches'])) return;
  for (const patch of args['patches']) {
    if (!isRecord(patch) || !Array.isArray(patch['path'])) continue;
    const path = patch['path'];
    if (path[0] !== 'nodes') continue;
    const operation = patch['op'];

    if (path.length === 1) {
      if (operation === 'remove') nodeTypes.clear();
      else replaceShadowNodeTypes(nodeTypes, patch['value']);
      continue;
    }

    const rawId: unknown = path[1];
    if (typeof rawId !== 'string' && typeof rawId !== 'number') continue;
    const id = String(rawId);
    if (path.length === 2) {
      if (operation === 'remove') {
        nodeTypes.delete(id);
      } else {
        const node = patch['value'];
        if (isRecord(node) && typeof node['type'] === 'string') {
          nodeTypes.set(id, node['type']);
        } else {
          nodeTypes.delete(id);
        }
      }
      continue;
    }

    if (path.length === 3 && path[2] === 'type') {
      const type = patch['value'];
      if (operation === 'remove' || typeof type !== 'string') nodeTypes.delete(id);
      else nodeTypes.set(id, type);
    }
  }
}

function utilityClassIssues(plan: AiPlan, kernel: BuilderKernel): readonly AiPlanValidationIssue[] {
  const nodeTypes = new Map(
    Object.values(kernel.getDocument().nodes).map((node) => [node.id, node.type]),
  );
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    const args = isRecord(step.args) ? step.args : {};
    const property =
      step.command === 'insertNode'
        ? firstUtilityPropertyInRecord(kernel, args['type'], args['props'])
        : step.command === 'wrapNode'
          ? firstUtilityPropertyInRecord(kernel, args['wrapperType'], args['wrapperProps'])
          : step.command === 'groupNodes'
            ? firstUtilityPropertyInRecord(kernel, args['groupType'], args['groupProps'])
            : step.command === 'setProp' ||
                step.command === 'setResponsive' ||
                step.command === 'setBinding'
              ? firstUtilityPropertyForNode(kernel, nodeTypes, args['id'], args['key'])
              : step.command === 'applyPatches'
                ? utilityPropertyFromPatches(kernel, args)
                : undefined;
    if (property !== undefined) {
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} authors utility-classes property "${property}", which is human-only and unavailable to AI plans.`,
        step: index,
      });
    }
    if (step.command === 'applyPatches') updateShadowNodeTypes(nodeTypes, args);
  });
  return issues;
}

/**
 * Every custom-code tree a plan writes, wherever in the args it appears.
 *
 * Deliberately shape-driven rather than command-driven: a tree can arrive as
 * `insertNode` props, a `setProp` value, or a JSON patch value, and a list of
 * command names to inspect would go stale the first time a new command carried
 * one. What identifies a tree is that it LOOKS like one.
 */
function customCodeTreesInArgs(args: unknown): readonly unknown[] {
  const found: unknown[] = [];
  const stack: unknown[] = [args];
  let visited = 0;
  while (stack.length > 0 && visited < 10_000) {
    const value = stack.pop();
    visited += 1;
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    const record = value as Record<string, unknown>;
    if (record['kind'] === 'root' && Array.isArray(record['children'])) {
      found.push(record);
      continue;
    }
    for (const child of Object.values(record)) stack.push(child);
  }
  return found;
}

/**
 * Refuse a class name the runtime vocabulary does not generate.
 *
 * This is not a style rule. A class outside the vocabulary has NO CSS: it is
 * inert on the canvas, silently absent from the production build, and reports
 * nothing anywhere. The failure it produces — "the page renders unstyled and
 * no one can say why" — is the single most expensive way this feature could
 * fail, so it is caught at the door where a name can still be reported.
 */
function customCodeVocabularyIssues(
  plan: AiPlan,
  colourPolicy: 'free' | 'tokens',
): readonly AiPlanValidationIssue[] {
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    for (const tree of customCodeTreesInArgs(step.args)) {
      const classNames = customCodeClassNames(tree);

      /*
        The THEMING law — roles only, no palette — applies to a tree only when
        the host asks for it. By default the assistant composes with the whole
        palette, the way any Tailwind user does; that was the product's
        decision, made after a first version refused "white text on a travel
        photo" as a colour violation. Arbitrary values (`bg-[#hex]`) are still
        refused below, by the generation law, because they have no CSS at all.
      */
      const rejected =
        colourPolicy === 'tokens'
          ? [
              ...new Map(
                classNames
                  .flatMap((value) => findRejectedUtilities(value))
                  .map((rejection) => [rejection.utility, rejection]),
              ).values(),
            ]
          : [];
      if (rejected.length > 0) {
        issues.push({
          code: 'policy-rejected',
          message: `Step ${String(index)} writes ${String(rejected.length)} unusable class(es) into a custom-code tree. ${rejected[0]?.message ?? ''}`,
          step: index,
        });
        continue;
      }

      /*
        Icons, by existence. An icon the set does not have draws a visible
        placeholder rather than nothing — but a placeholder on a published
        page is still a defect, and the name is knowable here, so it is
        refused here, by name.
      */
      const unknownIcons = customCodeIconNames(tree).filter((name) => !isLucideIconName(name));
      if (unknownIcons.length > 0) {
        issues.push({
          code: 'policy-rejected',
          message: `Step ${String(index)} names icons that are not in the Lucide set: ${unknownIcons
            .slice(0, 8)
            .join(', ')}. Use exact kebab-case names from lucide.dev/icons.`,
          step: index,
        });
        continue;
      }

      // Then the GENERATION law: a class with no CSS fails silently otherwise.
      const unknown = [
        ...new Set(classNames.flatMap((value) => unknownUtilityClasses(value))),
      ];
      if (unknown.length === 0) continue;
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} uses utility classes with no generated CSS: ${unknown
          .slice(0, 8)
          .join(', ')}${unknown.length > 8 ? `, and ${String(unknown.length - 8)} more` : ''}. Use a class from the site vocabulary, or name it "ck-…" and style it in the block's own css prop.`,
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
  composition?: Partial<Pick<ResolvedAiCompositionPolicy, 'enforceUtilityVocabulary' | 'colourPolicy'>>,
): AiPlanValidationResult {
  const overLimit = rawCommandLimitIssue(candidate, policy);
  if (overLimit !== undefined) return { ok: false, issues: [overLimit] };
  const overOperationLimit = rawOperationLimitIssue(candidate, policy);
  if (overOperationLimit !== undefined) return { ok: false, issues: [overOperationLimit] };
  const parsed = parsePlan(candidate);
  if (!parsed.ok) {
    return parsed;
  }
  const issues = commandIssues(parsed.plan, kernel);
  if (issues.length > 0) return { ok: false, issues };
  const utilityIssues = utilityClassIssues(parsed.plan, kernel);
  if (utilityIssues.length > 0) return { ok: false, issues: utilityIssues };
  /*
    Enforced unless a host opts out, which is the opposite of every other knob
    on this policy — see `enforceUtilityVocabulary` for why silence, not
    strictness, is the failure being guarded against here.
  */
  if (composition?.enforceUtilityVocabulary !== false) {
    const vocabularyIssues = customCodeVocabularyIssues(
      parsed.plan,
      composition?.colourPolicy ?? 'free',
    );
    if (vocabularyIssues.length > 0) return { ok: false, issues: vocabularyIssues };
  }
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
