/**
 * The built-in skills the Agent picks by itself (2026-10-14): each auto-activated built-in is
 * listed with a switch, on until the person switches it off. The choice is kept per viewer,
 * beside the default skills (`DEFAULT_SKILLS_KEY`), in the same shape: a versioned key holding
 * the JSON array of the ids switched off. Switched-off ids reach every run as
 * `excludedSkillIds`, which the engine honours in every lane; an explicit `/skill` pick still
 * wins, so a built-in is never removed from the registry.
 *
 * Engine-only skills are not switches. The four a build cannot run without (the fill and
 * scaffold steps, the direction deck, the always-on craft manual) are listed read-only as
 * "Always on" — the engine refuses to exclude them anyway, so a switch would lie. The other
 * explicit ones (Plan mode, the surgical edit, design code, section layouts, the creative
 * director and page shapes) only ever run when a mode or a step names them — an explicit pick
 * a switch could not override — so they are not listed.
 */
import { CRAFTKIT_DEFAULT_SKILLS, type AiSkillManifestV1 } from '@craftkit/builder';

import { builtInSkillCopy } from './builtin-skill-copy';
import type { AgentStorage } from './migrate-sessions';
import type { Locale } from './view-types';

export const BUILT_IN_SKILLS_KEY = 'ck-agent-builtin-skills:v1';

export type BuiltInSkillGroup =
  'design' | 'content' | 'data' | 'images' | 'creative' | 'language' | 'always';

/** The panel's order of the groups. */
export const BUILT_IN_SKILL_GROUPS: readonly BuiltInSkillGroup[] = Object.freeze([
  'design',
  'content',
  'data',
  'images',
  'creative',
  'language',
  'always',
]);

/**
 * Never switched off: the engine needs them on every build (it filters them out of any
 * exclusion too, `ENGINE_REQUIRED_SKILL_IDS` in the engine's excluded-skills.ts).
 */
export const ALWAYS_ON_SKILL_IDS: readonly string[] = Object.freeze([
  'craftkit.craft-manual',
  'craftkit.build-scaffold',
  'craftkit.build-fill',
  'craftkit.direction-deck',
]);

/** Explicit built-ins a writer is offered when they fit, so the person may switch them off. */
const OPTIONAL_EXPLICIT: ReadonlySet<string> = new Set(['craftkit.photo-direction']);

const GROUP_OF: Readonly<Record<string, BuiltInSkillGroup>> = {
  'craftkit.copywriting': 'content',
  'craftkit.data-viz': 'data',
  'craftkit.art-names': 'images',
  'craftkit.logo-design': 'images',
  'craftkit.photo-direction': 'images',
  'craftkit.arabic-rtl': 'language',
};

export interface BuiltInSkillToggleView {
  readonly id: string;
  /** In the panel's language. */
  readonly name: string;
  readonly description: string;
  readonly group: BuiltInSkillGroup;
  readonly enabled: boolean;
  /** Always on: listed, never switched. */
  readonly locked: boolean;
}

function groupOf(id: string): BuiltInSkillGroup {
  if (ALWAYS_ON_SKILL_IDS.includes(id)) return 'always';
  return GROUP_OF[id] ?? (id.startsWith('craftkit.pixi-') ? 'creative' : 'design');
}

const DEFAULT_IDS: ReadonlySet<string> = new Set(CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id));

/** Whether the panel lists this built-in with a switch. */
function switchable(skill: AiSkillManifestV1): boolean {
  return (
    skill.source !== 'host' &&
    !DEFAULT_IDS.has(skill.id) &&
    !ALWAYS_ON_SKILL_IDS.includes(skill.id) &&
    (skill.activation.mode === 'auto' || OPTIONAL_EXPLICIT.has(skill.id))
  );
}

/** The ids the panel offers a switch for, out of the built-in registry's list. */
export function switchableBuiltInIds(skills: readonly AiSkillManifestV1[]): readonly string[] {
  return skills.filter(switchable).map(({ id }) => id);
}

/** The built-ins as the panel lists them: by group, then in the registry's order. */
export function builtInSkillViews(
  skills: readonly AiSkillManifestV1[],
  locale: Locale,
  disabled: readonly string[],
): readonly BuiltInSkillToggleView[] {
  const listed = skills.filter(
    (skill) => switchable(skill) || ALWAYS_ON_SKILL_IDS.includes(skill.id),
  );
  const views = listed.map((skill): BuiltInSkillToggleView => {
    const own = builtInSkillCopy(locale, skill.id);
    const locked = ALWAYS_ON_SKILL_IDS.includes(skill.id);
    return {
      id: skill.id,
      name: own?.name ?? skill.name,
      description: own?.description ?? skill.description,
      group: groupOf(skill.id),
      enabled: locked || !disabled.includes(skill.id),
      locked,
    };
  });
  return BUILT_IN_SKILL_GROUPS.flatMap((group) => views.filter((view) => view.group === group));
}

export interface BuiltInSkillsStore {
  /** The ids the person switched off. */
  readonly get: () => readonly string[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly setEnabled: (id: string, enabled: boolean) => void;
  /** Every built-in back on ("Reset to defaults"). */
  readonly reset: () => void;
}

function readDisabled(storage: AgentStorage | undefined, known: ReadonlySet<string>) {
  try {
    const raw = storage?.getItem(BUILT_IN_SKILLS_KEY);
    const value: unknown = raw === null || raw === undefined ? [] : JSON.parse(raw);
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))]
      : [];
  } catch {
    return [];
  }
}

/**
 * Which built-ins are off, kept per viewer; every one is on until switched off. `known` is the
 * switchable ids: anything else saved (a skill since removed, a hand-edited entry) is ignored.
 */
export function createBuiltInSkillsStore(
  known: readonly string[],
  storage?: AgentStorage,
): BuiltInSkillsStore {
  const ids = new Set(known);
  let disabled: readonly string[] = readDisabled(storage, ids);
  const listeners = new Set<() => void>();
  const write = (next: readonly string[]) => {
    if (next.length === disabled.length && next.every((entry, i) => entry === disabled[i])) return;
    disabled = next;
    try {
      storage?.setItem(BUILT_IN_SKILLS_KEY, JSON.stringify(next));
    } catch {
      // A full or blocked storage keeps the choice for this visit only.
    }
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => disabled,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (id, enabled) => {
      if (!ids.has(id)) return;
      write(enabled ? disabled.filter((entry) => entry !== id) : [...new Set([...disabled, id])]);
    },
    reset: () => {
      write([]);
    },
  };
}
