/**
 * The agent panel's glyphs (SPEC §4.21), as static JSX.
 *
 * Every glyph is a module-level React element, created once. React compares a re-render's
 * `<path d>` prop by prop, finds nothing changed and leaves the DOM node alone, so the node
 * under a pointer survives any re-render of the button around it. The v1 set wrote its
 * glyphs through `dangerouslySetInnerHTML` with a fresh `{ __html }` object per render;
 * React compares that object by identity, rewrote the innerHTML on every render, and a
 * re-render between pointerdown and pointerup (the composer re-renders as the textarea
 * blurs) replaced the path under the pointer. The browser then had no common target for
 * the press and fired no click: the first press on Send was lost (visual audit P0-1).
 *
 * The drawing recipe is the rail's: a 16px grid, a 1.5px stroke, round caps and joins,
 * `currentColor` (set once on the `<svg>` by AgentIcon), and a live area of 2 to 14 so a
 * stroke never touches the box edge. Filled marks (the ⋯ dots, the drag handle, Stop)
 * set their own `fill`, still `currentColor`.
 *
 * Paths are redrawn for this grid from Lucide's icons (https://lucide.dev), ISC License:
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather
 * (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose with
 * or without fee is hereby granted, provided that the above copyright notice and this
 * permission notice appear in all copies.
 *
 * `mirror` marks the directional glyphs SPEC §4.21 lists (disclosure chevron, the
 * before → after arrow, undo, redo, back, queue ↵, the sheet's ⤓ and ⤒); AgentIcon stamps
 * `data-mirror` on them and its stylesheet flips them under `:dir(rtl)`. Send ↑, Stop ■,
 * the clock, the spinner (always clockwise) and the drag handle never mirror.
 */
import type { ReactElement } from 'react';

export interface IconDefinition {
  /** The glyph's shapes, drawn on the 16px grid. */
  readonly shapes: ReactElement;
  /** Flip under RTL: the glyph points along the reading direction. */
  readonly mirror: boolean;
}

const dot = (cx: number, cy: number): ReactElement => (
  <circle
    key={`${String(cx)},${String(cy)}`}
    cx={cx}
    cy={cy}
    r="1.25"
    fill="currentColor"
    stroke="none"
  />
);

