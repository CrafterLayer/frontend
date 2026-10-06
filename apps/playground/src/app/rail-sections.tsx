import type { ReactNode } from 'react';

import type { RailItem } from '@craftkit/builder';

/**
 * The rail's own icon set. They live here rather than in the shell because a
 * host decides what its sections ARE — the rail places whatever it is handed
 * and knows nothing about blocks, layers or assets.
 *
 * One consistent style: 16px grid, 1.5 stroke, round caps, `currentColor` so
 * every glyph takes the rail's text colour and its active state for free.
 *
 * STATIC JSX, built once at module load. The glyphs used to be strings handed to
 * `dangerouslySetInnerHTML`, whose `{ __html }` object is new on every render: React
 * then rewrites the SVG's children on every render of the rail, and a render that lands
 * between pointerdown and click replaces the node under the pointer, so the click never
 * arrives. The same bug swallowed the first click on the assistant's Send (SPEC §4.21,
 * visual audit P0-1). An element built once is the same node on every render.
 */
function glyph(shapes: ReactNode) {
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
    >
      {shapes}
    </svg>
  );
}

const BLOCKS = glyph(
  <>
    <rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1.2" />
    <rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1.2" />
    <rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1.2" />
    <rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1.2" />
  </>,
);
const LAYERS = glyph(
  <>
    <path d="M8 2.2 14 5.5 8 8.8 2 5.5z" />
    <path d="M2 8.7 8 12l6-3.3" />
  </>,
);
const ASSETS = glyph(
  <>
    <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6" />
    <circle cx="6" cy="6.6" r="1.1" />
    <path d="m3 11.5 3.2-3 2.4 2.2 2-1.8L13.8 11" />
  </>,
);
const CODE = glyph(<path d="m5.4 5-3 3 3 3M10.6 5l3 3-3 3" />);
const SETTINGS = glyph(
  <>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.9v1.6M8 12.5v1.6M13 5.2l-1.4.8M4.4 10l-1.4.8M13 10.8l-1.4-.8M4.4 6l-1.4-.8" />
  </>,
);
const ASSISTANT = glyph(
  <>
    <path d="M8 2.4 9.3 6l3.6 1.3-3.6 1.3L8 12.2 6.7 8.6 3.1 7.3 6.7 6z" />
    <path d="M12.6 11.4 13 12.7l1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4z" />
  </>,
);
/* A page stack with a spark: a whole site, built. */
const SITE = glyph(
  <>
    <rect x="2.2" y="2.6" width="8.4" height="6.2" rx="1.3" />
    <path d="M4.6 11.2h6.2M4.6 13.4h4" />
    <path d="M12.6 2.2 13.2 4l1.8.6-1.8.6-.6 1.8-.6-1.8L10.2 4.6 12 4z" />
  </>,
);
/* A swatch fan: the site's colours, type and named styles (style-manager DESIGN §G). */
const DESIGN = glyph(
  <>
    <path d="M3 13.5V3.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7v10.3a2.5 2.5 0 0 1-5 0Z" />
    <path d="m8 5.2 2.6-2.6c.3-.3.7-.3 1 0l2.5 2.5c.3.3.3.7 0 1L8 12.3" />
    <path d="M5.5 13.5h8.3c.4 0 .7-.3.7-.7V9.7c0-.4-.3-.7-.7-.7h-2.4" />
    <circle cx="5.5" cy="13.5" r=".6" />
  </>,
);
const HELP = glyph(
  <>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M6.4 6.3a1.7 1.7 0 0 1 3.3.5c0 1.1-1.7 1.4-1.7 2.5" />
    <path d="M8 11.6h.01" />
  </>,
);

export const RAIL_SECTIONS: readonly RailItem[] = [
  { id: 'blocks', label: 'Blocks', icon: BLOCKS },
  { id: 'pages', label: 'Pages', icon: SITE },
  { id: 'layers', label: 'Layers', icon: LAYERS },
  { id: 'assets', label: 'Assets', icon: ASSETS },
  /* The design system, named styles, symbols and design-library transfer (style-manager §G). */
  { id: 'design', label: 'Design', icon: DESIGN },
  { id: 'code', label: 'Code', icon: CODE },
  { id: 'assistant', label: 'Assistant', icon: ASSISTANT },
  /*
    ITS OWN DESTINATION, not a card in the assistant.

    It lived above the conversation for one afternoon and the first person to
    use it said the thread and their own typing had become hard to tell apart —
    which was true: a three-line form, a hint, a status line and an outcome sat
    permanently between the header and the messages, and the messages got
    whatever was left. A site build is not a message in a conversation; it is a
    job with its own progress and its own Stop, and jobs get their own place.
  */
  { id: 'site', label: 'Site', icon: SITE },
];

export const RAIL_UTILITIES: readonly RailItem[] = [
  { id: 'settings', label: 'Settings', icon: SETTINGS },
  { id: 'help', label: 'Help', icon: HELP },
];

/** The rail's items named in the editor's language (arabic-editor); an unnamed id keeps its label. */
export function railItemsIn(
  items: readonly RailItem[],
  names: Readonly<Record<string, string>>,
): readonly RailItem[] {
  return items.map((item) => ({ ...item, label: names[item.id] ?? item.label }));
}
