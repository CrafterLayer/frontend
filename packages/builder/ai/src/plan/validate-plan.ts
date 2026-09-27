import { coreCommands, createBuilder } from '@craftkit/builder-core';
import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  BlockRenderComponent,
  JsonValue,
  RegisteredCommand,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import {
  CUSTOM_CSS_FONT_HOSTS,
  customCodeClassNames,
  customCodeIconNames,
  customCodeTreeSchema,
  customCssPropertyNames,
  findCssRejection,
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

/**
 * Free composition still has one renderable storage type: `customCode`.
 *
 * A remote model can put an invented component name on an otherwise valid
 * authored tree (for example `{ type: "portfolioShell", props: { tree: ... } }`).
 * Treating that name as a real block cannot work: the document kernel has no
 * schema for it and the renderer can only show `UnknownBlock`. When the
 * payload already contains a valid custom-code tree, normalise the accidental
 * name to the dynamic block that can render it. Unknown nodes without an
 * authored tree remain rejected and are sent to the provider's repair attempt
 * with the real reason.
 */
function normalizeFreeCompositionTypes(plan: AiPlan, kernel: BuilderKernel): AiPlan {
  if (kernel.context.registry.block('customCode') === undefined) return plan;

  const commands = plan.commands.map((step) => {
    if (step.command !== 'insertNode' || !isRecord(step.args)) return step;
    const type = step.args['type'];
    if (
      typeof type !== 'string' ||
      type.trim() === '' ||
      kernel.context.registry.block(type) !== undefined
    ) {
      return step;
    }
    const props = step.args['props'];
    if (!isRecord(props) || !customCodeTreeSchema.safeParse(props['tree']).success) return step;

    return Object.freeze({
      ...step,
      args: Object.freeze({ ...step.args, type: 'customCode' }),
    });
  });

  const changed = commands.some((step, index) => step !== plan.commands[index]);
  return changed ? Object.freeze({ ...plan, commands: Object.freeze(commands) }) : plan;
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
      const unknown = [...new Set(classNames.flatMap((value) => unknownUtilityClasses(value)))];
      if (unknown.length === 0) continue;
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} uses utility classes with no generated CSS: ${unknown
          .slice(0, 8)
          .join(
            ', ',
          )}${unknown.length > 8 ? `, and ${String(unknown.length - 8)} more` : ''}. Use a class from the site vocabulary, or name it "ck-…" and style it in the block's own css prop.`,
        step: index,
      });
    }
  });
  return issues;
}

/**
 * Every stylesheet a plan writes, wherever in the args it appears.
 *
 * Shape-driven like `customCodeTreesInArgs`, with the one difference the data
 * forces: a stylesheet is a bare string, and nothing in the SHAPE of a string
 * separates a stylesheet from a title or a slug. So the NAMES come from the
 * registry — whichever props the blocks declared with `customCss()` — and the
 * walk then finds a value under one of those names wherever it sits: inside
 * `insertNode` props, as the `value` beside a `setProp` key, or as a JSON
 * patch value whose path ends in one. A list of command names would have gone
 * stale the first time a new command carried a sheet.
 */
interface PlanStylesheet {
  readonly property: string;
  readonly css: string;
  /** The node the sheet belongs to, when the args say which. */
  readonly owner: string | undefined;
}

function customCssPropertyNamesForType(kernel: BuilderKernel, type: string): ReadonlySet<string> {
  const schema = kernel.context.registry.block(type)?.schema;
  return schema === undefined ? new Set() : customCssPropertyNames(schema.props);
}

function allCustomCssPropertyNames(kernel: BuilderKernel): ReadonlySet<string> {
  return new Set(
    kernel.context.registry
      .blocks()
      .flatMap(({ schema }) => [...customCssPropertyNamesForType(kernel, schema.type)]),
  );
}

function customCssSheetsInArgs(
  args: unknown,
  propertyNames: ReadonlySet<string>,
): readonly PlanStylesheet[] {
  const found: PlanStylesheet[] = [];
  if (propertyNames.size === 0) return found;
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
    const written = record['value'];

    // `{ key, value }` — setProp and setResponsive name the property beside it.
    const key = record['key'];
    if (typeof key === 'string' && propertyNames.has(key) && typeof written === 'string') {
      found.push({ property: key, css: written, owner: nodeIdIn(record['id']) });
    }

    // `{ path, value }` — a JSON patch names the property inside its path,
    // and names the node it belongs to one segment after `nodes`.
    const path = record['path'];
    if (Array.isArray(path) && typeof written === 'string') {
      const named = path.find(
        (segment): segment is string => typeof segment === 'string' && propertyNames.has(segment),
      );
      if (named !== undefined) {
        found.push({
          property: named,
          css: written,
          owner: path[0] === 'nodes' ? nodeIdIn(path[1]) : undefined,
        });
      }
    }

    for (const [name, child] of Object.entries(record)) {
      if (propertyNames.has(name) && typeof child === 'string') {
        found.push({ property: name, css: child, owner: undefined });
        continue;
      }
      stack.push(child);
    }
  }
  return found;
}

