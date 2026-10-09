import { systemClock, systemIds, type BuilderKernel } from '@craftkit/builder-core';

import { validateAiPlan } from '../plan/validate-plan';
import type { AiEffectiveCommandPolicy } from '../skills/command-policy';
import { DEFAULT_AI_MAX_COMMANDS, DEFAULT_AI_MAX_OPERATIONS } from '../skills/command-policy';
import { treeWritesOf } from '../style-tools/tree-steps';
import { expandAgentTools } from '../tools/agent/expand';
import { AGENT_TOOLS } from '../tools/agent/registry';
import { isRecord, type JsonRecord } from '../tools/agent/shared';
import { AGENT_TOOL_COMMAND, type AgentToolLane, type AgentToolStep } from '../tools/agent/types';
import type { AiPlanValidationIssue, AiValidationPorts } from '../types';
import { coalesceScriptSteps, scriptDefaultTitle, type PropReader } from './coalesce';
import { buildElementIndex, type ElementIndex, type ScriptSite } from './element-index';
import { resolveScriptLimits } from './limits';
import { scriptError } from './errors';
import { normalizeScriptCode } from './normalize-code';
import { scriptPhotos } from './photos-index';
import {
  SCRIPT_TOOL_NAME,
  type ScriptError,
  type ScriptLimits,
  type ScriptRunner,
  type ScriptRunResult,
} from './types';
import { callsToSteps, otherPageError, toolInputError, type MappedStep } from './write-map';

export type { ScriptSite } from './element-index';

/**
 * The async pre-pass that turns `script.run` steps into ordinary kernel steps
 * BEFORE the door (agent-script DESIGN §A.7).
 *
 * For each script step, in order:
 *   1. the plan's earlier steps are expanded and folded into a `readProp`, so
 *      the script reads the page as the plan leaves it;
 *   2. the element index is built from that page (every page with a site);
 *   3. the sandbox runs the script and returns its queued calls (JSON in, JSON out);
 *   4. the calls are mapped to agent tool steps (write-map) and expanded with
 *      the same `expandAgentTools` every tool step goes through;
 *   5. the writes are coalesced per (node, prop), so the plan stays under the
 *      door's 64-command / 256-operation caps;
 *   6. the script step is replaced by those kernel steps.
 *
 * The result is still ONE plan: one labelled transaction, one Undo. A script
 * that fails leaves its step in place with an `invalid-args` issue whose
 * message (E_*) tells the model how to fix the script, so the existing repair
 * round works unchanged. A plan with no script step is returned as is and no
 * runner is loaded.
 */

export interface ScriptExpansionOptions {
  /** The lanes the plan's tools come from; `ck.tool` may name only their tools. Absent = every tool. */
  readonly lanes?: readonly AgentToolLane[];
  /** Default: `defaultScriptRunner()` (a browser Worker, or in-thread where there is none). */
  readonly runner?: ScriptRunner;
  readonly sampleValues?: readonly string[];
  /** Absent ⇒ the open page only, and a write to another page is E_OTHER_PAGE. */
  readonly site?: ScriptSite;
  /** The caps (maxCommands / maxOperations) and, for other pages, the door's policy. */
  readonly policy?: AiEffectiveCommandPolicy;
  readonly limits?: Partial<ScriptLimits>;
  /** Ports for validating other pages' steps (default: the system clock and ids). */
  readonly validationPorts?: AiValidationPorts;
}

/** What one script did, for the person (never sent back to the model). */
export interface ScriptRunReport {
  /** The script step's index in the plan. */
  readonly step: number;
  readonly ms: number;
  readonly calls: number;
  /** Kernel steps it produced after coalescing, every page counted. */
  readonly steps: number;
  readonly result?: string;
  readonly notes: readonly string[];
}

