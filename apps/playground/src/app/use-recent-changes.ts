import { useSyncExternalStore } from 'react';

import type { BuilderKernel, ChangeDoor, RecentChange } from '@craftkit/builder';

/**
 * The provenance strip's data — read, never invented.
 *
 * The kernel has stamped `author` on every transaction since B0: a change knows
 * whether it came from the canvas, the code view, or the assistant. Nothing in
 * the interface has ever shown it, so an author could not answer the question
 * they ask most often after a busy minute — "what just changed, and was that
 * me?". This maps that existing field onto the status bar's chips.
 *
 * Deliberately a projection, not a store: the transaction log is already the
 * source of truth, and a second list of the same facts is a second list to get
 * wrong.
 */

const DOOR_BY_AUTHOR: Readonly<Record<string, ChangeDoor>> = {
  user: 'canvas',
  codeview: 'code',
  ai: 'assistant',
};

/**
 * A command name is machinery (`setProp`, `insertNode`); the strip needs the
 * author's words. This is the smallest honest translation — where a command
 * has no phrasing yet it falls back to the name rather than inventing prose.
 */
const PHRASE_BY_COMMAND: Readonly<Record<string, string>> = {
  insertNode: 'add block',
  removeNode: 'remove block',
  moveNode: 'move block',
  duplicateNode: 'duplicate block',
  setProp: 'edit property',
  setBinding: 'bind data',
  setResponsive: 'device override',
  setDocMeta: 'page settings',
  applyPatches: 'code edit',
  // Site commands (fix pass: the strip read "Canvas: setSiteDirection").
  setSiteDirection: 'page direction',
  duplicatePage: 'duplicate page',
  languageVersions: 'language versions',
  setDesignToken: 'design token',
  setDesignSystem: 'design system',
  setSharedRegion: 'header or footer',
  setPageRegions: 'page regions',
  registerAsset: 'add picture',
  updateAsset: 'edit picture',
  removeAsset: 'remove picture',
  setPaletteColor: 'palette colour',
  removePaletteColor: 'remove palette colour',
  setNamedStyle: 'named style',
  removeNamedStyle: 'remove named style',
  // Element edits inside an editable region.
  patchTreeNode: 'edit element',
  setTreeNode: 'edit element',
  insertTreeNode: 'add element',
  removeTreeNode: 'remove element',
  moveTreeNode: 'move element',
  duplicateTreeNode: 'duplicate element',
  wrapTreeNode: 'wrap element',
  unwrapTreeNode: 'unwrap element',
  formatTreeText: 'format text',
};

/** A bare command name nobody phrased yet (`setFooBar`) reads as words (`set foo bar`). */
function phraseOf(command: string): string {
  const phrased = PHRASE_BY_COMMAND[command];
  if (phrased !== undefined) return phrased;
  if (!/^[a-z]+(?:[A-Z][a-z0-9]*)+$/u.test(command)) return command;
  return command.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').toLowerCase();
}

export interface RecentChangesOptions {
  /** How many chips the strip shows (default 3). */
  readonly limit?: number | undefined;
  /**
   * A door whose changes another surface already speaks for. With the v2 agent panel
   * mounted, the assistant's changes are its thread's records (and the status-bar pill
   * while the panel is hidden), so the strip no longer stacks three "Assistant: …" chips,
   * one per landed section, in engine words (SPEC §4.20: the pill replaces them).
   */
  readonly exclude?: ChangeDoor | undefined;
  /** Commands phrased in the editor's language (arabic-editor); English otherwise. */
  readonly phrases?: Readonly<Record<string, string>> | undefined;
  /**
   * Reads a recorded label in the editor's language ("Edit text · Hero heading"
   * in the Arabic chrome); labels are shown as recorded without it.
   */
  readonly localize?: ((label: string) => string) | undefined;
}

/** What the strip lists, and whether it left out changes another surface speaks for. */
export interface RecentChanges {
  /** Newest first, at most `limit`. */
  readonly changes: readonly RecentChange[];
  /**
   * Changes through the excluded door exist in the log. The strip must then not say "No
   * recent changes" when it lists none: after an AI build of eight sections it did, and the
   * page had plainly changed (final test, 2026-09-29).
   */
  readonly spokenElsewhere: boolean;
}

/**
 * A phrase opens with a capital, like every labelled change ("Size · Hero
 * heading"): the strip read "Canvas: add block" beside "Insert · Hero".
 * Scripts without case (Arabic) pass through unchanged.
 */
function sentenceCase(label: string): string {
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

/** The pure projection behind the hook: the log in, the strip's rows out. */
export function recentChangesOf(
  transactions: readonly {
    readonly id: string;
    readonly author: string;
    readonly command: string;
  }[],
  { limit = 3, exclude, phrases, localize }: RecentChangesOptions = {},
): RecentChanges {
  const all = transactions.map((transaction) => ({
    id: transaction.id,
    door: DOOR_BY_AUTHOR[transaction.author] ?? 'canvas',
    label: sentenceCase(
      phrases?.[transaction.command] ??
        (localize === undefined ? phraseOf(transaction.command) : localize(phraseOf(transaction.command))),
    ),
  }));
  const shown = all.filter((change) => change.door !== exclude);
  /*
    A run of the same change through the same door is ONE row: a rich-text
    session commits per keystroke, and the strip filled with three identical
    "Edit text · Rich Text" chips. The row keeps the newest id.
  */
  const runs: typeof shown = [];
  for (const change of shown) {
    const last = runs.at(-1);
    if (last?.door === change.door && last.label === change.label) {
      runs[runs.length - 1] = change;
    } else {
      runs.push(change);
    }
  }
  return {
    // Newest first, which is the order the strip reads in.
    changes: runs.slice(-limit).reverse(),
    spokenElsewhere: shown.length < all.length,
  };
}

export function useRecentChanges(
  kernel: BuilderKernel,
  options: RecentChangesOptions = {},
): RecentChanges {
  const transactions = useSyncExternalStore(
    (listener) => kernel.context.store.subscribe(listener),
    () => kernel.transactions(),
    () => kernel.transactions(),
  );
  return recentChangesOf(transactions, options);
}
