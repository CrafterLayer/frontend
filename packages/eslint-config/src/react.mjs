import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * `react/jsx-no-comment-textnodes` without the whole React plugin: a line
 * that starts with `//` or `/*` between JSX tags is TEXT, and it renders on
 * screen (App.tsx shipped one above the editor's top bar). esquery regexes
 * cannot hold a slash, hence `\x2F`.
 */
export const JSX_COMMENT_TEXT_SELECTOR = 'JSXText[value=/^\\s*\\x2F[\\x2F*]/m]';

export const reactConfig = [
  {
    name: '@craftkit/react',
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'no-restricted-syntax': [
        'error',
        {
          selector: JSX_COMMENT_TEXT_SELECTOR,
          message: 'Comments inside JSX children render as text. Wrap them in {/* … */}.',
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
    },
    settings: {
      react: {
        version: '19.2',
      },
    },
  },
];
