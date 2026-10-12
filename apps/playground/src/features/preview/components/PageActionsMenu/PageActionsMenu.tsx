import { ChromeButton } from '@craftkit/builder';
import { useRef, useState, type KeyboardEvent } from 'react';

import { PAGE_ACTIONS_MENU_LABELS_EN, type PageActionsMenuLabels } from './PageActionsMenu.labels';
import './PageActionsMenu.css';

export type PageMenuAction =
  | 'open'
  | 'rename'
  | 'change-route'
  | 'duplicate'
  | 'move-up'
  | 'move-down'
  | 'make-home'
  | 'settings'
  | 'clear';

export interface PageDeleteRequest {
  readonly pageId: string;
  readonly unlinkInboundLinks: boolean;
  readonly replacementHomePageId?: string | undefined;
}

export interface PageActionsMenuProps {
  readonly page: { readonly id: string; readonly title: string; readonly address: string };
  readonly pageCount: number;
  readonly inboundLinkCount?: number | undefined;
  readonly replacementHomePageId?: string | undefined;
  readonly replacementHomeTitle?: string | undefined;
  readonly canMoveUp?: boolean | undefined;
  readonly canMoveDown?: boolean | undefined;
  readonly onAction: (action: PageMenuAction, pageId: string) => void;
  readonly onDelete: (request: PageDeleteRequest) => void;
  /** Every string the menu shows; English unless the host passes its locale's set. */
  readonly labels?: PageActionsMenuLabels | undefined;
}

/** Page commands with explicit scope and a confirmation for destructive work. */
export function PageActionsMenu({
  page,
  pageCount,
  inboundLinkCount = 0,
  replacementHomePageId,
  replacementHomeTitle,
  canMoveUp = true,
  canMoveDown = true,
  onAction,
  onDelete,
  labels = PAGE_ACTIONS_MENU_LABELS_EN,
}: PageActionsMenuProps) {
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isHome = page.address === '/';
  const isLastPage = pageCount === 1;
  const deleteBlocked = isLastPage || (isHome && replacementHomePageId === undefined);

  const close = (): void => {
    setOpen(false);
    setConfirmDelete(false);
  };
  const run = (action: PageMenuAction): void => {
    close();
    onAction(action, page.id);
  };

  const navigateMenu = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      close();
      summaryRef.current?.focus();
      return;
    }
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].filter((item) => !item.matches(':disabled'));
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <details className="pg-page-actions" open={open}>
      <summary
        ref={summaryRef}
        role="button"
        aria-expanded={open}
        aria-label={labels.trigger(page.title)}
        title={labels.triggerTitle}
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
          if (open) setConfirmDelete(false);
        }}
      >
        <span aria-hidden="true">•••</span>
      </summary>
      {open ? (
        <div
          className="pg-page-actions__popover"
          role="menu"
          aria-label={labels.menu(page.title)}
          onKeyDown={navigateMenu}
        >
          <p className="pg-page-actions__scope">
            <strong>{page.title}</strong>
            <span>{page.address}</span>
          </p>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('open');
            }}
          >
            {labels.open}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('rename');
            }}
          >
            {labels.rename}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('change-route');
            }}
          >
            {labels.changeRoute}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('duplicate');
            }}
          >
            {labels.duplicate}
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={!canMoveUp}
            onClick={() => {
              run('move-up');
            }}
          >
            {labels.moveUp}
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={!canMoveDown}
            onClick={() => {
              run('move-down');
            }}
          >
            {labels.moveDown}
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={isHome}
            onClick={() => {
              run('make-home');
            }}
          >
            {isHome ? labels.currentHome : labels.makeHome}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('settings');
            }}
          >
            {labels.settings}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              run('clear');
            }}
          >
            {labels.clear}
          </button>
          <button
            className="pg-page-actions__danger"
            role="menuitem"
            type="button"
            disabled={deleteBlocked}
            aria-describedby={deleteBlocked ? `page-delete-note-${page.id}` : undefined}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            {labels.deletePage}
          </button>
          {deleteBlocked ? (
            <p id={`page-delete-note-${page.id}`} className="pg-page-actions__note">
              {isLastPage ? labels.lastPage : labels.chooseHome}
            </p>
          ) : null}
        </div>
      ) : null}

      {open && confirmDelete ? (
        <div
          className="pg-page-actions__confirm"
          role="alertdialog"
          aria-labelledby={`delete-title-${page.id}`}
        >
          <strong id={`delete-title-${page.id}`}>{labels.confirmTitle(page.title)}</strong>
          <p>
            {isHome && replacementHomePageId !== undefined
              ? `${labels.homeMoves(replacementHomeTitle ?? replacementHomePageId)} `
              : ''}
            {inboundLinkCount > 0 ? labels.unlinks(inboundLinkCount) : labels.removesOnce}
          </p>
          <div>
            <ChromeButton
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              {labels.cancel}
            </ChromeButton>
            <ChromeButton
              variant="primary"
              size="sm"
              onClick={() => {
                const request: PageDeleteRequest = {
                  pageId: page.id,
                  unlinkInboundLinks: inboundLinkCount > 0,
                  ...(replacementHomePageId === undefined ? {} : { replacementHomePageId }),
                };
                close();
                onDelete(request);
              }}
            >
              {inboundLinkCount > 0 ? labels.deleteAndUnlink : labels.deletePage}
            </ChromeButton>
          </div>
        </div>
      ) : null}
    </details>
  );
}
