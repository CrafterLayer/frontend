import { ChromeButton } from '../ChromeButton';
import { TextBubblePrompt, type TextBubblePromptSpec } from './TextBubblePrompt';
import './TextBubble.css';

export interface TextBubbleAction {
  id: string;
  label: string;
  /** Toggle state; omit ENTIRELY for one-shot actions (no aria-pressed on a non-toggle). */
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Runs the formatting command — ONE transaction, selection preserved (009 §5 b3). */
  run: () => void;
}

export interface TextBubbleProps {
  /** Content direction — sets `dir` on the group so the reading order flips under RTL. */
  dir: 'ltr' | 'rtl';
  /** Formatting actions, one button each, in order. */
  actions: TextBubbleAction[];
  /** Return to the editor-owned selection bookmark; true means focus moved. */
  onReturnFocus: () => boolean;
  /**
   * A one-field form shown INSTEAD of the actions (the link address while
   * formatting tree text, style-manager DESIGN.md §E). Its field takes focus.
   */
  prompt?: TextBubblePromptSpec | undefined;
  /** The group's accessible name. Default "Formatting". */
  label?: string | undefined;
}

function firstEnabledAction(group: HTMLElement): HTMLButtonElement | null {
  return group.querySelector<HTMLButtonElement>('.bldr-text-bubble__action:not(:disabled)');
}

/**
 * CONTENT of the floating formatting toolbar for inline rich-text editing
 * (009 contract §5). Geometry deliberately lives elsewhere: the floating host
 * (`overlay/floating-host.ts`) owns position, visibility, `data-placement`,
 * and the `--bldr-arrow-x` custom property, writing them straight to the DOM
 * so canvas scrolling never renders a component. React portals THIS component
 * into the host's element and concerns itself only with what the buttons are
 * and which are pressed — the two halves of a floating bar must not share a
 * rhythm.
 *
 * RISK 2 (research R3 — the one every prior implementation hit): activating a
 * formatting action must NEVER move focus out of the editor, or Bold destroys
 * the very selection it formats. The press is cancelled at pointer-down (and
 * mouse-down, for the compatibility path) on the WHOLE bubble, and the click
 * never propagates to the canvas selection path (risk 9). Commands run on
 * click; keyboard activation therefore leaves focus on the button, where the
 * `aria-pressed` change is actually announced — the ToolbarButton lesson.
 */
function insidePrompt(target: EventTarget): boolean {
  return target instanceof Element && target.closest('.bldr-text-bubble__prompt') !== null;
}

export function TextBubble({ dir, actions, onReturnFocus, prompt, label = 'Formatting' }: TextBubbleProps) {
  return (
    <div
      className="bldr-text-bubble"
      role="group"
      aria-label={label}
      dir={dir}
      onPointerDown={(event) => {
        event.stopPropagation();
        // RISK 2: the editor keeps its focus, caret, and selection — except in
        // the prompt's own field, which must be able to take focus to type.
        if (!insidePrompt(event.target)) event.preventDefault();
      }}
      onMouseDown={(event) => {
        // Compatibility path (no PointerEvent, or a browser that fires both).
        event.stopPropagation();
        if (!insidePrompt(event.target)) event.preventDefault();
      }}
      onClick={(event) => {
        // RISK 9: the canvas selection path never sees layer-origin clicks.
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        const group = event.currentTarget;
        const activeElement = group.ownerDocument.activeElement;
        if (activeElement === null || !group.contains(activeElement)) {
          return;
        }
        const returnsFromChrome =
          event.key === 'Escape' ||
          (event.key === 'Tab' && event.shiftKey && activeElement === firstEnabledAction(group));
        if (!returnsFromChrome || !onReturnFocus()) {
          return;
        }
        // This host-document Escape must not bubble through the React portal to
        // EditorCanvas and close the session. It returns to the editor first;
        // Escape there retains the established session-exit behavior.
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {prompt !== undefined ? <TextBubblePrompt prompt={prompt} /> : null}
      {prompt !== undefined ? null : actions.map((action) =>
        action.pressed === undefined ? (
          <ChromeButton
            key={action.id}
            className="bldr-text-bubble__action"
            disabled={action.disabled === true}
            size="lg"
            variant="quiet"
            onClick={() => {
              action.run();
            }}
          >
            {action.label}
          </ChromeButton>
        ) : (
          <ChromeButton
            key={action.id}
            className="bldr-text-bubble__action"
            disabled={action.disabled === true}
            size="lg"
            variant="toggle"
            aria-pressed={action.pressed}
            onClick={() => {
              action.run();
            }}
          >
            {action.label}
          </ChromeButton>
        ),
      )}
      {/* The pointer: positioned by the host's --bldr-arrow-x, flipped by its
          data-placement — pure CSS, no geometry in this component. */}
      <span aria-hidden="true" className="bldr-text-bubble__arrow" />
    </div>
  );
}
