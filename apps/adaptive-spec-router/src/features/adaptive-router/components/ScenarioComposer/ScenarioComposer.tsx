import { useState, type SyntheticEvent } from 'react';

import {
  modelTiers,
  orchestrationModes,
  riskLevels,
  workClasses,
  type TaskScenario,
} from '../../model/types';

interface ScenarioComposerProps {
  scenario: TaskScenario;
  onApply: (scenario: TaskScenario) => void;
  onInvalid: () => void;
}

const minimumBriefLength = 12;

function formatOption(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatOrchestrationMode(value: TaskScenario['orchestrationMode']): string {
  return value === 'codex-native' ? 'Codex-native session' : 'Claude-adaptive session';
}

export function ScenarioComposer({ scenario, onApply, onInvalid }: ScenarioComposerProps) {
  const [draft, setDraft] = useState<TaskScenario>(scenario);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft.brief.trim().length < minimumBriefLength) {
      setError(
        `Add at least ${String(minimumBriefLength)} characters so the route has enough context.`,
      );
      onInvalid();
      return;
    }

    if (!draft.availability.claude && !draft.availability.codex) {
      setError('Keep at least one provider lane available for this local scenario.');
      onInvalid();
      return;
    }

    setError(null);
    onApply({ ...draft, brief: draft.brief.trim() });
  }

  return (
    <section className="asr-panel" aria-labelledby="scenario-title">
      <header className="asr-panel-header">
        <div>
          <h2 id="scenario-title">Compose a task signal</h2>
          <p>Local inputs only. No prompt is sent to a provider.</p>
        </div>
        <span className="asr-status asr-status-active">Policy input</span>
      </header>

      <form className="asr-form" onSubmit={handleSubmit}>
        <div className="asr-field">
          <label htmlFor="scenario-brief">Task brief</label>
          <textarea
            id="scenario-brief"
            value={draft.brief}
            onChange={(event) => {
              setDraft((current) => ({ ...current, brief: event.target.value }));
            }}
          />
        </div>

        <div className="asr-form-grid">
          <div className="asr-field">
            <label htmlFor="scenario-orchestration-mode">Workflow entry point</label>
            <select
              id="scenario-orchestration-mode"
              value={draft.orchestrationMode}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  orchestrationMode: event.target.value as TaskScenario['orchestrationMode'],
                }));
              }}
            >
              {orchestrationModes.map((mode) => (
                <option key={mode} value={mode}>
                  {formatOrchestrationMode(mode)}
                </option>
              ))}
            </select>
          </div>

          <div className="asr-field">
            <label htmlFor="scenario-work-class">Work class</label>
            <select
              id="scenario-work-class"
              value={draft.workClass}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  workClass: event.target.value as TaskScenario['workClass'],
                }));
              }}
            >
              {workClasses.map((workClass) => (
                <option key={workClass} value={workClass}>
                  {formatOption(workClass)}
                </option>
              ))}
            </select>
          </div>

          <div className="asr-field">
            <label htmlFor="scenario-risk">Risk level</label>
            <select
              id="scenario-risk"
              value={draft.risk}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  risk: event.target.value as TaskScenario['risk'],
                }));
              }}
            >
              {riskLevels.map((risk) => (
                <option key={risk} value={risk}>
                  {formatOption(risk)}
                </option>
              ))}
            </select>
          </div>

          <div className="asr-field">
            <label htmlFor="scenario-unavailable-model">Unavailable model tier</label>
            <select
              id="scenario-unavailable-model"
              value={draft.unavailableModel ?? ''}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  unavailableModel:
                    event.target.value === ''
                      ? null
                      : (event.target.value as TaskScenario['unavailableModel']),
                }));
              }}
            >
              <option value="">All eligible tiers available</option>
              {modelTiers.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="asr-fieldset">
          <legend>Available provider lanes</legend>
          <label className="asr-check" htmlFor="scenario-codex">
            <input
              id="scenario-codex"
              type="checkbox"
              checked={draft.availability.codex}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  availability: { ...current.availability, codex: event.target.checked },
                }));
              }}
            />
            Codex lane available
          </label>
          <label className="asr-check" htmlFor="scenario-claude">
            <input
              id="scenario-claude"
              type="checkbox"
              checked={draft.availability.claude}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  availability: { ...current.availability, claude: event.target.checked },
                }));
              }}
            />
            Claude lane available
          </label>
        </fieldset>

        {error === null ? null : (
          <p className="asr-form-error" role="alert">
            {error}
          </p>
        )}

        <div className="asr-form-actions">
          <button className="asr-button asr-button-primary" type="submit">
            Apply route signals
          </button>
          <p className="asr-inline-note">
            Changing these fields updates a deterministic local policy.
          </p>
        </div>
      </form>
    </section>
  );
}
