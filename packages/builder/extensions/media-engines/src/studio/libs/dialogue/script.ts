/*
  The dialogue script compiler (split from engine.ts, 2026-10-12): limits, the authored
  input shapes, and compileDialogue, which validates a script into nodes the engine runs.
  Pure and eval-free; createDialogue in engine.ts plays what this produces.
*/

import type { Cast } from './cast';
import { compileExpression, type CompiledExpression, type DialogueValue } from './expression';
import type { DialogueHistoryEntry } from './types';

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

export type SetValue = DialogueValue | string;

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

export interface Update {
  readonly name: string;
  readonly apply: (current: DialogueValue, read: (name: string) => DialogueValue) => DialogueValue;
}

export interface Choice {
  readonly text: string;
  readonly to: string;
  readonly when: CompiledExpression | undefined;
  readonly updates: readonly Update[];
  readonly once: boolean;
  readonly showLocked: boolean;
}

export interface Node {
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

export const ID = /^[\p{L}\p{N}_-]{1,64}$/u;
export const VAR = /^[\p{L}_][\p{L}\p{N}_.]{0,47}$/u;

export function fail(message: string): never {
  throw new TypeError(`dialogue: ${message}`);
}

export function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function isValue(value: unknown): value is DialogueValue {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function compileWhen(source: unknown, where: string): CompiledExpression | undefined {
  if (source === undefined || source === '') return undefined;
  if (typeof source !== 'string') fail(`${where} "if" must be a string`);
  try {
    return compileExpression(source);
  } catch (error) {
    return fail(`${where} "if" ${(error as Error).message}`);
  }
}

export function compileUpdates(set: unknown, where: string): Update[] {
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

export function readCue(cue: unknown): Readonly<Record<string, DialogueValue>> {
  if (typeof cue === 'string' && cue !== '') return Object.freeze({ cue: cue.slice(0, 120) });
  if (typeof cue !== 'object' || cue === null || Array.isArray(cue)) return Object.freeze({});
  const out: Record<string, DialogueValue> = {};
  for (const [key, value] of Object.entries(cue).slice(0, 16)) {
    if (VAR.test(key) && isValue(value))
      out[key] = typeof value === 'string' ? value.slice(0, 120) : value;
  }
  return Object.freeze(out);
}

export function readTags(tags: unknown): readonly string[] {
  if (!Array.isArray(tags)) return Object.freeze([]);
  return Object.freeze(
    tags
      .filter((tag): tag is string => typeof tag === 'string')
      .slice(0, 16)
      .map((tag) => tag.slice(0, 80)),
  );
}

/** The fields of a line object; any of them may be missing or malformed in authored code. */
export type LineFields = Partial<Record<'speaker' | 'text' | 'emotion' | 'cue', unknown>>;

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
