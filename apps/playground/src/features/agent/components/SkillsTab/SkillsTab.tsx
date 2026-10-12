import { useId, useRef, useState, type ChangeEvent } from 'react';

import type { KnowledgeLabels } from '../../copy/knowledge-labels';
import type { UserSkillsView } from '../../model/knowledge';
import type { SkillTemplate } from '../../model/skill-templates';
import { EMPTY_SKILL_DRAFT, type UserSkillDraft } from '../../model/user-skills';
import { SkillEditor } from '../SkillEditor';
import { SkillRow } from '../SkillRow';

import '../knowledge-form.css';
import './SkillsTab.css';

export interface SkillsTabProps {
  readonly skills: UserSkillsView;
  readonly labels: KnowledgeLabels;
  /** Where "Copy as SKILL.md" writes; `navigator.clipboard` when absent. */
  readonly clipboard?: ((text: string) => Promise<void>) | undefined;
  /** Starter skills to add in one press (`skillTemplates(locale)`); none drawn when empty. */
  readonly templates?: readonly SkillTemplate[] | undefined;
}

/** What "Upload" takes: Markdown and MDX skill files. */
const SKILL_FILES = '.md,.mdx,.markdown,text/markdown,text/x-markdown';

type Editing = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: string } | null;

function writeClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * The Skills tab (2026-10-12): the person's own skills — each with its switch, Edit, Copy as
 * SKILL.md and Delete — then New skill, Import (paste) and Upload (.md or .mdx files, several
 * at once), the starter templates, and under them the skills the Agent already has, so the
 * person sees what to add rather than repeat. Writing or importing a skill replaces the list
 * in place; Save or Cancel brings it back. Uploads and templates say what happened in one
 * status line.
 */
