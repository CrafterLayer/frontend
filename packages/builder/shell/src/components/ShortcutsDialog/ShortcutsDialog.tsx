import { Fragment, useEffect, useId, useRef, type KeyboardEvent } from 'react';

import {
  EDITOR_SHORTCUTS,
  detectShortcutPlatform,
  type EditorShortcutDef,
  type ShortcutPlatform,
} from '../../keyboard/editor-shortcuts';
import { keyName } from './key-names';
import { SHORTCUTS_DIALOG_LABELS_EN, type ShortcutsDialogLabels } from './ShortcutsDialog.labels';
import './ShortcutsDialog.css';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  labels?: ShortcutsDialogLabels | undefined;
  /** Defaults to the user agent: ⌘ on macOS, Ctrl elsewhere. */
  platform?: ShortcutPlatform | undefined;
  /** Defaults to the editor keymap (`EDITOR_SHORTCUTS`). */
  shortcuts?: readonly EditorShortcutDef[] | undefined;
}

const GROUP_ORDER: readonly EditorShortcutDef['group'][] = ['history', 'clipboard', 'structure', 'selection', 'view'];

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The keymap, listed (style-manager DESIGN.md §E): opened with `?` or Mod+/,
 * grouped, with each chord printed for the person's platform and each action
 * named in the editor's language. A modal: focus moves in on open, Tab stays
 * inside, Escape (or the close button, or the backdrop) closes it and focus
 * returns to where it was.
 */
export function ShortcutsDialog({
  open,
  onClose,
  labels = SHORTCUTS_DIALOG_LABELS_EN,
  platform,
  shortcuts = EDITOR_SHORTCUTS,
}: ShortcutsDialogProps) {
  const titleId = useId();
  const introId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = closeRef.current?.ownerDocument.activeElement as HTMLElement | null | undefined;
    closeRef.current?.focus();
    return () => {
      if (previous?.isConnected === true) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  const resolvedPlatform = platform ?? detectShortcutPlatform();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusables[0];
    const last = focusables.at(-1);
    if (first === undefined || last === undefined) return;
    const active = event.currentTarget.ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="bldr-shortcuts__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bldr-shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        lang={labels.language}
        onKeyDown={onKeyDown}
      >
        <header className="bldr-shortcuts__header">
          <h2 id={titleId} className="bldr-shortcuts__title">
            {labels.title}
          </h2>
          <button ref={closeRef} type="button" className="bldr-shortcuts__close" aria-label={labels.close} onClick={onClose}>
            ×
          </button>
        </header>
        <p id={introId} className="bldr-shortcuts__intro">
          {labels.intro}
        </p>
        <div className="bldr-shortcuts__body" tabIndex={0}>
          {GROUP_ORDER.map((group) => {
            const rows = shortcuts.filter((def) => def.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} className="bldr-shortcuts__group" aria-label={labels.groups[group]}>
                <h3 className="bldr-shortcuts__group-title">{labels.groups[group]}</h3>
                <dl className="bldr-shortcuts__list">
                  {rows.map((def) => (
                    <div key={def.id} className="bldr-shortcuts__row" data-shortcut={def.id}>
                      <dt className="bldr-shortcuts__action">{def.labels[labels.language]}</dt>
                      <dd className="bldr-shortcuts__keys">
                        {def.keys.map((chord, index) => (
                          <Fragment key={chord.join('+')}>
                            {index > 0 ? <span className="bldr-shortcuts__or">{labels.or}</span> : null}
                            {/* Chords read left to right in every language: they are keys, not words. */}
                            <kbd className="bldr-shortcuts__chord" dir="ltr">
                              {chord.map((token) => (
                                <kbd key={token} className="bldr-shortcuts__key">
                                  {keyName(token, resolvedPlatform, labels)}
                                </kbd>
                              ))}
                            </kbd>
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