export interface ScriptExpansion {
  /** The plan with its script steps replaced by kernel steps; the input itself when there were issues. */
  readonly plan: unknown;
  /** `invalid-args`, `step` = the script step's index. */
  readonly issues: AiPlanValidationIssue[];
  readonly runs: readonly ScriptRunReport[];
  /** Other pages' steps (only with a site), each door-valid on its page's lens. */
  readonly crossPage: readonly { readonly pageId: string; readonly commands: readonly AgentToolStep[] }[];
}

/** The page id a script sees when the host passes no site. */
export const SCRIPT_DEFAULT_PAGE_ID = 'page';

const MARKER = '\u0000script:';
const REMOVAL_NOTE_AT = 10;

export function isScriptStep(step: unknown): step is JsonRecord {
  return (
    isRecord(step) &&
    step['command'] === AGENT_TOOL_COMMAND &&
    isRecord(step['args']) &&
    step['args']['name'] === SCRIPT_TOOL_NAME
  );
}

/** The tools `ck.tool` may call for these lanes: the same rule as expand.ts `allowed()`. */
export function scriptToolNames(lanes: readonly AgentToolLane[] | undefined): readonly string[] {
  return AGENT_TOOLS.filter((tool) => lanes === undefined || tool.lanes.some((lane) => lanes.includes(lane))).map(
    ({ name }) => name,
  );
}

/** FNV-1a (32-bit) of a string: the script's random seed is the plan's hash. */
export function scriptSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function issue(step: number, message: string): AiPlanValidationIssue {
  return { code: 'invalid-args', message: `Step ${String(step)} (tool ${SCRIPT_TOOL_NAME}): ${message}`, step };
}

function liveReader(kernel: BuilderKernel): PropReader {
  return (id, key) => {
    const nodes = kernel.getDocument().nodes;
    if (!Object.hasOwn(nodes, id)) return undefined;
    const props = nodes[id]?.props;
    return props !== undefined && Object.hasOwn(props, key) ? props[key] : undefined;
  };
}

/** A reader primed by the plan's earlier steps: the same `remember` rule as expand.ts. */
function primedReader(kernel: BuilderKernel, prefix: readonly unknown[]): { readProp: PropReader; dir: 'rtl' | 'ltr' } {
  const live = liveReader(kernel);
  const written = new Map<string, unknown>();
  const slot = (id: string, key: string) => `${id}\u0000${key}`;
  const readProp: PropReader = (id, key) => {
    const at = slot(id, key);
    return written.has(at) ? written.get(at) : live(id, key);
  };
  let dir: 'rtl' | 'ltr' = kernel.getDocument().dir === 'rtl' ? 'rtl' : 'ltr';
  for (const step of prefix) {
    if (!isRecord(step) || !isRecord(step['args'])) continue;
    const args = step['args'];
    if (step['command'] === 'setProp' && typeof args['id'] === 'string' && typeof args['key'] === 'string') {
      written.set(slot(args['id'], args['key']), args['value']);
    }
    for (const [id, tree] of treeWritesOf(step, (id) => readProp(id, 'tree'))) written.set(slot(id, 'tree'), tree);
    if (step['command'] === 'setDocMeta' && (args['dir'] === 'rtl' || args['dir'] === 'ltr')) dir = args['dir'];
  }
  return { readProp, dir };
}

async function loadDefaultRunner(): Promise<ScriptRunner> {
  const { defaultScriptRunner } = await import('./default-runner');
  return defaultScriptRunner();
}

type Expanded =
  | { readonly ok: true; readonly steps: readonly AgentToolStep[]; readonly origins: readonly number[] }
  | { readonly ok: false; readonly error: ScriptError };

const STEP_PREFIX = /^Step \d+ \(tool [^)]*\): /u;

/**
 * Expand the queued steps after `prefix` with `expandAgentTools`, keeping
 * which queued step each produced step came from (a title marker the tool
 * expansion carries onto each tool's first step). A set/style that changes
 * nothing ("nothing to change") is dropped, not an error: a script that
 * rounds every button skips the ones already round.
 */
