// The stylesheet door's type. A side-effect import has no bindings, so this
// declares an empty module — the point is only that TypeScript can RESOLVE
// `@craftkit/builder-theme/css`.
//
// It lives with the package rather than in a consumer's globals.d.ts because
// the preset's source is typechecked by several projects (the playground
// compiles it directly), and an ambient declaration only covers the project
// that includes the file. Shipping the type with the export covers all of them.
export {};
