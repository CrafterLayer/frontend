import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import type { UserSkillsView } from '../../model/knowledge';
import { slashOptions, slashToken, withoutSlash, type SlashOption } from '../../model/skill-slash';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './SkillSlash.css';

export interface SkillSlashProps {
  readonly locale: Locale;
  readonly skills: UserSkillsView;
  /** The composer's draft: a `/words` at its end opens the list. */
  readonly draft: string;
  readonly onDraftChange: (draft: string) => void;
  /** The composer's textarea: it keeps focus and is the list's combobox. */
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  /** "Manage skills & memory": opens the header's Skills & memory place. */
  readonly onManage: () => void;
}

type Row = { readonly kind: 'skill'; readonly option: SlashOption } | { readonly kind: 'manage' };

/**
 * The composer's `/` (2026-10-12), as other agents have it: a slash at the start of the
 * message or after a space lists the skills — the person's own, then the built-ins — and the
 * words after it narrow the list. ↑ ↓ move, Enter or Tab pick, Esc closes; the textarea keeps
 * focus and points at the active option, as it does for the `@` list. A picked skill leaves
 * the draft and is pinned above the composer for the next message, where the Agent must use
 * it; its × lets it go. The list ends with "Manage skills & memory".
 */
export function SkillSlash({
  locale,
  skills,
  draft,
  onDraftChange,
  inputRef,
  onManage,
}: SkillSlashProps) {
  const id = useId();
  const labels = knowledgeLabels(locale).slash;
  const token = slashToken(draft);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);
  const open = token !== null && dismissedFor !== draft;
  const options = open
    ? slashOptions(skills.skills, skills.builtIns, token.query, skills.pinned)
    : [];
  const rows: readonly Row[] = [
    ...options.map((option): Row => ({ kind: 'skill', option })),
    { kind: 'manage' },
  ];
  const [active, setActive] = useState(0);
  const [activeFor, setActiveFor] = useState(token?.query);
  if (activeFor !== token?.query) {
    setActiveFor(token?.query);
    setActive(0);
    // The note answers the last pick only: new words, or a list closed and opened again, clear it.
    setNote(undefined);
  }
  const activeIndex = Math.min(active, rows.length - 1);
  const optionId = (index: number) => `${id}-option-${String(index)}`;
  const list = useRef<HTMLUListElement>(null);

  const pick = (row: Row | undefined) => {
    if (row === undefined || token === null) return;
    if (row.kind === 'manage') {
      onDraftChange(withoutSlash(draft, token));
      onManage();
      return;
    }
    if (!skills.pin(row.option.id)) {
      setNote(labels.full);
      return;
    }
    setNote(undefined);
    onDraftChange(withoutSlash(draft, token));
    inputRef.current?.focus();
  };

  // The textarea owns the keys while the list is open; the composer never sees them.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing) return;
    const keys: Record<string, () => void> = {
      ArrowDown: () => {
        setActive((activeIndex + 1) % rows.length);
      },
      ArrowUp: () => {
        setActive((activeIndex - 1 + rows.length) % rows.length);
      },
      Enter: () => {
        pick(rows[activeIndex]);
      },
      Tab: () => {
        pick(rows[activeIndex]);
      },
      Escape: () => {
        setDismissedFor(draft);
      },
    };
    const run = keys[event.key];
    if (run === undefined || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    run();
  });
  useEffect(() => {
    const field = inputRef.current;
    if (!open || field === null) return undefined;
    const listener = (event: KeyboardEvent) => {
      onKey(event);
    };
    field.addEventListener('keydown', listener);
    return () => {
      field.removeEventListener('keydown', listener);
    };
  }, [open, inputRef]);

  // The textarea is the combobox: while the list is open it says so and points at the option.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!open || field === null) return undefined;
    field.setAttribute('aria-expanded', 'true');
    field.setAttribute('aria-controls', `${id}-list`);
    field.setAttribute('aria-activedescendant', optionId(activeIndex));
    return () => {
      field.setAttribute('aria-expanded', 'false');
      field.removeAttribute('aria-controls');
      field.removeAttribute('aria-activedescendant');
    };
  });

  useLayoutEffect(() => {
    const option = list.current?.querySelector(`[id="${optionId(activeIndex)}"]`);
    if (option instanceof HTMLElement && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
  });

  const pinned = skills.pinned.map((pinnedId) => {
    const own = skills.skills.find((skill) => skill.id === pinnedId);
    return {
      id: pinnedId,
      name: own?.name ?? skills.builtIns.find((skill) => skill.id === pinnedId)?.name ?? pinnedId,
    };
  });
  const firstBuiltIn = options.findIndex((option) => option.source === 'builtin');

  return (
    <div className="ck-agent-slash">
      {open ? (
        <div className="ck-agent-slash__popup">
          {options.length === 0 ? <p className="ck-agent-slash__empty">{labels.empty}</p> : null}
          {/* In the tree while the list is open, so a note that fills it is announced. */}
          <p className="ck-agent-slash__note" role="status">
            {note}
          </p>
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={labels.label}
            className="ck-agent-slash__list"
          >
            {rows.map((row, index) => {
              const heading =
                row.kind === 'skill' && index === 0 && row.option.source === 'user'
                  ? labels.yours
                  : row.kind === 'skill' && index === firstBuiltIn
                    ? labels.builtIn
                    : undefined;
              const option = (
                <li
                  key={row.kind === 'skill' ? row.option.id : 'manage'}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-kind={row.kind}
                  className="ck-agent-slash__option"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onPointerMove={() => {
                    if (index !== activeIndex) setActive(index);
                  }}
                  onClick={() => {
                    pick(row);
                  }}
                >
                  {row.kind === 'manage' ? (
                    <>
                      <AgentIcon name="skills" className="ck-agent-slash__glyph" />
                      <span className="ck-agent-slash__name">{labels.manage}</span>
                    </>
                  ) : (
                    <>
                      <span className="ck-agent-slash__command" dir="ltr">
                        <bdi>/{row.option.command}</bdi>
                      </span>
                      <span className="ck-agent-slash__text">
                        <span className="ck-agent-slash__name" dir="auto">
                          {row.option.name}
                        </span>
                        <span className="ck-agent-slash__description" dir="auto">
                          {row.option.description}
                        </span>
                      </span>
                    </>
                  )}
                </li>
              );
              return heading === undefined
                ? option
                : [
                    <li
                      key={`heading-${heading}`}
                      role="presentation"
                      aria-hidden="true"
                      className="ck-agent-slash__heading"
                    >
                      {heading}
                    </li>,
                    option,
                  ];
            })}
          </ul>
        </div>
      ) : null}
      {pinned.length === 0 ? null : (
        <div className="ck-agent-slash__pinned" role="group" aria-label={labels.pinned}>
          <AgentIcon name="skills" className="ck-agent-slash__glyph" />
          {pinned.map((skill) => (
            <span key={skill.id} className="ck-agent-slash__chip">
              <span className="ck-agent-slash__chip-name" dir="auto">
                {skill.name}
              </span>
              <button
                type="button"
                className="ck-agent-slash__unpin"
                aria-label={labels.unpin(skill.name)}
                title={labels.unpin(skill.name)}
                onClick={() => {
                  skills.unpin(skill.id);
                  inputRef.current?.focus();
                }}
              >
                <AgentIcon name="close" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
