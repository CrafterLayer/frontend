import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';

import { subscriptionEnv } from './api-models';
import { buildArgs, cliGenerationEnv } from './cli-generation-config';
import type { CliWarmPool } from './cli-warm-pool';
import { NARRATION_INTERVAL_MS, RunNarrator, formatCount, formatElapsed } from './narration';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';
import { turnText as messageText } from './prompt-cache';

/**
 * DEV-ONLY fallback, gated by `CRAFTKIT_AI_BACKEND=cli`.
 *
 * Routes the exact request `claude.ts` builds through the local `claude` CLI
 * (whatever session it is already logged into — a subscription, not an API
 * key) instead of the Messages API. It intercepts at the same seam the tests
 * fake (`client.messages.stream`), so `prompt.ts` — skills, catalog, cache
 * layout — runs completely unmodified and every existing test keeps testing
 * the real translation logic in `claude.ts` / `handler.ts`.
 *
 * What is NOT faithful, and why this must never be the default:
 * - No structured-output enforcement. The API decodes straight into
 *   `output_config.format.schema`; the CLI only sees that schema as text
 *   appended to the prompt and can drift from it in ways the real backend
 *   cannot.
 * - No `stop_reason: 'refusal'`. The API's safety-decline signal has no CLI
 *   equivalent; a decline here either surfaces as non-JSON text (mapped to
 *   `invalid-output`, not `refusal`) or as a CLI error.
 * - No real usage/cache accounting — `cachedShare` is always 0, so it cannot
 *   be trusted to validate the prompt-caching layout.
 *
 * It exists to unblock testing `prompt.ts` changes (skills, references) end
 * to end before `ANTHROPIC_API_KEY` is set — not to be a second production
 * path. Delete it once the SDK backend is the only one anyone runs.
 */

/** The request options this shim reads: the per-call reasoning budget header, and the cancel. */
interface CliRequestOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

interface CliStreamParams {
  /** The model the handler resolved for this call; honoured only when `allowedModels` lists it. */
  readonly model?: string;
  readonly max_tokens?: number;
  readonly system?: readonly { readonly text: string }[];
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
  readonly output_config?: { readonly format?: { readonly schema?: unknown } };
  /** Only `disabled` is read: the CLI's own default (thinking on) serves every other value. */
  readonly thinking?: { readonly type?: string };
}

/**
 * The child this backend drives, narrowed to what it actually uses.
 *
 * Narrow rather than `ChildProcess` so a test can supply a fake and exercise
 * the timeout and the failure translation without a `claude` on the PATH —
 * which is how the 110s cap shipped untested.
 */
export interface CliChildProcess {
  readonly pid?: number | undefined;
  readonly stdout: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown };
  readonly stderr: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown };
  readonly stdin: {
    on: (event: 'error', listener: () => void) => unknown;
    end: (text: string) => unknown;
    /** Used only to keep a warm spare waiting (`cli-warm-pool.ts`); a fake may leave it out. */
    write?: (text: string) => unknown;
  };
  readonly on: {
    (event: 'error', listener: (error: Error) => void): unknown;
    (event: 'close', listener: (code: number | null, signal: string | null) => void): unknown;
  };
  readonly kill: (signal?: string) => unknown;
}

/**
 * `env` holds only the variables a call adds on top of the server's own
 * environment; the real spawner merges them over `process.env`.
 */
export type SpawnCli = (
  command: string,
  args: readonly string[],
  env?: Readonly<Record<string, string>>,
) => CliChildProcess;

/** The reasoning budgets the CLI accepts; anything else it warns about and ignores. */
export const CLI_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type CliEffort = (typeof CLI_EFFORT_LEVELS)[number];

