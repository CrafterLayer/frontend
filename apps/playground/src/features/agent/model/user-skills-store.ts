/**
 * The person's skills, kept (2026-10-12): one tiny store persisted to their own browser
 * storage, like the story bible and the conversations. Every write is judged by
 * `checkSkillDraft` first; blocked or full storage never throws out of here — the skills keep
 * working for the session. No React here; `useUserSkills` subscribes to it.
 */
import type { AgentStorage } from './migrate-sessions';
import { parseSkillMarkdown } from './skill-markdown';
import { createStore, type Store } from './tiny-store';
import {
  checkSkillDraft,
  exceedsAlwaysBudget,
  nextSkillId,
  readUserSkill,
  USER_SKILLS_MAX,
  type UserSkill,
  type UserSkillDraft,
  type UserSkillRefusal,
} from './user-skills';

export const USER_SKILLS_KEY = 'ck-agent-skills:v1';

export type UserSkillWrite =
  | { readonly ok: true; readonly skill: UserSkill }
  | { readonly ok: false; readonly reason: UserSkillRefusal | 'unreadable' };

export interface UserSkillsStore {
  readonly get: () => readonly UserSkill[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly add: (draft: UserSkillDraft) => UserSkillWrite;
  readonly update: (id: string, draft: UserSkillDraft) => UserSkillWrite;
  /** Turning an always-on skill on can be refused by the budget; turning off never is. */
  readonly setEnabled: (id: string, enabled: boolean) => UserSkillWrite;
  readonly remove: (id: string) => void;
  /** A SKILL.md, read and added like a typed draft. */
  readonly importMarkdown: (markdown: string) => UserSkillWrite;
}

function load(storage: AgentStorage | undefined): readonly UserSkill[] {
  if (storage === undefined) return [];
  try {
    const text = storage.getItem(USER_SKILLS_KEY);
    const parsed: unknown = text === null ? [] : JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const skills: UserSkill[] = [];
    for (const entry of parsed) {
      const skill = readUserSkill(entry);
      if (skill === undefined || seen.has(skill.id)) continue;
      seen.add(skill.id);
      skills.push(skill);
    }
    return skills.slice(0, USER_SKILLS_MAX);
  } catch {
    // Unreadable or blocked storage: start with none rather than fail the panel.
    return [];
  }
}

export function createUserSkillsStore(storage: AgentStorage | undefined): UserSkillsStore {
  const store: Store<readonly UserSkill[]> = createStore(load(storage));

  function commit(next: readonly UserSkill[]): void {
    store.setState(next);
    try {
      storage?.setItem(USER_SKILLS_KEY, JSON.stringify(next));
    } catch {
      // Full or blocked storage: the skills still serve this session.
    }
  }

  const add = (draft: UserSkillDraft): UserSkillWrite => {
    const skills = store.getState();
    const check = checkSkillDraft(draft, skills);
    if (!check.ok) return check;
    const skill: UserSkill = { id: nextSkillId(skills), ...check.draft, enabled: true };
    commit([...skills, skill]);
    return { ok: true, skill };
  };

  return {
    get: store.getState,
    subscribe: store.subscribe,
    add,
    update: (id, draft) => {
      const skills = store.getState();
      const current = skills.find((skill) => skill.id === id);
      if (current === undefined) return { ok: false, reason: 'unreadable' };
      const check = checkSkillDraft(draft, skills, current.enabled ? id : undefined);
      if (!check.ok) return check;
      const skill: UserSkill = { ...current, ...check.draft };
      commit(skills.map((entry) => (entry.id === id ? skill : entry)));
      return { ok: true, skill };
    },
    setEnabled: (id, enabled) => {
      const skills = store.getState();
      const current = skills.find((skill) => skill.id === id);
      if (current === undefined) return { ok: false, reason: 'unreadable' };
      if (current.enabled === enabled) return { ok: true, skill: current };
      if (enabled && exceedsAlwaysBudget(skills, id)) return { ok: false, reason: 'alwaysBudget' };
      const skill: UserSkill = { ...current, enabled };
      commit(skills.map((entry) => (entry.id === id ? skill : entry)));
      return { ok: true, skill };
    },
    remove: (id) => {
      const skills = store.getState();
      if (!skills.some((skill) => skill.id === id)) return;
      commit(skills.filter((skill) => skill.id !== id));
    },
    importMarkdown: (markdown) => {
      const draft = parseSkillMarkdown(markdown);
      return draft === undefined ? { ok: false, reason: 'unreadable' } : add(draft);
    },
  };
}
