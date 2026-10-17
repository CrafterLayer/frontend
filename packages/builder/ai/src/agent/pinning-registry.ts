import type { AiSkillPrepareOptions, AiSkillRegistry } from '../skills';
import { fittingSkillIds } from './plan-page';
import type { RunAiAgentOptions } from './types';

/**
 * The registry as a scene edit sees it: every `prepare` also selects the scene's playbooks after
 * the person's own picks, shed from the end until they fit the run's budget (explicit skills are
 * mandatory to the resolver, so one that did not fit would fail the run). A view, like the
 * run's `explicitSkillsOnly`: nothing is read until skills are prepared, so a direct edit, which
 * is tried first, never pays for it. A pin the person switched off (`excluded`, 2026-10-14) is
 * never pinned; a pick of theirs is already one of `picks`.
 */
export function pinningRegistry(
  registry: AiSkillRegistry,
  policy: RunAiAgentOptions['policy'],
  pins: () => readonly string[],
  excluded: readonly string[] = [],
): AiSkillRegistry {
  return Object.freeze({
    list: () => registry.list(),
    get: (id: string) => registry.get(id),
    readSkill: (id: string) => registry.readSkill(id),
    listReferences: (id: string) => registry.listReferences(id),
    readReference: (id: string, path: string) => registry.readReference(id, path),
    prepare: (prepare: AiSkillPrepareOptions) => {
      const picks = prepare.selectedSkillIds ?? [];
      const extra = pins().filter((id) => !picks.includes(id) && !excluded.includes(id));
      if (extra.length === 0) return registry.prepare(prepare);
      const selectedSkillIds = fittingSkillIds(registry, policy, picks, extra);
      return registry.prepare({ ...prepare, selectedSkillIds });
    },
  });
}
