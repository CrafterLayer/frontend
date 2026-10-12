/*
  The shape every conversation runtime presents (creative engines, 2026-10-12): the native
  dialogue graph (`s.lib.dialogue.create`) and the Ink adapter (`s.lib.ink.dialogue`) both
  implement it, so one accessible view (`s.lib.dialogue.view`) and one piece of scene code can
  drive either.
*/

import type { CastMember } from './cast';
import type { DialogueValue } from './expression';

export interface DialogueChoiceView {
  readonly index: number;
  readonly text: string;
  readonly enabled: boolean;
}

export interface DialogueLine {
  /** Node id (graph) or a running counter (Ink). */
  readonly id: string;
  /** Cast id, or '' for narration. */
  readonly speaker: string;
  readonly character: CastMember | undefined;
  /** Display name: the cast name, the raw speaker, or '' for narration. */
  readonly name: string;
  readonly color: string;
  readonly text: string;
  readonly emotion: string;
  /** Scene cues for the scene code: background, music, effect, camera… */
  readonly cue: Readonly<Record<string, DialogueValue>>;
  readonly tags: readonly string[];
  readonly choices: readonly DialogueChoiceView[];
  readonly ended: boolean;
  readonly ending: string;
  /** True when advance() would move on (there is text and no choice is pending). */
  readonly canAdvance: boolean;
}

export type DialogueEvent = 'line' | 'end' | 'change' | 'cue';

export interface DialogueHistoryEntry {
  readonly speaker: string;
  readonly name: string;
  readonly text: string;
}

export interface DialogueLike {
  readonly current: DialogueLine;
  readonly history: readonly DialogueHistoryEntry[];
  readonly vars: Readonly<Record<string, DialogueValue>>;
  readonly started: boolean;
  start(at?: string): DialogueLine;
  advance(): boolean;
  choose(index: number): boolean;
  restart(): DialogueLine;
  get(name: string): DialogueValue;
  set(name: string, value: DialogueValue): void;
  on(event: DialogueEvent, fn: (line: DialogueLine) => void): () => void;
  save(): unknown;
  load(state: unknown): boolean;
  dispose(): void;
}
