import { useState } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import type { UserSkill } from '../../model/user-skills';
import { AgentIcon } from '../AgentIcon';

import '../knowledge-form.css';
import './SkillRow.css';

export interface SkillRowProps {
  readonly skill: UserSkill;
  readonly labels: KnowledgeLabels;
  /** Turn the skill on or off; a refusal comes back as the line to show. */
  readonly onToggle: (enabled: boolean) => string | undefined;
  readonly onEdit: () => void;
  /** Copy it as a SKILL.md; resolves when the clipboard has it. */
  readonly onCopy: () => Promise<boolean>;
  readonly onRemove: () => void;
}

/**
 * One of the person's skills (2026-10-12): its name and when it turns on, a switch to use it
 * or not, and its actions — Edit, Copy as SKILL.md, Delete. Delete asks once more in place
 * (the same button, now "Delete {name}?" in the Alarm colour) because nothing brings a
 * deleted skill back.
 */
export function SkillRow({ skill, labels, onToggle, onEdit, onCopy, onRemove }: SkillRowProps) {
  const words = labels.skills;
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const when = skill.mode === 'always' ? words.always : words.when(skill.keywords);
  return (
    <li className="ck-agent-skill-row" data-enabled={skill.enabled ? '' : undefined}>
      <div className="ck-agent-skill-row__text">
        <span className="ck-agent-skill-row__name">{skill.name}</span>
        <span className="ck-agent-skill-row__when">{when}</span>
        {refusal === undefined ? null : (
          <span className="ck-agent-kn-refusal" role="alert">
            {refusal}
          </span>
        )}
      </div>
      <div className="ck-agent-skill-row__actions">
        <button
          type="button"
          className="ck-agent-skill-row__action"
          aria-label={words.edit(skill.name)}
          title={words.edit(skill.name)}
          onClick={onEdit}
        >
          <AgentIcon name="pencil" />
        </button>
        <button
          type="button"
          className="ck-agent-skill-row__action"
          aria-label={copied ? words.copied : words.copy(skill.name)}
          title={words.copy(skill.name)}
          onClick={() => {
            void onCopy().then(setCopied);
          }}
        >
          <AgentIcon name={copied ? 'check' : 'code'} />
        </button>
        <button
          type="button"
          className="ck-agent-skill-row__action"
          data-confirming={confirming ? '' : undefined}
          aria-label={
            confirming ? words.confirm(words.remove(skill.name)) : words.remove(skill.name)
          }
          title={words.remove(skill.name)}
          onBlur={() => {
            setConfirming(false);
          }}
          onClick={() => {
            if (confirming) onRemove();
            setConfirming(!confirming);
          }}
        >
          <AgentIcon name="trash" />
        </button>
      </div>
      {/* Settings-row order (2026-10-12): the name first, the switch at the inline end. */}
      <input
        type="checkbox"
        role="switch"
        className="ck-agent-skill-row__switch"
        checked={skill.enabled}
        aria-label={words.use(skill.name)}
        onChange={(event) => {
          setRefusal(onToggle(event.target.checked));
        }}
      />
    </li>
  );
}
