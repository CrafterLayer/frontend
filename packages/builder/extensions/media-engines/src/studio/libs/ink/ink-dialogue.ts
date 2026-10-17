/*
  Ink stories as conversations (creative engines, 2026-10-12): `s.lib.ink.dialogue(source, { cast })`
  compiles an Ink script (inkle's open narrative language, inkjs 2.x) and presents it through the
  same DialogueLike interface as the native graph, so `s.lib.dialogue.view` renders it.

  Conventions read from each line:
  - `Layla: Hello.` — a "Name:" prefix (≤ 40 characters) names the speaker; the cast resolves it.
  - `# speaker:layla`, `# emotion:happy` — tags override the speaker and set the expression.
  - any other `# key:value` tag becomes a scene cue ({ bg: 'forest' }); bare tags stay in `tags`.

  Bounds: source ≤ 100 000 characters, compiled JSON ≤ 2 MB, ≤ 64 empty lines skipped per step,
  ≤ maxSteps lines per story run. External functions and INCLUDE files are not available.
*/

import type { Cast } from '../dialogue/cast';
import type { DialogueValue } from '../dialogue/expression';
import type {
  DialogueEvent,
  DialogueHistoryEntry,
  DialogueLike,
  DialogueLine,
} from '../dialogue/types';

export const INK_SOURCE_MAX = 100_000;
export const INK_JSON_MAX = 2_000_000;
const SILENT_HOPS = 64;
const HISTORY = 200;

export interface InkChoice {
  text: string;
  index: number;
  tags?: string[] | null;
}

export interface InkStoryLike {
  readonly canContinue: boolean;
  readonly currentChoices: InkChoice[];
  readonly currentTags: string[] | null;
  readonly variablesState: {
    $(name: string): unknown;
    $(name: string, value: unknown): void;
  };
  readonly state: { ToJson(): string; LoadJson(json: string): void };
  onError: ((message: string, type: number) => void) | null;
  allowExternalFunctionFallbacks: boolean;
  Continue(): string | null;
  ChooseChoiceIndex(index: number): unknown;
  ResetState(): void;
  ToJson(): unknown;
}

export interface InkDialogueOptions {
  cast?: Cast;
  maxSteps?: number;
}

export interface InkSave {
  v: 1;
  kind: 'ink';
  state: string;
  line: { speaker: string; text: string; emotion: string; tags: string[] };
  history: DialogueHistoryEntry[];
}

const SPEAKER = /^\s*([^:\n]{1,40}?)\s*:\s+(\S[\s\S]*)$/u;

