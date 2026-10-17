import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { BUILDER_AI_CONTEXT_PROVIDERS } from './assemble-context';

/** Registers the headless providers at the contribution point declared by the schema package. */
export const builderAiContextExtension: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-context',
  version: '0.0.0',
  contributes: { aiContext: [...BUILDER_AI_CONTEXT_PROVIDERS] },
};
