import { AiCommandPolicyError } from './errors';
import { compareSkillText } from './compare';
import type { AiPreparedSkillContext } from './types';

export const DEFAULT_AI_MAX_COMMANDS = 64;
export const DEFAULT_AI_MAX_OPERATIONS = 256;

/**
 * Bulk patching is a kernel interoperability escape hatch, not an ordinary AI
 * editing primitive. A host must name it in `allowedCommands` for this run;
 * merely registering it never grants it to the model.
 *
 * `applySitePatches` joins it for the same reason and one more (013, ق٢): it is
 * the door the host commits a finished DRAFT through, after fingerprinting the
 * live site and diffing it. The agent's changes reach the site through that
 * diff — never by the model choosing patch paths of its own, which would let a
 * single step rewrite `designSystem`, `assets`, or another page entirely,
 * bypassing every refusal the named site commands enforce.
 */
const EXPLICIT_HOST_ALLOW_COMMANDS: ReadonlySet<string> = new Set([
  'applyPatches',
  'applySitePatches',
]);

export interface AiCommandPolicy {
  allowedCommands?: readonly string[];
  deniedCommands?: readonly string[];
  maxCommands: number;
  maxOperations: number;
}

export interface AiEffectiveCommandPolicy {
  allowedCommands: readonly string[];
  maxCommands: number;
  /** Optional only for source compatibility; omission resolves to the safe default. */
  maxOperations?: number;
}

export interface ResolveAiCommandPolicyOptions {
  registeredCommands: readonly string[];
  session?: Partial<AiCommandPolicy>;
  skills?: AiPreparedSkillContext;
}

function fail(code: string, message: string): never {
  throw new AiCommandPolicyError(code, message);
}

function commandList(value: readonly string[], field: string): readonly string[] {
  if (!Array.isArray(value)) {
    return fail('invalid-command-list', `${field} must be an array of command names.`);
  }
  const seen = new Set<string>();
  const commands = value.map((command, index) => {
    if (typeof command !== 'string' || command.trim().length === 0) {
      return fail(
        'invalid-command-name',
        `${field}[${String(index)}] must be a non-empty command name.`,
      );
    }
    const normalized = command.trim();
    if (seen.has(normalized)) {
      return fail('duplicate-command', `${field} contains duplicate command ${normalized}.`);
    }
    seen.add(normalized);
    return normalized;
  });
  return Object.freeze(commands.sort(compareSkillText));
}

/**
 * Compute the only command set an agent may propose. Every layer is an
 * intersection; skills can reduce authority but can never add to the live
 * kernel registry.
 */
export function resolveAiCommandPolicy(
  options: ResolveAiCommandPolicyOptions,
): AiEffectiveCommandPolicy {
  const registered = commandList(options.registeredCommands, 'registeredCommands');
  const sessionAllowed =
    options.session?.allowedCommands === undefined
      ? undefined
      : commandList(options.session.allowedCommands, 'session.allowedCommands');
  const denied =
    options.session?.deniedCommands === undefined
      ? Object.freeze([])
      : commandList(options.session.deniedCommands, 'session.deniedCommands');
  const skillAllowed = options.skills?.effectiveCommandRestriction;

  const maxCommands = options.session?.maxCommands ?? DEFAULT_AI_MAX_COMMANDS;
  if (!Number.isSafeInteger(maxCommands) || maxCommands <= 0 || maxCommands > 10_000) {
    return fail('invalid-max-commands', 'session.maxCommands must be between 1 and 10000.');
  }
  const maxOperations = options.session?.maxOperations ?? DEFAULT_AI_MAX_OPERATIONS;
  if (!Number.isSafeInteger(maxOperations) || maxOperations <= 0 || maxOperations > 100_000) {
    return fail('invalid-max-operations', 'session.maxOperations must be between 1 and 100000.');
  }

  const allowedCommands = registered.filter(
    (command) =>
      (sessionAllowed === undefined || sessionAllowed.includes(command)) &&
      (!EXPLICIT_HOST_ALLOW_COMMANDS.has(command) || sessionAllowed?.includes(command) === true) &&
      (skillAllowed === undefined || skillAllowed.includes(command)) &&
      !denied.includes(command),
  );

  return Object.freeze({
    allowedCommands: Object.freeze(allowedCommands),
    maxCommands,
    maxOperations,
  });
}
