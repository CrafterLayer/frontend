import { useState } from 'react';

import type { StyleCorner, StyleMode, StyleValue } from '@craftkit/builder-schema';

import type { BoxSideState } from '../BoxModelControl';
import { ScaleNumberControl, type ScaleModel, type ScaleNumberControlLabels } from '../ScaleNumberControl';
import {
  CORNER_RADIUS_CONTROL_LABELS_EN,
  type CornerRadiusControlLabels,
} from './CornerRadiusControl.labels';

import { CORNERS } from './corners';

import './CornerRadiusControl.css';


export interface CornerRadiusControlProps {
  readonly corners: Readonly<Record<StyleCorner, BoxSideState>>;
  readonly model: ScaleModel;
  readonly units?: readonly string[] | undefined;
  /** The PAGE direction: start corners sit on the right of an RTL page. */
  readonly dir: 'ltr' | 'rtl';
  readonly mode?: StyleMode | undefined;
  /** `all` writes `rounded-*`; a corner writes `rounded-ss-*` and so on. */
  readonly onCommit: (side: 'all' | StyleCorner, value: StyleValue | null) => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: CornerRadiusControlLabels | undefined;
  readonly fieldLabels?: ScaleNumberControlLabels | undefined;
}

function sameValue(a: StyleValue | undefined, b: StyleValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Corner radius, linked or per logical corner (style-manager DESIGN.md §A.4
 * Borders). Linked shows one field that writes `rounded-*`; unlinked shows the
 * four corners where the PAGE puts them, each writing `rounded-ss/se/es/ee`.
 */
export function CornerRadiusControl({
  corners,
  model,
  units,
  dir,
  mode = 'free',
  onCommit,
  disabled = false,
  labels = CORNER_RADIUS_CONTROL_LABELS_EN,
  fieldLabels,
}: CornerRadiusControlProps) {
  const first = corners['start-start'];
  const uniform = CORNERS.every(
    (corner) => corners[corner].mixed !== true && sameValue(corners[corner].value, first.value),
  );
  const [linked, setLinked] = useState(uniform);

  return (
    <div className="bldr-corner-radius" role="group" aria-label={labels.group}>
      <button
        type="button"
        className="bldr-corner-radius__link"
        aria-pressed={linked}
        aria-label={labels.link}
        title={labels.link}
        disabled={disabled}
        onClick={() => {
          setLinked(!linked);
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 8V5a2 2 0 0 1 2-2h3M13 8v3a2 2 0 0 1-2 2H8" />
        </svg>
      </button>
      {linked ? (
        <ScaleNumberControl
          label={labels.all}
          value={uniform ? first.value : undefined}
          mixed={!uniform}
          model={model}
          units={units}
          mode={mode}
          min={0}
          disabled={disabled}
          labels={fieldLabels}
          onCommit={(value) => {
            onCommit('all', value);
          }}
        />
      ) : (
        <div className="bldr-corner-radius__grid" dir={dir}>
          {CORNERS.map((corner) => (
            <div key={corner} className="bldr-corner-radius__corner" data-corner={corner}>
              <ScaleNumberControl
                label={labels.corners[corner]}
                value={corners[corner].value}
                mixed={corners[corner].mixed}
                model={model}
                units={units}
                mode={mode}
                min={0}
                disabled={disabled}
                labels={fieldLabels}
                onCommit={(value) => {
                  onCommit(corner, value);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
