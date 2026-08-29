/**
 * The assistant's own glyphs — 16px grid, 1.5 stroke, round caps, `currentColor`,
 * the same recipe the rail's icon set uses (`apps/playground/src/app/rail-sections.tsx`),
 * so a proposal card and the rail tab it lives under read as one visual language.
 * Every glyph is decorative: the button or line it sits in already carries the
 * accessible name, so each one renders `aria-hidden`.
 */

interface IconProps {
  readonly paths: string;
}

function Icon({ paths }: IconProps) {
  return (
    <svg
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
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}

// Identical path data to the rail's ASSISTANT glyph — the same mark carries the
// tab and every message in the thread it opens onto.
const SPARKLE =
  '<path d="M8 2.4 9.3 6l3.6 1.3-3.6 1.3L8 12.2 6.7 8.6 3.1 7.3 6.7 6z"/>' +
  '<path d="M12.6 11.4 13 12.7l1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4z"/>';
const PLUS = '<path d="M8 3v10M3 8h10"/>';
const SEND = '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>';
const CHECK = '<path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>';
const CLOSE = '<path d="M4 4l8 8M12 4l-8 8"/>';
const UNDO = '<path d="M4.5 7.5A4.5 4.5 0 1 1 5 12"/><path d="M4.5 4v3.5H8"/>';
// Shared with the rail's CODE tab glyph — "Review as code" hands off to that tab.
const CODE = '<path d="m5.4 5-3 3 3 3M10.6 5l3 3-3 3"/>';
const ALERT = '<path d="M8 2.6 14 13H2z"/><path d="M8 6.4v3M8 11.4h.01"/>';
const SHIELD =
  '<path d="M8 2.2 13 4v4.2c0 3.4-2.3 5.7-5 6.6-2.7-.9-5-3.2-5-6.6V4z"/>' +
  '<path d="M5.8 8 7.3 9.5l3-3.2"/>';
const CHEVRON = '<path d="M4 6.2 8 10l4-3.8"/>';

export const IconSparkle = () => <Icon paths={SPARKLE} />;
export const IconPlus = () => <Icon paths={PLUS} />;
export const IconSend = () => <Icon paths={SEND} />;
export const IconCheck = () => <Icon paths={CHECK} />;
export const IconClose = () => <Icon paths={CLOSE} />;
export const IconUndo = () => <Icon paths={UNDO} />;
export const IconCode = () => <Icon paths={CODE} />;
export const IconAlert = () => <Icon paths={ALERT} />;
export const IconShield = () => <Icon paths={SHIELD} />;
export const IconChevron = () => <Icon paths={CHEVRON} />;