export const ICONS = {
  /* ── Header ─────────────────────────────────────────────────────────────── */

  /** Conversations `[◷]`: a clock face with the arrow of time turned back. */
  history: {
    shapes: (
      <>
        <path d="M2 8a6 6 0 1 0 6-6 6.5 6.5 0 0 0-4.49 1.83L2 5.33" />
        <path d="M2 2v3.33h3.33" />
        <path d="M8 4.67V8l2.67 1.33" />
      </>
    ),
    mirror: false,
  },
  /** New conversation `[+]`. */
  plus: { shapes: <path d="M8 3.5v9M3.5 8h9" />, mirror: false },
  /** Close `[×]`, and a chip's remove. */
  close: { shapes: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />, mirror: false },
  /** A record's `[⋯]` menu. */
  more: { shapes: <>{[dot(3.5, 8), dot(8, 8), dot(12.5, 8)]}</>, mirror: false },

  /* ── History actions ────────────────────────────────────────────────────── */

  /**
   * Undo: a hooked arrow turning back toward the reading start. A hook, not the ↺ circle
   * the ASCII frames approximate: a circle with an arrowhead is the Conversations clock
   * without its hands, and two neighbouring glyphs must not differ by two strokes.
   */
  undo: {
    shapes: (
      <>
        <path d="M5.75 3.25 3 6l2.75 2.75" />
        <path d="M3 6h6.75a3.25 3.25 0 0 1 0 6.5H6.5" />
      </>
    ),
    mirror: true,
  },
  /** Redo: undo, reflected. */
  redo: {
    shapes: (
      <>
        <path d="M10.25 3.25 13 6l-2.75 2.75" />
        <path d="M13 6H6.25a3.25 3.25 0 0 0 0 6.5H9.5" />
      </>
    ),
    mirror: true,
  },
  /** Retry a section: once round, clockwise. Not mirrored: a refresh has no reading direction. */
  retry: {
    shapes: (
      <>
        <path d="M14 8a6 6 0 1 1-6-6c1.68 0 3.29.67 4.49 1.83L14 5.33" />
        <path d="M14 2v3.33h-3.33" />
      </>
    ),
    mirror: false,
  },

  /* ── Composer ───────────────────────────────────────────────────────────── */

  /** Send `[↑]`: up, in every script. */
  send: { shapes: <path d="M8 12.75V3.5M3.75 7.75 8 3.5l4.25 4.25" />, mirror: false },
  /** Queue as next `[↵]`: the return key's corner, which points back to the reading start. */
  queue: {
    shapes: (
      <>
        <path d="M6 6.5 2.75 9.75 6 13" />
        <path d="M13.25 2.75v4.5a2.5 2.5 0 0 1-2.5 2.5h-8" />
      </>
    ),
    mirror: true,
  },
  /** Queued `[✓]`, and the selected option in a radio menu. Never "on the page": that is RunGlyph's. */
  check: { shapes: <path d="M3.5 8.5l3 3 6-7" />, mirror: false },
  /**
   * Stop `[■]`: a filled square. At 16px an outlined square reads as a checkbox; filled,
   * it reads as the transport control it is.
   */
  stop: {
    shapes: (
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    ),
    mirror: false,
  },
  /** Stopping: three quarters of a ring. AgentIcon.css turns it, clockwise in both directions. */
  spinner: { shapes: <path d="M8 2.75a5.25 5.25 0 1 1-5.25 5.25" />, mirror: false },
  /** Mention a section `[@]`. */
  mention: {
    shapes: (
      <>
        <circle cx="8" cy="8" r="2.5" />
        <path d="M10.5 5.5v3a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.4 4.8" />
      </>
    ),
    mirror: false,
  },
  /** A menu trigger's ▾. */
  chevronDown: { shapes: <path d="M4.5 6.25 8 9.75l3.5-3.5" />, mirror: false },

  /* ── Records and cards ──────────────────────────────────────────────────── */

  /**
   * A closed disclosure ▸, pointing along the reading direction. To open it, rotate it with
   * `transform: rotate(90deg)`: the mirror uses the `scale` property, so the two compose
   * and the open chevron points down in both directions.
   */
  disclosure: { shapes: <path d="M6.25 4.5 9.75 8l-3.5 3.5" />, mirror: true },
  /** The before → after arrow of a change line. */
  arrowEnd: { shapes: <path d="M3.25 8h9.5M9 4.25 12.75 8 9 11.75" />, mirror: true },
  /** Jump to the latest `↓`. */
  arrowDown: { shapes: <path d="M8 3.25v9.5M4.25 9 8 12.75 11.75 9" />, mirror: false },
  /** The proposal's Preview toggle `[◫]`: the page, split by what would change. */
  preview: {
    shapes: (
      <>
        <rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.75" />
        <path d="M8 3.25v9.5" />
      </>
    ),
    mirror: false,
  },
  /** The composer's free-code switch `</>`: code the agent writes outright. Never mirrors. */
  code: {
    shapes: (
      <>
        <path d="M10.5 11.5 14 8l-3.5-3.5" />
        <path d="M5.5 4.5 2 8l3.5 3.5" />
      </>
    ),
    mirror: false,
  },
  /** The plan's mood field `[✎]`. */
  pencil: {
    shapes: (
      <>
        <path d="M11 2.75a1.77 1.77 0 1 1 2.5 2.5L6 12.75l-3.25.75.75-3.25z" />
        <path d="M9.75 4 12 6.25" />
      </>
    ),
    mirror: false,
  },
  /** A plan row's drag handle `⠿`: two columns of three dots. */
  grip: {
    shapes: <>{[dot(6, 4), dot(10, 4), dot(6, 8), dot(10, 8), dot(6, 12), dot(10, 12)]}</>,
    mirror: false,
  },
  /** A block chip `▭`. */
  block: {
    shapes: <rect x="2.75" y="4.25" width="10.5" height="7.5" rx="1.5" />,
    mirror: false,
  },
  /** The "Whole page" scope chip. */
  page: {
    shapes: (
      <>
        <path d="M9.25 2.75H4.75a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1v-6.5z" />
        <path d="M9.25 2.75v3h3" />
      </>
    ),
    mirror: false,
  },

  /* ── Creative starters and the creative brief (creative agent, 2026-10-12) ── */

  /** A game: a controller's body, its cross pad and two buttons. Never mirrors. */
  game: {
    shapes: (
      <>
        <rect x="2" y="4.75" width="12" height="7" rx="3" />
        <path d="M5.25 7v2.5M4 8.25h2.5" />
        {[dot(10.25, 7.5), dot(11.75, 9.25)]}
      </>
    ),
    mirror: false,
  },
  /** A story with dialogue: two speech balloons. Never mirrors (the tails are not a direction). */
  dialogue: {
    shapes: (
      <>
        <path d="M2.75 3.5h6.5a1 1 0 0 1 1 1v3.25a1 1 0 0 1-1 1H5.5L3.5 10.5V8.75h-.75a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
        <path d="M12.25 6.5h.75a1 1 0 0 1 1 1v3.25a1 1 0 0 1-1 1h-.5v1.75l-2-1.75H8.25" />
      </>
    ),
    mirror: false,
  },
  /** A bedtime story: a crescent moon. */
  moon: {
    shapes: <path d="M12.75 9.75A5.25 5.25 0 1 1 6.25 3.25a4.25 4.25 0 0 0 6.5 6.5z" />,
    mirror: false,
  },
  /** The creative brief: a bound book with a ribbon line. */
  book: {
    shapes: (
      <>
        <path d="M3.25 12.75V3.75a1 1 0 0 1 1-1h8.5v8.5h-8.5a1 1 0 0 0-1 1.5" />
        <path d="M3.25 12.75a1 1 0 0 0 1 .5h8.5v-2" />
        <path d="M6 5.75h4" />
      </>
    ),
    mirror: false,
  },

  /** Skills & memory: what the Agent knows (2026-10-12). A spark and a plus. */
  skills: {
    shapes: (
      <>
        <path d="M6.75 2.75 7.9 5.6l2.85 1.15L7.9 7.9 6.75 10.75 5.6 7.9 2.75 6.75 5.6 5.6Z" />
        <path d="M11.75 9.5v3.75M9.88 11.38h3.75" />
      </>
    ),
    mirror: false,
  },

  /* ── Conversations and the phone sheet ──────────────────────────────────── */

  /** Search conversations. */
  search: {
    shapes: (
      <>
        <circle cx="7.25" cy="7.25" r="4.25" />
        <path d="M13 13l-2.75-2.75" />
      </>
    ),
    mirror: false,
  },
  /** Delete a conversation. */
  trash: {
    shapes: (
      <>
        <path d="M3 4.75h10" />
        <path d="M6.25 4.75V3.5a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25" />
        <path d="M4.5 4.75l.55 7.65a1 1 0 0 0 1 .85h3.9a1 1 0 0 0 1-.85l.55-7.65" />
      </>
    ),
    mirror: false,
  },
  /** The phone history's back button: a chevron toward the reading start. */
  back: { shapes: <path d="M9.75 4.5 6.25 8l3.5 3.5" />, mirror: true },
  /** Show the page `[⤓]`: drop the sheet to its mini detent. */
  showPage: {
    shapes: <path d="M8 2.75v7M4.75 6.5 8 9.75l3.25-3.25M3.25 13h9.5" />,
    mirror: true,
  },
  /** Back to the chat `[⤒]`: raise the sheet to full. */
  backToChat: {
    shapes: <path d="M3.25 3h9.5M8 13.25v-7M4.75 9.5 8 6.25l3.25 3.25" />,
    mirror: true,
  },
  // agent-panel redesign (2026-10-12): the compact composer chips and the settings modal.
  /** Mode: how the next request may touch the page (Lucide `zap`). */
  bolt: { shapes: <path d="M8.75 2.25 3.5 9h4l-.5 4.75L12.5 7h-4l.25-4.75Z" />, mirror: false },
  /** Model: who writes the request (Lucide `cpu`). */
  cpu: {
    shapes: (
      <>
        <rect x="4" y="4" width="8" height="8" rx="1.25" />
        <path d="M6.5 6.5h3v3h-3zM6.5 2v2M9.5 2v2M6.5 12v2M9.5 12v2M2 6.5h2M2 9.5h2M12 6.5h2M12 9.5h2" />
      </>
    ),
    mirror: false,
  },
  /** Effort: how long the model may think (Lucide `gauge`). */
  gauge: {
    shapes: (
      <>
        <path d="M2.75 11.25a5.25 5.25 0 1 1 10.5 0" />
        <path d="M8 11.25 10.5 7" />
      </>
    ),
    mirror: false,
  },
  /** Workers: sections built side by side (Lucide `users`). */
  users: {
    shapes: (
      <>
        <circle cx="6" cy="5.5" r="2.25" />
        <path d="M2.25 13a3.75 3.75 0 0 1 7.5 0" />
        <path d="M10.5 3.5a2.25 2.25 0 0 1 0 4.25M11.5 9.6A3.75 3.75 0 0 1 13.75 13" />
      </>
    ),
    mirror: false,
  },
  /** Background jobs (2026-10-12): pages stacked, sent as one batch (Lucide `layers`). */
  layers: {
    shapes: (
      <>
        <path d="M8 2.5 13.5 5.25 8 8 2.5 5.25Z" />
        <path d="M2.5 8 8 10.75 13.5 8" />
        <path d="M2.5 10.75 8 13.5l5.5-2.75" />
      </>
    ),
    mirror: false,
  },
  /** Settings: the knowledge modal's general section (Lucide `settings-2`). */
  sliders: {
    shapes: (
      <path d="M10.5 4.5h-7M12.5 11.5h-7M9 4.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M4 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" />
    ),
    mirror: false,
  },
} as const satisfies Readonly<Record<string, IconDefinition>>;

/** Every glyph's name. */
export type AgentIconName = keyof typeof ICONS;

/** Every glyph's name, in declaration order: what a gallery or a test iterates. */
export const AGENT_ICON_NAMES = Object.keys(ICONS) as readonly AgentIconName[];
