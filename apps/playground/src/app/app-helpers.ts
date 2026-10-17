import type { DeviceState, TopBarDevice } from '@craftkit/builder';

import type { PersistenceStatusValue } from '../features/vault/components/PersistenceStatus';
import type { VaultKernelState } from '../features/vault/use-vault';

/** An opened document: the vault state every editing surface needs. */
export type ReadySession = Extract<VaultKernelState, { readonly status: 'ready' }>;

/**
 * The top bar speaks in device NAMES; the canvas measures in pixels. One place
 * translates, so the two vocabularies never have to know about each other and a
 * width typed by hand still resolves to the right bucket.
 */
export function deviceForBucket(name: TopBarDevice): DeviceState {
  if (name === 'mobile') {
    return { width: 390, bucket: 'mobile' };
  }
  if (name === 'tablet') {
    return { width: 834, bucket: 'tablet' };
  }
  return { width: 1280, bucket: 'base' };
}

/**
 * The save state a healthy vault reports, for the status bar's own slot. Saving and
 * saved are quiet facts and belong in the bar; a session-only or failed save needs the
 * person to act, so it keeps its banner with Download and Retry.
 */
export function quietSaveState(value: PersistenceStatusValue): 'saved' | 'saving' | undefined {
  if (value.kind === 'saving') return 'saving';
  return value.kind === 'durable' ? 'saved' : undefined;
}
