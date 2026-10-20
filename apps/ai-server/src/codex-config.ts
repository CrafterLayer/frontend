import type { CliChildProcess } from './cli-client';

export const CODEX_DEFAULT_MODEL = 'codex-default';
export const CODEX_MAX_CONCURRENT = 6;
export const CODEX_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
export const CODEX_DEFAULT_TIMEOUT_MS = 600_000;
export const CODEX_EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type CodexEffort = (typeof CODEX_EFFORT_LEVELS)[number];

export class CodexBackendError extends Error {
  override readonly name = 'CodexBackendError';
  constructor(
    message: string,
    readonly httpStatus = 502,
    readonly retryable = true,
  ) {
    super(message);
  }
}

export type SpawnCodex = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv },
) => CliChildProcess;

/** The CLI reads its own login store. Keys and provider redirects never reach this child. */
export function codexSubscriptionEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SystemRoot',
    'CODEX_HOME',
    'LANG',
    'LC_ALL',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'NODE_EXTRA_CA_CERTS',
  ]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return env;
}

export function codexEffort(value: string | undefined): CodexEffort | undefined {
  if (value === undefined || value === '') return undefined;
  // CraftKit's shared effort scale includes Claude's `max`.
  if (value === 'max') return 'xhigh';
  const effort = CODEX_EFFORT_LEVELS.find((candidate) => candidate === value);
  if (effort === undefined) {
    throw new CodexBackendError(
      `Invalid Codex effort: use ${CODEX_EFFORT_LEVELS.join(', ')}.`,
      400,
      false,
    );
  }
  return effort;
}

export function codexArgs(input: {
  readonly directory: string;
  readonly instructionsPath: string;
  readonly outputPath: string;
  readonly images: readonly string[];
  readonly model?: string | undefined;
  readonly effort?: CodexEffort | undefined;
}): string[] {
  const config = [
    'approval_policy="never"',
    'forced_login_method="chatgpt"',
    'model_provider="openai"',
    'web_search="disabled"',
    'project_doc_max_bytes=0',
    'history.persistence="none"',
    'features.shell_tool=false',
    'features.shell_snapshot=false',
    'features.multi_agent=false',
    'features.apps=false',
    'features.plugins=false',
    'features.hooks=false',
    'features.memories=false',
    'features.js_repl=false',
    'tools.view_image=false',
    'mcp_servers={}',
    `model_instructions_file=${JSON.stringify(input.instructionsPath)}`,
  ];
  if (input.effort !== undefined) config.push(`model_reasoning_effort="${input.effort}"`);
  return [
    'exec',
    '--json',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--cd',
    input.directory,
    '--output-last-message',
    input.outputPath,
    ...config.flatMap((entry) => ['-c', entry]),
    ...(input.model === undefined || input.model === CODEX_DEFAULT_MODEL
      ? []
      : ['--model', input.model]),
    ...input.images.flatMap((path) => ['--image', path]),
    '-',
  ];
}
