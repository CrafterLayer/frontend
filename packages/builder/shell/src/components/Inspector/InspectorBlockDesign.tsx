import { useMemo, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId, StyleBucket, StyleState } from '@craftkit/builder-schema';

import type { ElementNameWords } from '../../custom-code/element-target';
import type { EditingBucket } from '../../devices/buckets';
import { blockDisplayName } from '../../naming/block-display-name';
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
  /**
   * "Convert to editable" (DESIGN §A.9); the host turns the block into a
   * custom-code region. A returned string is the refusal, shown in the panel.
   */
  readonly onConvertBlock?: ((nodeId: NodeId) => unknown) | undefined;
  /** The region type a conversion inserts (default `customCode`). */
  readonly regionType?: string | undefined;
  readonly labels: InspectorElementLabels;
  readonly styleLabels: StylePanelLabels;
  /** Names in the editor's language (arabic-editor); English by default. */
  readonly words?: ElementNameWords | undefined;
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
  regionType = 'customCode',
  labels,
  styleLabels,
  words,
}: InspectorBlockDesignProps) {
  const [refusal, setRefusal] = useState<{ readonly nodeId: NodeId; readonly text: string } | null>(null);
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
  const blockedBy = onConvertBlock === undefined ? undefined : refusingContainer(kernel, nodeId, regionType, words);
  const shownRefusal = refusal?.nodeId === nodeId ? refusal.text : undefined;

  return (
    <section className="bldr-inspector__section bldr-inspector__block-design" aria-label={labels.designBlock}>
      <h3 className="bldr-inspector__section-heading bldr-inspector__section-title">{labels.designBlock}</h3>
      <div className="bldr-inspector__section-region">
        {onConvertBlock === undefined ? null : (
          <div className="bldr-inspector__convert">
            <button
              type="button"
              className="bldr-inspector__convert-button"
              disabled={blockedBy !== undefined}
              {...(blockedBy === undefined ? {} : { 'aria-describedby': `${nodeId}-convert-blocked` })}
              onClick={() => {
                const refused = onConvertBlock(nodeId);
                setRefusal(typeof refused === 'string' ? { nodeId, text: refused } : null);
              }}
            >
              {labels.convert}
            </button>
            {blockedBy === undefined ? (
              <p className="bldr-inspector__element-note">{labels.convertHint}</p>
            ) : (
              <p id={`${nodeId}-convert-blocked`} className="bldr-inspector__element-note">
                {labels.convertBlocked(blockedBy)}
              </p>
            )}
            {shownRefusal === undefined ? null : (
              <p className="bldr-inspector__convert-refusal" role="alert">
                {shownRefusal}
              </p>
            )}
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

/**
 * The display name of the container whose slot would refuse the region a
 * conversion inserts (the hero inside an aurora), or undefined when the
 * conversion can land. The same rule the kernel door applies, read first so
 * the button is never offered where it cannot work.
 */
function refusingContainer(
  kernel: BuilderKernel,
  nodeId: NodeId,
  regionType: string,
  words?: ElementNameWords,
): string | undefined {
  const document = kernel.getDocument();
  for (const parent of Object.values(document.nodes)) {
    for (const [slot, children] of Object.entries(parent.slots ?? {})) {
      if (!children.includes(nodeId)) continue;
      const allow = kernel.context.registry.block(parent.type)?.schema.slots?.[slot]?.allow;
      return allow === undefined || allow.includes(regionType) ? undefined : blockDisplayName(kernel, parent.id, words);
    }
  }
  return undefined;
}
