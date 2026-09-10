export {
  COMPILER_VERSION,
  compileProject,
  createBuildCache,
  fingerprint,
  instrumentSource,
  projectFingerprints,
  resolveProjectModule,
  validateManagedCatalog,
  validateModulePath,
} from '@craftkit/builder-code-runtime/compiler';
export { buildManagedCatalog } from './catalog/build-managed-catalog';
export type {
  CompileOptions,
  CompileResult,
  CompiledPageArtifact,
  ManagedCatalog,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder-code-runtime/compiler';
