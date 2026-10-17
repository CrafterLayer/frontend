import {
  useId,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';

import { RunGlyph, type RunGlyphState } from '../RunGlyph';

import './DecisionCard.css';

export interface DecisionCardProps extends Omit<
  ComponentPropsWithoutRef<'article'>,
  'title' | 'children'
> {
  /**
   * The head's node: `decision`, the Indigo diamond, on a proposal and a change plan (SPEC
   * §4.7). A page plan has none: its nodes are its sections', down the pencil spine.
   */
  readonly glyph?: RunGlyphState | undefined;
  /** The card's `h3` (Heading type). Interpolated page words go in `<bdi>`. */
  readonly title: ReactNode;
  /** A Tint tag at the head's inline end: "Edited", "Waiting for your approval". */
  readonly tag?: ReactNode;
  /** A Graphite line under the title: the plan's subject. */
  readonly subject?: ReactNode;
  /** The heading, for callers that send focus to the card (SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** The card itself, for answers that must find their turn once the card is gone. */
  readonly cardRef?: Ref<HTMLElement> | undefined;
  /** `view-transition-name` of the head, for the plan-to-build morph (`ck-plan-head`). */
  readonly headTransitionName?: string | undefined;
  /** The card's parts: `.ck-agent-card__body`, `.ck-agent-card__section`, `.ck-agent-card__footer`. */
  readonly children: ReactNode;
}

/**
 * The box a decision waits in (SPEC §1, §2.5 e1, §4.11 to §4.13): a Sheet with a Hairline
 * border and a 9px radius, 12px in. It is one of the only two things in the panel with a
 * border (the other is the composer), so what is waiting for the person reads apart from
 * everything that already happened.
 *
 * An `<article>` named by its `h3`, like every record, so a screen reader moving by headings
 * meets it in the thread's order; the heading takes `tabindex="-1"` so focus can be sent to
 * it. The node, when there is one, is `aria-hidden`: the title says the state in words.
 *
 * Its parts share one geometry (DecisionCard.css): a head (node, title, tag, subject); body
 * lines 4px under the head, on the title's edge; sections split by full-width Hairlines with
 * 8px above and below; a footer with the actions at the start, the tools at the end, and
 * one note under them.
 */
export function DecisionCard({
  glyph,
  title,
  tag,
  subject,
  headingRef,
  cardRef,
  headTransitionName,
  children,
  className,
  ...rest
}: DecisionCardProps) {
  const titleId = useId();
  const headStyle: CSSProperties | undefined =
    headTransitionName === undefined ? undefined : { viewTransitionName: headTransitionName };
  return (
    <article
      {...rest}
      ref={cardRef}
      aria-labelledby={titleId}
      className={className === undefined ? 'ck-agent-card' : `ck-agent-card ${className}`}
      data-glyph={glyph === undefined ? undefined : ''}
    >
      <div className="ck-agent-card__head" style={headStyle}>
        <div className="ck-agent-card__headline">
          {glyph === undefined ? null : <RunGlyph state={glyph} />}
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className="ck-agent-card__title">
            {title}
          </h3>
          {tag === undefined || tag === null ? null : (
            <span className="ck-agent-card__tag">{tag}</span>
          )}
        </div>
        {subject === undefined || subject === null ? null : (
          <p className="ck-agent-card__subject">{subject}</p>
        )}
      </div>
      {children}
    </article>
  );
}
