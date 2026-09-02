import type { ReactNode } from 'react';

import type { EditingBucket } from '../../devices/buckets';
import { ChromeButton } from '../ChromeButton';
import { BACK_TO_REGION } from './constants';
import { INSPECTOR_ICONS } from './Inspector.icons';

export interface InspectorHeaderProps {
  /** The shared display name — the same string as the canvas chip and LayersTree. */
  readonly blockName: string;
  readonly selected: boolean;
  readonly bucket: EditingBucket;
  readonly onClearSelection: () => void;
  /**
   * Present while an ELEMENT inside a composed region is focused: where it
   * lives ("in CV header"), and the way back out to the region itself.
   */
  readonly within?: { readonly regionName: string; readonly onBack: () => void } | undefined;
  /** The tab strip, when there is one. */
  readonly children?: ReactNode | undefined;
}

/**
 * The head of the panel: "Inspector" is the eyebrow, the block's name is the
 * title, and the way OUT of a selection sits beside it.
 */
export function InspectorHeader({
  blockName,
  selected,
  bucket,
  onClearSelection,
  within,
  children,
}: InspectorHeaderProps) {
  return (
    <header className="bldr-inspector__head">
      <div className="bldr-inspector__title-row">
        <h2 className="bldr-inspector__title">Inspector</h2>
        {/* The way OUT of a selection, next to the name of what is selected.
            Quiet and small: it is furniture, not the panel's purpose. The
            cross is decorative — the text is the one accessible name. */}
        {selected ? (
          <ChromeButton
            className="bldr-inspector__clear-selection"
            size="sm"
            variant="quiet"
            onClick={onClearSelection}
          >
            {INSPECTOR_ICONS['clear-selection']}
            Clear selection
          </ChromeButton>
        ) : null}
      </div>
      <div className="bldr-inspector__identity">
        {within === undefined ? null : (
          // The step back out of an element. Before the name, because it is
          // where the person came FROM; the cross at the row end stays "leave
          // the selection altogether".
          <ChromeButton
            className="bldr-inspector__back"
            size="sm"
            variant="quiet"
            onClick={within.onBack}
          >
            {INSPECTOR_ICONS.back}
            {BACK_TO_REGION}
          </ChromeButton>
        )}
        <p
          className="bldr-inspector__block-name"
          data-empty={selected ? undefined : 'true'}
          aria-label="Selected block"
        >
          {blockName}
        </p>
        {bucket !== 'base' ? <span className="bldr-inspector__bucket">{bucket}</span> : null}
      </div>
      {within === undefined ? null : (
        <p className="bldr-inspector__within">in {within.regionName}</p>
      )}
      {selected && bucket !== 'base' ? (
        <p className="bldr-inspector__bucket-note">Editing {bucket} overrides</p>
      ) : null}
      {children}
    </header>
  );
}
