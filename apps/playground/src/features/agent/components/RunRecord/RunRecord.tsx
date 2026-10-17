import { useId, type ComponentPropsWithoutRef, type ReactNode, type Ref } from 'react';

import { RunGlyph, type RunGlyphState } from '../RunGlyph';

import './RunRecord.css';

/** One figure in a record's head: a count (`1/8`) or a final time (`2:21`). */
export interface RecordMetaItem {
  /** What is drawn, in an LTR island: `1/8`, `2:21`. */
  readonly text: string;
  /**
   * What a screen reader hears instead, when the bare figure would not make sense read
   * aloud ("1 of 8 sections are on the page" for `1/8`). Leave it out for a time.
   */
  readonly label?: string | undefined;
}

export interface RunRecordProps extends Omit<
  ComponentPropsWithoutRef<'article'>,
  'title' | 'children'
> {
  readonly glyph: RunGlyphState;
  /** Play the glyph's arrival motion (a live build); see RunGlyph. */
  readonly animateGlyph?: boolean | undefined;
  /**
   * The record's `h3`: a phrase that says the state in words ("Page built", "Build
   * stopped"). Interpolated page words go in `<bdi>` (`tParts` gives the pieces).
   */
  readonly title: ReactNode;
  /** The head's figures at the inline end: the count while live, the final time after. */
  readonly meta?: readonly RecordMetaItem[] | undefined;
  /** Body lines. They sit in the text column, 24px in; see `.ck-agent-record__body`. */
  readonly children?: ReactNode;
  /**
   * Footer buttons: at most one primary and one secondary (SPEC §4.6). They wrap in their
   * own column, so an InlineConfirm that takes the row keeps `menu` beside its answers.
   */
  readonly actions?: ReactNode;
  /** The `[⋯]` RecordMenu, closing the footer at its inline end. */
  readonly menu?: ReactNode;
  /** The heading, for callers that send focus to the record (SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
}

/**
 * The shared shell of every record (SPEC §4.6): BuildRecord, EditRecord, AnswerRecord,
 * ErrorRecord, and a decision card once it is answered.
 *
 * A record is history, so it has no box: no border, no fill, no radius (SPEC §1: only the
 * composer and a decision waiting for the person get a border). What it has is a head row
 * (glyph, title, figures), body lines that start 24px in, under the title, and a footer.
 *
 * It is an `<article>` named by its `h3`. The title carries the state in words; the glyph
 * is `aria-hidden` and adds nothing, so the state is never colour or shape alone. The
 * heading takes `tabindex="-1"` so an action can send focus to it ("Build this page" →
 * the new record's head, SPEC §6.3).
 */
export function RunRecord({
  glyph,
  animateGlyph = false,
  title,
  meta,
  children,
  actions,
  menu,
  headingRef,
  className,
  ...rest
}: RunRecordProps) {
  const titleId = useId();
  const hasFooter = actions !== undefined || menu !== undefined;
  return (
    <article
      {...rest}
      aria-labelledby={titleId}
      className={className === undefined ? 'ck-agent-record' : `ck-agent-record ${className}`}
    >
      <div className="ck-agent-record__head">
        <RunGlyph state={glyph} animate={animateGlyph} />
        <h3 id={titleId} ref={headingRef} tabIndex={-1} className="ck-agent-record__title">
          {title}
        </h3>
        {meta === undefined || meta.length === 0 ? null : (
          <span className="ck-agent-record__meta">
            {meta.map((item) => (
              <span key={item.text} className="ck-agent-record__figure">
                <bdi dir="ltr" aria-hidden={item.label === undefined ? undefined : true}>
                  {item.text}
                </bdi>
                {item.label === undefined ? null : (
                  <span className="bldr-visually-hidden">{item.label}</span>
                )}
              </span>
            ))}
          </span>
        )}
      </div>
      {children === undefined || children === null ? null : (
        <div className="ck-agent-record__body">{children}</div>
      )}
      {hasFooter ? (
        <div className="ck-agent-record__footer">
          {actions === undefined ? null : <div className="ck-agent-record__actions">{actions}</div>}
          {menu === undefined ? null : <div className="ck-agent-record__menu">{menu}</div>}
        </div>
      ) : null}
    </article>
  );
}
