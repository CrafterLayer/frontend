import type { SVGProps } from 'react';

import type { GENERATION_STAGE_IDS } from './constants';

import '../../styles/visually-hidden.css';
import './GenerationProgress.css';

/**
 * The five-stage site pipeline, made observable.
 *
 * The stage IDS are the pipeline's own vocabulary (`@craftkit/builder-ai`); the
 * LABELS are what a person reading the panel understands. They differ on
 * purpose: `sitemap` and `assembly` name what the stage computes, "Plan" and
 * "Apply" name what the person is waiting for. Keeping both means renaming a
 * stage in the UI never renames a wire field.
 *
 * This component is presentational and has no timer of its own. Whoever runs
 * the pipeline owns elapsed time and passes it as `detail`, so a replayed run
 * and a live run render identically.
 */
export type GenerationStageId = (typeof GENERATION_STAGE_IDS)[number];

export type GenerationStageStatus = 'pending' | 'active' | 'done' | 'failed' | 'cancelled';

export interface GenerationStage {
  readonly id: GenerationStageId;
  readonly status: GenerationStageStatus;
  /** Elapsed time when settled, or the reason when failed. Shown at the row's end. */
  readonly detail?: string | undefined;
}

export interface GenerationProgressProps {
  /** One entry per stage, in pipeline order. */
  stages: readonly GenerationStage[];
  /** Omit to withdraw cancellation entirely; it is also hidden once nothing runs. */
  onCancel?: (() => void) | undefined;
  /** The card's heading, and the region's accessible name. */
  heading?: string | undefined;
}

const ICON_PROPS = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': true,
  className: 'bldr-genprogress__glyph',
} as const satisfies SVGProps<SVGSVGElement>;

const STAGES = {
  sitemap: {
    label: 'Plan',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
      </svg>
    ),
  },
  structure: {
    label: 'Structure',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1.75 14 5v6l-6 3.25L2 11V5z" />
        <path d="M2 5l6 3.25L14 5M8 8.25v6" />
      </svg>
    ),
  },
  content: {
    label: 'Content',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3.5 1.75h6l3 3v9.5h-9z" />
        <path d="M9.25 1.75v3.5h3.5M5.5 8.5h5M5.5 11h3" />
      </svg>
    ),
  },
  design: {
    label: 'Design',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.25-.6 1.25-1.15 0-.85-.7-1.2-.7-1.9 0-.5.4-.95.95-.95h1.1a3.65 3.65 0 0 0 3.65-3.65C14.25 3.7 11.4 1.75 8 1.75Z" />
        <circle cx="5.25" cy="6.5" r="0.85" />
        <circle cx="9" cy="5" r="0.85" />
      </svg>
    ),
  },
  assembly: {
    label: 'Apply',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 10.5 3 13l1.25-3.75" />
        <path d="M9.5 2.75c2.5-1.25 4 .25 2.75 2.75l-5 5-3.5-3.5z" />
        <path d="M9.75 8.5 12 13l1.25-3" />
      </svg>
    ),
  },
} as const satisfies Record<GenerationStageId, { label: string; icon: React.ReactNode }>;

const STATUS_LABELS = {
  pending: 'Waiting',
  active: 'Active',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const satisfies Record<GenerationStageStatus, string>;

function StatusMark({ status }: { status: GenerationStageStatus }) {
  if (status === 'done') {
    return (
      <svg {...ICON_PROPS} className="bldr-genprogress__mark-glyph">
        <path d="m4 8.25 2.75 2.75L12 5.5" />
      </svg>
    );
  }
  if (status === 'failed') {
    return (
      <svg {...ICON_PROPS} className="bldr-genprogress__mark-glyph">
        <path d="M5 5l6 6M11 5l-6 6" />
      </svg>
    );
  }
  if (status === 'cancelled') {
    return (
      <svg {...ICON_PROPS} className="bldr-genprogress__mark-glyph">
        <path d="M4.5 8h7" />
      </svg>
    );
  }
  /* Active and pending share the ring; only active animates it. */
  return <span className="bldr-genprogress__ring" aria-hidden="true" />;
}

/*
  One sentence for a screen reader, derived from the same data the rows draw.
  A failed or cancelled run is reported as such rather than left as a silent
  gap, and progress is spoken as "N of M" so the listener knows how far in the
  run is without counting rows.
*/
function announcement(stages: readonly GenerationStage[]): string {
  const total = stages.length;
  const failed = stages.find((stage) => stage.status === 'failed');
  if (failed !== undefined) {
    const reason = failed.detail === undefined ? '' : ` ${failed.detail}`;
    return `${STAGES[failed.id].label} failed.${reason}`;
  }
  if (stages.some((stage) => stage.status === 'cancelled')) {
    return 'Generation cancelled.';
  }
  /* The index is part of the sentence, so this reads position and stage
     together rather than searching twice. Out of range yields `undefined`,
     which is the "nothing running" branch. */
  const activeIndex = stages.findIndex((stage) => stage.status === 'active');
  const active = stages[activeIndex];
  if (active !== undefined) {
    return `Stage ${String(activeIndex + 1)} of ${String(total)}: ${STAGES[active.id].label}.`;
  }
  if (total > 0 && stages.every((stage) => stage.status === 'done')) {
    return `All ${String(total)} stages complete.`;
  }
  return 'Not started.';
}

export function GenerationProgress({
  stages,
  onCancel,
  heading = 'Building your page',
}: GenerationProgressProps) {
  const running = stages.some((stage) => stage.status === 'active');
  const settled = stages.filter((stage) => stage.status === 'done').length;

  return (
    <section className="bldr-genprogress" aria-label={heading}>
      <header className="bldr-genprogress__head">
        <h3 className="bldr-genprogress__heading">{heading}</h3>
        <span className="bldr-genprogress__count">
          {String(settled)}/{String(stages.length)}
        </span>
      </header>

      {/* The announcement, and the only thing that speaks. Focus never moves. */}
      <p role="status" aria-live="polite" className="bldr-visually-hidden">
        {announcement(stages)}
      </p>

      <ol className="bldr-genprogress__list">
        {stages.map((stage) => (
          <li
            key={stage.id}
            className="bldr-genprogress__stage"
            data-status={stage.status}
            /* Colour alone never carries the state; this is for styling only. */
          >
            <span className="bldr-genprogress__icon" aria-hidden="true">
              {STAGES[stage.id].icon}
            </span>
            <span className="bldr-genprogress__name" data-testid="stage-name">
              {STAGES[stage.id].label}
            </span>
            {stage.detail === undefined ? null : (
              <span className="bldr-genprogress__detail">{stage.detail}</span>
            )}
            <span className="bldr-genprogress__status">{STATUS_LABELS[stage.status]}</span>
            <span className="bldr-genprogress__mark" aria-hidden="true">
              <StatusMark status={stage.status} />
            </span>
          </li>
        ))}
      </ol>

      {running && onCancel !== undefined ? (
        <footer className="bldr-genprogress__foot">
          <button type="button" className="bldr-genprogress__cancel" onClick={onCancel}>
            Cancel generation
          </button>
        </footer>
      ) : null}
    </section>
  );
}
