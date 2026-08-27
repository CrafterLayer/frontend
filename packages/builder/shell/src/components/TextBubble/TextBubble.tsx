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
export function TextBubble({ dir, actions }: TextBubbleProps) {
  return (
    <div
      className="bldr-text-bubble"
      role="group"
      aria-label="Formatting"
      dir={dir}
      onPointerDown={(event) => {
        // RISK 2: the editor keeps its focus, caret, and selection.
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        // Compatibility path (no PointerEvent, or a browser that fires both).
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        // RISK 9: the canvas selection path never sees layer-origin clicks.
        event.stopPropagation();
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="bldr-text-bubble__action"
          disabled={action.disabled === true}
          {...(action.pressed === undefined ? {} : { 'aria-pressed': action.pressed })}
          onClick={() => {
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
      {/* The pointer: positioned by the host's --bldr-arrow-x, flipped by its
          data-placement — pure CSS, no geometry in this component. */}
      <span aria-hidden="true" className="bldr-text-bubble__arrow" />
    </div>
  );
}
