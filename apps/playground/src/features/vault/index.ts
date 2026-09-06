/*
  The vault: the playground's persistence feature.

  store       — the async key/value port (IndexedDB, degrading to memory)
  persistence — the kernel's PersistenceAdapter over that port
  drafts      — the scratch documents a run writes into, so the live page is
                never half built, and the fingerprints a commit checks
  commit-draft— the one door a draft lands through: one transaction, attributed
                to the agent, refused with zero writes when the page moved
  run-journal — what a run DID, durable enough to survive the tab doing it
  keep-plan   — keep what succeeded: the shells of unwritten sections are taken
                back rather than committed as empty headings
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
  commitKept,
  keepSucceeded,
  kept,
  notApplied,
  type CommitKeptOptions,
  type KeepCause,
  type KeepOutcome,
  type KeepPlan,
  type KeepRefusal,
  type KeepUnit,
} from './keep-plan';
export {
  RUN_JOURNAL_TTL_MS,
  RUN_ORPHAN_AFTER_MS,
  createRunJournal,
  isResumable,
  resumePoint,
  type RunJournal,
  type RunJournalOptions,
  type RunRecord,
  type RunStage,
  type RunStatus,
  type RunUnitRecord,
  type RunUnitStatus,
  type StartRunOptions,
} from './run-journal';
export {
  commitDraft,
  type CommitDraftOptions,
  type CommitOutcome,
  type CommitRefusal,
} from './commit-draft';
export {
  DRAFT_LIMIT,
  DRAFT_TTL_MS,
  createDrafts,
  draftDocId,
  fingerprintDocument,
  fingerprintSite,
  type DraftMeta,
  type Drafts,
  type DraftsOptions,
  type OpenedDraft,
} from './drafts';
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
