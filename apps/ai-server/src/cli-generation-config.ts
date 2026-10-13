/** Per-call CLI budgets, carried in both the child environment and inline settings. */
export function cliGenerationEnv(
  effort: string | undefined,
  thinkingOff: boolean,
  maxTokens: number | undefined,
): Readonly<Record<string, string>> | undefined {
  if (maxTokens !== undefined && (!Number.isSafeInteger(maxTokens) || maxTokens <= 0)) {
    throw new RangeError('The CLI output budget must be a positive safe integer.');
  }
  const env = {
    ...(thinkingOff ? { MAX_THINKING_TOKENS: '0' } : {}),
    ...(effort === undefined ? {} : { CLAUDE_CODE_EFFORT_LEVEL: effort }),
    ...(maxTokens === undefined ? {} : { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxTokens) }),
  };
  return Object.keys(env).length === 0 ? undefined : env;
}

/** Settings env overrides account settings that would otherwise replace the child's budgets. */
export function buildArgs(
  model: string | undefined,
  effort: string | undefined,
  systemPromptPath: string | undefined,
  thinkingOff: boolean,
  env: Readonly<Record<string, string>> | undefined,
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
  if (effort !== undefined) args.push('--effort', effort);
  const settings = {
    ...(thinkingOff ? { alwaysThinkingEnabled: false } : {}),
    ...(env === undefined ? {} : { env }),
  };
  if (Object.keys(settings).length > 0) args.push('--settings', JSON.stringify(settings));
  return args;
}
