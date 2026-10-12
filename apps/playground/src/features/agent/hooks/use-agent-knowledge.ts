import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { createCraftkitAiSkillRegistry, type AiSkillRegistry } from '@craftkit/builder';

import type { AgentCheckpoint, AgentCheckpointPort } from '../model/checkpoints';
import {
  createDefaultSkillsStore,
  defaultSkillViews,
  enabledDefaultDefinitions,
} from '../model/default-skills';
import type { AgentKnowledgeView, BuiltInSkillView } from '../model/knowledge';
import type { AgentStorage } from '../model/migrate-sessions';
import { createProjectMemoryStore } from '../model/project-memory';
import { skillMarkdown } from '../model/skill-markdown';
import { MAX_PINNED_SKILLS } from '../model/skill-slash';
import { userSkillDefinitions, userSkillIdsFor } from '../model/user-skills';
import { createUserSkillsStore } from '../model/user-skills-store';
import type { Locale } from '../model/view-types';

import type { UseAgentControllerOptions } from './use-agent-controller';

function browserStorage(): AgentStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // A sandboxed frame can throw on the property read itself.
    return undefined;
  }
}

const BUILT_IN_REGISTRY = createCraftkitAiSkillRegistry();
const BUILT_INS: readonly BuiltInSkillView[] = BUILT_IN_REGISTRY.list()
  .filter((skill) => skill.source !== 'host')
  .map(({ id, name, description }) => ({ id, name, description }));

/**
 * The built-ins plus the enabled default skills and the person's enabled skills; the built-ins
 * alone if those cannot load.
 */
function registryWith(
  definitions: Parameters<typeof createCraftkitAiSkillRegistry>[0] = [],
): AiSkillRegistry {
  if (definitions.length === 0) return BUILT_IN_REGISTRY;
  try {
    return createCraftkitAiSkillRegistry(definitions);
  } catch {
    return BUILT_IN_REGISTRY;
  }
}

export interface UseAgentKnowledgeOptions {
  /** `undefined`: the browser's localStorage; `null`: memory only (tests, stories). */
  readonly storage?: AgentStorage | null | undefined;
  /** The host's page keeper; without it there is no Checkpoints tab and no Restore. */
  readonly checkpoints?: AgentCheckpointPort | undefined;
  /** The panel's language, for the default skills' names (English when absent). */
  readonly locale?: Locale | undefined;
}

export type KnowledgeControllerOptions = Pick<
  UseAgentControllerOptions,
  'skillRegistry' | 'selectedSkillIds' | 'hostSkillIdsFor' | 'extraContextProviders' | 'checkpoints'
>;

export interface UseAgentKnowledgeResult {
  /** Spread into `useAgentController`'s options. */
  readonly controllerOptions: KnowledgeControllerOptions;
  /** What the panel's "Skills & memory" place renders. */
  readonly view: AgentKnowledgeView;
}

/**
 * The Agent's knowledge (2026-10-12): the person's own skills (a registry rebuilt when they
 * change, named for builds by the request's words), the project memory (one context provider
 * every run reads) and the checkpoints the host keeps.
 */
