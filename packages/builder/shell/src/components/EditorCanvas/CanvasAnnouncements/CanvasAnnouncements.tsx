import '../../../styles/visually-hidden.css';

/** One polite message and its nonce: a repeat must still change the region's text. */
export interface CanvasAnnouncement {
  text: string;
  nonce: number;
}

export interface CanvasAnnouncementsProps {
  /** What is selected ("Selected: Hero"), re-announced on every selection change. */
  selection: CanvasAnnouncement;
  /** The last gesture outcome ("Moved after Pricing", "Already last"). */
  gesture: CanvasAnnouncement;
  /** Accessible name of the selection region. */
  selectionLabel: string;
  /** Accessible name of the gesture region. */
  gestureLabel: string;
}

/** A zero-width space on odd nonces: the text node changes even when the words do not. */
function toggle(nonce: number): string {
  return nonce % 2 === 1 ? '​' : '';
}

/**
 * The canvas's two polite live regions, visually hidden. A live region
 * announces DOM mutations, not semantic equality, so each message carries a
 * nonce: moving from one "Text" block to another, or a REPEATED outcome
 * ("Already last" twice), still mutates the region and assistive technology
 * hears it again.
 */
export function CanvasAnnouncements({
  selection,
  gesture,
  selectionLabel,
  gestureLabel,
}: CanvasAnnouncementsProps) {
  return (
    <>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label={selectionLabel}>
        {selection.text}
        {toggle(selection.nonce)}
      </output>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label={gestureLabel}>
        {gesture.text}
        {toggle(gesture.nonce)}
      </output>
    </>
  );
}
