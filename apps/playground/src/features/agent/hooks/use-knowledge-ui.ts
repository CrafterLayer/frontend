import { useState } from 'react';

import { knowledgeLabels, type KnowledgeTab } from '../copy/knowledge-labels';
import type { AgentKnowledgeView } from '../model/knowledge';
import { SLASH_COMMANDS, type SlashCommand } from '../model/skill-slash';
import { EMPTY_SKILL_DRAFT, type UserSkillDraft } from '../model/user-skills';
import type { Locale } from '../model/view-types';

export interface KnowledgeUi {
  /** Whether "Skills & memory" is open, the tab it shows, and the skill draft it starts with. */
  readonly open: boolean;
  readonly tab: KnowledgeTab;
  readonly newSkill: UserSkillDraft | undefined;
  readonly setOpen: (open: boolean) => void;
  readonly setTab: (tab: KnowledgeTab) => void;
  /** The header button: open on the last tab, or close. */
  readonly toggle: () => void;
  /** Open on a tab, optionally on New skill with a draft. */
  readonly show: (tab: KnowledgeTab, newSkill?: UserSkillDraft) => void;
  /** The composer's commands this host can run (no checkpoints without a page keeper). */
  readonly commands: readonly SlashCommand[];
  /** Runs a composer command; resolves with what happened, or nothing when it opened a tab. */
  readonly onCommand: (command: SlashCommand, text: string) => Promise<string | undefined>;
  /** AgentHeader's `knowledge` prop: absent without knowledge; `before` runs ahead of a toggle. */
  readonly header: (
    controls: string,
    before: () => void,
  ) =>
    | {
        readonly label: string;
        readonly open: boolean;
        readonly onToggle: () => void;
        readonly controls: string;
      }
    | undefined;
}

/**
 * The panel's "Skills & memory" state and the composer's `/` commands (2026-10-12):
 * `/remember` keeps the words in the project memory (or opens Memory when there are none),
 * `/checkpoint` keeps the page under their name, `/skill` opens New skill with them as the
 * instructions. Kept out of AgentPanel, which only places what this decides.
 */
export function useKnowledgeUi(
  knowledge: AgentKnowledgeView | undefined,
  locale: Locale,
): KnowledgeUi {
  const [open, setOpenState] = useState(false);
  const [tab, setTab] = useState<KnowledgeTab>('skills');
  const [newSkill, setNewSkill] = useState<UserSkillDraft | undefined>(undefined);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    // A draft from `/skill` is for that opening only.
    if (!next) setNewSkill(undefined);
  };
  const show = (next: KnowledgeTab, draft?: UserSkillDraft) => {
    setTab(next);
    setNewSkill(draft);
    setOpenState(true);
  };
  const commands =
    knowledge?.checkpoints === undefined
      ? SLASH_COMMANDS.filter((command) => command !== 'checkpoint')
      : SLASH_COMMANDS;

  const onCommand = async (command: SlashCommand, text: string): Promise<string | undefined> => {
    if (knowledge === undefined) return undefined;
    const labels = knowledgeLabels(locale);
    if (command === 'remember') {
      if (text === '') {
        show('memory');
        return undefined;
      }
      const written = knowledge.memory.add('preference', text);
      return written === 'saved' ? labels.slash.remembered : labels.memory.refusals[written];
    }
    if (command === 'checkpoint') {
      const label = text === '' ? labels.checkpoints.defaultName : text.slice(0, 120);
      const saved = (await knowledge.checkpoints?.save(label)) === true;
      return saved ? labels.slash.checkpointSaved(label) : labels.slash.checkpointFailed;
    }
    show('skills', { ...EMPTY_SKILL_DRAFT, instructions: text });
    return undefined;
  };

  return {
    open,
    tab,
    newSkill,
    setOpen,
    setTab,
    toggle: () => {
      setOpen(!open);
    },
    show,
    commands,
    onCommand,
    header: (controls, before) =>
      knowledge === undefined
        ? undefined
        : {
            label: knowledgeLabels(locale).title,
            open,
            onToggle: () => {
              before();
              setOpen(!open);
            },
            controls,
          },
  };
}
