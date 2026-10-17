const SYSTEM_PORT_FILES = [
  'packages/builder/core/src/ports/system-clock.ts',
  'packages/builder/core/src/ports/system-ids.ts',
];

const REACT_IMPORT_PATHS = [
  {
    name: 'react',
    allowTypeImports: true,
    message: 'Headless kernel code must not run React. Type-only imports are allowed.',
  },
  {
    name: 'react-dom',
    allowTypeImports: true,
    message: 'Headless kernel code must not touch the DOM renderer.',
  },
];

const REACT_IMPORT_PATTERNS = [
  {
    group: ['react/*'],
    allowTypeImports: true,
    message: 'Headless kernel code must not run React. Type-only imports are allowed.',
  },
  {
    group: ['react-dom/*'],
    allowTypeImports: true,
    message: 'Headless kernel code must not touch the DOM renderer.',
  },
  {
    group: ['*.css', '**/*.css'],
    message: 'Headless kernel code must not import styles.',
  },
];

const DETERMINISM_SYNTAX_RESTRICTIONS = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Time flows through ClockPort (Law D); only ports/system-clock.ts reads the system clock.',
  },
  {
    selector: "NewExpression[callee.name='Date']",
    message:
      'Time flows through ClockPort (Law D); only ports/system-clock.ts reads the system clock.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Randomness flows through IdPort (Law D); only ports/system-ids.ts may use entropy.',
  },
];

const RESTRICTED_GLOBALS = ['window', 'document', 'navigator'].map((name) => ({
  name,
  message: 'Headless kernel code must not assume a browser environment.',
}));

/**
 * Purity and determinism laws for headless builder-kernel packages.
 *
 * @param {string[]} files glob patterns (relative to the repository root config)
 *   selecting the kernel sources the laws apply to.
 */
export function headlessConfig(files) {
  return [
    {
      name: '@craftkit/headless-kernel',
      files,
      rules: {
        // The kernel's document is a flat id-keyed map; removing nodes/slots BY KEY
        // is its core operation (immer drafts make `delete` the idiomatic form).
        '@typescript-eslint/no-dynamic-delete': 'off',
        'no-restricted-globals': ['error', ...RESTRICTED_GLOBALS],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              ...REACT_IMPORT_PATHS,
              {
                name: 'zustand',
                message: "Import from 'zustand/vanilla' — the kernel ships zero React.",
              },
              {
                name: 'nanoid',
                message:
                  'Id generation flows through IdPort (Law D); only ports/system-ids.ts may import nanoid.',
              },
            ],
            patterns: REACT_IMPORT_PATTERNS,
          },
        ],
        'no-restricted-syntax': ['error', ...DETERMINISM_SYNTAX_RESTRICTIONS],
      },
    },
    {
      // The two system port implementations are the ONLY files allowed to touch
      // ambient time/entropy; every other law still applies to them.
      name: '@craftkit/headless-kernel-system-ports',
      files: SYSTEM_PORT_FILES,
      rules: {
        'no-restricted-imports': [
          'error',
          { paths: REACT_IMPORT_PATHS, patterns: REACT_IMPORT_PATTERNS },
        ],
        'no-restricted-syntax': 'off',
      },
    },
    {
      // Test files construct forbidden values (dates, Date.now results) to PROVE
      // the kernel rejects them; the import/global purity laws still apply.
      name: '@craftkit/headless-kernel-tests',
      files: files.map((pattern) => pattern.replace(/\*\*$/, '**/*.test.ts')),
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ];
}
