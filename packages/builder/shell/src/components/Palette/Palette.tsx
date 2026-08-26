import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import { seatOf, slotAccepts } from '../../overlay/drop-resolver';
import type { CanvasDragHandle } from '../EditorCanvas';
import '../../styles/visually-hidden.css';
import './Palette.css';

export interface PaletteProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** Hands insert payloads to the canvas session; absent ⇒ keyboard-insert only. */
  dragHandle?: CanvasDragHandle | undefined;
}

/**
 * The registered block vocabulary (006 contract §4): live under runtime
 * registration/disposal (the kernel-intrinsic catalog version — the B1 race-
 * proof pattern), insertable by keyboard (walk-up placement rule p2) or by
 * dragging onto the canvas (payload handoff p3 — the canvas owns chrome and
 * resolution; the palette owns nothing but the payload).
 */
export function Palette({ kernel, dragHandle }: PaletteProps) {
  // {text, nonce}: a REPEATED outcome (clicking a no-acceptor entry twice) must
  // still mutate the live region's text node or AT hears nothing the second
  // time — a zero-width space toggles on odd nonces, invisible but announced.
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const setMessage = (text: string) => {
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  };

  // The probe for the most recent pointer press: if that press turned into a
  // REAL drag (crossed the threshold), the button's own click must not insert —
  // an aborted drag would otherwise announce a cancel AND commit a transaction.
  const gestureProbeRef = useRef<{ didActivate: () => boolean } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const offRegistered = kernel.context.events.on('extension.registered', onStoreChange);
      const offDisposed = kernel.context.events.on('extension.disposed', onStoreChange);
      return () => {
        offRegistered();
        offDisposed();
      };
    },
    [kernel],
  );
  const getVersion = useCallback(() => kernel.extensions.version(), [kernel]);
  const catalogVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  const entries = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    const surface = kernel.getDocument().surface;
    return kernel.context.registry.blocks(surface).map((entry) => ({
      type: entry.schema.type,
      label: entry.schema.description || entry.schema.type,
    }));
  }, [kernel, catalogVersion]);

  const insertAtSelection = useCallback(
    (type: string) => {
      const doc = kernel.getDocument();
      const registry = kernel.context.registry;
      const payload = { kind: 'insert', type } as const;
      const selected = kernel.context.store.getState().selection[0];

      const commit = (parentId: NodeId, slot: string, index: number) => {
        const tx = kernel.dispatch('insertNode', { type, parentId, slot, index });
        const inserted = insertedNodeId(tx.patches);
        if (inserted !== undefined) {
          kernel.setSelection([inserted]);
        }
        setMessage(`Inserted ${type}`);
      };

      // p2: AFTER the selection in its parent slot when accepted…
      if (selected !== undefined) {
        const seat = seatOf(doc, selected);
        if (seat !== undefined && slotAccepts(doc, registry, seat.parentId, seat.slot, payload)) {
          commit(seat.parentId, seat.slot, seat.index + 1);
          return;
        }
      }
      // …else the first accepting slot walking selection → root (append).
      let candidate: NodeId | undefined = selected ?? doc.rootId;
      while (candidate !== undefined) {
        const candidateType = doc.nodes[candidate]?.type ?? '';
        for (const slot of Object.keys(registry.block(candidateType)?.schema.slots ?? {})) {
          if (slotAccepts(doc, registry, candidate, slot, payload)) {
            commit(candidate, slot, doc.nodes[candidate]?.slots?.[slot]?.length ?? 0);
            return;
          }
        }
        candidate = candidate === doc.rootId ? undefined : seatOf(doc, candidate)?.parentId;
      }
      setMessage(`No slot accepts ${type} here`);
    },
    [kernel],
  );

  return (
    <nav className="bldr-palette" aria-label="Block palette">
      <h2 className="bldr-palette__title">Blocks</h2>
      <ul className="bldr-palette__list">
        {entries.map((entry) => (
          <li key={entry.type}>
            <button
              type="button"
              className="bldr-palette__entry"
              onClick={() => {
                const dragged = gestureProbeRef.current?.didActivate() ?? false;
                gestureProbeRef.current = null;
                if (dragged) {
                  return; // the drag session owned this gesture, committed or cancelled
                }
                insertAtSelection(entry.type);
              }}
              onPointerDown={(event) => {
                // p3: the drag path — the canvas takes over from here.
                gestureProbeRef.current =
                  dragHandle?.beginInsert(entry.type, event.clientX, event.clientY) ?? null;
              }}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Palette">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
    </nav>
  );
}
