import { AiCommandPolicyError } from './errors';
import { compareSkillText } from './compare';
import type { AiPreparedSkillContext } from './types';

export const DEFAULT_AI_MAX_COMMANDS = 64;

export interface AiCommandPolicy {
  allowedCommands?: readonly string[];
  deniedCommands?: readonly string[];
  maxCommands: number;
}

export interface AiEffectiveCommandPolicy {
  allowedCommands: readonly string[];
  maxCommands: number;
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

  const allowedCommands = registered.filter(
    (command) =>
      (sessionAllowed === undefined || sessionAllowed.includes(command)) &&
      (skillAllowed === undefined || skillAllowed.includes(command)) &&
      !denied.includes(command),
  );

  return Object.freeze({
    allowedCommands: Object.freeze(allowedCommands),
    maxCommands,
  });
}
