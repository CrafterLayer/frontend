import type { ManagedCatalog } from '@craftkit/builder-code-runtime';

// Additive admission retains the existing lock/profile version. Full catalog content is hashed
// into every artifact identity, so adding Embla invalidates caches without breaking saved locks.
export const REFERENCE_MANAGED_CATALOG_VERSION = 'craftkit-managed-reference-v1';
export const MANAGED_REACT_VERSION = '19.2.8';
export const MANAGED_RUNTIME_SPECIFIER = 'react/managed-runtime';

const reactExports = [
  'Children',
  'Component',
  'Fragment',
  'Profiler',
  'PureComponent',
  'StrictMode',
  'Suspense',
  'cloneElement',
  'createContext',
  'createElement',
  'createRef',
  'forwardRef',
  'isValidElement',
  'lazy',
  'memo',
  'startTransition',
  'use',
  'useActionState',
  'useCallback',
  'useContext',
  'useDebugValue',
  'useDeferredValue',
  'useEffect',
  'useEffectEvent',
  'useId',
  'useImperativeHandle',
  'useInsertionEffect',
  'useLayoutEffect',
  'useMemo',
  'useOptimistic',
  'useReducer',
  'useRef',
  'useState',
  'useSyncExternalStore',
  'useTransition',
  'version',
] as const;

/** Virtual adapters share one React identity. The compiler facade supplies the pinned bundle. */
export const referenceManagedCatalog: ManagedCatalog = {
  manifest: {
    catalogVersion: REFERENCE_MANAGED_CATALOG_VERSION,
    runtimeProfile: 'craftkit-react-v1',
    packages: [
      {
        packageId: 'react',
        version: MANAGED_REACT_VERSION,
        importSpecifiers: ['react', 'react/jsx-runtime', MANAGED_RUNTIME_SPECIFIER],
        sourceArtifactId: 'craftkit-react-19.2.8-v1',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'unbuilt',
      },
      {
        packageId: 'react-dom',
        version: MANAGED_REACT_VERSION,
        importSpecifiers: ['react-dom', 'react-dom/client'],
        sourceArtifactId: 'craftkit-react-dom-19.2.8-v1',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'unbuilt',
      },
      {
        packageId: 'lucide-react',
        version: '1.43.0',
        importSpecifiers: ['lucide-react'],
        sourceArtifactId: 'craftkit-lucide-react-1.43.0',
        cssArtifactIds: [],
        license: 'ISC',
        integrity: 'unbuilt',
      },
      {
        packageId: 'motion',
        version: '13.1.1',
        importSpecifiers: ['motion/react'],
        sourceArtifactId: 'craftkit-motion-13.1.1',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'unbuilt',
      },
      {
        packageId: 'tailwindcss',
        version: '4.3.3',
        importSpecifiers: ['tailwindcss'],
        sourceArtifactId: 'craftkit-tailwind-4.3.3',
        cssArtifactIds: ['craftkit-tailwind-4.3.3'],
        license: 'MIT',
        integrity: 'unbuilt',
      },
      {
        packageId: 'embla-carousel',
        version: '8.6.0',
        importSpecifiers: ['embla-carousel'],
        sourceArtifactId: 'craftkit-embla-carousel-8.6.0',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'unbuilt',
      },
    ],
  },
  modules: {
    react: {
      language: 'js',
      source: `import { React } from '${MANAGED_RUNTIME_SPECIFIER}';\nexport default React;\n${reactExports.map((name) => `export const ${name} = React.${name};`).join('\n')}`,
    },
    'react/jsx-runtime': {
      language: 'js',
      source: `import { jsxRuntime } from '${MANAGED_RUNTIME_SPECIFIER}';\nexport const Fragment = jsxRuntime.Fragment;\nexport const jsx = jsxRuntime.jsx;\nexport const jsxs = jsxRuntime.jsxs;`,
    },
    'react-dom/client': {
      language: 'js',
      source: `import { reactDomClient } from '${MANAGED_RUNTIME_SPECIFIER}';\nexport const createRoot = reactDomClient.createRoot;\nexport const hydrateRoot = reactDomClient.hydrateRoot;`,
    },
    'react-dom': {
      language: 'js',
      source: `import { reactDom } from '${MANAGED_RUNTIME_SPECIFIER}';\nexport default reactDom;\n${['createPortal', 'flushSync', 'preconnect', 'prefetchDNS', 'preinit', 'preinitModule', 'preload', 'preloadModule', 'requestFormReset', 'unstable_batchedUpdates', 'useFormState', 'useFormStatus', 'version'].map((name) => `export const ${name} = reactDom.${name};`).join('\n')}`,
    },
  },
};
