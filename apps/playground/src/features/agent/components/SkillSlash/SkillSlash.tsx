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
import {
  slashCommands,
  inlineSkillIds,
  slashOptions,
  slashToken,
  textBeforeSlash,
  withoutSlash,
  withInlineSkill,
  type SlashCommand,
  type SlashOption,
} from '../../model/skill-slash';
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
  /** Speak a note or a command's answer through the panel's one live region, not this one's. */
  readonly onAnnounce?: ((text: string) => void) | undefined;
  /** Which commands to offer (all of them by default). */
  readonly commands?: readonly SlashCommand[] | undefined;
  /**
   * Runs a command on the words before the slash; resolves with the line that says what
   * happened (none when it opened a place instead). Without it the list offers no commands.
   */
  readonly onCommand?:
    ((command: SlashCommand, text: string) => Promise<string | undefined>) | undefined;
}

type Row =
  | { readonly kind: 'command'; readonly command: SlashCommand }
  | { readonly kind: 'skill'; readonly option: SlashOption }
  | { readonly kind: 'manage' };

const COMMAND_ICON = {
  remember: 'book',
  checkpoint: 'history',
  skill: 'plus',
  batch: 'layers',
} as const;
/** How long "Remembered." stays under the list. */
const DONE_MS = 4_000;

/**
 * The composer's `/` (2026-10-12), as other agents have it: a slash at the start of the
 * message or after a space lists the skills — the person's own, then the built-ins — and the
 * words after it narrow the list. ↑ ↓ move, Enter or Tab pick, Esc closes; the textarea keeps
 * focus and points at the active option, as it does for the `@` list. A picked skill stays
 * inline in this draft, so sending or queueing captures its choice with these words.
 * The list ends with "Manage skills & memory".
 *
 * Above the skills, the commands act on the words typed before the slash: Remember keeps them
 * in the project memory, Save a checkpoint keeps the page under that name, New skill starts a
 * skill from them. What happened is said once in a status line under the composer.
 */
export function SkillSlash({
  locale,
  skills,
  draft,
  onDraftChange,
  inputRef,
  onManage,
  commands: offered,
  onCommand,
  onAnnounce,
}: SkillSlashProps) {
  const id = useId();
  const labels = knowledgeLabels(locale).slash;
  const token = slashToken(draft);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const open = token !== null && dismissedFor !== draft;
  const vocabulary = slashOptions(skills.skills, skills.builtIns, '', [], skills.defaults);
  const selected = inlineSkillIds(token === null ? draft : draft.slice(0, token.start), vocabulary);
  const options = open
    ? slashOptions(skills.skills, skills.builtIns, token.query, selected, skills.defaults)
    : [];
  const commands =
    open && onCommand !== undefined
      ? slashCommands(token.query).filter((command) => offered?.includes(command) ?? true)
      : [];
  const rows: readonly Row[] = [
    ...commands.map((command): Row => ({ kind: 'command', command })),
    ...options.map((option): Row => ({ kind: 'skill', option })),
    { kind: 'manage' },
  ];
  const [done, setDone] = useState<string | undefined>(undefined);
  useEffect(() => {
    const said = done;
    if (said !== undefined && said !== '') onAnnounce?.(said);
  }, [done, onAnnounce]);
  useEffect(() => {
    if (done === undefined) return undefined;
    const timer = setTimeout(() => {
      setDone(undefined);
    }, DONE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [done]);
  const [active, setActive] = useState(0);
  const [activeFor, setActiveFor] = useState(token?.query);
  if (activeFor !== token?.query) {
    setActiveFor(token?.query);
    setActive(0);
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
    if (row.kind === 'command') {
      const text = textBeforeSlash(draft, token);
      // The words were the command's input: they leave the composer with the slash.
      onDraftChange(text === '' ? withoutSlash(draft, token) : '');
      void onCommand?.(row.command, text).then(setDone);
      inputRef.current?.focus();
      return;
    }
    onDraftChange(withInlineSkill(draft, token, row.option));
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

  const firstUser = rows.findIndex((row) => row.kind === 'skill' && row.option.source === 'user');
  const firstDefault = rows.findIndex(
    (row) => row.kind === 'skill' && row.option.source === 'default',
  );
  const firstBuiltIn = rows.findIndex(
    (row) => row.kind === 'skill' && row.option.source === 'builtin',
  );

  return (
    <div className="ck-agent-slash">
      {open ? (
        <div className="ck-agent-slash__popup">
          {options.length === 0 ? <p className="ck-agent-slash__empty">{labels.empty}</p> : null}
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={labels.label}
            className="ck-agent-slash__list"
          >
            {rows.map((row, index) => {
              const heading =
                index === 0 && row.kind === 'command'
                  ? labels.commandsHeading
                  : index === firstUser
                    ? labels.yours
                    : index === firstDefault
                      ? labels.defaults
                      : index === firstBuiltIn
                        ? labels.builtIn
                        : undefined;
              const option = (
                <li
                  key={
                    row.kind === 'skill'
                      ? row.option.id
                      : row.kind === 'command'
                        ? `command-${row.command}`
                        : 'manage'
                  }
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
                  ) : row.kind === 'command' ? (
                    <>
                      <AgentIcon
                        name={COMMAND_ICON[row.command]}
                        className="ck-agent-slash__glyph"
                      />
                      <span className="ck-agent-slash__text">
                        <span className="ck-agent-slash__name">
                          {labels.commands[row.command].name}
                        </span>
                        <span className="ck-agent-slash__description">
                          {labels.commands[row.command].hint}
                        </span>
                      </span>
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
      ) : (
        // While the list is closed: the line a command's answer fills (the list has its own).
        <p className="ck-agent-slash__done" role={onAnnounce === undefined ? 'status' : undefined}>
          {done}
        </p>
      )}
    </div>
  );
}
