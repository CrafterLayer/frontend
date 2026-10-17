import { useId, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';

import { safeHref } from '@craftkit/builder-renderer';

import type { QuickWriteResult } from './element-bar-model';
import { PART_QUICK_BAR_LABELS_EN, type PartQuickBarLabels } from './ElementQuickBar.labels';
import './ElementQuickBar.css';

/** A page of the site the link can point at. */
export interface PartLinkPage {
  readonly title: string;
  readonly href: string;
}

export interface PartLinkPopoverProps {
  /** The link's visible text and address, as stored. */
  readonly text: string;
  readonly href: string;
  /** The site's pages, offered as a shortcut for the address. Absent or empty ⇒ no picker. */
  readonly pages?: readonly PartLinkPage[] | undefined;
  readonly labels?: PartQuickBarLabels | undefined;
  /** The EDITOR UI direction. */
  readonly dir: 'ltr' | 'rtl';
  /** Where the popover portals (the editor's theme scope). */
  readonly container?: HTMLElement | null | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Write both values as ONE transaction (the caller merges the two part
   * plans). A refusal keeps the popover open with the reason beside the form.
   */
  readonly onApply: (value: { readonly text: string; readonly href: string }) => QuickWriteResult;
  /** The trigger — rendered as is (`asChild`), so a toolbar button keeps its roving focus. */
  readonly children: ReactNode;
}

/**
 * The link editor of a registered block's link part (block-parts DESIGN
 * §2.14): its visible text and its address in one small form, with the
 * site's pages as a shortcut. The address must pass `safeHref` (http(s),
 * mailto, tel or a clear relative path) before anything is written, and Apply
 * writes text and address together — one Undo. Text inputs take their
 * direction from what is typed (`dir="auto"`); the address is always LTR.
 */
export function PartLinkPopover({
  text,
  href,
  pages,
  labels = PART_QUICK_BAR_LABELS_EN,
  dir,
  container,
  open,
  onOpenChange,
  onApply,
  children,
}: PartLinkPopoverProps) {
  const id = useId();
  const [draftText, setDraftText] = useState(text);
  const [draftHref, setDraftHref] = useState(href);
  const [error, setError] = useState<string | null>(null);
  // Every opening starts from the stored values, never from an abandoned draft.
  const [openedFor, setOpenedFor] = useState(open);
  if (openedFor !== open) {
    setOpenedFor(open);
    if (open) {
      setDraftText(text);
      setDraftHref(href);
      setError(null);
    }
  }

  const submit = () => {
    const address = draftHref.trim();
    if (safeHref(address) === undefined) {
      setError(labels.invalidHref);
      return;
    }
    const result = onApply({ text: draftText, href: address });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onOpenChange(false);
  };

  const errorId = `${id}-error`;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          className="bldr-quick-bar__panel"
          data-part-link=""
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          dir={dir}
          aria-label={labels.linkTitle}
          onKeyDown={(event) => {
            // The canvas must not read the form's keys as canvas gestures.
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <p className="bldr-quick-bar__panel-title">{labels.linkTitle}</p>
          <form
            className="bldr-quick-bar__panel-body"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="bldr-quick-bar__field-label" htmlFor={`${id}-text`}>
              {labels.linkText}
            </label>
            <input
              id={`${id}-text`}
              className="bldr-quick-bar__input"
              type="text"
              dir="auto"
              value={draftText}
              onChange={(event) => {
                setDraftText(event.currentTarget.value);
              }}
            />
            <label className="bldr-quick-bar__field-label" htmlFor={`${id}-href`}>
              {labels.linkAddress}
            </label>
            <input
              id={`${id}-href`}
              className="bldr-quick-bar__input"
              type="text"
              inputMode="url"
              dir="ltr"
              value={draftHref}
              aria-invalid={error === labels.invalidHref ? true : undefined}
              aria-describedby={error === null ? undefined : errorId}
              onChange={(event) => {
                setDraftHref(event.currentTarget.value);
                if (error === labels.invalidHref) setError(null);
              }}
            />
            {pages === undefined || pages.length === 0 ? null : (
              <>
                <label className="bldr-quick-bar__field-label" htmlFor={`${id}-page`}>
                  {labels.page}
                </label>
                <select
                  id={`${id}-page`}
                  className="bldr-quick-bar__select"
                  value={pages.some((page) => page.href === draftHref) ? draftHref : ''}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    if (next !== '') {
                      setDraftHref(next);
                      setError(null);
                    }
                  }}
                >
                  <option value="">{labels.noPage}</option>
                  {pages.map((page) => (
                    <option key={page.href} value={page.href}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            {error === null ? null : (
              <p id={errorId} className="bldr-quick-bar__error" role="alert">
                {error}
              </p>
            )}
            <div className="bldr-quick-bar__panel-actions">
              <button type="submit" className="bldr-quick-bar__apply">
                {labels.apply}
              </button>
              <button
                type="button"
                className="bldr-quick-bar__apply"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                {labels.cancel}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
