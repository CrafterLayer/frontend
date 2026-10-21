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
import { explicitRequestSkillIdsFor } from '../skills/request-skills';
import { excludedSkillIdsOf, type AiExcludedSkillSource } from './excluded-skills';

export interface AiHostSkillOptions {
  /** Explicit picks are required, not optional host defaults. */
  selectedSkillIds?: readonly string[];
  /**
   * Skills the host chose for this request, by registry id (they must be in `skillRegistry`).
   * A build's steps and a page plan offer them before their own optional skills.
   */
  hostSkillIds?: readonly string[];
  /**
   * Built-in skills the person switched off (2026-10-14): no step names them and no match
   * activates them. An explicit pick (`selectedSkillIds`) and the engine's required skills
   * (`ENGINE_REQUIRED_SKILL_IDS`) are never excluded. See excluded-skills.ts.
   */
  excludedSkillIds?: readonly string[];
}

/** A step input's `skillRegistry`, `hostSkillIds` and effective exclusions, each only when set. */
export function stepSkills(
  options: AiExcludedSkillSource & {
    readonly skillRegistry?: AiSkillRegistry;
    readonly hostSkillIds?: readonly string[];
    readonly request?: string;
  },
): {
  skillRegistry?: AiSkillRegistry;
  hostSkillIds?: readonly string[];
  selectedSkillIds?: readonly string[];
  excludedSkillIds?: readonly string[];
} {
  const selectedSkillIds = explicitSkills(options);
  const excluded = excludedSkillIdsOf({ ...options, selectedSkillIds });
  return {
    ...(selectedSkillIds.length === 0 ? {} : { selectedSkillIds }),
    ...(options.skillRegistry === undefined ? {} : { skillRegistry: options.skillRegistry }),
    ...(options.hostSkillIds === undefined ? {} : { hostSkillIds: options.hostSkillIds }),
    ...(excluded.length === 0 ? {} : { excludedSkillIds: excluded }),
  };
}

/**
 * `optional` with the host's skills first, without duplicates, any id `required` holds, or
 * any id the person switched off (`excludedSkillIdsOf`: an explicit pick still stays).
 */
export function withHostSkills(
  host: AiHostSkillOptions & AiExcludedSkillSource,
  optional: readonly string[],
  required: readonly string[] = [],
): readonly string[] {
  const ids = host.hostSkillIds ?? [];
  const excluded = excludedSkillIdsOf(host);
  if (ids.length === 0 && excluded.length === 0) return optional;
  const taken = new Set([...required, ...excluded]);
  return [...new Set([...ids, ...optional])].filter((id) => !taken.has(id));
}

/** Explicit slash picks and named built-in expertise are never silently budget-shed. */
export function explicitSkills(options: {
  readonly selectedSkillIds?: readonly string[] | undefined;
  readonly skillRegistry?: AiSkillRegistry;
  readonly request?: string;
}): readonly string[] {
  return [
    ...new Set([
      ...(options.selectedSkillIds ?? []),
      ...explicitRequestSkillIdsFor(options.skillRegistry, options.request ?? ''),
    ]),
  ];
}
