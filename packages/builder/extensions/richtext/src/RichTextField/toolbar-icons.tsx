import type { ReactNode } from 'react';

/**
 * The builder's house glyph: the same 16px grid and stroke language documented
 * by apps/playground/src/app/rail-sections.tsx. These stay local because that
 * host-owned icon set is deliberately not a package API.
 */
function glyph(paths: string): ReactNode {
  return (
    <svg
      width="17"
      height="17"
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

const BOLD =
  '<path d="M4 2.5h4.2a2.5 2.5 0 0 1 0 5H4z"/>' + '<path d="M4 7.5h4.8a3 3 0 0 1 0 6H4z"/>';
const ITALIC = '<path d="M9.5 2.5h3M3.5 13.5h3M9.5 2.5l-3 11"/>';
const HEADING_2 =
  '<path d="M2.5 3v10M8 3v10M2.5 8H8"/>' +
  '<path d="M10.5 7a1.5 1.5 0 1 1 3 0c0 1.4-3 2.4-3 4h3"/>';
const HEADING_3 =
  '<path d="M2.5 3v10M8 3v10M2.5 8H8"/>' +
  '<path d="M10.7 6.2c.6-.9 2.8-.7 2.8.7 0 .8-.6 1.2-1.4 1.2.9 0 1.6.5 1.6 1.4 0 1.6-2.5 1.9-3.3.8"/>';
const BULLETED_LIST = '<path d="M3 4h.01M3 8h.01M3 12h.01"/>' + '<path d="M6 4h7M6 8h7M6 12h7"/>';
const NUMBERED_LIST =
  '<path d="m2.5 3.5.9-.4v3M2.4 6.1h1.9"/>' +
  '<path d="M2.4 9.5a1 1 0 1 1 2 0c0 .8-2 1.5-2 2.5h2"/>' +
  '<path d="M7 4h6M7 8h6M7 12h6"/>';
const LINK =
  '<path d="m6.2 10.6-1.3 1.3a2.1 2.1 0 0 1-3-3l2-2a2.1 2.1 0 0 1 3 0"/>' +
  '<path d="m9.8 5.4 1.3-1.3a2.1 2.1 0 1 1 3 3l-2 2a2.1 2.1 0 0 1-3 0"/>' +
  '<path d="m6 10 4-4"/>';
const CLEAR_FORMATTING =
  '<path d="m3 10.8 6.7-6.7a1.4 1.4 0 0 1 2 0l1.2 1.2a1.4 1.4 0 0 1 0 2L7.2 13H3z"/>' +
  '<path d="m7.7 6.1 3 3M9.5 13h4"/>';

export const TOOLBAR_ICONS = {
  bold: glyph(BOLD),
  italic: glyph(ITALIC),
  heading2: glyph(HEADING_2),
  heading3: glyph(HEADING_3),
  bulletList: glyph(BULLETED_LIST),
  orderedList: glyph(NUMBERED_LIST),
  link: glyph(LINK),
  clearFormatting: glyph(CLEAR_FORMATTING),
} as const;