export interface CliClientOptions {
  readonly model?: string;
  /**
   * Models a CALL may run on instead of `model`, as the server's allowlist
   * names them (`haiku`, or `cli:haiku` — the prefix is dropped). Found by
   * reading the code on 2026-09-28, not in a live run: on the `cli` backend
   * the handler vetted the picker's model against CRAFTKIT_AI_MODELS and
   * handed it on as `params.model`, and this shim ran `options.model`
   * regardless, so neither the picker nor a fast model for small edits (or
   * the enhancer's) ever changed who answered. Anything not listed —
   * claude.ts's `claude-opus-5` placeholder above all — keeps `model`, so an
   * unconfigured server still runs the CLI's own default.
   */
  readonly allowedModels?: readonly string[];
  /** Reasoning budget. Omitted ⇒ the CLI's own default. */
  readonly effort?: CliEffort;
  /** Whole-run cap. Defaults to `CLI_DEFAULT_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Injected for tests; defaults to spawning the real `claude` CLI. */
  readonly spawnCli?: SpawnCli;
  /** Injected for tests; defaults to a private temporary file removed after the run. */
  readonly writeSystemPrompt?: (text: string) => SystemPromptFile;
  /** One line per run milestone, for the server's own terminal. */
  readonly onLog?: (line: string) => void;
  /**
   * Keeps one pre-spawned `claude -p` per call shape waiting on stdin, so the
   * next call of that shape skips the process start-up (DESIGN §7). Shared by
   * every client the server builds; omitted ⇒ every call starts cold, as before.
   */
  readonly warmPool?: CliWarmPool;
}

/**
 * Every failure of this backend, as a sentence its owner can act on.
 *
 * `handler.ts` recognises the name and forwards the message verbatim. That is
 * the whole point of the class: a plain `Error` there becomes "The assistant
 * server failed unexpectedly", which is what the panel showed for two minutes
 * of waiting while this file was killing the CLI mid-plan.
 */
