import { defineAiSkill } from './define-skill';
import { compareSkillText } from './compare';
import { AiSkillRegistryError } from './errors';
import { resolveAiSkills } from './resolve-skills';
import type {
  AiDefinedSkillV1,
  AiSkillDefinitionV1,
  AiSkillManifestV1,
  AiSkillPrepareOptions,
  AiSkillRegistry,
} from './types';

export const AI_SKILL_MAX_REGISTRY_SIZE = 256;

function requireSkill(
  entries: ReadonlyMap<string, AiDefinedSkillV1>,
  id: string,
): AiDefinedSkillV1 {
  const skill = entries.get(id);
  if (skill === undefined) {
    throw new AiSkillRegistryError('unknown-skill', `Unknown skill ${id}.`);
  }
  return skill;
}

export function createAiSkillRegistry(
  definitions: readonly AiSkillDefinitionV1[] = [],
): AiSkillRegistry {
  if (!Array.isArray(definitions) || definitions.length > AI_SKILL_MAX_REGISTRY_SIZE) {
    throw new AiSkillRegistryError(
      'registry-too-large',
      `An AI skill registry may contain at most ${String(AI_SKILL_MAX_REGISTRY_SIZE)} definitions.`,
    );
  }
  // Build a private temporary map first so a duplicate or invalid definition
  // fails the whole construction without exposing a partially usable registry.
  const mutableEntries = new Map<string, AiDefinedSkillV1>();
  for (const definition of definitions) {
    const skill = defineAiSkill(definition);
    if (mutableEntries.has(skill.manifest.id)) {
      throw new AiSkillRegistryError('duplicate-skill', `Duplicate skill id ${skill.manifest.id}.`);
    }
    mutableEntries.set(skill.manifest.id, skill);
  }

  const sortedEntries = [...mutableEntries.entries()].sort(([left], [right]) =>
    compareSkillText(left, right),
  );
  const entries: ReadonlyMap<string, AiDefinedSkillV1> = new Map(sortedEntries);
  const catalog: readonly AiSkillManifestV1[] = Object.freeze(
    sortedEntries.map(([, skill]) => skill.manifest),
  );

  return Object.freeze({
    list: (): readonly AiSkillManifestV1[] => catalog,
    get: (id: string): AiSkillManifestV1 | undefined => entries.get(id)?.manifest,
    readSkill: (id: string): string => requireSkill(entries, id).instructions,
    listReferences: (id: string): readonly string[] =>
      requireSkill(entries, id).manifest.referencePaths,
    readReference: (id: string, path: string): string => {
      const skill = requireSkill(entries, id);
      const reference = Object.hasOwn(skill.references, path) ? skill.references[path] : undefined;
      if (typeof reference !== 'string') {
        throw new AiSkillRegistryError(
          'unknown-reference',
          `Unknown reference ${path} for skill ${id}.`,
        );
      }
      return reference;
    },
    prepare: (options: AiSkillPrepareOptions) => resolveAiSkills(entries, catalog, options),
  });
}
