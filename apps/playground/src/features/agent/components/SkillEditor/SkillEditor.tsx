import { useId, useState, type SyntheticEvent } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import {
  splitKeywords,
  USER_SKILL_MAX_DESCRIPTION,
  USER_SKILL_MAX_INSTRUCTIONS,
  USER_SKILL_MAX_NAME,
  type UserSkillDraft,
  type UserSkillMode,
} from '../../model/user-skills';
import type { UserSkillWrite } from '../../model/user-skills-store';

import '../knowledge-form.css';
import './SkillEditor.css';

export interface SkillEditorProps {
  readonly labels: KnowledgeLabels;
  /** The draft to start from: empty for a new skill, the skill itself for an edit. */
  readonly initial: UserSkillDraft;
  /** `true`: editing a kept skill (the title says so). */
  readonly editing?: boolean | undefined;
  /** Saves the draft; a refusal keeps the editor open and says why. */
  readonly onSave: (draft: UserSkillDraft) => UserSkillWrite;
  readonly onCancel: () => void;
}

/**
 * Writing a skill (2026-10-12): its name, when to use it, the instructions, and how it turns
 * on — by its words (the default; the field for them shows) or in every request. Saving goes
 * through the store's judgement; a refusal stays on screen as one line above the buttons, and
 * is announced (an alert), so the person hears why before they fix it.
 */
export function SkillEditor({
  labels,
  initial,
  editing = false,
  onSave,
  onCancel,
}: SkillEditorProps) {
  const id = useId();
  const words = labels.editor;
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [keywords, setKeywords] = useState(initial.keywords.join(', '));
  const [mode, setMode] = useState<UserSkillMode>(initial.mode);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const written = onSave({
      name,
      description,
      instructions,
      keywords: splitKeywords(keywords),
      mode,
    });
    setRefusal(written.ok ? undefined : words.refusals[written.reason]);
  };

  return (
    <form
      className="ck-agent-skill-editor"
      aria-labelledby={`${id}-title`}
      // `required` stays for its semantics; the refusal line, in the panel's language, says
      // why — the browser's own bubble would block the submit and speak the browser's.
      noValidate
      onSubmit={submit}
    >
      <h3 id={`${id}-title`} className="ck-agent-skill-editor__title">
        {editing ? words.editTitle : words.newTitle}
      </h3>
      <label className="ck-agent-kn-field" htmlFor={`${id}-name`}>
        {words.name}
        <input
          id={`${id}-name`}
          className="ck-agent-kn-input"
          dir="auto"
          value={name}
          maxLength={USER_SKILL_MAX_NAME}
          placeholder={words.namePlaceholder}
          autoComplete="off"
          required
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      <label className="ck-agent-kn-field" htmlFor={`${id}-description`}>
        {words.description}
        <input
          id={`${id}-description`}
          className="ck-agent-kn-input"
          dir="auto"
          value={description}
          maxLength={USER_SKILL_MAX_DESCRIPTION}
          placeholder={words.descriptionPlaceholder}
          autoComplete="off"
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <label className="ck-agent-kn-field" htmlFor={`${id}-instructions`}>
        <span className="ck-agent-skill-editor__label-row">
          {words.instructions}
          <span className="ck-agent-kn-hint" aria-hidden="true" dir="ltr">
            {words.length(instructions.length)}
          </span>
        </span>
        <textarea
          id={`${id}-instructions`}
          className="ck-agent-kn-textarea"
          dir="auto"
          value={instructions}
          maxLength={USER_SKILL_MAX_INSTRUCTIONS}
          placeholder={words.instructionsPlaceholder}
          rows={6}
          required
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
        />
      </label>
      <fieldset className="ck-agent-skill-editor__mode">
        <legend className="ck-agent-kn-field">{words.mode}</legend>
        {(['auto', 'always'] as const).map((choice) => (
          <label key={choice} className="ck-agent-skill-editor__choice">
            <input
              type="radio"
              name={`${id}-mode`}
              value={choice}
              checked={mode === choice}
              onChange={() => {
                setMode(choice);
              }}
            />
            {choice === 'auto' ? words.modeAuto : words.modeAlways}
          </label>
        ))}
      </fieldset>
      {mode === 'auto' ? (
        <label className="ck-agent-kn-field" htmlFor={`${id}-keywords`}>
          {words.keywords}
          <input
            id={`${id}-keywords`}
            className="ck-agent-kn-input"
            dir="auto"
            value={keywords}
            placeholder={words.keywordsHint}
            autoComplete="off"
            aria-describedby={`${id}-keywords-hint`}
            onChange={(event) => {
              setKeywords(event.target.value);
            }}
          />
          <span id={`${id}-keywords-hint`} className="ck-agent-kn-hint">
            {words.keywordsHint}
          </span>
        </label>
      ) : null}
      <p className="ck-agent-kn-refusal" role="alert">
        {refusal}
      </p>
      <div className="ck-agent-kn-actions">
        <button type="submit" className="ck-agent-kn-button" data-variant="primary">
          {words.save}
        </button>
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="quiet"
          onClick={onCancel}
        >
          {words.cancel}
        </button>
      </div>
    </form>
  );
}
