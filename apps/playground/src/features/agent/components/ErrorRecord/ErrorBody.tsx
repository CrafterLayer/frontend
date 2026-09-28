import { ERROR_CAUSE_KEY, ERROR_PAGE_KEY, t } from '../../copy';
import type { ErrorBodyView, Locale } from '../../model/view-types';

import './ErrorBody.css';

export interface ErrorBodyProps {
  readonly locale: Locale;
  /** The failure and what it left on the page; `details` is never read here. */
  readonly body: Pick<ErrorBodyView, 'failure' | 'pageState'>;
}

/**
 * The body every failure shares (SPEC §4.14): one cause sentence, and one page-state sentence,
 * always. ErrorRecord draws it under its title, and a build that failed before anything
 * landed draws the same two lines (SPEC §4.8 phase `failed`).
 *
 * Only classified words reach the screen: codes, run ids, validator text and provider names
 * go to the clipboard ("Copy error details") and nowhere else.
 */
export function ErrorBody({ locale, body }: ErrorBodyProps) {
  const cause = ERROR_CAUSE_KEY[body.failure];
  const page = body.pageState;
  return (
    <>
      {cause === null ? null : <p className="ck-agent-error-line">{t(locale, cause)}</p>}
      <p className="ck-agent-error-line" data-line="page">
        {t(locale, ERROR_PAGE_KEY[page.kind], page.kind === 'kept' ? { n: page.landed } : {})}
      </p>
    </>
  );
}