function expandQueued(
  kernel: BuilderKernel,
  prefix: readonly unknown[],
  queued: readonly MappedStep[],
  sampleValues: readonly string[],
): Expanded {
  let active = queued.map((entry, at) => ({ at, step: { ...entry.step, title: `${MARKER}${String(at)}` } }));
  for (let round = 0; round < 4; round += 1) {
    const expanded = expandAgentTools({ rationale: 'script', commands: [...prefix, ...active.map(({ step }) => step)] }, kernel, {
      sampleValues,
    });
    const noops = new Set<number>();
    for (const found of expanded.issues) {
      if (found.step === undefined || found.step < prefix.length) continue;
      const entry = active[found.step - prefix.length];
      const source = entry === undefined ? undefined : queued[entry.at];
      if (entry === undefined || source === undefined) continue;
      const message = found.message.replace(STEP_PREFIX, '');
      if (source.origin !== 'tool' && /^nothing to change\b/u.test(message)) {
        noops.add(found.step - prefix.length);
        continue;
      }
      return { ok: false, error: toolInputError(source.n, source.line, source.tool, message) };
    }
    if (noops.size > 0) {
      active = active.filter((_, position) => !noops.has(position));
      continue;
    }
    const commands = (expanded.plan as { commands: unknown[] }).commands.slice(prefix.length);
    const steps: AgentToolStep[] = [];
    const origins: number[] = [];
    let origin = -1;
    for (const produced of commands) {
      if (!isRecord(produced)) continue;
      const title = produced['title'];
      if (typeof title === 'string' && title.startsWith(MARKER)) origin = Number(title.slice(MARKER.length));
      steps.push({ command: String(produced['command']), args: isRecord(produced['args']) ? produced['args'] : {} });
      origins.push(origin);
    }
    return { ok: true, steps, origins };
  }
  /* v8 ignore next -- a dropped no-op never makes another step a no-op. */
  return { ok: false, error: toolInputError(undefined, undefined, SCRIPT_TOOL_NAME, 'the script\'s edits did not settle; write them as plain steps.') };
}

