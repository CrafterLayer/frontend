# Builder code runtime

Layer-2 compilation, preview transport and export for feature 014. Builder-family consumers use this
package's explicit entrypoints; applications use the matching `@craftkit/builder/code-runtime`
facade subpaths. The root exports types only, `/browser` has no Node/compiler imports, and
`/compiler` and `/export` never import the editor or shell.

`compileProject(snapshot, { catalog, cache, signal })` bundles only virtual project files and locked
managed modules. Catalog source comes from the facade; the runtime does not import higher-layer
extensions. Compilation instruments DOM JSX elements with revision-bound source handles. It does not
execute authored JavaScript. The application must supervise compilation in a killable worker with
deployment-specific resource limits; this package is not an OS sandbox.

`mountPreview(container, options)` owns one frame on the configured isolated origin, validates
frame/channel/revision/target identity, and disposes on abort or missed heartbeat. The preview host
must serve immutable artifact files, provide a restrictive CSP, validate its configured parent
origin, and use `validatePreviewHostCommand` before loading an artifact. A frame watchdog provides
recovery, not a portable browser CPU quota.

`exportSite(pages, { catalog, artifacts, prerender, signal })` refuses stale/incomplete output,
checks artifact integrity, and produces HTML/CSS/JavaScript files for a static host. Prerendering is
an injected isolated-worker port; this exporter never evaluates a page. The host must validate
runtime interactions and navigation in the exported site before release.

Source text is authoritative. Build output and source maps are content-addressed, rebuildable
artifacts. Artifact/source revisions must match before export; retaining an older preview never
authorizes publishing it.

Run `pnpm --filter @craftkit/builder-code-runtime test`, `typecheck`, and `lint`. Workspace graph
fixtures also reject browser imports of compiler dependencies.
