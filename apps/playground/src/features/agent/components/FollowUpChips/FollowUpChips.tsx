import { useId, useState } from 'react';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { FOLLOW_UPS, type FollowUp } from './constants';

import './FollowUpChips.css';

export interface FollowUpChipsProps {
  readonly locale: Locale;
  /**
   * A chip was chosen: send `request` as the person's next turn, through the same path a
   * typed request takes (TurnView: `setDraft(request)` then `send()`), so it is routed and
   * runs the ordinary edit flows.
   */
  readonly onSend: (request: string) => void;
  /** Appended to `ck-agent-next-steps`. */
  readonly className?: string | undefined;
}

/**
 * The next steps after a first build (docs/architecture/empty-canvas-first-build-research.md:
 * builders offer style choices AFTER the first build, Wix's "Shuffle colors / Shuffle
 * layout"): a compact row of four chips under the build's record: «بدّل الألوان»,
 * «ستايل مختلف», «رتّب الأقسام», «أضف قسمًا».
 *
 * Unlike SuggestionList, a chip SENDS: each one is a whole request, written out in the
 * catalog (`nextSteps.*.request`) so the router reads it as intended (an edit of the page,
 * or one new section). Its accessible description says so.
 *
 * The thread decides when the row shows (`BuildRecordView.nextSteps`: the newest turn, a
 * first build that finished on an empty page) and TurnView hides it while something runs
 * or the person is writing. One pick is all it takes: the row then waits, every chip
 * unavailable, until the request's own turn takes it away; a double click sends once.
 */
export function FollowUpChips({ locale, onSend, className }: FollowUpChipsProps) {
  const hintId = useId();
  const [sent, setSent] = useState<FollowUp['id'] | null>(null);
  const root = className === undefined ? 'ck-agent-next-steps' : `ck-agent-next-steps ${className}`;

  return (
    <div className={root}>
      {/* role="list": WebKit drops the list role from a list drawn without markers. */}
      <ul
        role="list"
        className="ck-agent-next-steps__list"
        aria-label={t(locale, 'nextSteps.label')}
      >
        {FOLLOW_UPS.map((followUp) => (
          <li key={followUp.id} className="ck-agent-next-steps__item">
            <button
              type="button"
              className="ck-agent-next-steps__chip"
              aria-describedby={hintId}
              aria-disabled={sent === null ? undefined : true}
              data-sent={sent === followUp.id ? '' : undefined}
              onClick={() => {
                if (sent !== null) return;
                setSent(followUp.id);
                onSend(t(locale, followUp.request));
              }}
            >
              {t(locale, followUp.label)}
            </button>
          </li>
        ))}
      </ul>
      <span id={hintId} hidden>
        {t(locale, 'nextSteps.hint')}
      </span>
    </div>
  );
}
