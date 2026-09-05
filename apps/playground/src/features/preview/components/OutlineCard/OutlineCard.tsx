import { ChromeButton } from '@craftkit/builder';

import { localeOf } from '../AssistantPanel/AssistantPanel.suggestions';

export interface OutlineCardProps {
  /** The plan, in prose, in the requester's language. Never empty. */
  readonly text: string;
  /**
   * Commands the model proposed anyway, and the run refused to keep.
   *
   * Reported rather than swallowed: a model that keeps proposing edits when it
   * was asked to plan is a fact worth seeing, and a person wondering why
   * nothing happened deserves the real answer.
   */
  readonly dropped: number;
  /**
   * The sections a PLANNED build would create, when this outline came from one.
   *
   * Titles only, in the order the skeleton wrote them. An `apply: 'never'`
   * build creates no node, so there is nothing here to address or jump to —
   * this is a list to read before deciding, not a list to act on.
   */
  readonly sections?: readonly string[] | undefined;
  /**
   * Build it for real. Absent when there is nothing to build, or when the host
   * has nowhere to send it.
   */
  readonly onBuild?: (() => void) | undefined;
  /** A run owns the panel, so starting a second one must not be offered. */
  readonly busy?: boolean;
}

/**
 * A plan, read as a plan — with nothing to apply.
 *
 * It has no Apply and no Preview, and NOT because a condition hides them: an
 * outline turn carries no proposal, so there is nothing for either button to
 * act on. That is the difference between hiding a door and not building one.
 *
 * The follow-up is not drawn here either. It goes to the suggestion rail above
 * the composer, which is where the next thing a person says is being decided
 * and — unlike a card inside the log — does not scroll away when the next
 * message arrives.
 */
export function OutlineCard({ text, dropped, sections, onBuild, busy = false }: OutlineCardProps) {
  return (
    <div className="pg-chat__card pg-chat__card--outline" data-state="outline">
      {/*
        `dir="auto"` and `lang` from the text itself: the model answers in the
        requester's language, which is not always the panel's.
      */}
      <p className="pg-chat__outline" dir="auto" lang={localeOf(text)}>
        {text}
      </p>
      {/*
        The page as the skeleton would lay it out, top to bottom.

        An ordered list, because the ORDER is the plan: a person reading it is
        checking that the page reads the way they meant, and a bulleted set
        would drop the one fact the list is carrying.
      */}
      {sections === undefined || sections.length === 0 ? null : (
        <ol className="pg-chat__outline-sections">
          {sections.map((title, index) => (
            <li key={`${String(index)}-${title}`} dir="auto" lang={localeOf(title)}>
              {title}
            </li>
          ))}
        </ol>
      )}
      {onBuild === undefined ? null : (
        <div className="pg-chat__decide">
          {/*
            A NEW run, at an authority this one never had. The run that produced
            this outline was told not to write and its closure will never write,
            so building means asking again — which is exactly what a person
            switching mode by hand would do, and the mode control moves with it
            so nothing about the panel says one thing while doing another.
          */}
          <ChromeButton variant="primary" disabled={busy} onClick={onBuild}>
            Build this
          </ChromeButton>
        </div>
      )}
      {dropped === 0 ? null : (
        <p className="pg-chat__outline-note" lang="en" dir="ltr">
          {`Planning only — ${String(dropped)} proposed change${dropped === 1 ? '' : 's'} ${
            dropped === 1 ? 'was' : 'were'
          } not kept. Switch to Ask or Auto to build.`}
        </p>
      )}
    </div>
  );
}
