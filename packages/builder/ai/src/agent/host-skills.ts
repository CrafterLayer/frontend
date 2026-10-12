/**
 * The person's own skills in a build (2026-10-12).
 *
 * A single-request run (`runAiAgent`) matches skills on the request's words by itself. A build
 * and a page plan do not: every step NAMES its skills (`autoSkills: false`, measured
 * 2026-09-28: keyword matching on the page request handed every section writer ~10k characters
 * of page-level playbooks). That rule also shut out the skills a person wrote for their own
 * site, so a "brand voice" skill shaped an edit and never the page built from scratch.
 *
 * The host now names those skills itself — the ones the request mentions, or that the person
 * keeps on — and every step offers them first among its optional skills. They are still only
 * optional: `fittingSkillIds` drops from the end until the step fits its skill budget, and a
 * host skill is never made mandatory, so it can never make a build throw.
 */
import type { AiSkillRegistry } from '../skills';

export interface AiHostSkillOptions {
  /**
   * Skills the host chose for this request, by registry id (they must be in `skillRegistry`).
   * A build's steps and a page plan offer them before their own optional skills.
   */
  hostSkillIds?: readonly string[];
}

/** A step input's `skillRegistry` and `hostSkillIds`, each only when set. */
export function stepSkills(options: {
  readonly skillRegistry?: AiSkillRegistry;
  readonly hostSkillIds?: readonly string[];
}): { skillRegistry?: AiSkillRegistry; hostSkillIds?: readonly string[] } {
  return {
    ...(options.skillRegistry === undefined ? {} : { skillRegistry: options.skillRegistry }),
    ...(options.hostSkillIds === undefined ? {} : { hostSkillIds: options.hostSkillIds }),
  };
}

/** `optional` with the host's skills first, without duplicates or any id `required` holds. */
export function withHostSkills(
  host: AiHostSkillOptions,
  optional: readonly string[],
  required: readonly string[] = [],
): readonly string[] {
  const ids = host.hostSkillIds ?? [];
  if (ids.length === 0) return optional;
  const taken = new Set(required);
  return [...new Set([...ids, ...optional])].filter((id) => !taken.has(id));
}
