import { useId } from 'react';

import { HELP_PANEL_LABELS_EN, type HelpPanelLabels } from './HelpPanel.labels';
import './HelpPanel.css';

export interface HelpPanelProps {
  /** Opens the keyboard shortcuts dialog. */
  readonly onOpenShortcuts: () => void;
  /** Opens the command palette. */
  readonly onOpenCommands: () => void;
  /** The palette's own shortcut as the platform writes it ("Ctrl K", "⌘ K"). */
  readonly commandsShortcut: string;
  readonly labels?: HelpPanelLabels | undefined;
}

/**
 * The Help destination (UX pass, 2026-10-13). It used to say that component documentation
 * lives in Storybook — true of the repository and of no use to someone building a page. It
 * now says how a page gets made, in four steps, and opens the two tools that make the
 * editor faster: the keyboard shortcuts and the command palette, each with its key.
 */
export function HelpPanel({
  onOpenShortcuts,
  onOpenCommands,
  commandsShortcut,
  labels = HELP_PANEL_LABELS_EN,
}: HelpPanelProps) {
  const titleId = useId();
  const stepsId = useId();
  const toolsId = useId();
  return (
    <section className="pg-help" aria-labelledby={titleId}>
      <header className="pg-help__head">
        <h2 id={titleId} className="pg-help__title">
          {labels.title}
        </h2>
        <p className="pg-help__intro">{labels.intro}</p>
      </header>

      <section className="pg-help__section" aria-labelledby={stepsId}>
        <h3 id={stepsId} className="pg-help__heading">
          {labels.stepsHeading}
        </h3>
        <ol className="pg-help__steps">
          {labels.steps.map((step) => (
            <li key={step.title} className="pg-help__step">
              <span className="pg-help__step-title">{step.title}</span>
              <span className="pg-help__step-body">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="pg-help__section" aria-labelledby={toolsId}>
        <h3 id={toolsId} className="pg-help__heading">
          {labels.shortcutsHeading}
        </h3>
        <div className="pg-help__tools">
          <button
            type="button"
            className="pg-help__tool"
            aria-keyshortcuts="Shift+/"
            onClick={onOpenShortcuts}
          >
            <span>{labels.keyboardShortcuts}</span>
            <kbd className="pg-help__key" aria-hidden="true">
              ?
            </kbd>
          </button>
          <button
            type="button"
            className="pg-help__tool"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={onOpenCommands}
          >
            <span>{labels.searchAndCommands}</span>
            <kbd className="pg-help__key" aria-hidden="true" dir="ltr">
              {commandsShortcut}
            </kbd>
          </button>
        </div>
      </section>
    </section>
  );
}
