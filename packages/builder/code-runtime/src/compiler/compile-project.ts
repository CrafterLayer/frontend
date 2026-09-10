import { context, type BuildContext, type BuildFailure, type Loader } from 'esbuild';
import { compile as compileTailwind } from 'tailwindcss';
import type { ArtifactFile, CompileDiagnostic } from '@craftkit/builder-schema';
import type { CompileOptions, CompileResult, RuntimeSnapshot, SourceElement } from '../contracts';
import { fingerprint, projectFingerprints } from '../fingerprint';
import { instrumentSource } from './instrument-source';
import {
  resolveProjectModule,
  validateManagedCatalog,
  type ResolvedModule,
} from './resolve-project';

function abort(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

function compileDiagnostics(cause: unknown): readonly CompileDiagnostic[] {
  if (cause instanceof Error && 'errors' in cause && Array.isArray(cause.errors)) {
    return (cause as BuildFailure).errors.slice(0, 20).map((error) => ({
      code: 'compile-failed',
      severity: 'error',
      message: error.text.slice(0, 4000),
      ...(error.location === null
        ? {}
        : {
            modulePath: error.location.file.replace(/^craftkit:project:/u, ''),
            line: error.location.line,
            column: error.location.column + 1,
          }),
    }));
  }
  return [
    {
      code: 'compile-failed',
      severity: 'error',
      message: cause instanceof Error ? cause.message.slice(0, 4000) : 'Compilation failed.',
    },
  ];
}

/** Compilation only; the application runs this entry in a bounded worker process. */
export async function compileProject(
  snapshot: RuntimeSnapshot,
  options: CompileOptions,
): Promise<CompileResult> {
  abort(options.signal);
  let build: BuildContext | undefined;
  const cancel = (): void => {
    void build?.cancel();
  };
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    // Pin every compiler input before the first async boundary; caller edits cannot race its digest.
    snapshot = structuredClone(snapshot);
    options = { ...options, catalog: structuredClone(options.catalog) };
    validateManagedCatalog(snapshot, options.catalog);
    const sourceBytes = new TextEncoder().encode(JSON.stringify(snapshot.project.files)).byteLength;
    if (sourceBytes > (options.maxSourceBytes ?? 2_000_000))
      throw new Error('Project source exceeds the compiler input limit.');
    const identity = await projectFingerprints(snapshot, options.catalog);
    abort(options.signal);
    const cached = await options.cache?.get(identity.artifactId);
    abort(options.signal);
    if (
      cached?.artifactId === identity.artifactId &&
      cached.sourceRevision === snapshot.project.revision
    )
      return { ok: true, artifact: cached, cacheHit: true };
    const modules = new Map<string, ResolvedModule>();
    const sourceElements: SourceElement[] = [];
    const entry = resolveProjectModule(snapshot, options.catalog, snapshot.entry);
    modules.set(`project:${entry.path}`, entry);
    const bootstrap = `import * as React from 'react'; import {createRoot,hydrateRoot} from 'react-dom/client'; import Page from 'craftkit:entry'; const root=document.getElementById('root'); if(!root)throw new Error('Missing page root'); const page=React.createElement(Page,${JSON.stringify(snapshot.inputs).replace(/</gu, '\\u003c')}); if(root.hasChildNodes())hydrateRoot(root,page);else createRoot(root).render(page);`;
    build = await context({
      stdin: { contents: bootstrap, loader: 'js', sourcefile: 'craftkit-bootstrap.js' },
      bundle: true,
      write: false,
      outdir: '/artifact',
      entryNames: 'page',
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      sourcemap: 'external',
      sourcesContent: false,
      logLevel: 'silent',
      metafile: true,
      plugins: [
        {
          name: 'craftkit-virtual-project',
          setup(builder) {
            // esbuild forwards filters to Go; JavaScript's Unicode flag is unsupported there.
            builder.onResolve({ filter: /.*/ }, (args) => {
              abort(options.signal);
              if (args.path === 'craftkit:entry' && args.importer === 'craftkit-bootstrap.js')
                return { path: `project:${entry.path}`, namespace: 'craftkit' };
              const importer = args.importer.startsWith('project:')
                ? args.importer.slice(8)
                : args.importer;
              const resolved = resolveProjectModule(
                snapshot,
                options.catalog,
                args.path,
                importer || undefined,
              );
              const key = `${resolved.kind}:${resolved.path}`;
              modules.set(key, resolved);
              return { path: key, namespace: 'craftkit' };
            });
            builder.onLoad({ filter: /.*/, namespace: 'craftkit' }, async (args) => {
              abort(options.signal);
              const module = modules.get(args.path);
              if (module === undefined) throw new Error(`Unknown virtual module: ${args.path}`);
              let contents = module.file.source;
              if (
                module.kind === 'project' &&
                ['tsx', 'jsx', 'ts', 'js'].includes(module.file.language)
              ) {
                const result = await instrumentSource(snapshot, module.path, contents);
                contents = result.source;
                sourceElements.push(...result.elements);
              }
              abort(options.signal);
              return { contents, loader: module.file.language as Loader };
            });
          },
        },
      ],
    });
    abort(options.signal);
    const result = await build.rebuild();
    abort(options.signal);
    const emitted = result.outputFiles ?? [];
    const cssSource = [
      options.catalog.stylesheet ?? '',
      ...emitted.filter((file) => file.path.endsWith('.css')).map((file) => file.text),
    ].join('\n');
    const styles = await compileTailwind(cssSource, {
      loadModule: () =>
        Promise.reject(
          new Error('Authored Tailwind plugins and configuration modules are not allowed.'),
        ),
      loadStylesheet: (id) => {
        const module = resolveProjectModule(snapshot, options.catalog, id);
        if (module.kind !== 'managed' || module.file.language !== 'css')
          throw new Error(`Stylesheet import is not managed: ${id}`);
        return Promise.resolve({ path: id, base: '', content: module.file.source });
      },
    });
    abort(options.signal);
    const candidates = [
      ...Object.values(snapshot.project.files),
      ...[...modules.values()].map((module) => module.file),
    ].flatMap((file) => file.source.match(/[A-Za-z0-9_!@#%:/.[\]()-]+/gu) ?? []);
    const css = styles.build([...new Set(candidates)]);
    const rawFiles = [
      ...emitted
        .filter((file) => !file.path.endsWith('.css'))
        .map((file) => ({ path: file.path.split('/').pop() ?? 'page.js', content: file.text })),
      { path: 'page.css', content: css },
    ];
    if (
      rawFiles.reduce((size, file) => size + new TextEncoder().encode(file.content).byteLength, 0) >
      (options.maxOutputBytes ?? 8_000_000)
    )
      throw new Error('Compiled artifact exceeds the output limit.');
    const files: ArtifactFile[] = await Promise.all(
      rawFiles.map(async (file) => ({ ...file, integrity: await fingerprint(file.content) })),
    );
    const js = files.filter((file) => file.path.endsWith('.js'));
    const sourceMap = files.find((file) => file.path.endsWith('.js.map'));
    if (js.length === 0) throw new Error('Compiler produced no JavaScript entry.');
    const artifact = {
      ...identity,
      projectId: snapshot.projectId,
      pageId: snapshot.pageId,
      sourceRevision: snapshot.project.revision,
      entry: snapshot.entry,
      routeEntries: { [snapshot.address]: snapshot.entry },
      js,
      css: files.filter((file) => file.path.endsWith('.css')),
      ...(sourceMap === undefined ? {} : { sourceMap }),
      sourceElements: sourceElements.sort(
        (left, right) =>
          left.handle.modulePath.localeCompare(right.handle.modulePath) || left.start - right.start,
      ),
      diagnostics: [] as CompileDiagnostic[],
      createdAt: Date.now(),
    };
    abort(options.signal);
    await options.cache?.put(identity.artifactId, artifact);
    abort(options.signal);
    return { ok: true, artifact, cacheHit: false };
  } catch (cause) {
    abort(options.signal);
    return { ok: false, diagnostics: compileDiagnostics(cause) };
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    await build?.dispose();
  }
}
