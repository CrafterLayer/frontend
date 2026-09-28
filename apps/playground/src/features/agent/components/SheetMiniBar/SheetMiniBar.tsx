import { ChromeButton } from '@craftkit/builder';
import {
  useId,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type ReactNode,
  type Ref,
} from 'react';

import { t, tParts, type CopyRef } from '../../copy';
import type { AgentController, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { IconButton } from '../IconButton';
import { InlineConfirm } from '../InlineConfirm';
import { MiniSpine } from '../MiniSpine';
import { RunGlyph } from '../RunGlyph';

import type { MiniBarAction, MiniBarView } from './mini-bar-view';
import './SheetMiniBar.css';

/** The controller actions the mini row can take: a structural slice of AgentController. */
export type MiniBarCommands = Pick<
  AgentController,
  | 'stop'
  | 'undoBuild'
  | 'redoBuild'
  | 'finishRest'
  | 'retrySections'
  | 'undoEdit'
  | 'redoEdit'
  | 'apply'
  | 'discard'
  | 'tryAgain'
>;

export interface SheetMiniBarProps {
  readonly locale: Locale;
  /** What the row says and offers: `miniBarView(controller.state)`. */
  readonly view: MiniBarView;
  /** Where each action goes; AgentController satisfies it as it is. */
  readonly commands: MiniBarCommands;
  /** `[⤒]` Back to the chat: raises the sheet to its full detent. */
  readonly onBackToChat: () => void;
  /** The `[⤒]` button, for AgentSheet to send focus to when the sheet drops to mini. */
  readonly backToChatRef?: Ref<HTMLButtonElement> | undefined;
}

/** A catalog string with its interpolated values isolated, as SPEC §4.0 asks. */
function copyOf(locale: Locale, ref: CopyRef): ReactNode {
  return tParts(locale, ref.key, ref.params).map((part, index) =>
    part.kind === 'text' ? part.text : <bdi key={`${part.slot}-${String(index)}`}>{part.text}</bdi>,
  );
}

/** The one element focus falls back to inside the row: its first action, else `[⤒]`. */
const FOCUS_FALLBACK = '.ck-agent-mini-bar__action, .ck-agent-mini-bar__back';

/**
 * The phone sheet's mini detent (SPEC §4.19, §3.16): the horizontal spine, then one 44px
 * row of glyph, status and the one action the moment calls for, and always `[⤒]` Back to
 * the chat at the inline end, where `[⤓]` Show the page stood in the full header. The
 * canvas stays in view above it, so a build can be watched landing section by section
 * with Stop still in reach.
 *
 * It renders a `MiniBarView` (`miniBarView(state)`) and calls the controller; it decides
 * nothing. The status is plain text, never live: the panel's one live region speaks for
 * it (SPEC §6.1).
 *
 * Focus: when the action that held focus goes away with its moment (Stop once the run
 * settles, Apply once applied), focus moves to the new moment's first action, or to
 * `[⤒]`, never to the page body. Apply lands on Undo that way (SPEC §6.3).
 */
export function SheetMiniBar({
  locale,
  view,
  commands,
  onBackToChat,
  backToChatRef,
}: SheetMiniBarProps) {
  const statusId = useId();
  const root = useRef<HTMLDivElement>(null);
  /** Focus was inside the row and has not been taken elsewhere since. */
  const holdsFocus = useRef(false);

  useLayoutEffect(() => {
    const element = root.current;
    if (element === null || !holdsFocus.current) return;
    const active = element.ownerDocument.activeElement;
    if (active !== null && active !== element.ownerDocument.body && element.contains(active)) {
      return;
    }
    element.querySelector<HTMLElement>(FOCUS_FALLBACK)?.focus();
  }, [view]);

  const run = (action: MiniBarAction): void => {
    switch (action.kind) {
      case 'stop':
        if (!action.stopping) commands.stop();
        return;
      case 'undoBuild':
        commands.undoBuild(action.turnId);
        return;
      case 'redoBuild':
        commands.redoBuild(action.turnId);
        return;
      case 'finishRest':
        commands.finishRest(action.turnId);
        return;
      case 'retryFailed':
        commands.retrySections(action.turnId, action.keys);
        return;
      case 'undoEdit':
        commands.undoEdit(action.turnId);
        return;
      case 'redoEdit':
        commands.redoEdit(action.turnId);
        return;
      case 'apply':
        commands.apply(action.turnId);
        return;
      case 'discard':
        commands.discard(action.turnId);
        return;
      case 'tryAgain':
        commands.tryAgain(action.turnId);
        return;
    }
  };

  const button = (
    action: Exclude<MiniBarAction, { kind: 'stop' }>,
    emphasis: 'primary' | 'secondary' | 'ghost',
    label: string,
    onClick: () => void,
  ): ReactNode => (
    <ChromeButton
      key={`${action.kind}:${action.turnId}`}
      className="ck-agent-mini-bar__action"
      data-emphasis={emphasis}
      size="touch"
      aria-describedby={statusId}
      onClick={onClick}
    >
      {label}
    </ChromeButton>
  );

  const renderAction = (action: MiniBarAction): ReactNode => {
    switch (action.kind) {
      case 'stop':
        return (
          <ChromeButton
            key="stop"
            className="ck-agent-mini-bar__action ck-agent-mini-bar__stop"
            size="touch"
            // Stopping keeps the visible «إيقاف» / "Stop" and focus; only the name moves on.
            aria-label={action.stopping ? t(locale, 'stopping') : undefined}
            aria-disabled={action.stopping ? true : undefined}
            onClick={() => {
              run(action);
            }}
          >
            <AgentIcon name={action.stopping ? 'spinner' : 'stop'} />
            <span>{t(locale, 'stop')}</span>
          </ChromeButton>
        );
      case 'undoBuild':
        // The record asks before undoing a whole build (SPEC §4.15); so does its mini row.
        return (
          <InlineConfirm
            key={`undoBuild:${action.turnId}`}
            className="ck-agent-mini-bar__confirm"
            message={t(locale, 'confirm.undoBuild')}
            confirmLabel={t(locale, 'confirm.undo')}
            cancelLabel={t(locale, 'confirm.cancel')}
            onConfirm={() => {
              run(action);
            }}
            renderOpener={({ open }) =>
              button(action, 'secondary', t(locale, 'footer.undoBuild'), open)
            }
          />
        );
      case 'redoBuild':
        return button(action, 'secondary', t(locale, 'footer.redoBuild'), () => {
          run(action);
        });
      case 'finishRest':
        return button(action, 'primary', t(locale, 'footer.finishRest', { n: action.count }), () => {
          run(action);
        });
      case 'retryFailed':
        return button(action, 'primary', t(locale, 'row.retry'), () => {
          run(action);
        });
      case 'undoEdit':
        return button(action, 'secondary', t(locale, 'edit.undo'), () => {
          run(action);
        });
      case 'redoEdit':
        return button(action, 'secondary', t(locale, 'edit.redo'), () => {
          run(action);
        });
      case 'apply':
        return button(action, 'primary', t(locale, 'proposal.apply'), () => {
          run(action);
        });
      case 'discard':
        return button(action, 'ghost', t(locale, 'proposal.discard'), () => {
          run(action);
        });
      case 'tryAgain':
        return button(action, 'primary', t(locale, 'error.retry'), () => {
          run(action);
        });
    }
  };

  const { spine } = view;
  return (
    <div
      ref={root}
      className="ck-agent-mini-bar"
      onFocus={() => {
        holdsFocus.current = true;
      }}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        // Moving within the row keeps the claim; anywhere else, or nowhere, gives it up.
        // A focused button removed with its moment fires no blur, so the claim survives
        // exactly the case the fallback is for.
        const next = event.relatedTarget;
        holdsFocus.current = next !== null && event.currentTarget.contains(next);
      }}
    >
      <div className="ck-agent-mini-bar__spine">
        {spine === null ? null : spine.kind === 'indeterminate' ? (
          <MiniSpine indeterminate live animate />
        ) : (
          <MiniSpine rows={spine.rows} live={spine.live} animate />
        )}
      </div>
      <div className="ck-agent-mini-bar__row">
        {view.glyph === null ? null : (
          <RunGlyph className="ck-agent-mini-bar__glyph" state={view.glyph} animate />
        )}
        <p id={statusId} className="ck-agent-mini-bar__status">
          {copyOf(locale, view.status)}
        </p>
        {view.actions.map(renderAction)}
        <IconButton
          ref={backToChatRef}
          icon="backToChat"
          label={t(locale, 'sheet.backToChat')}
          className="ck-agent-mini-bar__back"
          tooltipSide="top"
          tooltipAlign="end"
          onClick={onBackToChat}
        />
      </div>
    </div>
  );
}
