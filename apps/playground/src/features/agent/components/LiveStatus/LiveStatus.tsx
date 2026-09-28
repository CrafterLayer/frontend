import { tAnnounce } from '../../copy';
import type { AnnouncementView, Locale } from '../../model/view-types';

import './LiveStatus.css';

export interface LiveStatusProps {
  /** The UI locale: the language the sentence is written and spoken in. */
  readonly locale: Locale;
  /**
   * The newest announcement, already throttled and coalesced by `use-live-status`
   * (SPEC §4.3). `null` before the first one; the region stays mounted and says nothing.
   */
  readonly announcement: AnnouncementView | null;
}

/**
 * The panel's one live region (SPEC §4.3, §6.1): a visually hidden
 * `<p role="status" aria-live="polite" aria-atomic="true">` in the UI language.
 *
 * AgentPanel mounts it once for the panel's whole life, so the final outcome is still
 * spoken after the RunBar has gone. Nothing else in the panel is live: not the thread,
 * not the records, not the RunBar's visible line, not the clock.
 *
 * It speaks only what it is given: the policy (what is announced, when, how often) is
 * `model/agent-status.ts`, driven by `hooks/use-live-status.ts`. The sentence is the
 * `announce.*` catalog entry, MSA only.
 *
 * The sentence sits in a child keyed by `seq`. A screen reader speaks a live region when
 * its content changes, and React leaves identical text alone, so "Copied" twice in a row
 * would be spoken once. A new `seq` mounts a new node, which is a change, so it is spoken
 * again.
 */
export function LiveStatus({ locale, announcement }: LiveStatusProps) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" lang={locale} className="ck-agent-live">
      {announcement === null ? null : (
        <span key={announcement.seq}>
          {tAnnounce(locale, announcement.key, announcement.params)}
        </span>
      )}
    </p>
  );
}
