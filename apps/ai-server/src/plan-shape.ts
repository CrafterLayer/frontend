import type { AiPlanWireRequest } from '@craftkit/builder/wire';

/**
 * Whether a parsed answer has the SHAPE of a plan for this request — the
 * judge `salvageJson` hands its rebalanced candidates to.
 *
 * A run of closers rewritten to parse can still close one level too few or
 * too many, and the text after it then lands in the wrong object: a command's
 * `title` inside its `args`, a sibling node inside a node's props. Every such
 * candidate parses; almost none has keys where the request's own contract
 * puts them. So the check reads the contract the request carries — the plan
 * schema's properties, each command's argument schema — instead of restating
 * the plan format here, and adds one structural rule for trees: a node (an
 * object with `kind`) never carries a key that belongs to the plan above it.
 *
 * It judges shape, not validity. The plan's own validator, two layers later,
 * still decides whether the plan is allowed.
 */

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The property names a closed object schema admits, or undefined when it admits any. */
function closedKeys(schema: unknown): ReadonlySet<string> | undefined {
  if (!isRecord(schema) || schema['additionalProperties'] !== false) return undefined;
  const properties = schema['properties'];
  return isRecord(properties) ? new Set(Object.keys(properties)) : undefined;
}

function keysWithin(value: JsonRecord, allowed: ReadonlySet<string> | undefined): boolean {
  return allowed === undefined || Object.keys(value).every((key) => allowed.has(key));
}

/** Keys that live at the plan, command, and argument levels — never on a tree node. */
const PLAN_LEVEL_KEYS = new Set(['rationale', 'commands', 'followUp', 'command', 'args', 'title']);

/** Every object with a `kind` is a node; none may hold a key that belongs to the plan above it. */
function nodesStayInPlace(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...(current as unknown[]));
      continue;
    }
    if (!isRecord(current)) continue;
    if (typeof current['kind'] === 'string') {
      if (Object.keys(current).some((key) => PLAN_LEVEL_KEYS.has(key))) return false;
      const children = current['children'];
      if (children !== undefined && !Array.isArray(children)) return false;
      if (Array.isArray(children) && children.some((child) => !isRecord(child))) return false;
    }
    stack.push(...Object.values(current));
  }
  return true;
}

export function planShapeCheck(request: AiPlanWireRequest): (value: unknown) => boolean {
  const planSchema: unknown = request.context.outputContract?.schema;
  const planKeys = closedKeys(planSchema);
  const commandsSchema = isRecord(planSchema) ? planSchema['properties'] : undefined;
  const commandKeys = closedKeys(
    isRecord(commandsSchema) && isRecord(commandsSchema['commands'])
      ? commandsSchema['commands']['items']
      : undefined,
  );
  const argKeys = new Map<string, ReadonlySet<string> | undefined>(
    (request.context.commands ?? []).map((command) => [
      command.name,
      closedKeys(command.argsSchema),
    ]),
  );

  return (value: unknown): boolean => {
    if (!isRecord(value) || !keysWithin(value, planKeys)) return false;
    const commands = value['commands'];
    if (!Array.isArray(commands)) return false;
    for (const entry of commands as unknown[]) {
      if (!isRecord(entry) || !keysWithin(entry, commandKeys)) return false;
      const name = entry['command'];
      const args = entry['args'];
      if (typeof name !== 'string') return false;
      if (isRecord(args) && !keysWithin(args, argKeys.get(name))) return false;
      if (!nodesStayInPlace(args)) return false;
    }
    return true;
  };
}
