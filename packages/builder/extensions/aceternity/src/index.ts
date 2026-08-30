/*
  @craftkit/builder-aceternity — visual effects adapted from Aceternity UI
  (MIT), layer 4.

  Aceternity is a copy-paste catalog rather than a package, which is exactly
  the shape this workspace's standing rule already assumes: vendor with
  attribution, never npm-depend. The verbatim sources live under
  `vendor/aceternity/` and are never compiled; what ships here is the
  adaptation, and the adaptation is the point.

  Upstream hard-codes Tailwind's own palette into every gradient. Copied as-is,
  every generated site would carry the same blue effect regardless of its
  brand — at the top of the page, where people look first. Rewritten against
  `--t-*`, the effects follow the generated design system instead of
  contradicting it.
*/
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { AuroraBackground, auroraBackgroundSchema } from './components/AuroraBackground';

export const builderAceternity: TrustedExtensionManifest = {
  tier: 1,
  name: 'aceternity',
  version: '0.1.0',
  contributes: {
    blocks: [{ schema: auroraBackgroundSchema, render: AuroraBackground }],
  },
};

export {
  AuroraBackground,
  auroraBackgroundSchema,
  type AuroraBackgroundProps,
} from './components/AuroraBackground';
