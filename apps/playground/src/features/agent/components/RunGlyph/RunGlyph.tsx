import type { ReactElement } from 'react';

import './RunGlyph.css';
import type { RunGlyphState } from './run-glyph-state';

export interface RunGlyphProps {
  readonly state: RunGlyphState;
  /**
   * Play the arrival motion (SPEC §5 moments 1 and 3) when a state's marks appear: the
   * disc inks in and the check settles from 0.6 over 360ms; a draft's core fades in over
   * 120ms. A live build passes `true`; a record restored from history leaves it off, so a
   * thread of finished builds does not flicker on load. Keep it stable for a row's life:
   * turning it on later replays the arrival.
   */
  readonly animate?: boolean | undefined;
  /** Appended to `ck-agent-glyph`. */
  readonly className?: string | undefined;
}

/*
  The shapes, on a 16px box around a 12px node (SPEC §4.7). Geometry only: every colour is
  in RunGlyph.css, keyed on `data-state`, so the markup alone tells the states apart (the
  shape test strips colour and still finds nine), and so does high-contrast mode.

  Module-level and keyed, so React keeps a node for as long as a state change keeps its
  key: the ring is one element from waiting to landed, which is what lets a landing cross-
  fade (the disc inks in over a ring that never left) instead of swapping one drawing for
  another. Stroke widths are geometry, and stay here.
*/

/** The 2px Paper ring every node carries, so a spine appears to run into it. */
const ground = <circle key="ground" className="ck-agent-glyph__ground" cx="8" cy="8" r="8" />;

/** The node: a 1.5px ring whose outer edge is the 12px node. */
const ring = (
  <circle key="ring" className="ck-agent-glyph__ring" cx="8" cy="8" r="5.25" strokeWidth="1.5" />
);

/**
 * Not on the page: the same ring, dashed 2 on 2. `pathLength` 32 makes the circumference a
 * whole number of dashes, so the pattern closes without a seam at three o'clock.
 */
const dashedRing = (
  <circle
    key="ring"
    className="ck-agent-glyph__ring"
    cx="8"
    cy="8"
    r="5.25"
    strokeWidth="1.5"
    pathLength="32"
    strokeDasharray="2 2"
    strokeLinecap="butt"
  />
);

/** A quarter of the ring, from twelve to three o'clock; RunGlyph.css turns it clockwise. */
const spinner = (
  <g key="spin" className="ck-agent-glyph__spin">
    <path
      className="ck-agent-glyph__arc"
      d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </g>
);

/** Drafted: the core of ◎. The ring stays an outline, "written, not yet ink". */
const core = <circle key="core" className="ck-agent-glyph__core" cx="8" cy="8" r="2" />;

/** Ink: the full 12px disc. */
const disc = <circle key="disc" className="ck-agent-glyph__disc" cx="8" cy="8" r="6" />;

const check = (
  <path
    key="check"
    className="ck-agent-glyph__mark"
    d="M5.4 8.15 7.15 9.9 10.6 6.35"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const cross = (
  <path
    key="cross"
    className="ck-agent-glyph__mark"
    d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5"
    strokeWidth="1.5"
    strokeLinecap="round"
  />
);

/**
 * Partial: a 6px dot on the disc's edge at block-start / inline-end, inside a 2px Paper
 * ring. The ring separates it, not the colour: Alarm on Indigo is 1.21:1. It overhangs the
 * 16px box by 1.25px; the head leaves 8px before the title.
 */
const badge = (
  <g key="badge" className="ck-agent-glyph__badge" data-mirror="">
    <circle className="ck-agent-glyph__badge-ground" cx="12.25" cy="3.75" r="5" />
    <circle className="ck-agent-glyph__badge-dot" cx="12.25" cy="3.75" r="3" />
  </g>
);

/** Awaiting a decision: a 10px diamond, outlined. */
const diamond = (
  <path
    key="diamond"
    className="ck-agent-glyph__diamond"
    d="M8 3 13 8 8 13 3 8z"
    strokeWidth="1.5"
    strokeLinejoin="round"
  />
);

/** An answer: three lines 8, 10 and 6px long, ragged at the reading end like prose. */
const lines = (
  <path
    key="lines"
    className="ck-agent-glyph__lines"
    data-mirror=""
    d="M3.75 4.75h6.5M3.75 8h8.5M3.75 11.25h4.5"
    strokeWidth="1.5"
    strokeLinecap="round"
  />
);

const SHAPES = {
  waiting: [ground, ring],
  working: [ground, ring, spinner],
  drafted: [ground, ring, core],
  landed: [ground, ring, disc, check],
  absent: [ground, dashedRing],
  failed: [ground, ring, disc, cross],
  partial: [ground, ring, disc, check, badge],
  decision: [ground, diamond],
  note: [ground, lines],
} as const satisfies Readonly<Record<RunGlyphState, readonly ReactElement[]>>;

/**
 * The status node (SPEC §4.7): 16px box, 12px node, static SVG. Always `aria-hidden`: the
 * state is said in words by the record or row that carries it (its title, or its
 * accessible name), never by the glyph, and never by colour alone.
 *
 * On a Sheet surface (a decision card), set `--ck-agent-ground: var(--bldr-surface)` on
 * the card so the node's ring matches the card instead of the panel.
 */
export function RunGlyph({ state, animate = false, className }: RunGlyphProps) {
  return (
    <svg
      className={className === undefined ? 'ck-agent-glyph' : `ck-agent-glyph ${className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-state={state}
      data-animate={animate ? '' : undefined}
    >
      {SHAPES[state]}
    </svg>
  );
}
