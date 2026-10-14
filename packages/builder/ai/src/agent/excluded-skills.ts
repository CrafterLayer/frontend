/**
 * Built-in skills the person switched off (2026-10-14), as every lane of a run reads them.
 *
 * The host sends `excludedSkillIds` (the panel's "Built-in skills" switches). A lane that
 * MATCHES skills (an edit's keyword match, a carried skill, an auto skill's dependency) hands
 * them to the resolver as `AiSkillPrepareOptions.excludedSkillIds`; a lane that NAMES skills (a
 * page plan, the scaffold, a section writer, a scene's pins) leaves them out of what it names.
 * Two things still win over a switch: the person's explicit pick (`selectedSkillIds`, the
 * composer's `/skill`), and the skills the engine cannot build without.
 */
import type { AiSkillPrepareOptions, AiSkillRegistry } from '../skills';

/**
 * Never excluded, whatever the host sends: a build without its fill or scaffold skill, or a
 * plan without its direction deck, cannot do its job, and the craft manual is the always-on
 * floor every answer is checked against.
 */
export const ENGINE_REQUIRED_SKILL_IDS: readonly string[] = Object.freeze([
  'craftkit.build-fill',
  'craftkit.build-scaffold',
  'craftkit.direction-deck',
  'craftkit.craft-manual',
]);

const REQUIRED = new Set(ENGINE_REQUIRED_SKILL_IDS);

/** What a run's options say about exclusions. */
export interface AiExcludedSkillSource {
  readonly excludedSkillIds?: readonly string[] | undefined;
  readonly selectedSkillIds?: readonly string[] | undefined;
}

/**
 * The ids a lane must leave out: the host's exclusions minus the engine's required skills and
 * minus the explicit picks (an explicit pick wins over a switch).
 */
export function excludedSkillIdsOf(options: AiExcludedSkillSource): readonly string[] {
  const excluded = options.excludedSkillIds ?? [];
  if (excluded.length === 0) return excluded;
  const picked = new Set(options.selectedSkillIds ?? []);
  return Object.freeze([...new Set(excluded)].filter((id) => !REQUIRED.has(id) && !picked.has(id)));
}

/** `ids` without the excluded ones, in order. */
export function withoutExcluded(
  ids: readonly string[],
  excluded: readonly string[],
): readonly string[] {
  if (excluded.length === 0) return ids;
  const off = new Set(excluded);
  return ids.filter((id) => !off.has(id));
}

/**
 * The registry as a run with exclusions sees it: every `prepare` also carries them, so no
 * keyword, carried match or dependency activates a switched-off skill. A view, like the run's
 * `explicitSkillsOnly`; methods are delegated by name, as a host registry may keep them on a
 * prototype.
 */
export function excludingRegistry(
  registry: AiSkillRegistry,
  excluded: readonly string[],
): AiSkillRegistry {
  if (excluded.length === 0) return registry;
  return Object.freeze({
    list: () => registry.list(),
    get: (id: string) => registry.get(id),
    readSkill: (id: string) => registry.readSkill(id),
    listReferences: (id: string) => registry.listReferences(id),
    readReference: (id: string, path: string) => registry.readReference(id, path),
    prepare: (prepare: AiSkillPrepareOptions) =>
      registry.prepare({
        ...prepare,
        excludedSkillIds: [...new Set([...(prepare.excludedSkillIds ?? []), ...excluded])],
      }),
  });
}
