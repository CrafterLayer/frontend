import { useId, useLayoutEffect, useRef, useState, type Ref } from 'react';

import { t } from '../../copy';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type { AnswerView, Locale, RecordMenuItem } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { RecordMenu, type RecordMenuProps } from '../RecordMenu';
import { RunRecord } from '../RunRecord';

import './AnswerRecord.css';

export interface AnswerRecordProps {
  readonly locale: Locale;
  readonly view: AnswerView;
  /** The `[⋯]` menu's choice: Copy answer, Reuse request (the caller runs it). */
  readonly onMenuSelect: (item: RecordMenuItem) => void;
  /** Where focus goes after a menu item runs, when not back to `[⋯]` (Reuse → the composer). */
  readonly menuFocusAfter?: RecordMenuProps['focusAfterSelect'];
  readonly menuTriggerRef?: Ref<HTMLButtonElement> | undefined;
  /** The record's heading, for callers that send focus to it (SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** Appended to `ck-agent-record ck-agent-answer`. */
  readonly className?: string | undefined;
}

/**
 * A words-only answer (SPEC §4.10): a question was asked, nothing on the page changed. The note
 * glyph (three lines of prose, never the ink of "on the page"), the title "Answer", and the
 * answer in Read, Ink, laid out in its own direction: `dir` from the majority of its letters,
 * never `dir="auto"`, and again per line, so an English answer in the Arabic panel reads left
 * to right and a line of the other script orders itself. Per line by majority, not
 * `unicode-bidi: plaintext`: plaintext takes each line's FIRST strong letter, the rule that
 * lays «Hero قسم الخدمات» out left to right (SPEC §4.5, §6.6).
 *
 * At most six lines, then "Show more": a disclosure on the prose (`aria-expanded`,
 * `aria-controls`), shown only when the answer is longer than six lines. `[⋯]` copies it.
 */
export function AnswerRecord({
  locale,
  view,
  onMenuSelect,
  menuFocusAfter,
  menuTriggerRef,
  headingRef,
  className,
}: AnswerRecordProps) {
  const proseId = useId();
  const prose = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Whether six lines hide anything, measured while folded and whenever its width changes.
  useLayoutEffect(() => {
    const element = prose.current;
    if (element === null || expanded || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [view.text, expanded]);

  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const dir = resolveDir(view.text, uiDir);
  const lang = resolveLang(view.text, locale);
  const foldable = overflowing || expanded;
  // Each line takes the direction most of its own letters ask for (the answer's, for a line
  // with none), so a line in the other script lays out in its own direction.
  const lines = view.text.split('\n');

  return (
    <RunRecord
      className={className === undefined ? 'ck-agent-answer' : `ck-agent-answer ${className}`}
      glyph="note"
      title={t(locale, 'answer.title')}
      headingRef={headingRef}
      menu={
        view.menu.length === 0 ? undefined : (
          <RecordMenu
            locale={locale}
            items={view.menu}
            onSelect={onMenuSelect}
            focusAfterSelect={menuFocusAfter}
            triggerRef={menuTriggerRef}
          />
        )
      }
    >
      <div
        ref={prose}
        id={proseId}
        className="ck-agent-answer__prose"
        dir={dir}
        lang={lang}
        data-folded={expanded ? undefined : ''}
      >
        {lines.map((line, index) => (
          <span key={index} className="ck-agent-answer__line" dir={resolveDir(line, dir)}>
            {line === '' ? ' ' : line}
          </span>
        ))}
      </div>
      {foldable ? (
        <button
          type="button"
          className="ck-agent-answer__more"
          aria-expanded={expanded}
          aria-controls={proseId}
          onClick={() => {
            setExpanded((current) => !current);
          }}
        >
          <AgentIcon name="disclosure" className="ck-agent-answer__chevron" />
          {t(locale, expanded ? 'answer.less' : 'answer.more')}
        </button>
      ) : null}
    </RunRecord>
  );
}
