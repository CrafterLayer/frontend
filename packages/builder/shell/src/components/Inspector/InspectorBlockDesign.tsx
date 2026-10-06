import { useMemo, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId, StyleBucket, StyleState } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { blockSource } from '../../style-manager/block-source';
import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import { StylePanel, type StylePanelLabels } from '../../style-manager/StylePanel';
import type { InspectorElementLabels } from './element-panel.labels';

export interface InspectorBlockDesignProps {
  readonly kernel: BuilderKernel;
  readonly nodeId: NodeId;
  /** The block's declared `utility-classes` prop, when it has one. */
  readonly utilityKey: string | undefined;
  readonly device: EditingBucket;
  readonly dir: 'ltr' | 'rtl';
  readonly tokens: readonly ColorSwatch[];
  readonly announce: (text: string) => void;
  /** "Convert to editable" (DESIGN §A.9); the host turns the block into a custom-code region. */
  readonly onConvertBlock?: ((nodeId: NodeId) => void) | undefined;
  readonly labels: InspectorElementLabels;
  readonly styleLabels: StylePanelLabels;
}

/**
 * A registered block's style manager (style-manager DESIGN.md §A.9): the full
 * sectors against the block's declared `utility-classes` prop in TOKENS mode
 * (registered blocks keep the tokens-only law), plus "Convert to editable",
 * which the host wires to turn the block into an editable region whose every
 * part is its own element.
 */
export function InspectorBlockDesign({
  kernel,
  nodeId,
  utilityKey,
  device,
  dir,
  tokens,
  announce,
  onConvertBlock,
  labels,
  styleLabels,
}: InspectorBlockDesignProps) {
  const [bucket, setBucket] = useState<StyleBucket>(device);
  const [state, setState] = useState<StyleState>('default');
  const [seenDevice, setSeenDevice] = useState(device);
  if (seenDevice !== device) {
    // The DeviceBar moved: follow it (§A.7), dropping a custom width picked here.
    setSeenDevice(device);
    setBucket(device);
  }
  const source = useMemo(
    () => (utilityKey === undefined ? undefined : blockSource(kernel, nodeId, utilityKey, device)),
    [kernel, nodeId, utilityKey, device],
  );
  if (source === undefined && onConvertBlock === undefined) return null;

  return (
    <section className="bldr-inspector__section bldr-inspector__block-design" aria-label={labels.designBlock}>
      <h3 className="bldr-inspector__section-heading bldr-inspector__section-title">{labels.designBlock}</h3>
      <div className="bldr-inspector__section-region">
        {onConvertBlock === undefined ? null : (
          <div className="bldr-inspector__convert">
            <button
              type="button"
              className="bldr-inspector__convert-button"
              onClick={() => {
                onConvertBlock(nodeId);
              }}
            >
              {labels.convert}
            </button>
            <p className="bldr-inspector__element-note">{labels.convertHint}</p>
          </div>
        )}
        {source === undefined ? null : (
          <StylePanel
            source={source}
            bucket={bucket}
            state={state}
            onBucketChange={setBucket}
            onStateChange={setState}
            dir={dir}
            tokens={tokens}
            announce={announce}
            labels={styleLabels}
          />
        )}
      </div>
    </section>
  );
}
