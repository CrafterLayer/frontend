import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { DialogProps } from './schema';

const SIZE_CLASSES: Readonly<Record<DialogProps['size'], string>> = {
  sm: 'max-w-content-narrow',
  md: 'max-w-content-standard',
  lg: 'max-w-content-wide',
  full: 'max-w-none',
};

const TONE_CLASSES: Readonly<Record<DialogProps['tone'], string>> = {
  surface: 'border-text/10 bg-surface text-text',
  inverse: 'border-text-inverse/10 bg-surface-inverse text-text-inverse',
  accent: 'border-accent bg-accent text-accent-text',
};

const PRIMARY_ACTION_CLASSES: Readonly<Record<DialogProps['tone'], string>> = {
  surface: 'border-accent bg-accent text-accent-text',
  inverse: 'border-accent bg-accent text-accent-text',
  accent: 'border-surface-inverse bg-surface-inverse text-text-inverse',
};

const TRIGGER_CLASSES: Readonly<Record<DialogProps['triggerVariant'], string>> = {
  primary: 'border-accent bg-accent text-accent-text shadow-strong',
  secondary: 'border-accent bg-surface text-accent shadow-soft',
  ghost: 'border-transparent bg-transparent text-inherit',
};

/** A native modal dialog: browser focus containment and inert background, with explicit policies. */
export function Dialog({ node, props, isCanvas }: BlockRenderProps<DialogProps>) {
  const dialogId = `${node.id}-dialog`;
  const titleId = `${node.id}-title`;
  const bodyId = props.body === undefined ? undefined : `${node.id}-body`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const hasActionClose =
    props.closeOnAction &&
    (props.primaryAction !== undefined || props.secondaryAction !== undefined);
  /* A backdrop-only route excludes keyboard and switch users, so it never counts as sufficient. */
  const showGuaranteedClose = props.showCloseButton || (!props.closeOnEscape && !hasActionClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
        dialog.setAttribute('open', '');
      }

      const preferredTarget =
        props.initialFocus === 'primary'
          ? primaryRef.current
          : props.initialFocus === 'close'
            ? closeRef.current
            : panelRef.current;
      (preferredTarget ?? closeRef.current ?? primaryRef.current ?? panelRef.current)?.focus();
      return;
    }

    if (dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute('open');
      }
      dialog.removeAttribute('open');
    }
  }, [isOpen, props.initialFocus]);

  const openDialog = () => {
    setIsOpen(true);
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (dialog?.open === true) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute('open');
      }
      dialog.removeAttribute('open');
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (props.closeOnEscape) closeDialog();
  };

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (props.closeOnOverlay && event.target === event.currentTarget) closeDialog();
  };

  const handleAction = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (isCanvas) {
      event.preventDefault();
    }
    if (props.closeOnAction) closeDialog();
  };

  const handleNativeClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="inline-flex min-w-0">
      <button
        ref={triggerRef}
        className={clsx(
          'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-5 py-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
          TRIGGER_CLASSES[props.triggerVariant],
        )}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={openDialog}
      >
        {props.triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={clsx(
          'm-auto max-h-full w-full overflow-y-auto rounded-xl border-0 bg-transparent p-0 shadow-none backdrop:bg-surface-inverse/70 @container',
          SIZE_CLASSES[props.size],
          motionClassName,
          props.className,
        )}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-modal="true"
        onCancel={handleCancel}
        onClose={handleNativeClose}
        onClick={handleOverlayClick}
        {...motionData}
      >
        <div
          ref={panelRef}
          className={clsx(
            'relative m-4 flex min-w-0 flex-col gap-6 rounded-xl border p-6 shadow-elevated outline-none @md:m-6 @md:p-8 motion-reduce:transition-none',
            TONE_CLASSES[props.tone],
          )}
          tabIndex={-1}
          data-dialog-panel=""
        >
          {showGuaranteedClose ? (
            <button
              ref={closeRef}
              className="absolute top-4 end-4 inline-grid size-10 cursor-pointer place-items-center rounded-full border border-current/20 bg-current/10 text-xl leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
              type="button"
              aria-label={props.closeLabel}
              onClick={closeDialog}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}

          <header className="flex min-w-0 flex-col gap-3 pe-12">
            <h2
              id={titleId}
              className="m-0 text-2xl leading-tight font-bold tracking-tight text-balance"
            >
              {props.title}
            </h2>
            {props.body === undefined ? null : (
              <p
                id={bodyId}
                className="m-0 max-w-content-narrow leading-relaxed text-inherit opacity-80 text-pretty"
              >
                {props.body}
              </p>
            )}
          </header>

          {props.primaryAction === undefined && props.secondaryAction === undefined ? null : (
            <footer className="flex flex-col-reverse gap-3 @sm:flex-row @sm:justify-end">
              {props.secondaryAction === undefined ? null : (
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-current/25 bg-transparent px-5 py-2.5 font-semibold text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
                  href={props.secondaryAction.href}
                  onClick={handleAction}
                >
                  {props.secondaryAction.label}
                </a>
              )}
              {props.primaryAction === undefined ? null : (
                <a
                  ref={primaryRef}
                  className={clsx(
                    'inline-flex min-h-11 items-center justify-center rounded-lg border px-5 py-2.5 font-semibold shadow-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current',
                    PRIMARY_ACTION_CLASSES[props.tone],
                  )}
                  href={props.primaryAction.href}
                  onClick={handleAction}
                >
                  {props.primaryAction.label}
                </a>
              )}
            </footer>
          )}
        </div>
      </dialog>
    </div>
  );
}
