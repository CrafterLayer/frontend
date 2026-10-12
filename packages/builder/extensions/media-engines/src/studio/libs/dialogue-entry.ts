import { createCast, MAX_CAST, type CastMemberInput } from './dialogue/cast';
import {
  compileDialogue,
  createDialogue,
  DIALOGUE_LIMITS,
  DIALOGUE_SAVE_VERSION,
  interpolate,
  type DialogueOptions,
  type DialogueScript,
} from './dialogue/engine';
import { compileExpression, isTruthy } from './dialogue/expression';
import { scriptFromDom, type DialogueLogic } from './dialogue/from-dom';
import type { DialogueLike } from './dialogue/types';
import { createDialogueView, type DialogueViewOptions } from './dialogue/view';

export const DIALOGUE_VERSION = '1.0.0';

/**
 * `s.lib.dialogue` (creative engines, 2026-10-12): branching conversations with a cast,
 * variables, conditions, endings and versioned saves, plus one accessible dialogue box that also
 * renders `s.lib.ink` stories. Plain JavaScript; it never imports Pixi. `fromDom` reads a script
 * whose words live in the section's tree, where translation and editing reach them.
 */
export function createDialogueLibrary() {
  return Object.freeze({
    version: DIALOGUE_VERSION,
    limits: DIALOGUE_LIMITS,
    saveVersion: DIALOGUE_SAVE_VERSION,
    MAX_CAST,
    cast: (members: readonly CastMemberInput[]) => createCast(members),
    create: (script: DialogueScript, options?: DialogueOptions) => createDialogue(script, options),
    /** The script an `<ol data-ck-dialogue>` in `root` holds; `logic` adds vars, if/set, cues by id. */
    fromDom: (root: Element, logic?: DialogueLogic) => scriptFromDom(root, logic),
    /** Validate a script without starting it; throws a TypeError naming the problem. */
    check(script: DialogueScript): true {
      compileDialogue(script);
      return true;
    },
    view: (talk: DialogueLike, options: DialogueViewOptions) => createDialogueView(talk, options),
    expr(source: string) {
      const compiled = compileExpression(source);
      return (vars: Readonly<Record<string, unknown>>) =>
        compiled((name) => {
          const value = vars[name];
          return typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean' ||
            value === null
            ? value
            : 0;
        });
    },
    truthy: isTruthy,
    interpolate: (text: string, vars: Readonly<Record<string, unknown>>) =>
      interpolate(text, (name) => {
        const value = vars[name];
        return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
          ? value
          : null;
      }),
  });
}
