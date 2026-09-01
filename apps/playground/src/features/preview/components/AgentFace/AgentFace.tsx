/**
 * أبو غضب — the assistant's face. Purely visual and stateless: it never renders
 * text, never takes or moves focus, and always sits inside an aria-hidden
 * wrapper. Every feature is always in the DOM; a mood selects with opacity and
 * transform only — never `display`, never a path's `d` — so a mood change is a
 * transition, not a swap, in every engine. The brows do the acting.
 */
import './AgentFace.css';

import type { AgentMood, AgentMoodOutcome, AgentMoodVariant } from './agent-mood';

export type AgentFaceSize = 'sm' | 'md' | 'lg';

export interface AgentFaceProps {
  mood: AgentMood;
  /** `planning` only. */
  variant?: AgentMoodVariant | undefined;
  /** `done` only. */
  outcome?: AgentMoodOutcome | undefined;
  /** The listening nudge; drives `data-typing` and nothing else. */
  typing?: boolean | undefined;
  /** Default `'md'`. */
  size?: AgentFaceSize | undefined;
  /** Default `false`; `true` enables loops and one-shots. Only the header face passes it. */
  live?: boolean | undefined;
  className?: string | undefined;
}

export function AgentFace({
  mood,
  variant,
  outcome,
  typing = false,
  size = 'md',
  live = false,
  className,
}: AgentFaceProps) {
  return (
    <span
      className={className === undefined ? 'pg-face' : `pg-face ${className}`}
      data-mood={mood}
      data-variant={mood === 'planning' ? variant : undefined}
      data-outcome={mood === 'done' ? outcome : undefined}
      data-size={size}
      data-live={live ? '' : undefined}
      data-typing={typing ? '' : undefined}
    >
      <svg
        className="pg-face__svg"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden="true"
      >
        <circle className="pg-face__ring" cx={16} cy={16} r={14} pathLength={100} />
        <path className="pg-face__tick" d="M16 2.5v4" />
        <circle className="pg-face__disc" cx={16} cy={16} r={11.5} stroke="none" />
        <g className="pg-face__features">
          <path className="pg-face__brow pg-face__brow--start" d="M8.5 10.8h5.5" />
          <path className="pg-face__brow pg-face__brow--end" d="M18 10.8h5.5" />
          <ellipse
            className="pg-face__eye pg-face__eye--start"
            cx={11}
            cy={15.5}
            rx={2.2}
            ry={2.6}
            stroke="none"
          />
          <ellipse
            className="pg-face__eye pg-face__eye--end"
            cx={21}
            cy={15.5}
            rx={2.2}
            ry={2.6}
            stroke="none"
          />
          <path className="pg-face__mouth pg-face__mouth--flat" d="M12 22h8" />
          <path className="pg-face__mouth pg-face__mouth--short" d="M13.5 22h5" />
          <path className="pg-face__mouth pg-face__mouth--pressed" d="M13 22h6" />
          <path className="pg-face__mouth pg-face__mouth--smirk" d="M12 22.4q4 1 8-1.8" />
          <path className="pg-face__mouth pg-face__mouth--smile" d="M12 21.2q4 3.2 8 0" />
          <path className="pg-face__mouth pg-face__mouth--frown-small" d="M12.5 22.6q3.5-2 7 0" />
          <path className="pg-face__mouth pg-face__mouth--frown" d="M12 23.2q4-3.2 8 0" />
          <path className="pg-face__mouth pg-face__mouth--tilted" d="M12 21.2L20 22.8" />
        </g>
      </svg>
    </span>
  );
}
