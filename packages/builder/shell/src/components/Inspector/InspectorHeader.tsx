import { useLayoutEffect, useRef, type ReactNode } from 'react';

import type { EditingBucket } from '../../devices/buckets';
import { ChromeButton } from '../ChromeButton';
import { INSPECTOR_ICONS } from './Inspector.icons';
import { INSPECTOR_HEADER_LABELS_EN, type InspectorHeaderLabels } from './InspectorHeader.labels';

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
  readonly labels?: InspectorHeaderLabels | undefined;
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
  labels = INSPECTOR_HEADER_LABELS_EN,
}: InspectorHeaderProps) {
  const headRef = useRef<HTMLElement>(null);
  /*
    The head is sticky, and so is the style panel's own header (screen size,
    state, search) further down. Both stuck at 0, so the style header slid
    OVER the title and left the head's lower lines ("in Card") peeking out
    under it. The head publishes its height; nested sticky headers sit below.
  */
  useLayoutEffect(() => {
    const head = headRef.current;
    const panel = head?.closest<HTMLElement>('.bldr-inspector');
    if (head === null || panel === null || panel === undefined) return undefined;
    const publish = () => {
      panel.style.setProperty('--bldr-inspector-head-size', `${String(head.offsetHeight)}px`);
    };
    publish();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(publish);
    observer.observe(head);
    return () => {
      observer.disconnect();
    };
  }, []);
  return (
    <header ref={headRef} className="bldr-inspector__head">
      <div className="bldr-inspector__title-row">
        <h2 className="bldr-inspector__title">{labels.title}</h2>
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
            {labels.clearSelection}
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
            {labels.backToRegion}
          </ChromeButton>
        )}
        <p
          className="bldr-inspector__block-name"
          data-empty={selected ? undefined : 'true'}
          aria-label={labels.selectedBlock}
        >
          {blockName}
        </p>
        {bucket !== 'base' ? <span className="bldr-inspector__bucket">{labels.bucket(bucket)}</span> : null}
      </div>
      {/* Said only when it adds something: "Icon (sparkles) in Icon" and
          "Button label · Get started in Get started" repeated the name. */}
      {within === undefined ||
      blockName.toLocaleLowerCase().includes(within.regionName.trim().toLocaleLowerCase()) ? null : (
        <p className="bldr-inspector__within">{labels.within(within.regionName)}</p>
      )}
      {selected && bucket !== 'base' ? (
        <p className="bldr-inspector__bucket-note">{labels.editingOverrides(bucket)}</p>
      ) : null}
      {children}
    </header>
  );
}
