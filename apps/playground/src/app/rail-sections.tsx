import type { RailItem } from '@craftkit/builder';

/**
 * The rail's own icon set. They live here rather than in the shell because a
 * host decides what its sections ARE — the rail places whatever it is handed
 * and knows nothing about blocks, layers or assets.
 *
 * One consistent style: 16px grid, 1.5 stroke, round caps, `currentColor` so
 * every glyph takes the rail's text colour and its active state for free.
 */
function glyph(paths: string) {
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

const BLOCKS =
  '<rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1.2"/>' +
  '<rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1.2"/>' +
  '<rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1.2"/>' +
  '<rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1.2"/>';
const LAYERS = '<path d="M8 2.2 14 5.5 8 8.8 2 5.5z"/><path d="M2 8.7 8 12l6-3.3"/>';
const ASSETS =
  '<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6"/>' +
  '<circle cx="6" cy="6.6" r="1.1"/><path d="m3 11.5 3.2-3 2.4 2.2 2-1.8L13.8 11"/>';
const CODE = '<path d="m5.4 5-3 3 3 3M10.6 5l3 3-3 3"/>';
const SETTINGS =
  '<circle cx="8" cy="8" r="2.1"/>' +
  '<path d="M8 1.9v1.6M8 12.5v1.6M13 5.2l-1.4.8M4.4 10l-1.4.8M13 10.8l-1.4-.8M4.4 6l-1.4-.8"/>';
const ASSISTANT =
  '<path d="M8 2.4 9.3 6l3.6 1.3-3.6 1.3L8 12.2 6.7 8.6 3.1 7.3 6.7 6z"/>' +
  '<path d="M12.6 11.4 13 12.7l1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4z"/>';
const HELP =
  '<circle cx="8" cy="8" r="5.8"/>' +
  '<path d="M6.4 6.3a1.7 1.7 0 0 1 3.3.5c0 1.1-1.7 1.4-1.7 2.5"/><path d="M8 11.6h.01"/>';

export const RAIL_SECTIONS: readonly RailItem[] = [
  { id: 'blocks', label: 'Blocks', icon: glyph(BLOCKS) },
  { id: 'layers', label: 'Layers', icon: glyph(LAYERS) },
  { id: 'assets', label: 'Assets', icon: glyph(ASSETS) },
  { id: 'code', label: 'Code', icon: glyph(CODE) },
  { id: 'assistant', label: 'Assistant', icon: glyph(ASSISTANT) },
];

export const RAIL_UTILITIES: readonly RailItem[] = [
  { id: 'settings', label: 'Settings', icon: glyph(SETTINGS) },
  { id: 'help', label: 'Help', icon: glyph(HELP) },
];
