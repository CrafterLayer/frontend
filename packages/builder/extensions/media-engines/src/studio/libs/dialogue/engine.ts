/*
  The branching dialogue engine behind `s.lib.dialogue.create` (creative engines, 2026-10-12).

    const talk = D.create({
      start: 'intro',
      vars: { courage: 0 },
      nodes: {
        intro: { lines: [['layla', 'The lantern went out.'], ['omar', 'Then we walk by starlight.']], next: 'ask' },
        ask:   { speaker: 'layla', text: 'Cross the river?', choices: [
                 { text: 'Cross it', to: 'cross', set: { courage: '+=1' } },
                 { text: 'Wait for dawn', to: 'wait' } ] },
        cross: { text: 'The water is cold, but {courage} step is enough.', cue: { fx: 'splash' }, end: true, ending: 'brave' },
        wait:  { text: 'Dawn comes slowly.', end: true, ending: 'patient' },
      },
    }, { cast });

  Data only: conditions and updates go through the eval-free expression compiler, ids and every
  jump target are validated before the story starts, and a story that loops through silent nodes
  stops with a RangeError instead of freezing the page. Saves are versioned plain JSON and are
  checked against this script before they are restored.
*/

import { isTruthy, type DialogueValue } from './expression';
import type {
  DialogueChoiceView,
  DialogueEvent,
  DialogueHistoryEntry,
  DialogueLike,
  DialogueLine,
} from './types';

import {
  DIALOGUE_LIMITS,
  DIALOGUE_SAVE_VERSION,
  VAR,
  compileDialogue,
  interpolate,
  isValue,
  str,
  type DialogueOptions,
  type DialogueSave,
  type DialogueScript,
  type Node,
  type Update,
} from './script';
export { DIALOGUE_LIMITS, DIALOGUE_SAVE_VERSION, compileDialogue, interpolate } from './script';
export type {
  DialogueChoiceInput,
  DialogueLineInput,
  DialogueNodeInput,
  DialogueOptions,
  DialogueSave,
  DialogueScript,
} from './script';