function nodeIdIn(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * The block type whose schema decides whether this string is a stylesheet.
 *
 * The NAMES alone are not enough: `css` is a stylesheet on a region and a
 * caption on a block that declared a plain string. Resolve the owner — the
 * node the args name, or the type an insert is creating — and let that block's
 * own schema answer. Unknown owner means the global name set stands, which is
 * the safe direction: a real sheet is never missed.
 */
function stylesheetBlockType(
  kernel: BuilderKernel,
  args: Record<string, unknown>,
  owner: string | undefined,
): string | undefined {
  if (owner !== undefined) {
    const type = kernel.getDocument().nodes[owner]?.type;
    if (type !== undefined) return type;
  }
  const declared = args['type'];
  return typeof declared === 'string' && declared !== '' ? declared : undefined;
}

/** The node or block type a step's args are about, for naming the dead sheet. */
function stylesheetOwnerInArgs(args: Record<string, unknown>): string | undefined {
  for (const name of ['id', 'type', 'wrapperType', 'groupType']) {
    const owner = nodeIdIn(args[name]);
    if (owner !== undefined) return owner;
  }
  return undefined;
}

/*
  What to do instead, per refused construct. The two entries are the ones an
  honest design actually reaches for — a web font and a background image — and
  they get a specific instruction because "refused" alone would send the model
  looking for a different way to say the same thing. Everything else shares the
  general rule, which is worth stating because the list is a REFUSAL list: the
  freedom is the default, and a model told only what failed tends to retreat
  from colours and gradients it was always allowed to use.
*/
const CSS_REFUSAL_ADVICE = new Map<string, string>([
  [
    '@import',
    `@import is allowed only from ${CUSTOM_CSS_FONT_HOSTS.join(' or ')} — write every other rule inline.`,
  ],
  ['insecure (http or //) url()', 'url() must be https://, a data: URI, or a site-relative path.'],
]);

const CSS_REFUSAL_RULE =
  'Only fetching and scripting constructs are refused; hex colours, gradients, filters, @keyframes, @font-face and https url() are all allowed.';

/**
 * Refuse a stylesheet the renderer will throw away.
 *
 * Not a style rule, and not a vocabulary preference — which is why it is not
 * behind `enforceUtilityVocabulary`. A refused construct makes the renderer
 * drop the sheet WHOLE: the page loses every rule in it, on the canvas and in
 * the published build, and nothing anywhere says why. The kernel cannot catch
 * it either — zod sees a valid short string — so the dry run downstream would
 * wave it through. This is the last place the reason can still be reported.
 */
function customCssIssues(plan: AiPlan, kernel: BuilderKernel): readonly AiPlanValidationIssue[] {
  const propertyNames = allCustomCssPropertyNames(kernel);
  if (propertyNames.size === 0) return [];
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    const args = isRecord(step.args) ? step.args : {};
    for (const sheet of customCssSheetsInArgs(args, propertyNames)) {
      const blockType = stylesheetBlockType(kernel, args, sheet.owner);
      if (
        blockType !== undefined &&
        !customCssPropertyNamesForType(kernel, blockType).has(sheet.property)
      ) {
        // Same name, different block: a caption, not a stylesheet.
        continue;
      }
      const rejection = findCssRejection(sheet.css);
      if (rejection === undefined) continue;
      const owner = sheet.owner ?? stylesheetOwnerInArgs(args);
      issues.push({
        code: 'policy-rejected',
        message: `Step ${String(index)} writes a stylesheet that will never render: "${sheet.property}"${
          owner === undefined ? '' : ` on "${owner}"`
        } uses ${rejection.reason}. A refused sheet is dropped WHOLE — the page loses every rule in it, on the canvas and in the published build, with no message anywhere. ${
          CSS_REFUSAL_ADVICE.get(rejection.reason) ?? CSS_REFUSAL_RULE
        }`,
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

/**
 * Refuse an insert of the document's own root type, with the edit that was
 * meant instead.
 *
 * The kernel door already refuses it, but only at the end of a run that has
 * already been paid for, and with a slot-list message that reads as a
 * vocabulary problem rather than a category error. Caught here it becomes a
 * repairable issue naming the one thing the model actually wanted: the root
 * already exists, so change IT.
 */
function rootInsertIssues(plan: AiPlan, kernel: BuilderKernel): readonly AiPlanValidationIssue[] {
  const { rootId, nodes } = kernel.getDocument();
  const rootType = nodes[rootId]?.type;
  if (rootType === undefined) return [];
  const issues: AiPlanValidationIssue[] = [];
  plan.commands.forEach((step, index) => {
    if (step.command !== 'insertNode') return;
    const args = isRecord(step.args) ? step.args : {};
    if (args['type'] !== rootType) return;
    issues.push({
      code: 'policy-rejected',
      step: index,
      message: `Step ${String(index)} inserts a "${rootType}", which is the document's ROOT type: the page already exists and cannot contain another one. To change the page itself, use setProp on "${rootId}" (its props are in the document); to add a section, insert a section type into "${rootId}".`,
    });
  });
  return issues;
}

/** How many node ids a rejection may quote back before the hint costs more than it saves. */
const DOOR_HINT_MAX_NODES = 40;

/**
 * Turn "that id is wrong" into "here are the right ones, and here is why yours
 * could not have worked".
 *
 * A model that names a node the document does not have is almost never
 * guessing at random: it is referring to a node it is INSERTING in the same
 * plan. It cannot know that id — the kernel mints ids from its own port, after
 * the plan is written — so no amount of retrying finds it. The bare rejection
 * sent the repair attempt looking for a better guess; it now sends it the two
 * facts that actually resolve the mistake.
 */
function missingNodeHint(cause: unknown, kernel: BuilderKernel): string {
  const message = errorMessage(cause);
  if (!/does not exist/iu.test(message)) return '';
  const { nodes } = kernel.getDocument();
  const listed = Object.values(nodes)
    .slice(0, DOOR_HINT_MAX_NODES)
    .map((node) => `${node.id} (${node.type})`)
    .join(', ');
  const more = Object.keys(nodes).length - DOOR_HINT_MAX_NODES;
  return ` The document's nodes are: ${listed}${more > 0 ? `, and ${String(more)} more` : ''}. A node this plan INSERTS is given its id by the kernel after the plan is written, so it can never be named by a later step of the same plan — put that node's props inside its own insertNode instead.`;
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
          message: `${step === undefined ? 'The grouped plan' : `Step ${String(step)}`} was rejected by the kernel door: ${errorMessage(cause)}${missingNodeHint(cause, kernel)}`,
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
  composition?: Partial<
    Pick<ResolvedAiCompositionPolicy, 'enforceUtilityVocabulary' | 'colourPolicy'>
  >,
): AiPlanValidationResult {
  const overLimit = rawCommandLimitIssue(candidate, policy);
  if (overLimit !== undefined) return { ok: false, issues: [overLimit] };
  const overOperationLimit = rawOperationLimitIssue(candidate, policy);
  if (overOperationLimit !== undefined) return { ok: false, issues: [overOperationLimit] };
  const parsed = parsePlan(candidate);
  if (!parsed.ok) {
    return parsed;
  }
  const plan = normalizeFreeCompositionTypes(parsed.plan, kernel);
  const issues = commandIssues(plan, kernel);
  if (issues.length > 0) return { ok: false, issues };
  const utilityIssues = utilityClassIssues(plan, kernel);
  if (utilityIssues.length > 0) return { ok: false, issues: utilityIssues };
  /*
    Enforced unless a host opts out, which is the opposite of every other knob
    on this policy — see `enforceUtilityVocabulary` for why silence, not
    strictness, is the failure being guarded against here.
  */
  if (composition?.enforceUtilityVocabulary !== false) {
    const vocabularyIssues = customCodeVocabularyIssues(
      plan,
      composition?.colourPolicy ?? 'free',
    );
    if (vocabularyIssues.length > 0) return { ok: false, issues: vocabularyIssues };
  }
  /*
    Outside the vocabulary opt-out on purpose: a refused stylesheet is not "a
    class this host would rather you did not use", it is "this CSS will not
    render at all". And it must run BEFORE the dry run, because the scratch
    kernel accepts a refused sheet happily — a gate placed after it would
    never fire.
  */
  const cssIssues = customCssIssues(plan, kernel);
  if (cssIssues.length > 0) return { ok: false, issues: cssIssues };
  /*
    Before the dry run too, and for the same reason as the sheet: the door's own
    refusal is a slot list, which reads as "wrong vocabulary" when the truth is
    "that thing already exists". Said here, the repair attempt is handed the
    edit that was meant.
  */
  const rootInserts = rootInsertIssues(plan, kernel);
  if (rootInserts.length > 0) return { ok: false, issues: rootInserts };
  const rejectedByPolicy = policyIssues(plan, policy);
  return rejectedByPolicy.length > 0
    ? { ok: false, issues: rejectedByPolicy }
    : dryRun(plan, kernel, ports);
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
