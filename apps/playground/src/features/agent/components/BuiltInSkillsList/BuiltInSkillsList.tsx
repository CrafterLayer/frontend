import { useId, useState } from 'react';

import type { BuiltInSkillLabels } from '../../copy/builtin-skill-labels';
import { BUILT_IN_SKILL_GROUPS, type BuiltInSkillToggleView } from '../../model/builtin-skills';
import { matchesFilter } from './utils';

import '../knowledge-form.css';
import '../SkillRow/SkillRow.css';
import '../SkillsTab/SkillsTab.css';
import './BuiltInSkillsList.css';

export interface BuiltInSkillsListProps {
  /** The built-ins by group (`builtInSkillViews`); nothing is drawn when empty. */
  readonly skills: readonly BuiltInSkillToggleView[];
  readonly labels: BuiltInSkillLabels;
  readonly onToggle: (id: string, enabled: boolean) => void;
  /** "Reset to defaults": every built-in back on. */
  readonly onReset: () => void;
  /** Open on mount; closed by default, like the quiet disclosure it sits in. */
  readonly defaultOpen?: boolean | undefined;
}

/**
 * The built-in skills (2026-10-14): what the Agent picks by itself from a request, behind a
 * quiet disclosure with its count. Inside, a filter, "Reset to defaults" and the skills by
 * group (Design & pages, Content, Data & reports, Images & brand, Creative, Language), each a
 * row with its name, one line of what it does and a switch, on until switched off. The skills
 * the engine needs on every build close the list, marked "Always on", with no switch.
 */
export function BuiltInSkillsList({
  skills,
  labels,
  onToggle,
  onReset,
  defaultOpen = false,
}: BuiltInSkillsListProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  if (skills.length === 0) return null;
  const switchable = skills.filter((skill) => !skill.locked);
  const on = switchable.filter((skill) => skill.enabled).length;
  const allOn = on === switchable.length;
  const shown = skills.filter((skill) => matchesFilter(skill, query));
  const groups = BUILT_IN_SKILL_GROUPS.map((group) => ({
    group,
    rows: shown.filter((skill) => skill.group === group),
  })).filter(({ rows }) => rows.length > 0);
  return (
    <details className="ck-agent-skills__builtins ck-agent-builtins" open={defaultOpen}>
      <summary className="ck-agent-skills__summary">{labels.title(skills.length)}</summary>
      <p className="ck-agent-kn-intro">{labels.intro}</p>
      <div className="ck-agent-builtins__tools">
        <input
          type="search"
          className="ck-agent-kn-input ck-agent-builtins__filter"
          dir="auto"
          value={query}
          aria-label={labels.filter}
          placeholder={labels.filterPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="quiet"
          // aria-disabled, not disabled: focus stays on the button once everything is on.
          aria-disabled={allOn}
          onClick={() => {
            if (!allOn) onReset();
          }}
        >
          {labels.reset}
        </button>
        {/* Polite, not a second status line: a switch or Reset is heard as the new count. */}
        <span className="ck-agent-skills__count" aria-live="polite">
          {labels.count(on, switchable.length)}
        </span>
      </div>
      {groups.length === 0 ? <p className="ck-agent-kn-empty">{labels.noMatch}</p> : null}
      {groups.map(({ group, rows }) => (
        <section
          key={group}
          className="ck-agent-builtins__group"
          aria-labelledby={`${id}-${group}`}
        >
          <h4 id={`${id}-${group}`} className="ck-agent-builtins__heading">
            {labels.groups[group]}
          </h4>
          <ul className="ck-agent-kn-list" role="list">
            {rows.map((skill) => (
              <li
                key={skill.id}
                className="ck-agent-skill-row"
                data-enabled={skill.enabled ? '' : undefined}
              >
                <div className="ck-agent-skill-row__text">
                  <span className="ck-agent-skill-row__name" dir="auto" title={skill.name}>
                    {skill.name}
                  </span>
                  <span className="ck-agent-skill-row__when" dir="auto" title={skill.description}>
                    {skill.description}
                  </span>
                </div>
                {skill.locked ? (
                  <span className="ck-agent-builtins__always">{labels.always}</span>
                ) : (
                  <input
                    type="checkbox"
                    role="switch"
                    className="ck-agent-skill-row__switch"
                    checked={skill.enabled}
                    aria-label={labels.use(skill.name)}
                    onChange={(event) => {
                      onToggle(skill.id, event.target.checked);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}
