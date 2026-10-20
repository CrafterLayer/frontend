import { StringDecoder } from 'node:string_decoder';

import type Anthropic from '@anthropic-ai/sdk';

import type { CliChildProcess } from './cli-client';
import { CODEX_MAX_OUTPUT_BYTES, CodexBackendError } from './codex-config';
import { isRecord, type CodexFiles } from './codex-prompt';

export function codexAbortError(): Error {
  const error = new Error('The Codex request was cancelled.');
  error.name = 'AbortError';
  return error;
}

export function killCodexChild(child: CliChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    if (process.platform !== 'win32' && child.pid !== undefined) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* Already gone. */
    }
  }
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Only fixed, authored diagnostics leave this boundary; stderr may contain private context. */
function failedRun(diagnostics: string): CodexBackendError {
  if (
    /not logged in|login required|unauthorized|authentication|401|refresh token/iu.test(diagnostics)
  )
    return new CodexBackendError(
      'Codex needs a ChatGPT login. Run `codex login` as the server user.',
      503,
      false,
    );
  if (/usage limit|rate.?limit|quota|429/iu.test(diagnostics))
    return new CodexBackendError(
      'Your Codex subscription is currently limited. Wait before retrying.',
      429,
    );
  return new CodexBackendError(
    'Codex could not finish the request. Check `codex login status` and the selected Codex model.',
  );
}

export function runCodex(input: {
  readonly child: CliChildProcess;
  readonly files: CodexFiles;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly emit: (event: string, text: string) => void;
}): Promise<Anthropic.Message> {
  const { child, files, signal, timeoutMs, emit } = input;
  return new Promise((resolve, reject) => {
    let settled = false;
    let closed = false;
    let completed = false;
    let failed = false;
    let diagnostics = '';
    let buffer = '';
    let bytes = 0;
    let usage: Record<string, unknown> = {};
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const decoder = new StringDecoder('utf8');
    const isSettled = (): boolean => settled;
    const terminate = (): void => {
      if (closed) return;
      killTimer = setTimeout(() => {
        killCodexChild(child, 'SIGKILL');
      }, 1_000);
      killTimer.unref();
      killCodexChild(child, 'SIGTERM');
    };
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error !== undefined) {
        terminate();
        reject(error);
        return;
      }
      try {
        const text = files.answer();
        const total = count(usage['input_tokens']);
        const cached = count(usage['cached_input_tokens']);
        emit('text', text);
        resolve({
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          stop_details: null,
          usage: {
            // Codex's input total includes cached tokens; the shared API reports them separately.
            input_tokens:
              total === null ? null : cached === null ? total : Math.max(0, total - cached),
            output_tokens: count(usage['output_tokens']),
            cache_read_input_tokens: cached,
            cache_creation_input_tokens: null,
          },
        } as unknown as Anthropic.Message);
      } catch (cause) {
        reject(
          cause instanceof Error
            ? cause
            : new CodexBackendError('Could not read the Codex answer.'),
        );
      }
    };
    const abort = (): void => {
      finish(codexAbortError());
    };
    const timer = setTimeout(() => {
      finish(
        new CodexBackendError(
          `Codex exceeded its ${String(Math.ceil(timeoutMs / 1000))}s process deadline. Adjust CRAFTKIT_AI_CLI_TIMEOUT_MS if needed.`,
          504,
        ),
      );
    }, timeoutMs);
    const frame = (line: string): void => {
      if (settled || line.trim() === '') return;
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        finish(new CodexBackendError('Codex emitted an invalid event stream.', 502, false));
        return;
      }
      if (!isRecord(event)) return;
      const type = event['type'];
      if (type === 'turn.started') emit('streamEvent', '');
      if (type === 'turn.completed') {
        completed = true;
        if (isRecord(event['usage'])) usage = event['usage'];
      }
      if (type === 'turn.failed') {
        failed = true;
        diagnostics += JSON.stringify(event).slice(0, 4096);
      }
      // `error` may precede a successful CLI reconnect; turn.failed/exit decides failure.
      if (type === 'error') diagnostics += JSON.stringify(event).slice(0, 4096);
      diagnostics = diagnostics.slice(-8192);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > CODEX_MAX_OUTPUT_BYTES) {
        finish(
          new CodexBackendError('Codex output exceeded the local response limit.', 502, false),
        );
        return;
      }
      buffer += decoder.write(chunk);
      let newline = buffer.indexOf('\n');
      while (newline >= 0 && !isSettled()) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        frame(line);
        newline = buffer.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (!settled) diagnostics = (diagnostics + chunk.toString('utf8')).slice(-8192);
    });
    child.on('error', () => {
      finish(
        new CodexBackendError(
          'Could not start `codex`. Install Codex CLI 0.162.1 or newer, then run `codex login`.',
          503,
          false,
        ),
      );
    });
    child.on('close', (code, closeSignal) => {
      closed = true;
      clearTimeout(killTimer);
      if (isSettled()) return;
      frame(buffer + decoder.end());
      if (isSettled()) return;
      finish(
        code === 0 && closeSignal === null && completed && !failed
          ? undefined
          : failedRun(diagnostics),
      );
    });
    child.stdin.on('error', () => {
      finish(new CodexBackendError('Codex closed its input before accepting the request.'));
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      child.stdin.end(files.prompt);
    } catch {
      finish(new CodexBackendError('Could not send the request to Codex.'));
    }
  });
}
