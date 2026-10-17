import { Compiler, Story } from 'inkjs/full';

import type { Cast } from './dialogue/cast';
import {
  createInkDialogue,
  INK_JSON_MAX,
  INK_SOURCE_MAX,
  type InkDialogueOptions,
  type InkStoryLike,
} from './ink/ink-dialogue';

export const INK_VERSION = '2.4.0';

export class InkCompileError extends Error {
  override readonly name = 'InkCompileError';

  constructor(readonly errors: readonly string[]) {
    super(`ink: ${errors.slice(0, 5).join(' | ') || 'compilation failed'}`);
  }
}

function compile(source: string): InkStoryLike {
  if (typeof source !== 'string' || source.trim() === '')
    throw new TypeError('ink: source must be a non-empty string');
  if (source.length > INK_SOURCE_MAX)
    throw new RangeError(`ink: source longer than ${String(INK_SOURCE_MAX)} characters`);
  const compiler = new Compiler(source);
  try {
    return compiler.Compile();
  } catch (error) {
    const errors = compiler.errors.length > 0 ? compiler.errors : [(error as Error).message];
    throw new InkCompileError(errors);
  }
}

function load(json: string | Record<string, unknown>): InkStoryLike {
  const text = typeof json === 'string' ? json : JSON.stringify(json);
  if (text.length > INK_JSON_MAX) throw new RangeError('ink: compiled story is larger than 2 MB');
  return new Story(text);
}

/**
 * Ink source starts with text, a knot or a VAR line; compiled JSON with `{` and inkVersion.
 * Authored scene code is plain JavaScript, so the input is checked as an unknown value.
 */
function toStory(input: unknown): InkStoryLike {
  if (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as InkStoryLike).Continue === 'function'
  ) {
    return input as InkStoryLike;
  }
  if (typeof input === 'string' && !/^\s*\{\s*"inkVersion"/u.test(input)) return compile(input);
  return load(input as string | Record<string, unknown>);
}

/**
 * `s.lib.ink` (creative engines, 2026-10-12): inkjs (MIT, inkle's Ink narrative language) with its
 * compiler, so an authored scene can carry Ink source directly. `dialogue()` wraps a story in the
 * DialogueLike interface `s.lib.dialogue.view` renders. Plain JavaScript; no Pixi.
 */
export function createInkLibrary() {
  return Object.freeze({
    version: INK_VERSION,
    limits: Object.freeze({ source: INK_SOURCE_MAX, json: INK_JSON_MAX }),
    Story,
    Compiler,
    InkCompileError,
    compile,
    load,
    /** Compile without running: the list of errors, empty when the source is valid. */
    check(source: string): readonly string[] {
      try {
        compile(source);
        return [];
      } catch (error) {
        return error instanceof InkCompileError ? error.errors : [(error as Error).message];
      }
    },
    dialogue(
      input: string | Record<string, unknown> | InkStoryLike,
      options?: InkDialogueOptions & { cast?: Cast },
    ) {
      return createInkDialogue(toStory(input), options);
    },
  });
}
