export { compileProject } from './compiler/compile-project';
export { instrumentSource } from './compiler/instrument-source';
export {
  resolveProjectModule,
  validateManagedCatalog,
  validateModulePath,
} from './compiler/resolve-project';
export { createBuildCache } from './cache/build-cache';
export { fingerprint, projectFingerprints, COMPILER_VERSION } from './fingerprint';
export type {
  CompileOptions,
  CompileResult,
  CompiledPageArtifact,
  ManagedCatalog,
  RuntimeSnapshot,
  SourceElement,
} from './contracts';
