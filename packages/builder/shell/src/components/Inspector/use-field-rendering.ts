import { useEffect, useMemo, useState } from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BlockPropertyKind } from '@craftkit/builder-schema';

import { resolveField } from '../../fields/resolve-field';
import { fallbackRendering, fieldModuleCache } from './field-module-cache';
import type { Rendering } from './types';

export interface FieldRendering {
  /** What the row mounts right now — the live resolution, or the R8-locked one. */
  readonly rendering: Rendering;
  /** What the row WOULD mount without the lock. */
  readonly liveRendering: Rendering;
  /** A default placeholder standing in for a contribution that is still loading. */
  readonly loading: boolean;
  /** R8: freeze the mounted renderer while the row owns focus. */
  readonly lock: () => void;
  readonly unlock: () => void;
  /** A contributed renderer threw: remember the failure and fall back live. */
  readonly markFailed: () => void;
}

interface LockHolder {
  readonly get: () => Rendering | null;
  readonly set: (rendering: Rendering | null) => void;
}

/*
  The R8 lock lives in a holder that is deliberately NEITHER state NOR a ref.

  Not state: taking focus and giving it up must not render — a segment click
  would cost the pressed row two renders (lock, then commit) and the row it
  blurred one for nothing. Not a ref: a ref's whole contract is "never read
  during render", and this value is read during render on purpose. Its write
  never asks for a render; it is picked up by the next render that happens for
  a reason of its own (a registry epoch, a module landing), which is exactly
  when a frozen renderer matters. `unlock` is the one place that forces a
  render, and only when the live resolution moved while the lock was held.
*/
function createLockHolder(): LockHolder {
  let held: Rendering | null = null;
  return {
    get: () => held,
    set: (rendering) => {
      held = rendering;
    },
  };
}

/**
 * Field resolution for one row: resolveField picks the renderer, a contributed
 * module loads lazily into the shared per-def cache, and a focused row keeps
 * its resolved component until blur even if a better field type registers
 * meanwhile (i5).
 */
export function useFieldRendering(
  kernel: BuilderKernel,
  schema: z.ZodType,
  propertyKind: BlockPropertyKind | undefined,
  catalogVersion: number,
): FieldRendering {
  /** Bumped when the module cache gains an entry this row is waiting on. */
  const [loadEpoch, setLoadEpoch] = useState(0);
  /** Bumped when an unlock has to show a resolution that arrived under the lock. */
  const [, setUnlockEpoch] = useState(0);

  const resolved = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    return resolveField(kernel.context.registry, schema, propertyKind);
  }, [kernel, schema, propertyKind, catalogVersion]);

  // Lazy load (FR-005): a rejected loader is containment, not an error state —
  // the row keeps rendering the default resolution for this schema.
  useEffect(() => {
    if (resolved.kind !== 'contributed') {
      return undefined;
    }
    const def = resolved.def;
    if (fieldModuleCache.has(def)) {
      return undefined;
    }
    let cancelled = false;
    def.load().then(
      (mod) => {
        fieldModuleCache.set(def, mod.default);
        if (!cancelled) {
          setLoadEpoch((epoch) => epoch + 1);
        }
      },
      () => {
        fieldModuleCache.set(def, 'failed');
        if (!cancelled) {
          setLoadEpoch((epoch) => epoch + 1);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const liveRendering = useMemo<Rendering>(() => {
    void loadEpoch; // the memo's real dependency: the module cache generation
    if (resolved.kind === 'contributed') {
      const entry = fieldModuleCache.get(resolved.def);
      if (entry !== undefined && entry !== 'failed') {
        return { kind: 'contributed', def: resolved.def, component: entry };
      }
      // Still loading ⇒ a DISABLED default placeholder (f3 reserves the live
      // default for FAILURE — an interim must not accept commits a contributed
      // control was registered to constrain). 'failed' ⇒ the live default.
      return fallbackRendering(schema, entry === undefined);
    }
    return resolved.kind === 'default'
      ? { kind: 'default', control: resolved.control, loading: false }
      : { kind: 'readonly', loading: false };
  }, [resolved, loadEpoch, schema]);

  // R8 focus lock: while any element inside the row owns focus, the mounted
  // renderer is frozen so a runtime registration can never steal the caret.
  const [lock] = useState(createLockHolder);
  const rendering = lock.get() ?? liveRendering;

  return {
    rendering,
    liveRendering,
    loading: rendering.kind !== 'contributed' && rendering.loading,
    lock: () => {
      if (lock.get() === null) {
        lock.set(liveRendering);
      }
    },
    unlock: () => {
      const held = lock.get();
      lock.set(null);
      if (held !== null && held !== liveRendering) {
        setUnlockEpoch((epoch) => epoch + 1);
      }
    },
    markFailed: () => {
      if (rendering.kind === 'contributed') {
        fieldModuleCache.set(rendering.def, 'failed');
        setLoadEpoch((epoch) => epoch + 1);
      }
    },
  };
}