export function useAgentKnowledge(options: UseAgentKnowledgeOptions = {}): UseAgentKnowledgeResult {
  const { checkpoints, locale = 'en' } = options;
  const [stores] = useState(() => {
    const storage = options.storage === null ? undefined : (options.storage ?? browserStorage());
    return {
      skills: createUserSkillsStore(storage),
      memory: createProjectMemoryStore(storage),
      defaults: createDefaultSkillsStore(storage),
    };
  });
  const skills = useSyncExternalStore(
    stores.skills.subscribe,
    stores.skills.get,
    stores.skills.get,
  );
  const notes = useSyncExternalStore(stores.memory.subscribe, stores.memory.get, stores.memory.get);
  const disabledDefaults = useSyncExternalStore(
    stores.defaults.subscribe,
    stores.defaults.get,
    stores.defaults.get,
  );

  const [items, setItems] = useState<readonly AgentCheckpoint[] | undefined>(undefined);
  useEffect(() => {
    if (checkpoints === undefined) return undefined;
    let live = true;
    const read = () => {
      checkpoints.list().then(
        (list) => {
          if (live) setItems(list);
        },
        () => {
          if (live) setItems([]);
        },
      );
    };
    read();
    const off = checkpoints.subscribe(read);
    return () => {
      live = false;
      off();
    };
  }, [checkpoints]);

  const registry = useMemo(
    () =>
      registryWith([
        ...enabledDefaultDefinitions(disabledDefaults),
        ...userSkillDefinitions(skills),
      ]),
    [skills, disabledDefaults],
  );
  const defaults = useMemo(
    () => defaultSkillViews(locale, disabledDefaults),
    [locale, disabledDefaults],
  );
  // The composer's `/` pins: kept while they name a skill the registry holds (one turned off
  // or deleted drops out), sent as the request's explicit skills.
  const [pinned, setPinned] = useState<readonly string[]>([]);
  const activePins = useMemo(
    () => pinned.filter((id) => registry.get(id) !== undefined),
    [pinned, registry],
  );
  const controllerOptions = useMemo<KnowledgeControllerOptions>(
    () => ({
      ...(registry === BUILT_IN_REGISTRY ? {} : { skillRegistry: registry }),
      hostSkillIdsFor: (request: string) => [
        ...new Set([
          ...activePins,
          ...userSkillIdsFor(registry, skills, request),
          ...defaultSkillIdsFor(registry, defaults, request),
        ]),
      ],
      ...(activePins.length === 0 ? {} : { selectedSkillIds: activePins }),
      extraContextProviders: notes.length === 0 ? [] : [stores.memory.provider],
      ...(checkpoints === undefined ? {} : { checkpoints }),
    }),
    [registry, skills, defaults, activePins, notes.length, stores.memory.provider, checkpoints],
  );

  const view = useMemo<AgentKnowledgeView>(
    () => ({
      skills: {
        skills,
        builtIns: BUILT_INS,
        add: stores.skills.add,
        update: stores.skills.update,
        setEnabled: stores.skills.setEnabled,
        remove: stores.skills.remove,
        importMarkdown: stores.skills.importMarkdown,
        exportMarkdown: (id) => {
          const skill = skills.find((entry) => entry.id === id);
          return skill === undefined ? undefined : skillMarkdown(skill);
        },
        pinned: activePins,
        pin: (id) => {
          if (activePins.includes(id)) return true;
          if (activePins.length >= MAX_PINNED_SKILLS || registry.get(id) === undefined)
            return false;
          setPinned([...activePins, id]);
          return true;
        },
        unpin: (id) => {
          setPinned((current) => current.filter((entry) => entry !== id));
        },
        defaults,
        setDefaultEnabled: stores.defaults.setEnabled,
      },
      memory: {
        notes,
        add: stores.memory.add,
        update: stores.memory.update,
        remove: stores.memory.remove,
        clear: stores.memory.clear,
      },
      ...(checkpoints === undefined
        ? {}
        : {
            checkpoints: {
              items,
              restore: (id: string) => checkpoints.restore(id),
              save: async (label: string) => (await checkpoints.save(label)) !== undefined,
            },
          }),
    }),
    [skills, defaults, notes, items, stores, checkpoints, activePins, registry],
  );

  return { controllerOptions, view };
}

/** The enabled default skills a request's words turn on, offered to builds as host skills. */
function defaultSkillIdsFor(
  registry: AiSkillRegistry,
  defaults: readonly { readonly id: string; readonly enabled: boolean }[],
  request: string,
): readonly string[] {
  const enabled = new Set(defaults.filter((skill) => skill.enabled).map((skill) => skill.id));
  if (enabled.size === 0) return [];
  try {
    return registry
      .prepare({ request })
      .active.map((skill) => skill.id)
      .filter((id) => enabled.has(id));
  } catch {
    return [];
  }
}

/**
 * Pins hold for one message: they are let go once the run they went out with has finished
 * (every step of a build reads them, so they stay until the last one has).
 */
export function useReleasePinsAfterRun(running: boolean, view: AgentKnowledgeView): void {
  const wasRunning = useRef(running);
  const { pinned, unpin } = view.skills;
  useEffect(() => {
    if (wasRunning.current && !running) {
      for (const id of pinned) unpin(id);
    }
    wasRunning.current = running;
  }, [running, pinned, unpin]);
}
