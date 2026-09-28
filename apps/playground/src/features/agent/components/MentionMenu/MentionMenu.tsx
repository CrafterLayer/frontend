import { useLayoutEffect, useRef } from 'react';

import { t } from '../../copy';
import type { Locale, MentionCandidateView, MentionView } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './MentionMenu.css';

export interface MentionMenuProps {
  readonly locale: Locale;
  /** The listbox's id: the textarea's `aria-controls`. */
  readonly id: string;
  /** The open `@` list (`AgentViewState.mention`), already filtered by the controller. */
  readonly mention: MentionView;
  /** The option the keyboard is on; `-1` for none. */
  readonly activeIndex: number;
  /** The id of option `index`: what the textarea's `aria-activedescendant` points at. */
  readonly optionId: (index: number) => string;
  /** The pointer moved onto option `index`: it becomes the active one. */
  readonly onActiveChange: (index: number) => void;
  readonly onPick: (candidate: MentionCandidateView) => void;
  /** The id of the "No section by that name" line, so the textarea can be described by it. */
  readonly emptyId?: string | undefined;
  /** Appended to `ck-agent-mention`. */
  readonly className?: string | undefined;
}

/**
 * The `@` list (SPEC §4.17 MentionMenu, §3.2): the page's sections and blocks by their
 * human names, sections first with their place on the page ("3 of 8").
 *
 * Only the list is drawn here; the keys belong to the textarea, which stays focused and
 * is the combobox: ↑ ↓ move `activeIndex`, Enter or Tab pick (never send), Esc closes
 * (SPEC §6.7). Options are never focused; the textarea points at the active one with
 * `aria-activedescendant`, and the active option scrolls into view. A pointer press does
 * not take focus from the textarea either, so the caret is where the person left it.
 *
 * With no match there is no listbox (a listbox must hold options); the line says so.
 */
export function MentionMenu({
  locale,
  id,
  mention,
  activeIndex,
  optionId,
  onActiveChange,
  onPick,
  emptyId,
  className,
}: MentionMenuProps) {
  const list = useRef<HTMLUListElement>(null);

  // Keep the keyboard's option in view: six rows show at a time and the rest scroll.
  useLayoutEffect(() => {
    const option = list.current?.children.item(activeIndex);
    if (option instanceof HTMLElement && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const root = className === undefined ? 'ck-agent-mention' : `ck-agent-mention ${className}`;

  if (mention.candidates.length === 0) {
    return (
      <div className={root} data-empty="">
        <p id={emptyId} className="ck-agent-mention__empty">
          {t(locale, 'mention.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className={root}>
      <ul
        ref={list}
        id={id}
        role="listbox"
        aria-label={t(locale, 'mention.label')}
        className="ck-agent-mention__list"
      >
        {mention.candidates.map((candidate, index) => (
          <li
            key={candidate.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            className="ck-agent-mention__option"
            // Keep focus (and the caret) in the textarea: the list is its popup.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onPointerMove={() => {
              if (index !== activeIndex) onActiveChange(index);
            }}
            onClick={() => {
              onPick(candidate);
            }}
          >
            <AgentIcon name="block" className="ck-agent-mention__glyph" />
            <span className="ck-agent-mention__label">
              <bdi>{candidate.label}</bdi>
            </span>
            {candidate.section === undefined ? null : (
              <span className="ck-agent-mention__position">
                {t(locale, 'mention.position', {
                  i: candidate.section.position,
                  n: candidate.section.total,
                })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
