import { describe, expect, it } from 'vitest';

import { professionalBuilderFlags } from './feature-flags';

describe('professionalBuilderFlags', () => {
  it('keeps every new capability off unless it is explicitly enabled', () => {
    expect(professionalBuilderFlags({})).toEqual({
      v2Authoring: false,
      sourceAwareEditing: false,
      remoteCodeGeneration: false,
      codeExport: false,
    });
  });

  it('keeps rollout boundaries independent', () => {
    expect(
      professionalBuilderFlags({
        VITE_BUILDER_V2_AUTHORING: 'true',
        VITE_BUILDER_SOURCE_EDITING: 'false',
        VITE_BUILDER_REMOTE_CODE_GENERATION: true,
        VITE_BUILDER_CODE_EXPORT: 'true',
      }),
    ).toEqual({
      v2Authoring: true,
      sourceAwareEditing: false,
      remoteCodeGeneration: false,
      codeExport: true,
    });
  });
});
