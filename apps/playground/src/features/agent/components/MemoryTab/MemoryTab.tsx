import { useId, useState } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import type { ProjectMemoryView } from '../../model/knowledge';
import { PROJECT_MEMORY_MAX_TEXT, type MemoryNoteKind } from '../../model/project-memory';
import { AgentIcon } from '../AgentIcon';

import '../knowledge-form.css';
import './MemoryTab.css';

export interface MemoryTabProps {
  readonly memory: ProjectMemoryView;
  readonly labels: KnowledgeLabels;
}

/**
 * The Memory tab (2026-10-12): what the Agent keeps in every request — each note with its kind
 * (a preference, or a fact about the site) and Forget — and the field to add one. "Forget
 * everything" asks once more in place.
 */
export function MemoryTab({ memory, labels }: MemoryTabProps) {
  const id = useId();
  const words = labels.memory;
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MemoryNoteKind>('preference');
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="ck-agent-memory">
      <p className="ck-agent-kn-intro">{words.intro}</p>
      <form
        className="ck-agent-memory__form"
        onSubmit={(event) => {
          event.preventDefault();
          const written = memory.add(kind, text);
          if (written === 'saved') {
            setText('');
            setRefusal(undefined);
          } else {
            setRefusal(words.refusals[written]);
          }
        }}
      >
        <label className="ck-agent-kn-field" htmlFor={`${id}-text`}>
          {words.field}
          <textarea
            id={`${id}-text`}
            className="ck-agent-kn-textarea ck-agent-memory__text"
            dir="auto"
            rows={2}
            value={text}
            maxLength={PROJECT_MEMORY_MAX_TEXT}
            placeholder={words.placeholder}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </label>
        <div className="ck-agent-kn-actions">
          <label className="ck-agent-memory__kind" htmlFor={`${id}-kind`}>
            <span className="bldr-visually-hidden">{words.kind}</span>
            <select
              id={`${id}-kind`}
              className="ck-agent-kn-select"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value === 'site-fact' ? 'site-fact' : 'preference');
              }}
            >
              <option value="preference">{words.kinds.preference}</option>
              <option value="site-fact">{words.kinds['site-fact']}</option>
            </select>
          </label>
          <button type="submit" className="ck-agent-kn-button" data-variant="primary">
            {words.add}
          </button>
          <span className="ck-agent-memory__count">{words.count(memory.notes.length)}</span>
        </div>
        <p className="ck-agent-kn-refusal" role="alert">
          {refusal}
        </p>
      </form>
      {memory.notes.length === 0 ? (
        <p className="ck-agent-kn-empty">{words.empty}</p>
      ) : (
        <ul className="ck-agent-kn-list" role="list">
          {memory.notes.map((note) => (
            <li key={note.id} className="ck-agent-memory__note">
              <span className="ck-agent-memory__tag">{words.kinds[note.kind]}</span>
              <span className="ck-agent-memory__words" dir="auto">
                {note.text}
              </span>
              <button
                type="button"
                className="ck-agent-memory__forget"
                aria-label={words.remove(note.text)}
                title={words.remove(note.text)}
                onClick={() => {
                  memory.remove(note.id);
                }}
              >
                <AgentIcon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {memory.notes.length > 0 ? (
        <button
          type="button"
          className="ck-agent-kn-button ck-agent-memory__clear"
          data-variant="quiet"
          data-confirming={confirming ? '' : undefined}
          onBlur={() => {
            setConfirming(false);
          }}
          onClick={() => {
            if (confirming) memory.clear();
            setConfirming(!confirming);
          }}
        >
          {confirming ? labels.skills.confirm(words.clear) : words.clear}
        </button>
      ) : null}
    </div>
  );
}
