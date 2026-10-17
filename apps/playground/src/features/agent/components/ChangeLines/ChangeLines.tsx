import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { t } from '../../copy';
import type { ChangeLineView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './ChangeLines.css';

export interface ChangeLinesProps {
  readonly locale: Locale;
  /** In schema labels and the page's own words (`impactLines()`), never command names. */
  readonly changes: readonly ChangeLineView[];
  /** Lines shown before "Show all changes (n)". SPEC §4.9: three. */
  readonly limit?: number | undefined;
  /** Appended to `ck-agent-changes`. */
  readonly className?: string | undefined;
}

/*
  Quotation marks are the locale's punctuation, not words (SPEC §4.0: «» in Arabic, “” in
  English). The catalog's sentences embed the same marks; these frame a value the visual
  line draws on its own.
*/
const QUOTES: Readonly<Record<Locale, readonly [open: string, close: string]>> = {
  ar: ['«', '»'],
  en: ['“', '”'],
};

/** U+2212, the minus sign: the width of the plus it stands beside, unlike a hyphen. */
const MINUS = '−';

/** Spacing between revealed lines' arrivals, and the most lines that stagger (SPEC §5 moment 6). */
const STAGGER_MS = 24;
const STAGGER_CAP = 8;

/** A theme duration token's value in ms (`220ms`, `0.22s`); 0 when it is not set. */
function msOf(value: string): number {
  const raw = value.trim();
  const ms = raw.endsWith('ms')
    ? Number.parseFloat(raw)
    : raw.endsWith('s')
      ? Number.parseFloat(raw) * 1000
      : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Grows `list` from the height it had before the reveal to its full height (SPEC §5
 * moment 8: a disclosure opens over `enter`, 220ms, `easing-enter`), so the record's footer
 * glides down instead of jumping by two or more lines at once.
 *
 * The Web Animations API rather than `grid-template-rows: 0fr → 1fr`: the revealed lines
 * belong to the same `<ul>` as the first three, and the list must stay one list for a
 * screen reader ("list, 5 items"), so there is no separate region to collapse. Timing is
 * read from the theme's tokens on the list itself, never restated here. Reduced motion,
 * a missing token or a browser without the API opens it at once.
 */
function growFrom(list: HTMLElement, from: number): void {
  if (typeof list.animate !== 'function') return;
  // jsdom has no `matchMedia`; a browser without it has no preference to honour either.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const to = list.getBoundingClientRect().height;
  const style = getComputedStyle(list);
  const duration = msOf(style.getPropertyValue('--bldr-duration-enter'));
  if (to <= from || duration === 0) return;
  const easing = style.getPropertyValue('--bldr-easing-enter').trim();
  // The lines arriving would otherwise paint over the footer below while the list grows.
  list.style.overflow = 'clip';
  const growth = list.animate(
    [{ blockSize: `${String(from)}px` }, { blockSize: `${String(to)}px` }],
    {
      duration,
      easing: easing === '' ? 'ease-out' : easing,
    },
  );
  const release = () => {
    list.style.removeProperty('overflow');
  };
  growth.finished.then(release, release);
}

function quoted(locale: Locale, text: string): ReactNode {
  const [open, close] = QUOTES[locale];
  return (
    <span className="ck-agent-change__value">
      {open}
      <bdi>{text}</bdi>
      {close}
    </span>
  );
}

/** The sentence a screen reader hears in place of the drawn line. */
function spoken(locale: Locale, change: ChangeLineView): string {
  switch (change.kind) {
    case 'changed':
      return t(locale, 'change.changed.aria', {
        label: change.label,
        before: change.before,
        after: change.after,
      });
    case 'added':
      return t(locale, 'change.added.aria', { label: change.label, value: change.value });
    case 'removed':
      return t(locale, 'change.removed.aria', { label: change.label, value: change.value });
    case 'restyled':
      return t(locale, 'change.restyled.aria', { label: change.label, value: change.value });
    case 'moved':
      return t(locale, 'change.moved.aria', { label: change.label, value: change.value });
  }
}

function drawn(locale: Locale, change: ChangeLineView): ReactNode {
  switch (change.kind) {
    case 'changed':
      return (
        <>
          {quoted(locale, change.before)}
          <AgentIcon name="arrowEnd" className="ck-agent-change__arrow" />
          {quoted(locale, change.after)}
        </>
      );
    case 'added':
      return (
        <>
          <span className="ck-agent-change__sign">+</span>
          {quoted(locale, change.value)}
        </>
      );
    case 'removed':
      return (
        <>
          <span className="ck-agent-change__sign">{MINUS}</span>
          {quoted(locale, change.value)}
        </>
      );
    /*
      A block whose look changed, or that stands somewhere else, has no words to set before
      and after an arrow. It is named like an added block, then the catalog says what
      happened to it («البطل» مظهر جديد, “Hero” New look).
    */
    case 'restyled':
    case 'moved':
      return (
        <>
          {quoted(locale, change.value)}
          <span className="ck-agent-change__word">
            {t(locale, change.kind === 'restyled' ? 'change.restyled' : 'change.moved')}
          </span>
        </>
      );
  }
}

/**
 * What an edit changed (SPEC §4.9), as `label  before → after` lines: at most three, then
 * "Show all changes (n)". An addition reads `+ «value»`, a removal `− «value»`, a restyled
 * or moved block `«value»  New look` / `«value»  Moved`.
 *
 * Each line is drawn for the eye and spoken for the ear separately: the drawn line is
 * `aria-hidden` and a visually hidden sentence from the catalog carries it, so a screen
 * reader hears "Background: from “light” to “deep navy”" instead of two quotes around
 * "right arrow". The arrow mirrors under RTL.
 *
 * "Show all" is a disclosure (`aria-expanded`, `aria-controls` on the list). It reveals the
 * rest in place, growing the list over the `enter` tokens, and moves focus to the first line
 * it revealed. The catalog authors no "show fewer" (SPEC §4.9), so it opens one way: with
 * nothing left to show, the button goes rather than stay as a control that does nothing.
 */
export function ChangeLines({ locale, changes, limit = 3, className }: ChangeLinesProps) {
  const listId = useId();
  const [showAll, setShowAll] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const firstRevealed = useRef<HTMLLIElement>(null);
  /** The list's height the moment "Show all" was pressed: where the growth starts. */
  const heightBefore = useRef<number | null>(null);

  // After React has committed the revealed lines, so both heights are real.
  useLayoutEffect(() => {
    const from = heightBefore.current;
    if (!showAll || from === null) return;
    heightBefore.current = null;
    if (list.current !== null) growFrom(list.current, from);
    firstRevealed.current?.focus();
  }, [showAll]);

  if (changes.length === 0) return null;

  const hidden = changes.length > limit && !showAll;
  const shown = hidden ? changes.slice(0, limit) : changes;

  return (
    <div className={className === undefined ? 'ck-agent-changes' : `ck-agent-changes ${className}`}>
      {/* `role="list"`: WebKit drops list semantics from a list styled without markers. */}
      <ul ref={list} id={listId} role="list" className="ck-agent-changes__list">
        {shown.map((change, index) => {
          const revealed = showAll && index >= limit;
          return (
            <li
              key={`${change.kind}:${change.label}:${String(index)}`}
              ref={index === limit ? firstRevealed : undefined}
              tabIndex={index === limit ? -1 : undefined}
              className="ck-agent-change"
              data-kind={change.kind}
              data-revealed={revealed ? '' : undefined}
              style={
                revealed
                  ? {
                      animationDelay: `${String(Math.min(index - limit, STAGGER_CAP) * STAGGER_MS)}ms`,
                    }
                  : undefined
              }
            >
              <span className="ck-agent-change__visual" aria-hidden="true">
                <bdi className="ck-agent-change__label">{change.label}</bdi>
                <span className="ck-agent-change__values">{drawn(locale, change)}</span>
              </span>
              <span className="bldr-visually-hidden">{spoken(locale, change)}</span>
            </li>
          );
        })}
      </ul>
      {hidden ? (
        <button
          type="button"
          className="ck-agent-changes__more"
          aria-expanded={false}
          aria-controls={listId}
          onClick={() => {
            heightBefore.current = list.current?.getBoundingClientRect().height ?? 0;
            setShowAll(true);
          }}
        >
          <AgentIcon name="disclosure" />
          {t(locale, 'edit.showAll', { n: changes.length })}
        </button>
      ) : null}
    </div>
  );
}
