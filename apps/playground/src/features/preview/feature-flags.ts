export interface ProfessionalBuilderFeatureFlags {
  readonly v2Authoring: boolean;
  readonly sourceAwareEditing: boolean;
  readonly remoteCodeGeneration: boolean;
  readonly codeExport: boolean;
}

type FeatureFlagName = keyof ProfessionalBuilderFeatureFlags;

const ENV_KEYS: Readonly<Record<FeatureFlagName, string>> = {
  v2Authoring: 'VITE_BUILDER_V2_AUTHORING',
  sourceAwareEditing: 'VITE_BUILDER_SOURCE_EDITING',
  remoteCodeGeneration: 'VITE_BUILDER_REMOTE_CODE_GENERATION',
  codeExport: 'VITE_BUILDER_CODE_EXPORT',
};

/**
 * New authored-code capabilities stay independently reversible. A missing or
 * malformed value is disabled; only an explicit `true` enables a boundary.
 */
export function professionalBuilderFlags(
  environment: Readonly<Record<string, unknown>>,
): ProfessionalBuilderFeatureFlags {
  const enabled = (name: FeatureFlagName): boolean => environment[ENV_KEYS[name]] === 'true';

  return Object.freeze({
    v2Authoring: enabled('v2Authoring'),
    sourceAwareEditing: enabled('sourceAwareEditing'),
    remoteCodeGeneration: enabled('remoteCodeGeneration'),
    codeExport: enabled('codeExport'),
  });
}

export const PROFESSIONAL_BUILDER_FLAGS = professionalBuilderFlags(import.meta.env);
