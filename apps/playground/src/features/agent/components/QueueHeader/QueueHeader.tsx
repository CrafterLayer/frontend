import { ChromeButton } from '@craftkit/builder';
import { useId } from 'react';

import { QUEUE_CAPTION_KEY, t } from '../../copy';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type { ContextChipView, Locale, QueueView } from '../../model/view-types';
import { ContextChip } from '../ContextChip';
import { IconButton } from '../IconButton';

import './QueueHeader.css';

export interface QueueHeaderProps {
  readonly locale: Locale;
  /** The one queued request (`AgentViewState.queue`, FR-025). */
  readonly queue: QueueView;
  /** `×`: drops the queued request and clears the box (`removeQueued`). */
  readonly onRemove: () => void;
  /** Continue, after Stop (`continueQueued`, FR-054). Only a paused queue offers it. */
  readonly onContinue: () => void;
  /**
   * Ids for the label and the caption. The Composer passes its own, so the textarea that
   * holds the queued text can be described by them ("Up next. Starts when the current work
   * ends"); left out, the header makes its own.
   */
  readonly labelId?: string | undefined;
  readonly captionId?: string | undefined;
  /**
   * The chips the composer below shows for the new draft. A paused request's scope that the
   * dock already shows is not drawn a second time (SPEC §3.10: the queued text and Continue).
   */
  readonly dockChips?: readonly ContextChipView[] | undefined;
  /** Appended to `ck-agent-queue`. */
  readonly className?: string | undefined;
}

/**
 * The chips a paused request shows for its scope: none for the whole page, which is every
 * request's scope unless it names a block, and none when the composer below already shows
 * the very same scope. Two identical chips in one dock read as two requests.
 */
function pausedScope(
  chips: readonly ContextChipView[],
  dockChips: readonly ContextChipView[] | undefined,
): readonly ContextChipView[] {
  const named = chips.filter((chip) => chip.kind !== 'page');
  if (named.length === 0) return named;
  const dock = dockChips?.filter((chip) => chip.kind !== 'page') ?? [];
  const same =
    dock.length === named.length && named.every((chip, index) => chip.id === dock[index]?.id);
  return same ? [] : named;
}

/**
 * The header of the one queued request (SPEC §4.17 QueueHeader, §3.9, §3.10): an 8px dot,
 * "Up next" with a caption under it, and `×` at the inline end. 44px, two lines.
 *
 * While a run is live the queued request **is** the composer's own text (FR-025): there is
 * no second field, so this header sits directly on top of the textarea and heads it, and
 * editing the text edits the request. What the caption says follows the revalidation
 * against the page (FR-026): waiting, target changed (Amber), target gone (Alarm, it cannot
 * run as written).
 *
 * After Stop the request pauses with its own text (SPEC §3.10) while the composer below
 * empties for a new draft, so the paused header carries the request itself, its scope,
 * and Continue (FR-054). The dot follows the state as a second cue; the words carry it.
 */
export function QueueHeader({
  locale,
  queue,
  onRemove,
  onContinue,
  labelId,
  captionId,
  dockChips,
  className,
}: QueueHeaderProps) {
  const ownLabelId = useId();
  const ownCaptionId = useId();
  const label = labelId ?? ownLabelId;
  const caption = captionId ?? ownCaptionId;
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const scope = queue.status === 'paused' ? pausedScope(queue.chips, dockChips) : [];

  return (
    <div
      role="group"
      aria-labelledby={label}
      aria-describedby={caption}
      className={className === undefined ? 'ck-agent-queue' : `ck-agent-queue ${className}`}
      data-status={queue.status}
    >
      <p id={label} className="ck-agent-queue__label">
        {t(locale, 'queue.label')}
      </p>
      <p id={caption} className="ck-agent-queue__caption">
        {t(locale, QUEUE_CAPTION_KEY[queue.status])}
      </p>
      <IconButton
        icon="close"
        label={t(locale, 'queue.remove')}
        className="ck-agent-queue__remove"
        tooltipSide="top"
        tooltipAlign="end"
        onClick={onRemove}
      />
      {queue.status === 'paused' ? (
        <div className="ck-agent-queue__request">
          {scope.length === 0 ? null : (
            <div className="ck-agent-queue__chips">
              {scope.map((chip) => (
                <ContextChip key={chip.id} locale={locale} chip={chip} />
              ))}
            </div>
          )}
          <p
            className="ck-agent-queue__text"
            dir={resolveDir(queue.text, uiDir)}
            lang={resolveLang(queue.text, locale)}
          >
            {queue.text}
          </p>
          <ChromeButton className="ck-agent-queue__continue" size="lg" onClick={onContinue}>
            {t(locale, 'queue.continue')}
          </ChromeButton>
        </div>
      ) : null}
    </div>
  );
}
