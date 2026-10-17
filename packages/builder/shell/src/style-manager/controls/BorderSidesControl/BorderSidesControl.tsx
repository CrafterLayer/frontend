import type { StyleBoxSide, StyleMode, StyleSide, StyleValue } from '@craftkit/builder-schema';

import { BoxModelControl, type BoxSideState } from '../BoxModelControl';
import { ChoiceGroup } from '../ChoiceGroup';
import type { ScaleModel } from '../ScaleNumberControl';
import {
  BORDER_SIDES_CONTROL_LABELS_EN,
  type BorderSidesControlLabels,
} from './BorderSidesControl.labels';

import './BorderSidesControl.css';

export interface BorderSidesControlProps {
  readonly widths: Readonly<Record<StyleBoxSide, BoxSideState>>;
  readonly model: ScaleModel;
  readonly units?: readonly string[] | undefined;
  /** The current border style keyword (`solid`, `dashed`…), if any. */
  readonly borderStyle: string | undefined;
  readonly styles?: readonly string[] | undefined;
  readonly dir: 'ltr' | 'rtl';
  readonly mode?: StyleMode | undefined;
  readonly onCommitWidth: (side: StyleSide, value: StyleValue | null) => void;
  readonly onCommitStyle: (style: string) => void;
  readonly onPreviewWidth?: ((side: StyleSide, value: StyleValue | null) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: BorderSidesControlLabels | undefined;
}

const DEFAULT_STYLES: readonly string[] = ['solid', 'dashed', 'dotted', 'double', 'none'];

/**
 * Border width per logical side plus the border style (style-manager
 * DESIGN.md §A.4 Borders). The widths are one box-model ring — the same
 * scrub, the same Shift (all) and Alt (pair) — mirrored to the page.
 */
export function BorderSidesControl({
  widths,
  model,
  units,
  borderStyle,
  styles = DEFAULT_STYLES,
  dir,
  mode = 'free',
  onCommitWidth,
  onCommitStyle,
  onPreviewWidth,
  disabled = false,
  labels = BORDER_SIDES_CONTROL_LABELS_EN,
}: BorderSidesControlProps) {
  return (
    <div className="bldr-border-sides" role="group" aria-label={labels.group}>
      <BoxModelControl
        dir={dir}
        mode={mode}
        disabled={disabled}
        labels={labels.box}
        rings={[{ id: 'borderWidth', label: labels.width, sides: widths, model, units }]}
        onCommit={(_ring, side, value) => {
          onCommitWidth(side, value);
        }}
        onPreview={
          onPreviewWidth === undefined
            ? undefined
            : (_ring, side, value) => {
                onPreviewWidth(side, value);
              }
        }
      />
      <ChoiceGroup
        label={labels.style}
        dir={dir}
        disabled={disabled}
        value={borderStyle}
        options={styles.map((value) => ({ value, label: labels.styles[value] ?? value }))}
        onChange={onCommitStyle}
      />
    </div>
  );
}