function isPrimitive(value: unknown): value is DialogueValue {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function variableNames(story: InkStoryLike): string[] {
  // inkjs keeps globals in a Map; read it defensively, it is not part of the public typings.
  const globals = (story.variablesState as unknown as { _globalVariables?: Map<string, unknown> })
    ._globalVariables;
  return globals instanceof Map ? [...globals.keys()].slice(0, 128) : [];
}

export function createInkDialogue(
  story: InkStoryLike,
  options: InkDialogueOptions = {},
): DialogueLike {
  const cast = options.cast;
  const maxSteps = Math.max(1, Math.min(100_000, Math.floor(options.maxSteps ?? 10_000)));
  const listeners = new Map<DialogueEvent, Set<(line: DialogueLine) => void>>();
  let history: DialogueHistoryEntry[] = [];
  let steps = 0;
  let counter = 0;
  let started = false;
  let disposed = false;
  let line: DialogueLine = makeLine('', '', '', []);

  story.allowExternalFunctionFallbacks = true;
  story.onError = (message, type) => {
    // type 2 is an error; warnings and author notes are ignored at run time.
    if (type === 2) throw new Error(`ink: ${message}`);
  };

  function emit(event: DialogueEvent): void {
    for (const fn of listeners.get(event) ?? []) fn(line);
  }

  function makeLine(
    rawSpeaker: string,
    text: string,
    emotion: string,
    tags: readonly string[],
  ): DialogueLine {
    const cue: Record<string, DialogueValue> = {};
    const bare: string[] = [];
    let speaker = rawSpeaker;
    let mood = emotion;
    for (const tag of tags.slice(0, 16)) {
      const match = /^\s*([\p{L}_][\p{L}\p{N}_-]{0,31})\s*:\s*(.{0,120})$/u.exec(tag);
      if (match === null) {
        bare.push(tag.trim().slice(0, 80));
        continue;
      }
      // Both groups always take part in a match; the fallbacks only satisfy the index types.
      const key = match[1] ?? '';
      const value = (match[2] ?? '').trim();
      if (key === 'speaker') speaker = value;
      else if (key === 'emotion') mood = value;
      else cue[key] = /^-?\d+(\.\d+)?$/u.test(value) ? Number(value) : value;
    }
    const character = speaker === '' ? undefined : cast?.find(speaker);
    const choices = started && !story.canContinue ? story.currentChoices.slice(0, 16) : [];
    const ended = started && !story.canContinue && choices.length === 0;
    return Object.freeze({
      id: String(counter),
      speaker: character?.id ?? speaker,
      character,
      name: character?.name ?? speaker,
      color: character?.color ?? '',
      text,
      emotion: mood,
      cue: Object.freeze(cue),
      tags: Object.freeze(bare),
      choices: Object.freeze(
        choices.map((choice) =>
          Object.freeze({ index: choice.index, text: choice.text, enabled: true }),
        ),
      ),
      ended,
      ending: '',
      canAdvance: started && story.canContinue,
    });
  }

  function remember(entry: DialogueHistoryEntry): void {
    if (entry.text === '') return;
    history.push(Object.freeze(entry));
    if (history.length > HISTORY) history = history.slice(-HISTORY);
  }

  function parse(raw: string): { speaker: string; text: string } {
    const trimmed = raw.replace(/\s+$/u, '');
    const match = SPEAKER.exec(trimmed);
    if (match !== null) {
      // Both groups always take part in a match; the fallbacks only satisfy the index types.
      const name = match[1] ?? '';
      if (!/[.!?؟،,]/u.test(name)) return { speaker: name.trim(), text: (match[2] ?? '').trim() };
    }
    return { speaker: '', text: trimmed.trim() };
  }

  /** Read live: Continue() changes it, which TypeScript's property narrowing cannot see. */
  function canContinue(): boolean {
    return story.canContinue;
  }

  function step(): void {
    for (let hop = 0; hop <= SILENT_HOPS; hop += 1) {
      if (!story.canContinue) {
        line = makeLine('', '', '', []);
        emit('line');
        if (line.ended) emit('end');
        return;
      }
      steps += 1;
      if (steps > maxSteps) throw new RangeError(`ink: step limit ${String(maxSteps)} reached`);
      const raw = story.Continue() ?? '';
      const tags = story.currentTags ?? [];
      const { speaker, text } = parse(raw);
      if (text === '' && tags.length === 0 && canContinue()) continue;
      counter += 1;
      line = makeLine(speaker, text.slice(0, 2000), '', tags);
      remember({ speaker: line.speaker, name: line.name, text: line.text });
      if (Object.keys(line.cue).length > 0) emit('cue');
      emit('line');
      if (line.ended) emit('end');
      return;
    }
    throw new RangeError('ink: too many empty lines in a row');
  }

  function readVars(): Record<string, DialogueValue> {
    const out: Record<string, DialogueValue> = {};
    for (const name of variableNames(story)) {
      const value = story.variablesState.$(name);
      if (isPrimitive(value)) out[name] = value;
    }
    return out;
  }

  return {
    get current() {
      return line;
    },
    get history() {
      return Object.freeze(history.slice());
    },
    get vars() {
      return Object.freeze(readVars());
    },
    get started() {
      return started;
    },
    start() {
      if (disposed) return line;
      if (!started) {
        started = true;
        step();
      }
      return line;
    },
    advance() {
      if (disposed || !started || !story.canContinue) return false;
      step();
      return true;
    },
    choose(index) {
      if (disposed || !started || story.canContinue) return false;
      const choice = story.currentChoices.find((candidate) => candidate.index === index);
      if (choice === undefined) return false;
      remember({ speaker: '', name: '', text: `› ${choice.text}` });
      story.ChooseChoiceIndex(index);
      emit('change');
      step();
      return true;
    },
    restart() {
      if (disposed) return line;
      story.ResetState();
      history = [];
      steps = 0;
      started = true;
      emit('change');
      step();
      return line;
    },
    get(name) {
      try {
        const value = story.variablesState.$(name);
        return isPrimitive(value) ? value : 0;
      } catch {
        return 0;
      }
    },
    set(name, value) {
      if (disposed || !isPrimitive(value) || !variableNames(story).includes(name)) return;
      story.variablesState.$(name, value);
      emit('change');
    },
    on(event, fn) {
      if (typeof fn !== 'function') return () => undefined;
      const set = listeners.get(event) ?? new Set();
      if (set.size >= 64) throw new RangeError('ink: too many listeners');
      set.add(fn);
      listeners.set(event, set);
      return () => set.delete(fn);
    },
    save(): InkSave {
      return {
        v: 1,
        kind: 'ink',
        state: story.state.ToJson(),
        line: {
          speaker: line.speaker,
          text: line.text,
          emotion: line.emotion,
          tags: [...line.tags],
        },
        history: history.map((entry) => ({ ...entry })),
      };
    },
    load(state) {
      if (disposed || typeof state !== 'object' || state === null) return false;
      // A save is untrusted JSON (storage, a URL, another build): every field is checked.
      const save = state as Partial<Record<keyof InkSave, unknown>>;
      if (
        save.v !== 1 ||
        save.kind !== 'ink' ||
        typeof save.state !== 'string' ||
        save.state.length > INK_JSON_MAX
      ) {
        return false;
      }
      const before = story.state.ToJson();
      try {
        story.state.LoadJson(save.state);
      } catch {
        story.state.LoadJson(before);
        return false;
      }
      history = Array.isArray(save.history)
        ? save.history
            .filter(
              (entry: unknown): entry is DialogueHistoryEntry =>
                typeof entry === 'object' &&
                entry !== null &&
                typeof (entry as { text?: unknown }).text === 'string',
            )
            .slice(-HISTORY)
        : [];
      started = true;
      const shown = (save.line ?? { speaker: '', text: '', emotion: '', tags: [] }) as Partial<
        Record<keyof InkSave['line'], unknown>
      >;
      line = makeLine(
        typeof shown.speaker === 'string' ? shown.speaker : '',
        typeof shown.text === 'string' ? shown.text.slice(0, 2000) : '',
        typeof shown.emotion === 'string' ? shown.emotion : '',
        Array.isArray(shown.tags)
          ? shown.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
      );
      emit('change');
      emit('line');
      if (line.ended) emit('end');
      return true;
    },
    dispose() {
      disposed = true;
      listeners.clear();
      story.onError = null;
    },
  };
}
