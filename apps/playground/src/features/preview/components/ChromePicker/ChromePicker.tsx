import type { ChromeChoice } from './chrome-theme';

export interface ChromePickerProps {
  value: ChromeChoice;
  onChange: (next: ChromeChoice) => void;
}

const CHOICES: readonly ChromeChoice[] = ['system', 'light', 'dark'];

/**
 * Which theme the EDITOR wears — deliberately not the same control as the one
 * that themes the page being edited.
 *
 * `BuilderTheme` argues that an author working on a dark website must not be
 * forced into a dark editor, and that a dark editor must never repaint their
 * light page. That argument only means something if a person can actually put
 * the two into different states, and until this control existed they could not:
 * the chrome silently followed the operating system and the dark chrome theme —
 * built, tokenised and contrast-gated — was unreachable from inside the app.
 *
 * `system` is a real third state, not the absence of a choice: it passes no
 * theme at all, which is what lets the stylesheet's `prefers-color-scheme`
 * block answer. Choosing `light` on a dark machine is a different decision from
 * not choosing, and this control keeps them distinguishable.
 */
export function ChromePicker({ value, onChange }: ChromePickerProps) {
  return (
    <fieldset>
      <legend>Editor</legend>
      {CHOICES.map((choice) => (
        <label key={choice}>
          <input
            type="radio"
            /*
              The page's own theme picker sits in the same bar and its options
              read "light" and "dark" too. Two radio groups whose options are
              spoken identically leave a screen-reader user with no way to tell
              which theme they are about to change, so each option here names
              its subject. The visible word is still contained in the spoken
              name, which is what WCAG 2.5.3 asks of a label in a name.
            */
            aria-label={`Editor ${choice}`}
            name="playground-chrome"
            value={choice}
            checked={value === choice}
            onChange={() => {
              onChange(choice);
            }}
          />
          {choice}
        </label>
      ))}
    </fieldset>
  );
}
