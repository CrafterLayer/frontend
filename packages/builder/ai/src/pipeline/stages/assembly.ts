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

/**
 * Every asset id anywhere inside a command's arguments.
 *
 * A walk rather than a lookup at a known path, because the block registry owns
 * where an image prop sits: it can be `props.image`, an entry in
 * `props.items[2].photo`, or a prop of a block that does not exist yet. The
 * shape `{ assetId }` is the reference itself, so finding the shape finds every
 * reference no matter which block invented the place to put it.
 */
const assetRefsIn = (value: unknown, found: string[] = []): readonly string[] => {
  if (Array.isArray(value)) {
    for (const item of value) assetRefsIn(item, found);
    return found;
  }
  if (!isRecord(value)) return found;
  if (typeof value['assetId'] === 'string') found.push(value['assetId']);
  for (const item of Object.values(value)) assetRefsIn(item, found);
  return found;
};

/**
 * The props through which a MEDIA ADDRESS could reach a page.
 *
 * `src`, `poster` and `imageUrl` across the registry. `href` is deliberately not
 * here: a link is a destination a business legitimately has — its own booking
 * page, its Instagram — and refusing those would break the sites this is meant
 * to build. A picture is different. There is exactly one legitimate source for
 * one, the site's asset table, and it is reached by id.
 */
const MEDIA_ADDRESS_PROPS = new Set(['src', 'poster', 'imageUrl']);

/** Every media address written literally into a command's arguments. */
const mediaAddressesIn = (value: unknown, found: string[] = []): readonly string[] => {
  if (Array.isArray(value)) {
    for (const item of value) mediaAddressesIn(item, found);
    return found;
  }
  if (!isRecord(value)) return found;
  for (const [key, item] of Object.entries(value)) {
    if (MEDIA_ADDRESS_PROPS.has(key) && typeof item === 'string' && item !== '') {
      found.push(item);
      continue;
    }
    mediaAddressesIn(item, found);
  }
  return found;
};

export function validateAssembly(
  response: AssemblyResponse,
  allowedCommands: readonly string[],
  knownAssets: readonly string[],
): readonly AssemblyStep[] {
  const reasons: string[] = [];
  const allowed = new Set(allowedCommands);
  const assets = new Set(knownAssets);
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
    /*
      An unresolvable reference is refused HERE and not at the door, because the
      door cannot tell the difference: `{ assetId: 'hero-1' }` satisfies the
      block schema perfectly, and a site would store it, validate, and then
      render a hole. FR-045 is the rule that the only ids that may appear are
      the ones the run was actually given.
    */
    /*
      The hole this closes: the catalogue withholds URLs so a stage cannot COPY
      one, but nothing stopped it INVENTING one into `src`. Such a command
      satisfied the block schema, the door, and `validateSite` — and rendered a
      broken image on a stranger's site, which is the exact failure the whole
      asset design exists to make impossible.

      Refused by PROP NAME rather than by pattern-matching a URL, because the
      rule is not "no addresses" — it is that a PICTURE has one legitimate
      source and this is not it. A link's `href` is untouched.
    */
    for (const address of mediaAddressesIn(step.args)) {
      const shown = address.length > 60 ? `${address.slice(0, 57)}…` : address;
      reasons.push(
        `Command ${String(index + 1)} ("${step.command}") writes the image address "${shown}". Pictures come from the site's asset table by id; an address a run was not given cannot be checked and renders as a broken image.`,
      );
    }
    for (const assetId of assetRefsIn(step.args)) {
      if (assets.has(assetId)) continue;
      reasons.push(
        assets.size === 0
          ? `Command ${String(index + 1)} references the picture "${assetId}", but this run has no asset library, so no picture exists to reference.`
          : `Command ${String(index + 1)} references the picture "${assetId}", which is not in this site's asset table.`,
      );
    }
  }

  if (reasons.length > 0) throw new StageRejectedError('assembly', reasons);
  return validated;
}
