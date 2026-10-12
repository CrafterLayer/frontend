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

import type { Cast } from './cast';
import {
  compileExpression,
  isTruthy,
  type CompiledExpression,
  type DialogueValue,
} from './expression';
import type {
  DialogueChoiceView,
  DialogueEvent,
  DialogueHistoryEntry,
  DialogueLike,
  DialogueLine,
} from './types';

export const DIALOGUE_LIMITS = Object.freeze({
  nodes: 512,
  expandedNodes: 1024,
  linesPerNode: 32,
  choices: 8,
  text: 2000,
  vars: 64,
  history: 200,
  silentHops: 64,
  maxSteps: 10_000,
});

export const DIALOGUE_SAVE_VERSION = 1;

type SetValue = DialogueValue | string;

export interface DialogueChoiceInput {
  text: string;
  to: string;
  if?: string;
  set?: Readonly<Record<string, SetValue>>;
  once?: boolean;
  /** Show the choice disabled (instead of hiding it) while its condition is false. */
  showLocked?: boolean;
}

export type DialogueLineInput =
  | readonly [speaker: string, text: string, emotion?: string]
  | {
      speaker?: string;
      text: string;
      emotion?: string;
      cue?: Readonly<Record<string, DialogueValue>>;
    };

export interface DialogueNodeInput {
  speaker?: string;
  text?: string;
  lines?: readonly DialogueLineInput[];
  emotion?: string;
  cue?: string | Readonly<Record<string, DialogueValue>>;
  tags?: readonly string[];
  if?: string;
  else?: string;
  set?: Readonly<Record<string, SetValue>>;
  next?: string;
  random?: readonly string[];
  choices?: readonly DialogueChoiceInput[];
  end?: boolean;
  ending?: string;
}

export interface DialogueScript {
  start: string;
  vars?: Readonly<Record<string, DialogueValue>>;
  nodes: Readonly<Record<string, DialogueNodeInput>>;
}

export interface DialogueOptions {
  cast?: Cast;
  /** A seeded random source, e.g. s.random. */
  rng?: () => number;
  maxSteps?: number;
}

export interface DialogueSave {
  v: 1;
  at: string;
  vars: Record<string, DialogueValue>;
  visited: Record<string, number>;
  once: string[];
  history: DialogueHistoryEntry[];
}

interface Update {
  readonly name: string;
  readonly apply: (current: DialogueValue, read: (name: string) => DialogueValue) => DialogueValue;
}

interface Choice {
  readonly text: string;
  readonly to: string;
  readonly when: CompiledExpression | undefined;
  readonly updates: readonly Update[];
  readonly once: boolean;
  readonly showLocked: boolean;
}

interface Node {
  readonly id: string;
  readonly speaker: string;
  readonly text: string;
  readonly emotion: string;
  readonly cue: Readonly<Record<string, DialogueValue>>;
  readonly tags: readonly string[];
  readonly when: CompiledExpression | undefined;
  readonly otherwise: string;
  readonly updates: readonly Update[];
  readonly next: string;
  readonly random: readonly string[];
  readonly choices: readonly Choice[];
  readonly end: boolean;
  readonly ending: string;
}

const ID = /^[\p{L}\p{N}_-]{1,64}$/u;
const VAR = /^[\p{L}_][\p{L}\p{N}_.]{0,47}$/u;

