/**
 * What the panel's "Skills & memory" place renders (2026-10-12): the person's own skills,
 * the project memory and the checkpoints, with the edits each allows. Built by
 * `useAgentKnowledge`; stories and tests build it from fixtures.
 */
import type { AgentCheckpoint, CheckpointRestore } from './checkpoints';
import type { DefaultSkillView } from './default-skills';
import type { MemoryNote, MemoryNoteKind, MemoryWrite } from './project-memory';
import type { UserSkill, UserSkillDraft } from './user-skills';
import type { UserSkillWrite } from './user-skills-store';

/** A built-in skill, listed so the person can see what the Agent already knows. */
export interface BuiltInSkillView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface UserSkillsView {
  readonly skills: readonly UserSkill[];
  readonly builtIns: readonly BuiltInSkillView[];
  readonly add: (draft: UserSkillDraft) => UserSkillWrite;
  readonly update: (id: string, draft: UserSkillDraft) => UserSkillWrite;
  readonly setEnabled: (id: string, enabled: boolean) => UserSkillWrite;
  readonly remove: (id: string) => void;
  readonly importMarkdown: (markdown: string) => UserSkillWrite;
  /** The skill as a SKILL.md, to copy or keep. */
  readonly exportMarkdown: (id: string) => string | undefined;
  /** The default skills every project starts with, in the panel's language (2026-10-12). */
  readonly defaults: readonly DefaultSkillView[];
  /** Switch a default skill on or off for this viewer. */
  readonly setDefaultEnabled: (id: string, enabled: boolean) => void;
}

export interface ProjectMemoryView {
  readonly notes: readonly MemoryNote[];
  readonly add: (kind: MemoryNoteKind, text: string) => MemoryWrite;
  readonly update: (id: string, text: string) => MemoryWrite;
  readonly remove: (id: string) => void;
  readonly clear: () => void;
}

export interface CheckpointsView {
  /** Newest first; `undefined` while the first list is read. */
  readonly items: readonly AgentCheckpoint[] | undefined;
  readonly restore: (id: string) => Promise<CheckpointRestore>;
  readonly save: (label: string) => Promise<boolean>;
}

export interface AgentKnowledgeView {
  readonly skills: UserSkillsView;
  readonly memory: ProjectMemoryView;
  /** Absent when the host keeps no pages (no vault): the tab is not drawn. */
  readonly checkpoints?: CheckpointsView | undefined;
}
