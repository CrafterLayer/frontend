import { describe, expect, it } from 'vitest';

import {
  CODEX_DEFAULT_MODEL,
  CODEX_DEFAULT_TIMEOUT_MS,
  codexArgs,
  codexEffort,
  codexSubscriptionEnv,
} from './codex-config';

const FILES = {
  directory: '/private/tmp/codex isolated',
  instructionsPath: '/private/tmp/codex isolated/instructions.md',
  outputPath: '/private/tmp/codex isolated/answer.txt',
  images: [],
};

describe('Codex subscription configuration', () => {
  it('preserves login location and executable lookup while dropping keys and provider redirects', () => {
    const source = {
      PATH: '/bin',
      HOME: '/test-home',
      CODEX_HOME: '/test-codex',
      LANG: 'en_US.UTF-8',
      SSL_CERT_FILE: '/test-ca.pem',
      OPENAI_API_KEY: 'fixture-openai',
      CODEX_API_KEY: 'fixture-codex',
      ANTHROPIC_API_KEY: 'fixture-anthropic',
      OPENROUTER_API_KEY: 'fixture-openrouter',
      OPENAI_BASE_URL: 'https://untrusted.invalid',
      OPENAI_ORG_ID: 'fixture-org',
      OPENAI_PROJECT_ID: 'fixture-project',
      HTTP_PROXY: 'https://untrusted.invalid',
      HTTPS_PROXY: 'https://untrusted.invalid',
      NODE_OPTIONS: '--require /untrusted.js',
      BASH_ENV: '/untrusted.sh',
      CRAFTKIT_AI_MODEL: 'claude-other',
    };

    expect(codexSubscriptionEnv(source)).toEqual({
      PATH: '/bin',
      HOME: '/test-home',
      CODEX_HOME: '/test-codex',
      LANG: 'en_US.UTF-8',
      SSL_CERT_FILE: '/test-ca.pem',
    });
    expect(source.OPENAI_API_KEY).toBe('fixture-openai');
    expect(codexSubscriptionEnv({})).toEqual({});
  });

  it('runs an ephemeral read-only child with no tools, customization or API-key fallback', () => {
    const args = codexArgs(FILES);
    expect(args).toEqual(
      expect.arrayContaining([
        'exec',
        '--json',
        '--ephemeral',
        '--ignore-user-config',
        '--ignore-rules',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
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
      ]),
    );
    expect(args[args.indexOf('--cd') + 1]).toBe(FILES.directory);
    expect(args[args.indexOf('--output-last-message') + 1]).toBe(FILES.outputPath);
    expect(args).toContain(`model_instructions_file=${JSON.stringify(FILES.instructionsPath)}`);
    expect(args.at(-1)).toBe('-');
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).not.toContain('--full-auto');
  });

  it.each([undefined, CODEX_DEFAULT_MODEL])('leaves model selection to the CLI for %s', (model) => {
    expect(codexArgs({ ...FILES, model })).not.toContain('--model');
  });

  it('passes a chosen model, effort and image paths as separate arguments', () => {
    const args = codexArgs({
      ...FILES,
      model: 'gpt-fixture',
      effort: 'xhigh',
      images: ['/private/tmp/image one.png', '/private/tmp/image two.jpg'],
    });
    expect(args.slice(args.indexOf('--model'))).toEqual([
      '--model',
      'gpt-fixture',
      '--image',
      '/private/tmp/image one.png',
      '--image',
      '/private/tmp/image two.jpg',
      '-',
    ]);
    expect(args).toContain('model_reasoning_effort="xhigh"');
    expect(CODEX_DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(600_000);
  });

  it.each(['minimal', 'low', 'medium', 'high', 'xhigh'] as const)(
    'accepts the supported effort %s',
    (effort) => {
      expect(codexEffort(effort)).toBe(effort);
    },
  );

  it('maps the shared max level and preserves an omitted effort', () => {
    expect(codexEffort('max')).toBe('xhigh');
    expect(codexEffort(undefined)).toBeUndefined();
    expect(codexEffort('')).toBeUndefined();
  });

  it.each(['HIGH', 'invalid', 'low";web_search="live'])(
    'refuses invalid effort %s instead of injecting config',
    (effort) => {
      expect(() => codexEffort(effort)).toThrow(
        expect.objectContaining({ name: 'CodexBackendError', httpStatus: 400, retryable: false }),
      );
    },
  );
});
