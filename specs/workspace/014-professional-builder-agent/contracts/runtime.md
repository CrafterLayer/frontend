# Runtime, Preview, and Export Contract

## Public entrypoints

- `@craftkit/builder/code-runtime`: shared contract types only.
- `@craftkit/builder/code-runtime/compiler`: Node/worker compilation and instrumentation.
- `@craftkit/builder/code-runtime/browser`: browser preview session and bridge client.
- `@craftkit/builder/code-runtime/export`: route validation and export assembly.

Browser entrypoints cannot reach Node, compiler, editor, or shell modules. Compiler/export entrypoints
cannot reach editor DOM code. Workspace graph tests enforce both properties.

## Compiler

```ts
compileProject(snapshot, { catalog, cache, signal }): Promise<CompileResult>
```

The compiler normalizes and validates paths, resolves only locked managed imports, instruments stable
source identities, compiles source and used styles, and returns either a revision-pinned artifact or
diagnostics. It does not execute authored source.

## Preview

```ts
mountPreview(container, {
  artifact,
  publicData,
  expectedOrigin,
  bridge,
  signal,
}): Promise<PreviewSession>
```

The preview application loads immutable artifact URLs. Messages include protocol version, channel,
project, page, artifact revision, and compiler-generated target identity. Unknown, forged, stale, or
wrong-origin messages are ignored and reported. The bridge exposes geometry, target focus, runtime
diagnostics, navigation requests, and heartbeat only.

## Export

```ts
exportSite(snapshot, { catalog, artifacts, prerender, signal }): Promise<ExportResult>
```

Every indexable route requires matching artifacts, primary prerendered content, metadata, navigable
links, assets, and a hydration entry. Browser-only islands require meaningful fallback. A stale or
missing artifact refuses export.

## Capability policy

Authored code receives public inputs, copied assets, route manifest, and configured public network
capabilities. It never receives editor credentials, storage, cookies, source, kernel references,
filesystem access, install scripts, build plugins, or generic parent RPC.

