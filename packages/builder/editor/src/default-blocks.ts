import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Page, pageExamples, pageSchema } from './components/Page';

/**
 * The preset's structural starter set (starter-kit style): today only the page
 * root; grows with the shell milestone. Registered by default alongside content
 * extensions like blocks-marketing.
 */
export const defaultBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-default-blocks',
  version: '0.1.0',
  contributes: {
    blocks: [{ schema: { ...pageSchema, examples: pageExamples }, render: Page }],
  },
};