export function SkillsTab({
  skills: view,
  labels,
  clipboard = writeClipboard,
  templates = [],
}: SkillsTabProps) {
  const id = useId();
  const words = labels.skills;
  const [editing, setEditing] = useState<Editing>(null);
  const [importing, setImporting] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    let imported = 0;
    const failures: string[] = [];
    for (const file of files) {
      const written = view.importMarkdown(await file.text());
      if (written.ok) imported += 1;
      else failures.push(labels.upload.failed(file.name, labels.editor.refusals[written.reason]));
    }
    setStatus([...(imported > 0 ? [labels.upload.imported(imported)] : []), ...failures].join(' '));
  };
  const unusedTemplates = templates.filter(
    (template) => !view.skills.some((skill) => skill.name === template.draft.name),
  );

  if (editing !== null) {
    const kept =
      editing.kind === 'edit' ? view.skills.find((skill) => skill.id === editing.id) : undefined;
    const initial: UserSkillDraft = kept ?? EMPTY_SKILL_DRAFT;
    return (
      <SkillEditor
        labels={labels}
        initial={initial}
        editing={kept !== undefined}
        onSave={(draft) => {
          const written = kept === undefined ? view.add(draft) : view.update(kept.id, draft);
          if (written.ok) setEditing(null);
          return written;
        }}
        onCancel={() => {
          setEditing(null);
        }}
      />
    );
  }

  if (importing) {
    return (
      <form
        className="ck-agent-skills__import"
        onSubmit={(event) => {
          event.preventDefault();
          const written = view.importMarkdown(markdown);
          if (written.ok) {
            setImporting(false);
            setMarkdown('');
            setRefusal(undefined);
          } else {
            setRefusal(labels.editor.refusals[written.reason]);
          }
        }}
      >
        <label className="ck-agent-kn-field" htmlFor={`${id}-markdown`}>
          {words.importLabel}
          <textarea
            id={`${id}-markdown`}
            className="ck-agent-kn-textarea ck-agent-kn-textarea--mono"
            dir="auto"
            value={markdown}
            rows={8}
            placeholder={words.importPlaceholder}
            onChange={(event) => {
              setMarkdown(event.target.value);
            }}
          />
        </label>
        <p className="ck-agent-kn-refusal" role="alert">
          {refusal}
        </p>
        <div className="ck-agent-kn-actions">
          <button type="submit" className="ck-agent-kn-button" data-variant="primary">
            {words.importSave}
          </button>
          <button
            type="button"
            className="ck-agent-kn-button"
            data-variant="quiet"
            onClick={() => {
              setImporting(false);
              setRefusal(undefined);
            }}
          >
            {labels.editor.cancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="ck-agent-skills">
      <p className="ck-agent-kn-intro">{words.intro}</p>
      <div className="ck-agent-kn-actions">
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="primary"
          onClick={() => {
            setEditing({ kind: 'new' });
          }}
        >
          {words.add}
        </button>
        <button
          type="button"
          className="ck-agent-kn-button"
          onClick={() => {
            setImporting(true);
          }}
        >
          {words.import}
        </button>
        <button
          type="button"
          className="ck-agent-kn-button"
          onClick={() => {
            fileInput.current?.click();
          }}
        >
          {labels.upload.choose}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={SKILL_FILES}
          multiple
          hidden
          aria-label={labels.upload.choose}
          onChange={(event) => {
            void upload(event);
          }}
        />
        <span className="ck-agent-skills__count">{words.count(view.skills.length)}</span>
      </div>
      <p className="ck-agent-kn-status" role="status">
        {status}
      </p>
      {view.skills.length === 0 ? (
        <p className="ck-agent-kn-empty">{words.empty}</p>
      ) : (
        <ul className="ck-agent-kn-list" role="list">
          {view.skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              labels={labels}
              onToggle={(enabled) => {
                const written = view.setEnabled(skill.id, enabled);
                return written.ok ? undefined : labels.editor.refusals[written.reason];
              }}
              onEdit={() => {
                setEditing({ kind: 'edit', id: skill.id });
              }}
              onCopy={async () => {
                const text = view.exportMarkdown(skill.id);
                if (text === undefined) return false;
                try {
                  await clipboard(text);
                  return true;
                } catch {
                  return false;
                }
              }}
              onRemove={() => {
                view.remove(skill.id);
              }}
            />
          ))}
        </ul>
      )}
      {unusedTemplates.length === 0 ? null : (
        <details className="ck-agent-skills__builtins ck-agent-skills__templates">
          <summary className="ck-agent-skills__summary">{labels.templates.title}</summary>
          <ul className="ck-agent-skills__template-list" role="list">
            {unusedTemplates.map((template) => (
              <li key={template.id} className="ck-agent-skills__template">
                <span className="ck-agent-skills__builtin-name">{template.draft.name}</span>
                <span className="ck-agent-skills__builtin-description">
                  {template.draft.description}
                </span>
                <button
                  type="button"
                  className="ck-agent-kn-button ck-agent-skills__template-add"
                  aria-label={labels.templates.add(template.draft.name)}
                  onClick={() => {
                    const written = view.add(template.draft);
                    setStatus(
                      written.ok
                        ? labels.templates.added(template.draft.name)
                        : labels.editor.refusals[written.reason],
                    );
                  }}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="ck-agent-skills__builtins">
        <summary id={`${id}-builtins`} className="ck-agent-skills__summary">
          {words.builtIns(view.builtIns.length)}
        </summary>
        <p className="ck-agent-kn-intro">{words.builtInsHint}</p>
        {/* It scrolls on its own and holds nothing focusable: a tab stop lets a keyboard scroll it. */}
        <ul
          className="ck-agent-skills__builtin-list"
          role="list"
          tabIndex={0}
          aria-labelledby={`${id}-builtins`}
        >
          {view.builtIns.map((skill) => (
            <li key={skill.id} className="ck-agent-skills__builtin">
              <span className="ck-agent-skills__builtin-name">{skill.name}</span>
              <span className="ck-agent-skills__builtin-description">{skill.description}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
