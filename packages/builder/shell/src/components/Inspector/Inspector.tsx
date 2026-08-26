import { useCallback, useMemo, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import { useKernelSelector, useRegistryEpoch } from '@craftkit/builder-renderer';

import type { EditingBucket } from '../../devices/buckets';
import { propsShapeOf } from '../../fields/resolve-field';
import { InspectorRow } from './InspectorRow';
import '../../styles/visually-hidden.css';
import './Inspector.css';

export interface InspectorProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** Active editing bucket; 'base' edits props, others edit responsive overrides. */
  bucket?: EditingBucket | undefined;
}

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;

/**
 * The generated properties panel (007 contract §4): rows derive from the
 * selected block's OWN schema (i1 — zero panel code per block), every commit is
 * one kernel transaction (i2), values render from document truth (i3 —
 * undo/external edits show through, a pruned selection empties the panel), and
 * override buckets read/write `responsive[bucket]` with markers and one-
 * transaction clears (i4).
 */
export function Inspector({ kernel, bucket = 'base' }: InspectorProps) {
  // ONE selector for the whole panel: the selected node's reference. Selection
  // pruning and undo both surface here as a plain snapshot change.
  const node = useKernelSelector(
    kernel,
    useCallback((state: KernelState) => {
      const id = state.selection[0];
      return id === undefined ? undefined : state.doc.nodes[id];
    }, []),
  );

  // Field types are live under runtime registration/disposal — the renderer's
  // kernel-intrinsic catalog-version hook (one implementation, shared).
  const catalogVersion = useRegistryEpoch(kernel);

  // {text, nonce}: repeated outcomes must still mutate the live region's text
  // node or AT hears nothing the second time (the established shell pattern).
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const announce = useCallback((text: string) => {
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);

  const blockSchema =
    node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;

  const properties = useMemo(
    () => (blockSchema === undefined ? [] : Object.entries(propsShapeOf(blockSchema.props))),
    [blockSchema],
  );

  const overrides = node === undefined || bucket === 'base' ? undefined : node.responsive?.[bucket];

  return (
    <section className="bldr-inspector" aria-label="Inspector">
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Inspector messages">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
      {node === undefined ? (
        <p className="bldr-inspector__empty">Select a block to edit its properties.</p>
      ) : (
        <>
          <header className="bldr-inspector__head">
            <h2 className="bldr-inspector__title">{blockSchema?.description ?? node.type}</h2>
            {bucket !== 'base' ? (
              <p className="bldr-inspector__bucket">Editing {bucket} overrides</p>
            ) : null}
          </header>
          {blockSchema === undefined ? (
            // An unregistered type is NOT "nothing to edit" — say what happened.
            <p className="bldr-inspector__empty">
              Unknown block type — no schema is registered for it.
            </p>
          ) : properties.length === 0 ? (
            <p className="bldr-inspector__empty">This block has no editable properties.</p>
          ) : (
            <div className="bldr-inspector__rows">
              {properties.map(([propKey, schema]) => (
                <InspectorRow
                  key={`${node.id}:${bucket}:${propKey}`}
                  kernel={kernel}
                  nodeId={node.id}
                  propKey={propKey}
                  schema={schema}
                  bucket={bucket}
                  value={bucket === 'base' ? node.props[propKey] : overrides?.[propKey]}
                  baseValue={node.props[propKey]}
                  hasOverride={overrides !== undefined && Object.hasOwn(overrides, propKey)}
                  catalogVersion={catalogVersion}
                  announce={announce}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