export function createDialogue(
  script: DialogueScript,
  options: DialogueOptions = {},
): DialogueLike {
  const compiled = compileDialogue(script);
  const cast = options.cast;
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const maxSteps = Math.max(
    1,
    Math.min(DIALOGUE_LIMITS.maxSteps, Math.floor(options.maxSteps ?? DIALOGUE_LIMITS.maxSteps)),
  );
  const listeners = new Map<DialogueEvent, Set<(line: DialogueLine) => void>>();
  let vars: Record<string, DialogueValue> = { ...compiled.vars };
  let visited: Record<string, number> = {};
  let once = new Set<string>();
  let history: DialogueHistoryEntry[] = [];
  let at = compiled.start;
  let steps = 0;
  let started = false;
  let disposed = false;
  let line: DialogueLine = blank();

  const read = (name: string): DialogueValue => (name in vars ? (vars[name] as DialogueValue) : 0);

  /** One of a node's random targets (the list is never empty where this is called). */
  const pick = (targets: readonly string[]): string =>
    targets[Math.min(targets.length - 1, Math.floor(rng() * targets.length))] ?? '';

  function blank(): DialogueLine {
    return Object.freeze({
      id: '',
      speaker: '',
      character: undefined,
      name: '',
      color: '',
      text: '',
      emotion: '',
      cue: Object.freeze({}),
      tags: Object.freeze([]),
      choices: Object.freeze([]),
      ended: false,
      ending: '',
      canAdvance: false,
    });
  }

  function emit(event: DialogueEvent): void {
    for (const fn of listeners.get(event) ?? []) fn(line);
  }

  function setVar(name: string, value: DialogueValue): void {
    if (!VAR.test(name) || !isValue(value)) return;
    if (!(name in vars) && Object.keys(vars).length >= DIALOGUE_LIMITS.vars) {
      throw new RangeError(`dialogue: at most ${String(DIALOGUE_LIMITS.vars)} variables`);
    }
    vars[name] = typeof value === 'string' ? value.slice(0, DIALOGUE_LIMITS.text) : value;
  }

  function runUpdates(updates: readonly Update[]): boolean {
    for (const update of updates) setVar(update.name, update.apply(read(update.name), read));
    return updates.length > 0;
  }

  function choicesOf(node: Node): DialogueChoiceView[] {
    const views: DialogueChoiceView[] = [];
    node.choices.forEach((choice, index) => {
      if (choice.once && once.has(`${node.id}:${String(index)}`)) return;
      const open = choice.when === undefined || isTruthy(choice.when(read));
      if (!open && !choice.showLocked) return;
      views.push(Object.freeze({ index, text: interpolate(choice.text, read), enabled: open }));
    });
    return views;
  }

  function show(node: Node): void {
    const choices = choicesOf(node);
    const character = cast?.find(node.speaker);
    const ended =
      node.end || (node.next === '' && node.random.length === 0 && choices.length === 0);
    const text = interpolate(node.text, read);
    line = Object.freeze({
      id: node.id,
      speaker: character?.id ?? node.speaker,
      character,
      name: character?.name ?? node.speaker,
      color: character?.color ?? '',
      text,
      emotion: node.emotion,
      cue: node.cue,
      tags: node.tags,
      choices: Object.freeze(choices),
      ended,
      ending: ended ? node.ending : '',
      canAdvance: !ended && choices.length === 0 && text !== '',
    });
  }

  function remember(entry: DialogueHistoryEntry): void {
    if (entry.text === '') return;
    history.push(Object.freeze(entry));
    if (history.length > DIALOGUE_LIMITS.history) history = history.slice(-DIALOGUE_LIMITS.history);
  }

  function enter(target: string): void {
    let id = target;
    for (let hop = 0; ; hop += 1) {
      if (hop > DIALOGUE_LIMITS.silentHops) {
        throw new RangeError('dialogue: too many silent nodes in a row (a loop with no text?)');
      }
      steps += 1;
      if (steps > maxSteps)
        throw new RangeError(`dialogue: step limit ${String(maxSteps)} reached`);
      const node = compiled.nodes.get(id);
      if (node === undefined) throw new RangeError(`dialogue: unknown node "${id}"`);
      if (node.when !== undefined && !isTruthy(node.when(read))) {
        const skip = node.otherwise || node.next;
        if (skip === '') {
          at = node.id;
          line = Object.freeze({ ...blank(), id: node.id, ended: true });
          emit('line');
          emit('end');
          return;
        }
        id = skip;
        continue;
      }
      visited[node.id] = (visited[node.id] ?? 0) + 1;
      if (runUpdates(node.updates)) emit('change');
      if (node.random.length > 0) {
        id = pick(node.random);
        continue;
      }
      at = node.id;
      show(node);
      if (Object.keys(node.cue).length > 0) emit('cue');
      const silent = line.text === '' && line.choices.length === 0 && !line.ended;
      if (silent) {
        id = node.next;
        continue;
      }
      remember({ speaker: line.speaker, name: line.name, text: line.text });
      emit('line');
      if (line.ended) emit('end');
      return;
    }
  }

  function guard(): boolean {
    return !disposed;
  }

  const dialogue: DialogueLike = {
    get current() {
      return line;
    },
    get history() {
      return Object.freeze(history.slice());
    },
    get vars() {
      return Object.freeze({ ...vars });
    },
    get started() {
      return started;
    },
    start(from) {
      if (!guard()) return line;
      const target = from ?? compiled.start;
      if (!compiled.nodes.has(target)) throw new RangeError(`dialogue: unknown node "${target}"`);
      started = true;
      enter(target);
      return line;
    },
    advance() {
      if (!guard() || !started || !line.canAdvance) return false;
      const node = compiled.nodes.get(at);
      if (node === undefined) return false;
      if (node.random.length > 0) {
        enter(pick(node.random));
      } else enter(node.next);
      return true;
    },
    choose(index) {
      if (!guard() || !started || line.ended) return false;
      const view = line.choices.find((choice) => choice.index === index);
      const node = compiled.nodes.get(at);
      const choice = node?.choices[index];
      if (view === undefined || !view.enabled || node === undefined || choice === undefined)
        return false;
      if (choice.once) once.add(`${node.id}:${String(index)}`);
      remember({ speaker: '', name: '', text: `› ${view.text}` });
      if (runUpdates(choice.updates)) emit('change');
      enter(choice.to);
      return true;
    },
    restart() {
      if (!guard()) return line;
      vars = { ...compiled.vars };
      visited = {};
      once = new Set();
      history = [];
      steps = 0;
      started = true;
      emit('change');
      enter(compiled.start);
      return line;
    },
    get(name) {
      return read(name);
    },
    set(name, value) {
      if (!guard()) return;
      setVar(name, value);
      emit('change');
    },
    on(event, fn) {
      if (typeof fn !== 'function') return () => undefined;
      const set = listeners.get(event) ?? new Set();
      if (set.size >= 64) throw new RangeError('dialogue: too many listeners');
      set.add(fn);
      listeners.set(event, set);
      return () => set.delete(fn);
    },
    save(): DialogueSave {
      return {
        v: DIALOGUE_SAVE_VERSION,
        at,
        vars: { ...vars },
        visited: { ...visited },
        once: [...once],
        history: history.map((entry) => ({ ...entry })),
      };
    },
    load(state) {
      if (!guard() || typeof state !== 'object' || state === null) return false;
      // A save is untrusted JSON (storage, a URL, another build): every field is checked.
      const save = state as Partial<Record<keyof DialogueSave, unknown>>;
      if (save.v !== DIALOGUE_SAVE_VERSION || typeof save.at !== 'string') return false;
      const node = compiled.nodes.get(save.at);
      if (node === undefined) return false;
      if (typeof save.vars !== 'object' || save.vars === null) return false;
      const nextVars: Record<string, DialogueValue> = {};
      for (const [name, value] of Object.entries(save.vars as Readonly<Record<string, unknown>>)) {
        if (!VAR.test(name) || !isValue(value)) return false;
        nextVars[name] = value;
      }
      if (Object.keys(nextVars).length > DIALOGUE_LIMITS.vars) return false;
      const nextVisited: Record<string, number> = {};
      for (const [id, count] of Object.entries(
        (save.visited ?? {}) as Readonly<Record<string, unknown>>,
      )) {
        if (
          !compiled.nodes.has(id) ||
          typeof count !== 'number' ||
          !Number.isSafeInteger(count) ||
          count < 0
        )
          return false;
        nextVisited[id] = count;
      }
      const nextOnce = Array.isArray(save.once)
        ? save.once.filter((key): key is string => typeof key === 'string').slice(0, 512)
        : [];
      const nextHistory = Array.isArray(save.history)
        ? save.history
            .filter(
              (entry: unknown): entry is DialogueHistoryEntry =>
                typeof entry === 'object' &&
                entry !== null &&
                typeof (entry as { text?: unknown }).text === 'string',
            )
            .slice(-DIALOGUE_LIMITS.history)
            .map((entry) =>
              Object.freeze({
                speaker: str(entry.speaker, 64),
                name: str(entry.name, 80),
                text: str(entry.text, DIALOGUE_LIMITS.text),
              }),
            )
        : [];
      vars = nextVars;
      visited = nextVisited;
      once = new Set(nextOnce);
      history = nextHistory;
      at = save.at;
      started = true;
      show(node);
      emit('change');
      emit('line');
      if (line.ended) emit('end');
      return true;
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
  return dialogue;
}

/** How many times a node was entered — handy for "first visit" lines. Reads a save, never mutates. */
export function visitsOf(save: unknown, id: string): number {
  if (typeof save !== 'object' || save === null) return 0;
  const count = (save as Partial<DialogueSave>).visited?.[id];
  return typeof count === 'number' ? count : 0;
}
