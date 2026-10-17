import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { t } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './AddSectionRow.css';

export interface AddSectionRowProps {
  readonly locale: Locale;
  /** False at the plan's ceiling, twelve sections (`plan.max`): the reason shows under it. */
  readonly canAdd: boolean;
  /** A new section's name, tidied, never empty (`{ kind: 'add', title }`). */
  readonly onAdd: (title: string) => void;
}

/**
 * The engine's limit on a section title (`validate-page-plan.ts`: `sections[].title`, 80
 * characters), as the inline rename holds it.
 */
const TITLE_MAX_LENGTH = 80;

function tidy(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * The last line of an editable plan (SPEC §4.11 AddSectionRow, frame §3.7):
 *
 *   ○  8  Contact            [⠿] [⋯]
 *   +  Add section                        a text button, the + where the nodes are
 *   +  [Section name, e.g. Pricing    ]   …that becomes a 32px field in place
 *
 * Enter adds the section and keeps the field open, empty, for the next one; Esc closes it
 * and focus returns to "Add section". Leaving the field with a name in it adds it, as a
 * rename saves on blur; leaving it empty just closes it. At twelve sections the button stays
 * in the tab order, `aria-disabled` and described by the reason, which is also written
 * under it: a plan never hides why it cannot grow.
 */
export function AddSectionRow({ locale, canAdd, onAdd }: AddSectionRowProps) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  /*
    What the field holds right now. A blur can arrive from a render behind (a field removed
    under the caret fires one in some engines), and its closure would still hold a name
    Enter already added; the ref never does.
  */
  const typed = useRef('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Where focus goes when the field closes: back to the button, or nowhere (it was left). */
  const returnFocus = useRef(false);
  /** The field holds focus: if it closes under the caret (the plan filled up), the button takes it. */
  const fieldFocused = useRef(false);
  /** Set by Esc: a blur the closing field may still fire must not add what was typed. */
  const closing = useRef(false);
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  /*
    The plan filled up while the field was open: it closes onto the button, which says why,
    and stays closed if a section is later removed. Derived while rendering (React's "adjust
    state when a prop changes"), not in an effect that would paint the field once more.
  */
  const [seenCanAdd, setSeenCanAdd] = useState(canAdd);
  if (seenCanAdd !== canAdd) {
    setSeenCanAdd(canAdd);
    if (!canAdd) setOpen(false);
  }
  const isOpen = open && canAdd;

  useLayoutEffect(() => {
    if (isOpen) {
      closing.current = false;
      inputRef.current?.focus();
      return;
    }
    if (returnFocus.current || fieldFocused.current) {
      returnFocus.current = false;
      fieldFocused.current = false;
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  const write = (text: string) => {
    typed.current = text;
    setName(text);
  };

  const close = (refocus: boolean) => {
    closing.current = true;
    returnFocus.current = refocus;
    write('');
    setOpen(false);
  };

  const submit = () => {
    const title = tidy(typed.current);
    if (title === '') return;
    write('');
    onAdd(title);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape') {
      // Spent here: the composer and the panel must not also act on it.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  return (
    <div className="ck-agent-add-section" data-open={isOpen ? '' : undefined}>
      {isOpen ? (
        <>
          <AgentIcon name="plus" className="ck-agent-add-section__glyph" />
          <input
            ref={inputRef}
            type="text"
            className="ck-agent-add-section__field"
            aria-label={t(locale, 'plan.add')}
            placeholder={t(locale, 'plan.add.placeholder')}
            autoComplete="off"
            maxLength={TITLE_MAX_LENGTH}
            value={name}
            dir={name === '' ? uiDir : resolveDir(name, uiDir)}
            onChange={(event) => {
              write(event.currentTarget.value);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => {
              fieldFocused.current = true;
            }}
            onBlur={(event) => {
              // A field removed under the caret was not left: the button takes focus.
              if (!event.currentTarget.isConnected) return;
              fieldFocused.current = false;
              if (closing.current) return;
              submit();
              close(false);
            }}
          />
        </>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          className="ck-agent-add-section__button"
          aria-disabled={canAdd ? undefined : true}
          aria-describedby={canAdd ? undefined : reasonId}
          onClick={() => {
            if (canAdd) setOpen(true);
          }}
        >
          <AgentIcon name="plus" className="ck-agent-add-section__glyph" />
          <span className="ck-agent-add-section__label">{t(locale, 'plan.add')}</span>
        </button>
      )}
      {canAdd ? null : (
        <p id={reasonId} className="ck-agent-add-section__reason">
          {t(locale, 'plan.max')}
        </p>
      )}
    </div>
  );
}
