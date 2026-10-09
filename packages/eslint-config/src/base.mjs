import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import typescript from 'typescript-eslint';

const typeScriptFiles = ['**/*.{ts,tsx,mts,cts}'];

export const baseConfig = typescript.config(
  {
    name: '@craftkit/ignores',
    ignores: [
      '**/.cache/**',
      '**/.turbo/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      // The remember plugin's scratch folder (gitignored by its own .gitignore).
      '**/.remember/**',
      '**/storybook-static/**',
      '**/test-results/**',
      '.agents/**',
      '.claude/**',
      '.cursor/**',
      '.specify/extensions/**',
      '.specify/integrations/**',
      '.specify/presets/**',
      // Vendored third-party code is kept VERBATIM for provenance (vendor/VENDOR.md):
      // it is never compiled, imported, or shipped, and must not be reformatted or
      // linted against our rules — the adaptations live inside our own packages.
      'vendor/**',
    ],
  },
  {
    name: '@craftkit/javascript',
    ...eslint.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
  {
    name: '@craftkit/typescript',
    files: typeScriptFiles,
    extends: [...typescript.configs.strictTypeChecked, ...typescript.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: '@craftkit/test-files',
    files: ['**/*.{test,spec}.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