function kindCounts(index: ElementIndex, pageId: string): Record<string, number> {
  const counts = new Map<string, number>();
  for (const element of index.elements) {
    if (element.page !== pageId) continue;
    counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function emptyError(index: ElementIndex, pageId: string, mapped: readonly MappedStep[]): ScriptError {
  const kinds = new Map<string, number>();
  for (const entry of mapped) if (entry.kind !== undefined) kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1);
  const top = [...kinds.entries()].sort((left, right) => right[1] - left[1])[0];
  return scriptError('E_EMPTY', {
    ...(top === undefined ? {} : { kind: top[0], found: top[1] }),
    kinds: kindCounts(index, pageId),
  });
}

function tooManyError(writes: number, max: number): ScriptError {
  return scriptError('E_TOO_MANY_WRITES', { count: writes, max });
}

function engineError(): ScriptError {
  return scriptError('E_ENGINE');
}

function errorText(error: ScriptError): string {
  return error.message.startsWith(error.code) ? error.message : `${error.code}: ${error.message}`;
}

function originError(origins: readonly number[], at: number, queued: readonly MappedStep[], message: string): ScriptError {
  const source = queued[origins[at] ?? -1];
  return source === undefined
    ? toolInputError(undefined, undefined, SCRIPT_TOOL_NAME, message)
    : toolInputError(source.n, source.line, source.tool, message);
}

function removals(steps: readonly AgentToolStep[]): number {
  return steps.filter((entry) => entry.command === 'removeNode' || entry.command === 'removeTreeNode').length;
}

interface StepOutcome {
  readonly steps: readonly AgentToolStep[];
  readonly cross: ReadonlyMap<string, readonly AgentToolStep[]>;
  readonly report: ScriptRunReport;
}

/** Expand every `script.run` step of a candidate plan, in order. */
export async function expandScriptSteps(
  candidate: unknown,
  kernel: BuilderKernel,
  options: ScriptExpansionOptions = {},
): Promise<ScriptExpansion> {
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) return { plan: candidate, issues: [], runs: [], crossPage: [] };
  const commands = candidate['commands'] as unknown[];
  if (!commands.some(isScriptStep)) return { plan: candidate, issues: [], runs: [], crossPage: [] };

  let runner = options.runner;
  const issues: AiPlanValidationIssue[] = [];
  const runs: ScriptRunReport[] = [];
  const cross = new Map<string, { steps: AgentToolStep[]; from: number }>();
  const out: unknown[] = [];
  const tools = scriptToolNames(options.lanes);
  const limits: ScriptLimits = resolveScriptLimits(options.limits);
  let seed: number;
  try {
    seed = scriptSeed(JSON.stringify(candidate));
  } catch {
    seed = 0;
  }
  const maxCommands = options.policy?.maxCommands ?? DEFAULT_AI_MAX_COMMANDS;
  const maxOperations = options.policy?.maxOperations ?? DEFAULT_AI_MAX_OPERATIONS;
  const sampleValues = options.sampleValues ?? [];
  const site = options.site;
  const pageId = site?.currentPage() ?? SCRIPT_DEFAULT_PAGE_ID;

  const runOne = async (k: number, step: JsonRecord): Promise<{ ok: true; value: StepOutcome } | { ok: false; error: ScriptError }> => {
    const args = isRecord(step['args']) ? step['args'] : {};
    const input = args['input'];
    if (!isRecord(input) || typeof input['code'] !== 'string' || Object.keys(input).some((key) => key !== 'code')) {
      return {
        ok: false,
        error: toolInputError(undefined, undefined, SCRIPT_TOOL_NAME, 'input must be exactly {"code":"…"}: the script as ONE string of plain JavaScript.'),
      };
    }
    const code = normalizeScriptCode(input['code']);

    // The plan's earlier steps, expanded, so the script reads the page as they leave it.
    const before = expandAgentTools({ rationale: 'script prefix', commands: out }, kernel, {
      ...(options.lanes === undefined ? {} : { lanes: options.lanes }),
      sampleValues,
    });
    const prefix = [...(before.plan as { commands: unknown[] }).commands];
    const reader = primedReader(kernel, prefix);
    const lang = reader.readProp(kernel.getDocument().rootId, 'lang');
    const locale = {
      lang: typeof lang === 'string' && lang.trim() !== '' ? lang.trim().toLowerCase() : reader.dir === 'rtl' ? 'ar' : 'en',
      dir: reader.dir,
    };
    const index = buildElementIndex(kernel, reader.readProp, { pageId, locale, ...(site === undefined ? {} : { site }) });

    let result: ScriptRunResult;
    try {
      runner ??= options.runner ?? (await loadDefaultRunner());
      result = await runner.run({
        code,
        elements: index.elements,
        pages: index.pages,
        photos: scriptPhotos(locale.lang),
        tools,
        locale,
        seed,
        now: (options.validationPorts?.clock ?? systemClock).now(),
        limits,
      });
    } catch {
      return { ok: false, error: engineError() };
    }
    if (!result.ok) return { ok: false, error: result.error };

    const open = index.pages.find((page) => page.id === pageId);
    const pageName = open === undefined ? pageId : open.title.trim() || open.slug.trim() || pageId;
    const mapping = callsToSteps(result.calls, index.handles, {
      currentPage: pageId,
      site: site !== undefined,
      tools,
      pages: index.pages,
      pageName,
    });
    if (!mapping.ok) return { ok: false, error: mapping.error };
    const allMapped = [...mapping.byPage.values()].flat();
    const title =
      typeof step['title'] === 'string' && step['title'].trim() !== ''
        ? step['title']
        : (result.notes[0] ?? scriptDefaultTitle(allMapped.length, locale.lang));

    // The open page.
    const queued = mapping.byPage.get(pageId) ?? [];
    let steps: readonly AgentToolStep[] = [];
    let removed = 0;
    if (queued.length > 0) {
      const tail = expandQueued(kernel, prefix, queued, sampleValues);
      if (!tail.ok) return tail;
      removed += removals(tail.steps);
      const folded = coalesceScriptSteps(tail.steps, reader.readProp, { title });
      if (!folded.ok) return { ok: false, error: originError(tail.origins, folded.step, queued, folded.error) };
      steps = folded.steps;
    }
    const total = out.length + steps.length + (commands.length - k - 1);
    if (total > maxCommands || total > maxOperations) {
      return { ok: false, error: tooManyError(steps.length, Math.min(maxCommands, maxOperations)) };
    }

    // Other pages (only with a site): each against its own lens.
    const otherPages = new Map<string, readonly AgentToolStep[]>();
    for (const [other, list] of mapping.byPage) {
      if (other === pageId) continue;
      if (site === undefined) return { ok: false, error: otherPageError(pageName) };
      const lens = site.page(other);
      const tail = expandQueued(lens, [], list, sampleValues);
      if (!tail.ok) return tail;
      removed += removals(tail.steps);
      const folded = coalesceScriptSteps(tail.steps, liveReader(lens), { title });
      if (!folded.ok) return { ok: false, error: originError(tail.origins, folded.step, list, folded.error) };
      if (folded.steps.length > Math.min(maxCommands, maxOperations)) {
        return { ok: false, error: tooManyError(folded.steps.length, Math.min(maxCommands, maxOperations)) };
      }
      if (folded.steps.length > 0) otherPages.set(other, folded.steps);
    }

    if (steps.length === 0 && otherPages.size === 0) {
      return { ok: false, error: emptyError(index, pageId, allMapped) };
    }
    const notes = [...result.notes];
    if (removed > REMOVAL_NOTE_AT) {
      notes.push(
        locale.lang.startsWith('ar') ? `هذا السكربت يحذف ${String(removed)} عنصرًا.` : `This script removes ${String(removed)} elements.`,
      );
    }
    return {
      ok: true,
      value: {
        steps,
        cross: otherPages,
        report: {
          step: k,
          ms: result.stats.ms,
          calls: result.stats.calls,
          steps: steps.length + [...otherPages.values()].reduce((sum, list) => sum + list.length, 0),
          ...(result.result === undefined ? {} : { result: result.result }),
          notes,
        },
      },
    };
  };

  for (const [k, step] of commands.entries()) {
    if (!isScriptStep(step)) {
      out.push(step);
      continue;
    }
    const outcome = await runOne(k, step);
    if (!outcome.ok) {
      issues.push(issue(k, errorText(outcome.error)));
      out.push(step);
      continue;
    }
    out.push(...outcome.value.steps);
    runs.push(outcome.value.report);
    for (const [other, list] of outcome.value.cross) {
      const entry = cross.get(other);
      if (entry === undefined) cross.set(other, { steps: [...list], from: k });
      else {
        entry.steps.push(...list);
        entry.from = k;
      }
    }
  }

  // Every other page's steps through the door, on that page's lens.
  const crossPage: { pageId: string; commands: readonly AgentToolStep[] }[] = [];
  if (site !== undefined) {
    const ports = options.validationPorts ?? { clock: systemClock, ids: systemIds };
    for (const [other, entry] of cross) {
      const judged = validateAiPlan({ rationale: 'script', commands: entry.steps }, site.page(other), ports, options.policy);
      if (!judged.ok) {
        issues.push(
          issue(entry.from, `page "${other}": ${judged.issues.map(({ message }) => message).join(' ')}`.slice(0, 900)),
        );
        continue;
      }
      crossPage.push({ pageId: other, commands: entry.steps });
    }
  }

  if (issues.length > 0) return { plan: candidate, issues, runs, crossPage: [] };
  return { plan: { ...candidate, commands: out }, issues, runs, crossPage };
}