export class CliBackendError extends Error {
  override readonly name = 'CliBackendError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The CLI's own words, on one line and bounded — never a stack, never a page. */
function boundedCliText(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat;
}

/**
 * Strips a single wrapping ```json fence, when the whole reply is one.
 * The CLI is told not to do this; some turns do it anyway. `claude.ts`'s own
 * `JSON.parse` is the real validator — this only undoes the one wrapper shape
 * that would otherwise fail it for a reason that has nothing to do with the
 * plan's content.
 */
function stripCodeFence(text: string): string {
  const match = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/u.exec(text.trim());
  return match?.[1] ?? text;
}

interface RenderedPrompt {
  /** The rules, the catalog, the skills and the output format — the CLI's SYSTEM prompt. */
  readonly system: string;
  /** The conversation and the page as it is now — the one user turn. */
  readonly user: string;
}

/**
 * Splits the request the way the Messages API would see it.
 *
 * The rules and the stable context go to the CLI as its system prompt
 * (`--system-prompt-file`), not in front of the user's text. Two measured
 * reasons (2026-09-27): without it every call also carried Claude Code's own
 * ~3.2k-token coding-agent prompt, which is the wrong role for a page
 * builder; and a system prompt is the part the CLI caches between calls, so
 * the four section writers of one build stop re-reading the same catalog
 * and skills from cold. The output format sits at the end of the system text
 * (it is the same for every call of a kind) with a one-line reminder last in
 * the user turn, where it is most salient.
 */
function renderPrompt(params: CliStreamParams): RenderedPrompt {
  const rules = (params.system ?? []).map((block) => block.text).join('\n\n');
  const turns = (params.messages ?? [])
    .map(
      (turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${messageText(turn.content)}`,
    )
    .join('\n\n');
  const schema = params.output_config?.format?.schema;
  if (schema === undefined) return { system: rules, user: turns };
  return {
    system: `${rules}\n\n# Required output format\nNothing enforces this shape at the decoding layer, so you must get it right yourself. Reply with RAW JSON ONLY — the first character of your reply must be "{" and the last must be "}". No markdown code fences, no \`\`\`json, no explanation before or after. Conform exactly to this JSON Schema:\n${JSON.stringify(schema)}`,
    user: `${turns}\n\nReply with the JSON object only.`,
  };
}

/**
 * The system prompt as a file the CLI reads, removed once the run ends.
 *
 * A file rather than `--system-prompt <text>`: the rules, catalog and skills
 * run to tens of thousands of characters, past what an argument list should
 * carry, and a file keeps them out of every process listing.
 */
export interface SystemPromptFile {
  readonly path: string;
  readonly remove: () => void;
}

function writeSystemPromptFile(text: string): SystemPromptFile {
  const directory = mkdtempSync(join(tmpdir(), 'craftkit-cli-'));
  const path = join(directory, 'system-prompt.md');
  writeFileSync(path, text, 'utf8');
  return {
    path,
    remove: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** What a CLI run actually cost, from its `result` event. */
interface CliUsage {
  readonly input: number | null;
  readonly output: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
  /** Time spent inside the model API, as the CLI measured it — the rest is process overhead. */
  readonly apiMs: number | undefined;
}

function count(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000_000_000
    ? value
    : null;
}

/**
 * The `result` event's usage. Read rather than reported as zeros, because
 * whether the system prompt actually caches between calls is the question
 * every speed change here has to answer, and only these numbers answer it.
 */
function usageOf(event: Readonly<Record<string, unknown>>): CliUsage | undefined {
  const usage = event['usage'];
  if (!isRecord(usage)) return undefined;
  const apiMs = event['duration_api_ms'];
  return {
    input: count(usage['input_tokens']),
    output: count(usage['output_tokens']),
    cacheRead: count(usage['cache_read_input_tokens']),
    cacheWrite: count(usage['cache_creation_input_tokens']),
    apiMs: typeof apiMs === 'number' ? apiMs : undefined,
  };
}

/** Where a run's wall-clock time went, as this shim saw it. */
interface CliTiming {
  /** Spawn to the `result` event. */
  readonly elapsedMs: number;
  /** Spawn to the CLI's first event — the process starting, before any model call. */
  readonly startupMs: number;
  /**
   * The prompt written to stdin to the CLI's first event: the number a warm
   * spare is judged by (DESIGN D8), since a spare spawned long before its
   * prompt arrived has no meaningful "spawn" time of its own.
   */
  readonly firstEventMs: number;
}

/**
 * The usage, with the model's time and the process's own named apart.
 * Measured over 26 fills (2026-09-29): about 9.6 s of each CLI call was the
 * process, not the model ("model 00:09" in a run that "ended after 00:21"),
 * and the log only said the first — so the CLI's real cost was invisible.
 *
 * Start-up is measured here (spawn to the CLI's first event) rather than
 * derived as run minus model: the CLI's `duration_api_ms` also counts calls
 * it makes while starting, so the difference understated it (a haiku run
 * logged model 00:08 of 00:25 with 00:18 before its first event).
 */
function measuredCount(value: number | null): string {
  return value === null ? 'unknown' : formatCount(value);
}

function usageLine(usage: CliUsage, timing: CliTiming): string {
  return (
    `cli usage — in ${measuredCount(usage.input)}, cache read ${measuredCount(usage.cacheRead)}, ` +
    `cache write ${measuredCount(usage.cacheWrite)}, out ${measuredCount(usage.output)}` +
    (usage.apiMs === undefined ? '' : `, model ${formatElapsed(usage.apiMs)}`) +
    `, start-up ${formatElapsed(timing.startupMs)}, run ${formatElapsed(timing.elapsedMs)}` +
    `, stdin→first event ${String(timing.firstEventMs)} ms`
  );
}

/** Kills the CLI's whole process group so a cancelled request doesn't keep running. */
function killTree(pid: number | undefined, fallback: () => void): void {
  if (process.platform !== 'win32' && pid !== undefined) {
    try {
      process.kill(-pid, 'SIGTERM');
      return;
    } catch {
      // The group may already be gone; fall through to the direct child.
    }
  }
  fallback();
}

/**
 * The cancellation `handler.ts` answers with 499 and the routing client never
 * falls back from: the platform's AbortError, by name, as every backend
 * reports a request the caller hung up on.
 */
function cancelled(): Error {
  const error = new Error('The request was cancelled, so the dev `claude` CLI run was stopped.');
  error.name = 'AbortError';
  return error;
}

/** The real child: its own process group, so a cancelled request can kill the tree. */
const spawnRealCli: SpawnCli = (command, args, env) =>
  spawn(command, [...args], {
    cwd: tmpdir(),
    env: subscriptionEnv(env),
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    // Node's typed `stdout`/`stderr` are nullable in general; with this exact stdio triple they are always streams.
  }) as unknown as CliChildProcess;

/** One CLI run: a child already spawned (cold, or a warm spare) and what to tell whom. */
interface CliRun {
  readonly child: CliChildProcess;
  readonly prompt: string;
  readonly timeoutMs: number;
  /** The thinking narration (`stream.on('thinking')`). */
  readonly onThinking: (delta: string) => void;
  /** Each piece of the answer's text as it is written (`stream.on('text')`). */
  readonly onText: (delta: string) => void;
  readonly onStreamEvent: () => void;
  readonly onLog: (line: string) => void;
  readonly signal: AbortSignal | undefined;
}

/**
 * Drives one child to its answer. The child is spawned by the caller —
 * either now (cold) or earlier, as a warm spare waiting on stdin — and is
 * driven, timed out, cancelled and killed identically either way.
 */
function runClaude(run: CliRun): Promise<Anthropic.Message> {
  const { child, prompt, timeoutMs, onThinking, onText, onStreamEvent, onLog, signal } = run;
  return new Promise((resolve, reject) => {
    // Cancelled before it began (the caller checks first; this is the backstop).
    if (signal?.aborted === true) {
      killTree(child.pid, () => child.kill('SIGTERM'));
      reject(cancelled());
      return;
    }

    let settled = false;
    let buffer = '';
    let finalText: string | undefined;
    let usage: CliUsage | undefined;
    let stderr = '';
    /** When the CLI said anything at all: the end of its start-up. */
    let firstEventAt: number | undefined;

    const startedAt = Date.now();
    /** When the prompt went in: the start a warm spare's latency is measured from. */
    let stdinWrittenAt = startedAt;
    const narrator = new RunNarrator(onThinking, startedAt);
    const narrationTimer = setInterval(() => {
      narrator.emit();
    }, NARRATION_INTERVAL_MS);

    const timeoutTimer = setTimeout(() => {
      finish(() => {
        reject(
          new CliBackendError(
            `The dev \`claude\` CLI backend gave up after ${String(Math.round(timeoutMs / 1000))}s. ` +
              'A full-page plan is 15-25k tokens and the CLI writes about 80 a second, so it needs ' +
              'several minutes: raise CRAFTKIT_AI_CLI_TIMEOUT_MS, ask for a smaller change, or set ' +
              'ANTHROPIC_API_KEY and unset CRAFTKIT_AI_BACKEND to use the API.',
          ),
        );
      });
      killTree(child.pid, () => child.kill('SIGTERM'));
    }, timeoutMs);

    // Stop kills the process group, exactly as a timeout does; no orphaned CLI runs.
    const onAbort = (): void => {
      onLog('cli run stopped — the request was cancelled');
      finish(() => {
        reject(cancelled());
      });
      killTree(child.pid, () => child.kill('SIGTERM'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    function finish(callback: () => void): void {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timeoutTimer);
      clearInterval(narrationTimer);
      onLog(
        `cli run ended after ${formatElapsed(Date.now() - startedAt)} — ` +
          `${formatCount(narrator.writtenSoFar())} characters of plan`,
      );
      callback();
    }

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (line === '') continue;
        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isRecord(event)) continue;
        firstEventAt ??= Date.now();
        if (event['type'] === 'stream_event' && isRecord(event['event'])) {
          const frame = event['event'];
          if (
            ['message_start', 'content_block_start', 'content_block_delta'].includes(
              String(frame['type']),
            )
          )
            onStreamEvent();
          const block = frame['content_block'];
          if (frame['type'] === 'content_block_start' && isRecord(block)) {
            if (block['type'] === 'thinking') narrator.enterPhase('thinking');
            if (block['type'] === 'text') narrator.enterPhase('writing');
          }
          const delta = frame['delta'];
          if (isRecord(delta)) {
            // CLI thinking deltas carry estimated tokens, rather than answer text.
            if (delta['type'] === 'thinking_delta') {
              const estimated = delta['estimated_tokens'];
              narrator.addThinking(typeof estimated === 'number' ? estimated : 0);
            }
            if (delta['type'] === 'text_delta' && typeof delta['text'] === 'string') {
              narrator.addText(delta['text'].length);
              // The answer as it is written: a page plan's drafts (handler.ts).
              onText(delta['text']);
            }
          }
        }
        if (event['type'] === 'result') {
          if (event['is_error'] === true) {
            const reported =
              typeof event['result'] === 'string' ? boundedCliText(event['result']) : '';
            finish(() => {
              reject(
                new CliBackendError(
                  reported === ''
                    ? 'The dev `claude` CLI backend reported an error with no explanation.'
                    : `The dev \`claude\` CLI backend reported: ${reported}`,
                ),
              );
            });
            return;
          }
          finalText = typeof event['result'] === 'string' ? event['result'] : '';
          usage = usageOf(event);
          if (usage !== undefined) {
            onLog(
              usageLine(usage, {
                elapsedMs: Date.now() - startedAt,
                startupMs: firstEventAt - startedAt,
                firstEventMs: firstEventAt - stdinWrittenAt,
              }),
            );
          }
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString('utf8').slice(0, 4096 - stderr.length);
    });
    child.on('error', (error: Error) => {
      finish(() => {
        reject(
          new CliBackendError(
            'The dev backend could not start the `claude` CLI ' +
              `(${boundedCliText(error.message)}). Check that it is installed and on the server's PATH, ` +
              'or set ANTHROPIC_API_KEY and unset CRAFTKIT_AI_BACKEND to use the API.',
          ),
        );
      });
    });
    child.on('close', (code: number | null, signal: string | null) => {
      finish(() => {
        if (signal !== null) {
          reject(new CliBackendError(`The dev \`claude\` CLI backend was stopped (${signal}).`));
        } else if (finalText === undefined) {
          const detail = boundedCliText(stderr);
          reject(
            new CliBackendError(
              `The dev \`claude\` CLI backend exited ${String(code)} without a plan` +
                (detail === '' ? '.' : `: ${detail}`),
            ),
          );
        } else {
          resolve({
            stop_reason: 'end_turn',
            stop_details: null,
            content: [{ type: 'text', text: stripCodeFence(finalText) }],
            usage: {
              input_tokens: usage?.input ?? null,
              output_tokens: usage?.output ?? null,
              cache_read_input_tokens: usage?.cacheRead ?? null,
              cache_creation_input_tokens: usage?.cacheWrite ?? null,
            },
          } as unknown as Anthropic.Message);
        }
      });
    });
    child.stdin.on('error', () => {
      finish(() => {
        reject(
          new CliBackendError(
            'The dev `claude` CLI backend closed its input before reading the prompt.',
          ),
        );
      });
    });
    stdinWrittenAt = Date.now();
    child.stdin.end(prompt);
  });
}

/**
 * Ten minutes, and the number is measured rather than guessed.
 *
 * The CLI writes roughly 80 output tokens a second (10,161 tokens in 122s on
 * the machine this was found on) and a full-page plan is 15-25k of them — three
 * to five minutes. The first value here was 110s, which killed every real plan
 * mid-generation and reported it to the panel as a nameless server failure.
 * A cap this generous costs nothing: the client hangs up first if the user does.
 */
export const CLI_DEFAULT_TIMEOUT_MS = 600_000;

/** The CLI's own name for a slug the allowlist may spell with the hybrid `cli:` prefix. */
function cliModelName(slug: string): string | undefined {
  const name = slug.startsWith('cli:') ? slug.slice('cli:'.length) : slug;
  return name === '' ? undefined : name;
}

/** The model this call runs on: the call's own when the server allows it, else the configured one. */
function callModel(requested: string | undefined, options: CliClientOptions): string | undefined {
  if (requested !== undefined && (options.allowedModels ?? []).includes(requested)) {
    return cliModelName(requested);
  }
  return options.model;
}

/**
 * The warm-pool key of one call shape: everything that decides the spare's
 * command line and system file. Hashed so the pool never holds a prompt.
 */
export function cliShapeKey(
  model: string | undefined,
  effort: CliEffort | undefined,
  thinkingOff: boolean,
  system: string,
  maxTokens?: number,
): string {
  return createHash('sha256')
    .update(JSON.stringify([model ?? null, effort ?? null, thinkingOff, system, maxTokens ?? null]))
    .digest('hex');
}

/**
 * What a warm spare is sent the moment it starts. `claude -p` gives up on an
 * empty stdin after 3 s ("no stdin data received in 3s, proceeding without
 * it", then "Input must be provided"; measured 2026-10-05 on 2.1.283), so a
 * spare that only waited would be dead before the next call came. One
 * newline keeps it reading; it leads the prompt, where whitespace is inert.
 */
const SPARE_KEEPALIVE = '\n';

/** A `client.messages.stream(...)`-shaped shim over the local `claude` CLI. */
export function createCliClient(options: CliClientOptions = {}): Anthropic {
  const timeoutMs = options.timeoutMs ?? CLI_DEFAULT_TIMEOUT_MS;
  const spawnCli = options.spawnCli ?? spawnRealCli;
  const writeSystemPrompt = options.writeSystemPrompt ?? writeSystemPromptFile;
  const onLog = options.onLog ?? ((): void => undefined);
  const warmPool = options.warmPool;
  /** Calls of each shape now running: how many spares the next wave of that shape wants. */
  const running = new Map<string, number>();

  const stream = (params: CliStreamParams, requestOptions: CliRequestOptions = {}) => {
    const listeners = new Map<string, (delta: string) => void>();
    const shim = (done: Promise<Anthropic.Message>) => ({
      on: (event: string, listener: (delta: string) => void) => {
        listeners.set(event, listener);
      },
      finalMessage: () => done,
    });
    /** A call that ends before any child runs; observed so an unread rejection is never "unhandled". */
    const failed = (error: Error) => {
      const done: Promise<Anthropic.Message> = Promise.reject(error);
      done.catch(() => undefined);
      return shim(done);
    };
    // Cancelled before it began: no process is worth starting (or taking) for nobody.
    if (requestOptions.signal?.aborted === true) return failed(cancelled());
    const prompt = renderPrompt(params);
    // A per-call budget (a section writer's) wins over the backend default.
    const effort =
      CLI_EFFORT_LEVELS.find(
        (level) => requestOptions.headers?.[CRAFTKIT_REASONING_EFFORT_HEADER] === level,
      ) ?? options.effort;
    const model = callModel(params.model, options);
    const thinkingOff = params.thinking?.type === 'disabled';
    const env = cliGenerationEnv(effort, thinkingOff, params.max_tokens);
    /** Spawns this shape's child with its own system file, exactly as a cold call always has. */
    const spawnShape = (): { child: CliChildProcess; systemFile: SystemPromptFile | undefined } => {
      const systemFile = prompt.system === '' ? undefined : writeSystemPrompt(prompt.system);
      const args = buildArgs(model, effort, systemFile?.path, thinkingOff, env);
      try {
        const child = env === undefined ? spawnCli('claude', args) : spawnCli('claude', args, env);
        return { child, systemFile };
      } catch (cause) {
        systemFile?.remove();
        throw cause;
      }
    };

    const key =
      warmPool === undefined
        ? undefined
        : cliShapeKey(model, effort, thinkingOff, prompt.system, params.max_tokens);
    const spare = key === undefined ? undefined : warmPool?.take(key);
    // A recently primed spare may still be starting; its age states the saved startup honestly.
    const startKind =
      spare === undefined
        ? 'cold'
        : `warm (spare ${(Math.max(0, Date.now() - spare.spawnedAt) / 1000).toFixed(1)} s old)`;
    onLog(
      `cli run started — ${startKind}, model ${model ?? '(CLI default)'}, ` +
        `effort ${effort ?? '(CLI default)'}${thinkingOff ? ', thinking off' : ''}, ` +
        `system ${formatCount(prompt.system.length)} + ` +
        `request ${formatCount(prompt.user.length)} characters`,
    );
    let started: { child: CliChildProcess; systemFile: SystemPromptFile | undefined };
    if (spare === undefined) {
      try {
        started = spawnShape();
      } catch (cause) {
        return failed(
          new CliBackendError(
            'The dev backend could not start the `claude` CLI ' +
              `(${boundedCliText(cause instanceof Error ? cause.message : String(cause))}).`,
          ),
        );
      }
    } else {
      started = { child: spare.child as CliChildProcess, systemFile: spare.systemFile };
    }
    const { systemFile } = started;
    if (key !== undefined) running.set(key, (running.get(key) ?? 0) + 1);
    const done = runClaude({
      child: started.child,
      prompt: prompt.user,
      timeoutMs,
      onThinking: (delta) => {
        listeners.get('thinking')?.(delta);
      },
      onText: (delta) => {
        listeners.get('text')?.(delta);
      },
      onStreamEvent: () => {
        listeners.get('streamEvent')?.('');
      },
      onLog,
      signal: requestOptions.signal,
    }).finally(() => {
      systemFile?.remove();
      if (key !== undefined) {
        const left = (running.get(key) ?? 1) - 1;
        if (left <= 0) running.delete(key);
        else running.set(key, left);
      }
    });
    /*
      After the prompt went in, so the spare never competes with the call
      that is waiting: the NEXT call of this shape finds it ready.
    */
    if (warmPool !== undefined && key !== undefined) {
      // As many spares as calls of this shape are running: a writer wave's next call finds one each.
      const want = Math.max(1, running.get(key) ?? 1);
      warmPool.prime(
        key,
        () => {
          const next = spawnShape();
          // An idle spare's input is nobody's to fail on; its run attaches its own handler.
          next.child.stdin.on('error', () => undefined);
          next.child.stdin.write?.(SPARE_KEEPALIVE);
          return {
            child: next.child,
            ...(next.systemFile === undefined ? {} : { systemFile: next.systemFile }),
            spawnedAt: Date.now(),
          };
        },
        want,
      );
    }
    return shim(done);
  };

  return { messages: { stream } } as unknown as Anthropic;
}
