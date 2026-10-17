import { useEffect, useMemo, useState } from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BlockParts, BlockPropertyKind } from '@craftkit/builder-schema';

import { resolveField } from '../../fields/resolve-field';
import {
  fallbackRendering,
  fieldModuleCache,
  fieldModuleFailures,
  loadFieldModule,
  recordFieldFailure,
  type FieldModuleFailure,
} from './field-module-cache';
import type { Rendering } from './types';

export interface FieldRendering {
  /** What the row mounts right now — the live resolution, or the R8-locked one. */
  readonly rendering: Rendering;
  /** What the row WOULD mount without the lock. */
  readonly liveRendering: Rendering;
  /** A default placeholder standing in for a contribution that is still loading. */
  readonly loading: boolean;
  /**
   * The contribution this row resolved to failed (its module did not load,
   * or its component threw): the sentence, for the row to show. `undefined`
   * while it is loading, mounted, or when the row resolved to no contribution.
   */
  readonly failure: FieldModuleFailure | undefined;
  /** Load the failed contribution again (the Retry button). */
  readonly retry: () => void;
  /** R8: freeze the mounted renderer while the row owns focus. */
  readonly lock: () => void;
  readonly unlock: () => void;
  /** A contributed renderer threw: remember the failure and fall back live. */
  readonly markFailed: (error?: unknown) => void;
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

/** Where the row sits, for part-declared bindings (block-parts DESIGN §2.10 step 2). */
export interface FieldRenderingPlace {
  /** The owning block's declared parts — a stable reference from its schema. */
  readonly parts?: BlockParts | undefined;
  /** The row's prop path relative to `props`, indices as numbers. */
  readonly propPath?: readonly (string | number)[] | undefined;
}

/**
 * Field resolution for one row: resolveField picks the renderer, a contributed
 * module loads lazily into the shared per-def cache, and a focused row keeps
 * its resolved component until blur even if a better field type registers
 * meanwhile (i5).
 *
 * A failed load is NOT remembered forever (block-parts P3): the failure is
 * reported with its sentence, `retry()` loads again, and the next row that
 * mounts for the same contribution tries again on its own.
 */
export function useFieldRendering(
  kernel: BuilderKernel,
  schema: z.ZodType,
  propertyKind: BlockPropertyKind | undefined,
  catalogVersion: number,
  place?: FieldRenderingPlace,
): FieldRendering {
  /** Bumped when the module cache gains an entry this row is waiting on. */
  const [loadEpoch, setLoadEpoch] = useState(0);
  /** Bumped when an unlock has to show a resolution that arrived under the lock. */
  const [, setUnlockEpoch] = useState(0);

  const parts = place?.parts;
  // A path is compared by its text: a caller may hand a fresh array per render.
  const pathKey = place?.propPath === undefined ? undefined : JSON.stringify(place.propPath);

  const resolved = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    const propPath =
      pathKey === undefined ? undefined : (JSON.parse(pathKey) as (string | number)[]);
    return resolveField(kernel.context.registry, schema, propertyKind, { parts, propPath });
  }, [kernel, schema, propertyKind, catalogVersion, parts, pathKey]);

  // Lazy load (FR-005). A rejected loader is containment, not an error state:
  // the row shows its fallback. Loads are shared per def (loadFieldModule).
  useEffect(() => {
    if (resolved.kind !== 'contributed') {
      return undefined;
    }
    const def = resolved.def;
    if (fieldModuleCache.has(def)) {
      return undefined;
    }
    let cancelled = false;
    void loadFieldModule(def).then(() => {
      if (!cancelled) {
        setLoadEpoch((epoch) => epoch + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const liveRendering = useMemo<Rendering>(() => {
    void loadEpoch; // the memo's real dependency: the module cache generation
    if (resolved.kind === 'contributed') {
      const component = fieldModuleCache.get(resolved.def);
      if (component !== undefined) {
        return { kind: 'contributed', def: resolved.def, component };
      }
      // Still loading ⇒ a DISABLED default placeholder (f3 reserves the live
      // default for FAILURE — an interim must not accept commits a contributed
      // control was registered to constrain). Failed ⇒ the live default.
      return fallbackRendering(schema, !fieldModuleFailures.has(resolved.def));
    }
    return resolved.kind === 'default'
      ? { kind: 'default', control: resolved.control, loading: false }
      : { kind: 'readonly', loading: false };
  }, [resolved, loadEpoch, schema]);

  // R8 focus lock: while any element inside the row owns focus, the mounted
  // renderer is frozen so a runtime registration can never steal the caret.
  const [lock] = useState(createLockHolder);
  const rendering = lock.get() ?? liveRendering;

  const failure =
    resolved.kind === 'contributed' && rendering.kind !== 'contributed'
      ? fieldModuleFailures.get(resolved.def)
      : undefined;

  return {
    rendering,
    liveRendering,
    loading: rendering.kind !== 'contributed' && rendering.loading,
    failure,
    retry: () => {
      if (resolved.kind !== 'contributed') return;
      const def = resolved.def;
      void loadFieldModule(def).then(() => {
        // Pressing Retry focused the row, which took the R8 lock on the
        // fallback; the person asked for the editor, so the lock yields to it.
        lock.set(null);
        setLoadEpoch((epoch) => epoch + 1);
      });
    },
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
    markFailed: (error?: unknown) => {
      if (rendering.kind === 'contributed') {
        // The component, not the module, failed: drop it so Retry mounts a
        // fresh load, and keep the sentence for the row to show.
        fieldModuleCache.delete(rendering.def);
        recordFieldFailure(
          rendering.def,
          error ?? new Error('The field stopped working while it was showing.'),
        );
        setLoadEpoch((epoch) => epoch + 1);
      }
    },
  };
}
