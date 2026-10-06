import type { StyleIntent, StyleMode } from '@craftkit/builder-schema';

/**
 * What the style panel edits, whatever it is (style-manager DESIGN.md §A.8).
 *
 * The panel never knows whether it is styling one heading inside an AI tree,
 * five buttons at once, a registered block's utility-classes prop or a named
 * style in the site library. It reads class strings and hands back intents;
 * the source turns those intents into ONE labelled kernel transaction (or
 * refuses, with the reason the door gave).
 *
 * Every adapter keeps the same promises:
 * - `read()` is document truth at call time (one class string per target),
 *   so an undo or an agent edit shows through on the next render;
 * - `apply()` writes every target in one `dispatchGroup` — one Undo — with a
 *   label such as "Padding · Heading 'Our story'";
 * - `subscribe()` fires whenever any target's stored classes may have changed.
 */
export interface StyleSource {
  /** Stable for the same targets: a panel keys its local state on it. */
  readonly id: string;
  /** The element name used in transaction labels and announcements. */
  readonly label: string;
  /** `free` for agent trees; `tokens` for registered blocks (the tokens-only law). */
  readonly mode: StyleMode;
  /** How many elements one write touches (`Mixed` shows when > 1 and they differ). */
  readonly targetCount: number;
  /** The current class string of each target, in target order. */
  read(): readonly string[];
  /**
   * Apply intents to every target as one transaction labelled
   * `<label> · <source label>`. A refusal leaves the document untouched.
   */
  apply(intents: readonly StyleIntent[], label: string): StyleApplyResult;
  /** Called whenever a target's classes may have changed; returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

export type StyleApplyResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** The transaction label every adapter uses: "Padding · Hero heading". */
export function styleTransactionLabel(property: string, elementName: string): string {
  return `${property} · ${elementName}`.slice(0, 160);
}

/** A thrown door error, as the one sentence a person reads. */
export function refusalMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
