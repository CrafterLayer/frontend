/*
  The vault: the playground's persistence feature.

  store       — the async key/value port (IndexedDB, degrading to memory)
  persistence — the kernel's PersistenceAdapter over that port
  snapshots   — the user-facing shelf of labelled restore points
  restore     — the one legal revert, through the kernel's applyPatches door
  use-vault   — the React boot: loading → ready | failed, and the autosave

  Only the last of those imports React; the four below it are plain logic over
  the store port, which is why the whole vault is testable without a browser.
*/

export { createIndexedDbVaultStore, createMemoryVaultStore, type VaultStore } from './store';
export {
  createVaultPersistence,
  sessionKey,
  type VaultPersistenceAdapter,
  type VaultPersistenceOptions,
} from './persistence';
export {
  createSnapshotShelf,
  type SnapshotShelf,
  type SnapshotShelfOptions,
  type VaultSnapshot,
  type VaultSnapshotMeta,
} from './snapshots';
export { restoreDocument, type RestoreOutcome } from './restore';
export {
  useVaultKernel,
  vaultDocId,
  type UseVaultKernelOptions,
  type VaultKernelState,
  type VaultSaveState,
} from './use-vault';
