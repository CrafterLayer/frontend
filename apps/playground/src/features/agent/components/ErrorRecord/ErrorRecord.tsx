import { useCallback, useRef, type ReactNode, type Ref } from 'react';

import { t } from '../../copy';
import type { AgentController, ErrorView, Locale, RecordMenuItem } from '../../model/view-types';
import { assignRef } from '../BuildRecord/assign-ref';
import { RecordButton } from '../BuildRecord/RecordButton';
import { RecordMenu, type RecordMenuProps } from '../RecordMenu';
import { RunRecord } from '../RunRecord';

import { ErrorBody } from './ErrorBody';
import './ErrorRecord.css';

/** The controller actions an error record calls: its successor run, and its clean-up. */
export type ErrorRecordActions = Pick<AgentController, 'tryAgain' | 'removeEmpty'>;

export interface ErrorRecordProps {
  readonly locale: Locale;
  readonly view: ErrorView;
  readonly actions: ErrorRecordActions;
  /** The `[⋯]` menu's choice: Copy error details, Reuse request (the caller runs it). */
  readonly onMenuSelect: (item: RecordMenuItem) => void;
  /** Where focus goes after a menu item runs, when not back to `[⋯]` (Reuse → the composer). */
  readonly menuFocusAfter?: RecordMenuProps['focusAfterSelect'];
  readonly menuTriggerRef?: Ref<HTMLButtonElement> | undefined;
  /** The record's heading, for callers that send focus to it (SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** Appended to `ck-agent-record ck-agent-error`. */
  readonly className?: string | undefined;
}

/**
 * A run that failed as a whole (SPEC §4.14, §3.11): the failed glyph, a title by failure class
 * (never colour alone: "Couldn't reach the model"), one cause sentence, and one sentence, always,
 * about what the page holds now. Its footer offers "Try again" when the class can be retried
 * and "Remove the empty layout" when a skeleton was left behind; `[⋯]` copies the details.
 *
 * Try again is an action, not a message: it starts a successor run through the controller and
 * never posts a sentence as the person's turn (SPEC §4.8). Focus then goes to this record's
 * head (SPEC §6.3), so it never falls to the page when the button leaves.
 */
export function ErrorRecord({
  locale,
  view,
  actions,
  onMenuSelect,
  menuFocusAfter,
  menuTriggerRef,
  headingRef,
  className,
}: ErrorRecordProps) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const setHeading = useCallback(
    (node: HTMLHeadingElement | null) => {
      heading.current = node;
      assignRef(headingRef, node);
    },
    [headingRef],
  );
  const focusHead = () => {
    heading.current?.focus();
  };

  const buttons: ReactNode[] = [];
  if (view.retryable) {
    buttons.push(
      <RecordButton
        key="retry"
        tone="primary"
        onClick={() => {
          actions.tryAgain(view.turnId);
          focusHead();
        }}
      >
        {t(locale, 'error.retry')}
      </RecordButton>,
    );
  }
  if (view.pageState.kind === 'skeleton') {
    buttons.push(
      <RecordButton
        key="skeleton"
        tone="text"
        onClick={() => {
          actions.removeEmpty(view.turnId);
          focusHead();
        }}
      >
        {t(locale, 'error.removeSkeleton')}
      </RecordButton>,
    );
  }

  return (
    <RunRecord
      className={className === undefined ? 'ck-agent-error' : `ck-agent-error ${className}`}
      data-failure={view.failure}
      glyph="failed"
      title={t(locale, `error.${view.failure}.title`)}
      headingRef={setHeading}
      actions={buttons.length === 0 ? undefined : buttons}
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
      <ErrorBody locale={locale} body={view} />
    </RunRecord>
  );
}
