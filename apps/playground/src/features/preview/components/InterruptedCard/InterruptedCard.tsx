import { ChromeButton } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import { IconAlert, IconCheck, IconClose, IconUndo } from '../AssistantPanel/AssistantPanel.icons';
import {
  isResumable,
  resumePoint,
  type RunRecord,
  type RunUnitRecord,
} from '../../../vault/run-journal';

export interface InterruptedCardProps {
  /** The record a boot found: a run nobody closed, or one that stopped early. */
  readonly record: RunRecord;
  readonly locale: AgentLocale;
  /** Continue from the first unwritten section. Absent when it cannot be. */
  readonly onResume?: (() => void) | undefined;
  /** Start again from the beginning, after putting the page back. */
  readonly onRestart: () => void;
  /** Keep the sections that landed and take back the rest. */
  readonly onKeep: () => void;
  /** Throw the whole draft away. */
  readonly onDiscard: () => void;
  /** Another run owns the panel: none of these may start a second one. */
  readonly busy?: boolean;
}

const LABELS = {
  ar: {
    title: 'تشغيل لم يكتمل',
    resume: 'أكمل',
    restart: 'ابدأ من جديد',
    keep: 'احتفظ بما نجح',
    discard: 'تجاهل',
    done: 'مكتوب',
    waiting: 'لم يُكتب',
    skeleton: 'الهيكل على الصفحة بالفعل — البدء من جديد يزيله أولاً.',
    nothing: 'لا شيء لإكماله: كل قسم إمّا كُتب أو رُفض.',
  },
  en: {
    title: 'A run that did not finish',
    resume: 'Resume',
    restart: 'Start over',
    keep: 'Keep what worked',
    discard: 'Discard',
    done: 'written',
    waiting: 'not written',
    skeleton: 'A skeleton is already on the page — starting over removes it first.',
    nothing: 'Nothing to continue: every section was either written or refused.',
  },
} as const;

/** Written, and therefore not what a resume would redo. */
const isWritten = (unit: RunUnitRecord): boolean => unit.status === 'applied';

/**
 * The card a person meets when they come back to a run that never finished.
 *
 * ## Why four actions and not one
 *
 * Because four different things can be true, and only the person knows which.
 * The page may already carry sections they like (Keep), the plan may still be
 * right and just unfinished (Resume), the whole attempt may have been wrong
 * (Start over), or they may have moved on entirely (Discard). A card that
 * offered only "try again" would decide that for them, and would silently throw
 * away work that landed.
 *
 * ## Why Resume is sometimes absent rather than disabled
 *
 * A disabled button is a promise that it could work under some condition the
 * person might discover. There are runs for which no condition exists: a
 * plan-only run wrote nothing and its sections have no region to continue into;
 * a run that never got past the skeleton has no section list at all; and a
 * record whose last checkpoint failed cannot be trusted about which sections
 * landed. `isResumable` decides, and when it says no the card says why in
 * words instead of showing a control that would never light up.
 */
export function InterruptedCard({
  record,
  locale,
  onResume,
  onRestart,
  onKeep,
  onDiscard,
  busy = false,
}: InterruptedCardProps) {
  const copy = LABELS[locale];
  const written = record.units.filter(isWritten).length;
  const resumable = isResumable(record) && onResume !== undefined;
  const next = resumePoint(record);
  /*
    A settled record still at `scaffolding` means the run died between laying
    the skeleton and knowing what its sections were — so the page carries
    placeholders that no unit table describes, and a Start over that did not say
    so would lay a second skeleton on top of the first.
  */
  const skeletonOnPage = record.stage === 'scaffolding';

  return (
    <div className="pg-chat__card pg-chat__card--interrupted" data-state="interrupted">
      <div className="pg-chat__card-head">
        <span className="pg-chat__card-kind" data-kind="interrupted">
          <IconAlert />
          {copy.title}
        </span>
        <span className="pg-chat__card-count">
          {`${String(written)}/${String(record.units.length)}`}
        </span>
      </div>

      {/* The request in the person's own words: the run may be hours old. */}
      <p className="pg-chat__rationale" dir="auto">
        {record.request}
      </p>

      {/*
        Every section, said plainly. FR-093's four actions are only a real choice
        if a person can see what each of them would cost — and "3/8" alone does
        not say WHICH three.
      */}
      {record.units.length === 0 ? null : (
        <ol className="pg-chat__outline-sections">
          {record.units.map((unit) => (
            <li key={`${record.runId}-${String(unit.position)}`} data-written={isWritten(unit)}>
              <span dir="auto">{unit.title}</span>
              <span className="pg-chat__step-cmd">
                {isWritten(unit) ? copy.done : (unit.reason ?? copy.waiting)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {skeletonOnPage ? <p className="pg-chat__outline-note">{copy.skeleton}</p> : null}
      {resumable || record.units.length === 0 ? null : (
        <p className="pg-chat__outline-note">{copy.nothing}</p>
      )}

      <div className="pg-chat__decide">
        {resumable ? (
          <ChromeButton variant="primary" disabled={busy} onClick={onResume}>
            {next === undefined ? copy.resume : `${copy.resume} — ${next.title}`}
          </ChromeButton>
        ) : null}
        {written === 0 ? null : (
          <ChromeButton variant="quiet" size="sm" disabled={busy} onClick={onKeep}>
            <IconCheck />
            {copy.keep}
          </ChromeButton>
        )}
        <ChromeButton variant="quiet" size="sm" disabled={busy} onClick={onRestart}>
          <IconUndo />
          {copy.restart}
        </ChromeButton>
        <ChromeButton
          variant="quiet"
          size="sm"
          className="pg-chat__decide-discard"
          disabled={busy}
          onClick={onDiscard}
        >
          <IconClose />
          {copy.discard}
        </ChromeButton>
      </div>
    </div>
  );
}