function fail(message: string): never {
  throw new TypeError(`dialogue: ${message}`);
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isValue(value: unknown): value is DialogueValue {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function compileWhen(source: unknown, where: string): CompiledExpression | undefined {
  if (source === undefined || source === '') return undefined;
  if (typeof source !== 'string') fail(`${where} "if" must be a string`);
  try {
    return compileExpression(source);
  } catch (error) {
    return fail(`${where} "if" ${(error as Error).message}`);
  }
}

function compileUpdates(set: unknown, where: string): Update[] {
  if (set === undefined) return [];
  if (typeof set !== 'object' || set === null || Array.isArray(set))
    fail(`${where} "set" must be an object`);
  const updates: Update[] = [];
  for (const [name, raw] of Object.entries(set as Record<string, unknown>)) {
    if (!VAR.test(name)) fail(`${where} variable "${name}" is not a valid name`);
    if (typeof raw === 'string' && /^[+-]=\s*-?\d+(\.\d+)?$/u.test(raw)) {
      const delta = Number(raw.slice(2)) * (raw.startsWith('-') ? -1 : 1);
      updates.push({
        name,
        apply: (current) => {
          const base = typeof current === 'number' ? current : Number(current) || 0;
          const next = base + delta;
          return Number.isFinite(next) ? next : base;
        },
      });
    } else if (typeof raw === 'string' && raw.startsWith('=')) {
      let compiled: CompiledExpression;
      try {
        compiled = compileExpression(raw.slice(1));
      } catch (error) {
        return fail(`${where} "${name}" ${(error as Error).message}`);
      }
      updates.push({ name, apply: (_current, read) => compiled(read) });
    } else if (isValue(raw)) {
      const value = typeof raw === 'string' ? raw.slice(0, DIALOGUE_LIMITS.text) : raw;
      updates.push({ name, apply: () => value });
    } else
      fail(`${where} "${name}" must be a number, text, boolean, "+=n", "-=n" or "=expression"`);
  }
  return updates;
}

function readCue(cue: unknown): Readonly<Record<string, DialogueValue>> {
  if (typeof cue === 'string' && cue !== '') return Object.freeze({ cue: cue.slice(0, 120) });
  if (typeof cue !== 'object' || cue === null || Array.isArray(cue)) return Object.freeze({});
  const out: Record<string, DialogueValue> = {};
  for (const [key, value] of Object.entries(cue).slice(0, 16)) {
    if (VAR.test(key) && isValue(value))
      out[key] = typeof value === 'string' ? value.slice(0, 120) : value;
  }
  return Object.freeze(out);
}

function readTags(tags: unknown): readonly string[] {
  if (!Array.isArray(tags)) return Object.freeze([]);
  return Object.freeze(
    tags
      .filter((tag): tag is string => typeof tag === 'string')
      .slice(0, 16)
      .map((tag) => tag.slice(0, 80)),
  );
}

/** The fields of a line object; any of them may be missing or malformed in authored code. */
type LineFields = Partial<Record<'speaker' | 'text' | 'emotion' | 'cue', unknown>>;

/**
 * Validate a script and expand `lines` into chained nodes. Scripts come from authored scene code
 * (plain JavaScript), so the script and every node, choice and line are checked at run time.
 */
export function compileDialogue(input: unknown): {
  start: string;
  vars: Record<string, DialogueValue>;
  nodes: Map<string, Node>;
} {
  if (typeof input !== 'object' || input === null) fail('script must be an object');
  const script = input as Partial<Record<keyof DialogueScript, unknown>>;
  const nodeInputs = script.nodes;
  if (typeof nodeInputs !== 'object' || nodeInputs === null) fail('script.nodes must be an object');
  const inputs = nodeInputs as Readonly<Record<string, unknown>>;
  const ids = Object.keys(inputs);
  if (ids.length < 1 || ids.length > DIALOGUE_LIMITS.nodes) {
    fail(`needs 1..${String(DIALOGUE_LIMITS.nodes)} nodes`);
  }
  const vars: Record<string, DialogueValue> = {};
  for (const [name, value] of Object.entries(
    (script.vars ?? {}) as Readonly<Record<string, unknown>>,
  )) {
    if (!VAR.test(name) || !isValue(value))
      fail(`variable "${name}" must be a valid name with a simple value`);
    vars[name] = value;
  }
  if (Object.keys(vars).length > DIALOGUE_LIMITS.vars)
    fail(`at most ${String(DIALOGUE_LIMITS.vars)} variables`);

  const nodes = new Map<string, Node>();
  for (const id of ids) {
    if (!ID.test(id)) fail(`node id "${id}" must be 1..64 letters, digits, _ or -`);
    const nodeInput = inputs[id];
    if (typeof nodeInput !== 'object' || nodeInput === null) fail(`node "${id}" must be an object`);
    const input = nodeInput as Partial<Record<keyof DialogueNodeInput, unknown>>;
    const where = `node "${id}"`;
    const choiceInputs: readonly unknown[] = Array.isArray(input.choices) ? input.choices : [];
    const choices: Choice[] = choiceInputs.map((choiceInput, index) => {
      if (typeof choiceInput !== 'object' || choiceInput === null)
        fail(`${where} choice ${String(index)} must be an object`);
      const choice = choiceInput as Partial<Record<keyof DialogueChoiceInput, unknown>>;
      const label = str(choice.text, 300).trim();
      if (label === '') fail(`${where} choice ${String(index)} needs text`);
      return {
        text: label,
        to: str(choice.to, 64),
        when: compileWhen(choice.if, `${where} choice ${String(index)}`),
        updates: compileUpdates(choice.set, `${where} choice ${String(index)}`),
        once: choice.once === true,
        showLocked: choice.showLocked === true,
      };
    });
    if (choices.length > DIALOGUE_LIMITS.choices)
      fail(`${where} has more than ${String(DIALOGUE_LIMITS.choices)} choices`);

    const lines: readonly unknown[] = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length > DIALOGUE_LIMITS.linesPerNode)
      fail(`${where} has more than ${String(DIALOGUE_LIMITS.linesPerNode)} lines`);
    const base = {
      speaker: str(input.speaker, 64),
      text: str(input.text, DIALOGUE_LIMITS.text),
      emotion: str(input.emotion, 48),
      cue: readCue(input.cue),
      tags: readTags(input.tags),
    };
    const parts =
      lines.length === 0
        ? [base]
        : lines.map((line, index) => {
            // A line is a [speaker, text, emotion?] tuple or an object with those fields.
            const tuple: readonly unknown[] | undefined = Array.isArray(line) ? line : undefined;
            const fields = line as LineFields;
            const [speaker, text, emotion] =
              tuple === undefined
                ? [fields.speaker, fields.text, fields.emotion]
                : [tuple[0], tuple[1], tuple[2]];
            if (typeof text !== 'string' || text.trim() === '')
              fail(`${where} line ${String(index)} needs text`);
            return {
              speaker: str(speaker, 64),
              text: str(text, DIALOGUE_LIMITS.text),
              emotion: str(emotion, 48),
              cue: index === 0 ? readCue(fields.cue ?? input.cue) : readCue(fields.cue),
              tags: index === 0 ? base.tags : Object.freeze([]),
            };
          });
    parts.forEach((part, index) => {
      const partId = index === 0 ? id : `${id}~${String(index)}`;
      const last = index === parts.length - 1;
      nodes.set(partId, {
        id: partId,
        ...part,
        when: index === 0 ? compileWhen(input.if, where) : undefined,
        otherwise: index === 0 ? str(input.else, 64) : '',
        updates: index === 0 ? compileUpdates(input.set, where) : [],
        next: last ? str(input.next, 64) : `${id}~${String(index + 1)}`,
        random:
          last && Array.isArray(input.random)
            ? input.random.slice(0, 16).map((target) => str(target, 64))
            : [],
        choices: last ? choices : [],
        end: last && input.end === true,
        ending: last ? str(input.ending, 64) : '',
      });
    });
    if (nodes.size > DIALOGUE_LIMITS.expandedNodes)
      fail(`expands to more than ${String(DIALOGUE_LIMITS.expandedNodes)} nodes`);
  }

  const missing: string[] = [];
  const check = (target: string, from: string): void => {
    if (target !== '' && !nodes.has(target)) missing.push(`${from} → "${target}"`);
  };
  for (const node of nodes.values()) {
    check(node.next, node.id);
    check(node.otherwise, node.id);
    for (const target of node.random) check(target, node.id);
    for (const choice of node.choices) {
      if (choice.to === '') missing.push(`${node.id} → a choice with no "to"`);
      else check(choice.to, node.id);
    }
  }
  const start = str(script.start, 64) || (ids[0] ?? '');
  if (!nodes.has(start)) missing.push(`start → "${start}"`);
  if (missing.length > 0) fail(`unknown targets: ${missing.slice(0, 8).join(', ')}`);
  return { start, vars, nodes };
}

export function interpolate(text: string, read: (name: string) => DialogueValue): string {
  return text.replace(/\{([\p{L}_][\p{L}\p{N}_.]{0,47})\}/gu, (_match, name: string) => {
    const value = read(name);
    return value === null ? '' : String(value);
  });
}

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
