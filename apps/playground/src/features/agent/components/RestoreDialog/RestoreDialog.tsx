import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { t } from '../../copy';
import type { Locale, RestoreResult } from '../../model/view-types';
import { RecordButton } from '../BuildRecord/RecordButton';
import { portalScopeOf, type PortalScope } from '../IconButton';
import { RunGlyph } from '../RunGlyph';

import './RestoreDialog.css';

export interface RestoreDialogProps {
  readonly locale: Locale;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * The restore itself (`AgentController.restore`, bound to the record's turn): a forward
   * transaction that refuses, rather than guesses, when the same parts changed since.
   */
  readonly onRestore: () => Promise<RestoreResult>;
  /**
   * Where focus returns when the dialog closes: the record's `[⋯]` (RecordMenu's
   * `triggerRef`). The menu item that opened the dialog no longer exists, so Radix's own
   * return would land on `body`.
   */
  readonly returnFocusRef?: RefObject<HTMLElement | null> | undefined;
}

type Phase = 'confirm' | 'working' | 'conflict';

const NO_SCOPE: PortalScope = { container: undefined, lang: undefined, dir: undefined };

/**
 * "Restore page to before this request?" (SPEC §4.15 RestoreDialog), opened from a record's
 * `[⋯]` menu. A Radix Dialog, e3: it traps focus while open and hands it back to the menu's
 * trigger when it closes (SPEC §6.3 "Menus, popovers, dialogs closing: their trigger").
 *
 * Opening puts focus on Cancel, the answer that changes nothing. The primary action is
 * destructive, so it is an Alarm outline, never the Indigo fill: Indigo is spent on "this is
 * real on the page", and undoing a stretch of history is the opposite. While the restore runs
 * the button is `aria-disabled` and described as working, and the dialog cannot be dismissed
 * half way.
 *
 * Restore is a forward transaction through the door that refuses honestly on a conflict: then
 * the dialog stays, says so in place («تعذّر الإرجاع تلقائيًا…») with the failed node, and
 * offers only Close, which takes focus. Nothing was changed, so there is nothing to confirm.
 *
 * It mounts inside the panel root, so it keeps the panel's theme, language and direction,
 * and its overlay veils the panel, not the whole editor.
 */
export function RestoreDialog({
  locale,
  open,
  onOpenChange,
  onRestore,
  returnFocusRef,
}: RestoreDialogProps) {
  const workingId = useId();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const scope = anchor === null ? NO_SCOPE : portalScopeOf(anchor);

  // Each opening asks afresh: a refusal shown last time is not this time's answer.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPhase('confirm');
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A refusal leaves one answer, and focus goes to it (SPEC §6.3).
  useLayoutEffect(() => {
    if (phase === 'conflict') closeRef.current?.focus();
  }, [phase]);

  const close = () => {
    setPhase('confirm');
    onOpenChange(false);
  };

  const restore = async () => {
    if (phase !== 'confirm') return;
    setPhase('working');
    let result: RestoreResult;
    try {
      result = await onRestore();
    } catch {
      // The door refused without a verdict: nothing was restored, and that is what is said.
      result = 'conflict';
    }
    if (!mounted.current) return;
    if (result === 'restored') {
      close();
      return;
    }
    setPhase('conflict');
  };

  const working = phase === 'working';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        if (!working) close();
      }}
    >
      <span ref={setAnchor} hidden />
      <Dialog.Portal container={scope.container ?? null}>
        <Dialog.Overlay className="ck-agent-restore__overlay" />
        <Dialog.Content
          className="ck-agent-restore"
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          data-phase={phase}
          aria-busy={working ? true : undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const trigger = returnFocusRef?.current;
            if (trigger === null || trigger === undefined || !trigger.isConnected) return;
            event.preventDefault();
            trigger.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (working) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (working) event.preventDefault();
          }}
        >
          <Dialog.Title className="ck-agent-restore__title">
            {t(locale, 'restore.title')}
          </Dialog.Title>
          <div className="ck-agent-restore__body">
            {phase === 'conflict' ? <RunGlyph state="failed" /> : null}
            <Dialog.Description className="ck-agent-restore__text">
              {t(locale, phase === 'conflict' ? 'restore.conflict' : 'restore.body')}
            </Dialog.Description>
          </div>
          <div className="ck-agent-restore__actions">
            {phase === 'conflict' ? (
              <RecordButton ref={closeRef} tone="secondary" onClick={close}>
                {t(locale, 'restore.close')}
              </RecordButton>
            ) : (
              <>
                <RecordButton
                  tone="secondary"
                  className="ck-agent-restore__confirm"
                  unavailable={working}
                  aria-describedby={working ? workingId : undefined}
                  onClick={() => {
                    void restore();
                  }}
                >
                  {t(locale, 'restore.confirm')}
                </RecordButton>
                <RecordButton
                  ref={cancelRef}
                  tone="text"
                  className="ck-agent-restore__cancel"
                  unavailable={working}
                  onClick={close}
                >
                  {t(locale, 'confirm.cancel')}
                </RecordButton>
              </>
            )}
          </div>
          {working ? (
            <span id={workingId} hidden>
              {t(locale, 'restore.working')}
            </span>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
