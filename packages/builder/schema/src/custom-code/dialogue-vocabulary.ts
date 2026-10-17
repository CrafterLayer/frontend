/**
 * The dialogue markers (creative engines, 2026-10-12): a story's lines held in the section's tree,
 * read by the scene's `s.lib.dialogue.fromDom` instead of being frozen in script strings — so
 * `page.translate` translates them as ordinary element text and a person edits them as text.
 *
 *   <ol data-ck-dialogue hidden>
 *     <li data-ck-speaker="layla">The lantern went out.</li>
 *     <li data-ck-node="ask" data-ck-speaker="omar">Cross the river?
 *       <button data-ck-next="cross">Cross it</button><button data-ck-next="wait">Wait</button></li>
 *     <li data-ck-node="cross" data-ck-ending="brave">The water is cold.</li>
 *     <li data-ck-node="wait" data-ck-ending="patient">Dawn comes slowly.</li>
 *   </ol>
 *
 * Every value is a node id, a cast id or an ending name (`DIALOGUE_ID`, the dialogue runtime's
 * own id rule), never words, code or an address: the tree still carries data only, and the
 * runtime checks the graph (targets, limits) when the scene reads it. This module imports
 * nothing; the tree door (`custom-code-tree.ts`) admits these names with these rules.
 */

/** A node id, cast id or ending name: what the dialogue runtime accepts as an id. */
export const DIALOGUE_ID = /^[\p{L}\p{N}_-]{1,64}$/u;

/** The marker names, in the order a script is written. */
export const CUSTOM_CODE_DIALOGUE_ATTRIBUTES = [
  // The list of lines; its value, when given, is the node the conversation starts at.
  'data-ck-dialogue',
  // On a line: its id (a jump lands there), who says it, where it goes next, the ending it ends on.
  'data-ck-node',
  'data-ck-speaker',
  'data-ck-next',
  'data-ck-ending',
] as const;

export type CustomCodeDialogueAttribute = (typeof CUSTOM_CODE_DIALOGUE_ATTRIBUTES)[number];

interface DialogueMarkerRule {
  /** The tags that may carry the marker. */
  readonly on: readonly string[];
  /** What is wrong with the value, or undefined when it is fine. */
  readonly value: (value: string, name: string) => string | undefined;
}

const id =
  (bare: boolean) =>
  (value: string, name: string): string | undefined =>
    (bare && value === '') || DIALOGUE_ID.test(value)
      ? undefined
      : `${name} is ${bare ? 'bare or ' : ''}an id of 1-64 letters, digits, _ or -`;

/** Where each marker may stand and what its value may be (the door names the fix otherwise). */
export const CUSTOM_CODE_DIALOGUE_RULES: Readonly<
  Record<CustomCodeDialogueAttribute, DialogueMarkerRule>
> = {
  'data-ck-dialogue': { on: ['ol', 'ul'], value: id(true) },
  'data-ck-node': { on: ['li'], value: id(false) },
  'data-ck-speaker': { on: ['li'], value: id(false) },
  // A line jumps; a choice (a button inside a line) goes there when chosen.
  'data-ck-next': { on: ['li', 'button'], value: id(false) },
  // Bare: the conversation ends there without a named ending.
  'data-ck-ending': { on: ['li'], value: id(true) },
};
