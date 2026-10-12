import { useId } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import type { DefaultSkillView } from '../../model/default-skills';
import { AgentIcon } from '../AgentIcon';

import '../knowledge-form.css';
import '../SkillRow/SkillRow.css';
import './DefaultSkillsList.css';

export interface DefaultSkillsListProps {
  readonly skills: readonly DefaultSkillView[];
  readonly labels: KnowledgeLabels;
  readonly onToggle: (id: string, enabled: boolean) => void;
  /** "Make it my own": open New skill on a copy of this default. */
  readonly onMakeOwn: (skill: DefaultSkillView) => void;
}

/**
 * The default skills (2026-10-12): the reviewed pack every project starts with, as other agents
 * ship their own skills: design intelligence from UI UX Pro Max, landing patterns, UX rules, type
 * and colour, forms, natural copy in English and Arabic, honest proof. Each row has a switch (on until switched off,
 * kept per viewer), a two-line description, "What it teaches the Agent" (the exact instructions,
 * to read before trusting it), and "Make it my own", which opens New skill on a copy.
 */
export function DefaultSkillsList({ skills, labels, onToggle, onMakeOwn }: DefaultSkillsListProps) {
  const id = useId();
  const words = labels.defaults;
  const on = skills.filter((skill) => skill.enabled).length;
  if (skills.length === 0) return null;
  return (
    <section className="ck-agent-defaults" aria-labelledby={`${id}-title`}>
      <div className="ck-agent-defaults__head">
        <h3 id={`${id}-title`} className="ck-agent-defaults__title">
          {words.title}
        </h3>
        <span className="ck-agent-defaults__count">{words.count(on, skills.length)}</span>
      </div>
      <p className="ck-agent-kn-intro">{words.intro}</p>
      <ul className="ck-agent-kn-list" role="list">
        {skills.map((skill) => (
          <li
            key={skill.id}
            className="ck-agent-skill-row ck-agent-defaults__row"
            data-enabled={skill.enabled ? '' : undefined}
          >
            <div className="ck-agent-skill-row__text">
              <span className="ck-agent-skill-row__name" dir="auto">
                {skill.name}
              </span>
              <span className="ck-agent-defaults__description" dir="auto">
                {skill.description}
              </span>
              <details className="ck-agent-defaults__teaches">
                <summary className="ck-agent-defaults__summary">{words.teaches}</summary>
                {/* It scrolls on its own: a tab stop lets a keyboard scroll it. */}
                <pre className="ck-agent-defaults__instructions" dir="ltr" tabIndex={0}>
                  {skill.instructions}
                </pre>
              </details>
            </div>
            <div className="ck-agent-skill-row__actions">
              <button
                type="button"
                className="ck-agent-skill-row__action"
                aria-label={words.own(skill.name)}
                title={words.own(skill.name)}
                onClick={() => {
                  onMakeOwn(skill);
                }}
              >
                <AgentIcon name="pencil" />
              </button>
            </div>
            <input
              type="checkbox"
              role="switch"
              className="ck-agent-skill-row__switch"
              checked={skill.enabled}
              aria-label={words.use(skill.name)}
              onChange={(event) => {
                onToggle(skill.id, event.target.checked);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
