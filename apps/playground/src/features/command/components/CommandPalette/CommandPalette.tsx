import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';

import { groupCommands, type CommandItem } from '../../command-model';
import { COMMAND_PALETTE_LABELS_EN, type CommandPaletteLabels } from '../../command-palette.labels';

import './CommandPalette.css';

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Every place and action, built by the host from its own state (`command-model.ts`). */
  readonly commands: readonly CommandItem[];
  readonly labels?: CommandPaletteLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  /** `Ctrl K` or `⌘ K`, drawn on the trigger. */
  readonly shortcut?: string | undefined;
  /** Draw the top-bar trigger; the dialog itself portals to the body either way. */
  readonly showTrigger?: boolean | undefined;
}

const SEARCH_ICON = (
  <svg
    className="pg-command__trigger-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="7.25" cy="7.25" r="4.25" />
    <path d="M13 13l-2.75-2.75" />
  </svg>
);

/**
 * The editor's command palette (Studio Indigo, 2026-10-12): one searchable list of every
 * place and action — rail sections, publish and preview, undo, devices, panes, pages, the
 * editor language and the keyboard shortcuts — opened with Ctrl/⌘ K or the top-bar trigger.
 *
 * Built on cmdk (filtering, arrow keys, Enter) inside the editor's Radix dialog (focus trap,
 * Escape, focus return, a spoken title). Rows are grouped, each says what it does in the editor's language, shows its
 * shortcut or state at the end, and marks the current place. A row that cannot run now stays
 * listed and disabled, so the palette also teaches what the editor can do. Choosing a row
 * closes the palette first, then runs, so focus lands where the action leads.
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
  labels = COMMAND_PALETTE_LABELS_EN,
  dir = 'ltr',
  shortcut,
  showTrigger = true,
}: CommandPaletteProps) {
  const groups = groupCommands(commands);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="pg-command__trigger"
            aria-keyshortcuts="Control+K Meta+K"
          >
            {SEARCH_ICON}
            <span className="pg-command__trigger-label">{labels.trigger}</span>
            {shortcut === undefined ? null : (
              <kbd className="pg-command__kbd" dir="ltr">
                {shortcut}
              </kbd>
            )}
          </button>
        </Dialog.Trigger>
      ) : null}
      <Dialog.Portal>
        <Dialog.Overlay className="pg-command__overlay" />
        <Dialog.Content className="pg-command__content" dir={dir} aria-describedby={undefined}>
          <Dialog.Title className="bldr-visually-hidden">{labels.dialog}</Dialog.Title>
          <Command className="pg-command" label={labels.dialog} loop>
            <div className="pg-command__search">
              {SEARCH_ICON}
              <Command.Input className="pg-command__input" placeholder={labels.placeholder} />
            </div>
            <Command.List className="pg-command__list">
              <Command.Empty className="pg-command__empty">{labels.empty}</Command.Empty>
              {groups.map(({ group, items }) => (
                <Command.Group
                  key={group}
                  heading={labels.groups[group]}
                  className="pg-command__group"
                >
                  {items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      keywords={[item.label, ...(item.keywords ?? [])]}
                      disabled={item.disabled === true}
                      data-current={item.current === true ? '' : undefined}
                      className="pg-command__item"
                      onSelect={() => {
                        onOpenChange(false);
                        item.run();
                      }}
                    >
                      <span className="pg-command__label">{item.label}</span>
                      {item.current === true ? (
                        <span className="pg-command__current">{labels.current}</span>
                      ) : null}
                      {item.hint === undefined ? null : (
                        <kbd className="pg-command__kbd" dir="ltr">
                          {item.hint}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <div className="pg-command__footer" aria-hidden="true">
              <span>
                <kbd className="pg-command__kbd">↑↓</kbd> {labels.footerMove}
              </span>
              <span>
                <kbd className="pg-command__kbd">↵</kbd> {labels.footerRun}
              </span>
              <span>
                <kbd className="pg-command__kbd">Esc</kbd> {labels.footerClose}
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
