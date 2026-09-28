import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';

import { NARRATION_INTERVAL_MS, RunNarrator, formatCount, formatElapsed } from './narration';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';

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
  readonly system?: readonly { readonly text: string }[];
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
  readonly output_config?: { readonly format?: { readonly schema?: unknown } };
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
  };
  readonly on: {
    (event: 'error', listener: (error: Error) => void): unknown;
    (event: 'close', listener: (code: number | null, signal: string | null) => void): unknown;
  };
  readonly kill: (signal?: string) => unknown;
}

export type SpawnCli = (command: string, args: readonly string[]) => CliChildProcess;

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

function messageText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
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

function buildArgs(
  model: string | undefined,
  effort: CliEffort | undefined,
  systemPromptPath: string | undefined,
): string[] {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--max-turns',
    '1',
    '--safe-mode',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--tools',
    '',
  ];
  if (systemPromptPath !== undefined) args.push('--system-prompt-file', systemPromptPath);
  if (model !== undefined && model !== '') args.push('--model', model);
  /*
    Left out entirely when unset: the CLI would otherwise fall back to whatever
    CLAUDE_EFFORT the launching shell happened to export, which made the
    server's reasoning budget depend on who started it.
  */
  if (effort !== undefined) args.push('--effort', effort);
  return args;
}

/** What a CLI run actually cost, from its `result` event. */
interface CliUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  /** Time spent inside the model API, as the CLI measured it — the rest is process overhead. */
  readonly apiMs: number | undefined;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function usageLine(usage: CliUsage): string {
  return (
    `cli usage — in ${formatCount(usage.input)}, cache read ${formatCount(usage.cacheRead)}, ` +
    `cache write ${formatCount(usage.cacheWrite)}, out ${formatCount(usage.output)}` +
    (usage.apiMs === undefined ? '' : `, model ${formatElapsed(usage.apiMs)}`)
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
const spawnRealCli: SpawnCli = (command, args) =>
  spawn(command, [...args], {
    cwd: tmpdir(),
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    // Node's typed `stdout`/`stderr` are nullable in general; with this exact
    // stdio triple they are always streams.
  }) as unknown as CliChildProcess;

function runClaude(
  prompt: string,
  args: readonly string[],
  timeoutMs: number,
  spawnCli: SpawnCli,
  onThinking: (delta: string) => void,
  onLog: (line: string) => void,
  signal: AbortSignal | undefined,
): Promise<Anthropic.Message> {
  return new Promise((resolve, reject) => {
    // Cancelled before it began: no process is worth starting for nobody.
    if (signal?.aborted === true) {
      reject(cancelled());
      return;
    }
    const child = spawnCli('claude', args);

    let settled = false;
    let buffer = '';
    let finalText: string | undefined;
    let usage: CliUsage | undefined;
    let stderr = '';

    const startedAt = Date.now();
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

    /*
      Stop means stop (measured 2026-09-28: an aborted request's CLI ran its
      whole 51s on, and a killed server left one orphaned). The request's
      signal kills the process group exactly as the timeout does.
    */
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
        if (event['type'] === 'stream_event' && isRecord(event['event'])) {
          const frame = event['event'];
          const block = frame['content_block'];
          if (frame['type'] === 'content_block_start' && isRecord(block)) {
            if (block['type'] === 'thinking') narrator.enterPhase('thinking');
            if (block['type'] === 'text') narrator.enterPhase('writing');
          }
          const delta = frame['delta'];
          if (isRecord(delta)) {
            /*
              `thinking`, not `text` — the field this read for its first weeks,
              which is why the panel's line never moved once in a whole run.
            */
            if (delta['type'] === 'thinking_delta') {
              const estimated = delta['estimated_tokens'];
              narrator.addThinking(typeof estimated === 'number' ? estimated : 0);
            }
            if (delta['type'] === 'text_delta' && typeof delta['text'] === 'string') {
              narrator.addText(delta['text'].length);
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
          if (usage !== undefined) onLog(usageLine(usage));
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
              input_tokens: usage?.input ?? 0,
              output_tokens: usage?.output ?? 0,
              cache_read_input_tokens: usage?.cacheRead ?? 0,
              cache_creation_input_tokens: usage?.cacheWrite ?? 0,
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

/** A `client.messages.stream(...)`-shaped shim over the local `claude` CLI. */
export function createCliClient(options: CliClientOptions = {}): Anthropic {
  const timeoutMs = options.timeoutMs ?? CLI_DEFAULT_TIMEOUT_MS;
  const spawnCli = options.spawnCli ?? spawnRealCli;
  const writeSystemPrompt = options.writeSystemPrompt ?? writeSystemPromptFile;
  const onLog = options.onLog ?? ((): void => undefined);

  const stream = (params: CliStreamParams, requestOptions: CliRequestOptions = {}) => {
    const listeners = new Map<string, (delta: string) => void>();
    const prompt = renderPrompt(params);
    const systemFile = prompt.system === '' ? undefined : writeSystemPrompt(prompt.system);
    // A per-call budget (a section writer's) wins over the backend default.
    const effort =
      CLI_EFFORT_LEVELS.find(
        (level) => requestOptions.headers?.[CRAFTKIT_REASONING_EFFORT_HEADER] === level,
      ) ?? options.effort;
    const model = callModel(params.model, options);
    const args = buildArgs(model, effort, systemFile?.path);
    onLog(
      `cli run started — model ${model ?? '(CLI default)'}, ` +
        `effort ${effort ?? '(CLI default)'}, system ${formatCount(prompt.system.length)} + ` +
        `request ${formatCount(prompt.user.length)} characters`,
    );
    const done = runClaude(
      prompt.user,
      args,
      timeoutMs,
      spawnCli,
      (delta) => {
        listeners.get('thinking')?.(delta);
      },
      onLog,
      requestOptions.signal,
    ).finally(() => {
      systemFile?.remove();
    });
    return {
      on: (event: string, listener: (delta: string) => void) => {
        listeners.set(event, listener);
      },
      finalMessage: () => done,
    };
  };

  return { messages: { stream } } as unknown as Anthropic;
}
