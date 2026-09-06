import { StageRejectedError } from './errors';
import { isRecord, stageArray } from './shape';
import type { AssemblyResponse, AssemblyStep } from '../wire';

/**
 * What the assembly stage must produce: COMMANDS, and only commands.
 *
 * ## Why not a finished site
 *
 * Because the door is the only thing that may write one. A stage that returned
 * a site object would be a second way to build a site — one with none of the
 * validation, none of the ids, and none of the transaction accounting the first
 * way has. Every command here goes through `validateAiPlan` and
 * `dispatchGroup` exactly as a plan's does, which is what keeps "storable
 * implies renderable" true for a generated site.
 *
 * This function does NOT validate the commands themselves. That is the door's
 * job and it does it better: it knows the registry, the slot rules and the
 * schemas. What is checked here is only what the door cannot say — that the
 * stage returned commands at all, and that they are shaped like commands.
 */
const isCommandEntry = (value: unknown): value is AssemblyStep =>
  isRecord(value) &&
  typeof value['command'] === 'string' &&
  value['command'] !== '' &&
  (value['page'] === undefined || typeof value['page'] === 'string');

export function validateAssembly(
  response: AssemblyResponse,
  allowedCommands: readonly string[],
): readonly AssemblyStep[] {
  const reasons: string[] = [];
  const allowed = new Set(allowedCommands);
  /*
    A model asked for commands sometimes answers with the SITE it would have
    built. That is the one answer this stage must never accept, because the door
    is the only thing allowed to build a site — so it is refused by shape, here,
    with a message naming what arrived.
  */
  const validated: AssemblyStep[] = [];
  const commands = stageArray(
    'assembly',
    response,
    'commands',
    'An assembly answer must carry a list of commands, not a finished site.',
  );

  if (commands.length === 0) {
    reasons.push('It returned no commands, so nothing would be built.');
  }

  for (const [index, step] of commands.entries()) {
    if (!isCommandEntry(step)) {
      reasons.push(`Command ${String(index + 1)} has no name.`);
      continue;
    }
    validated.push(step);
    if (!allowed.has(step.command)) {
      /*
        Checked here as well as at the door, and the duplication is deliberate:
        the door refuses at the END of a run that has already been paid for,
        with a message about a policy. Here it is one stage, and the message can
        say which command and that the list was sent.
      */
      reasons.push(`"${step.command}" is not a command this run may use.`);
    }
    if (typeof step.args !== 'object' || step.args === null) {
      reasons.push(`Command ${String(index + 1)} ("${step.command}") has no arguments.`);
    }
  }

  if (reasons.length > 0) throw new StageRejectedError('assembly', reasons);
  return validated;
}
