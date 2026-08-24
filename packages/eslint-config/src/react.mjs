import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

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
