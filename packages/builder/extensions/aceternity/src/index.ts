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
import { CloudShader, cloudShaderSchema } from './components/CloudShader';
import { SpotlightSurface, spotlightSurfaceSchema } from './components/SpotlightSurface';

export const builderAceternity: TrustedExtensionManifest = {
  tier: 1,
  name: 'aceternity',
  version: '0.1.0',
  contributes: {
    blocks: [
      { schema: auroraBackgroundSchema, render: AuroraBackground },
      { schema: cloudShaderSchema, render: CloudShader },
      { schema: spotlightSurfaceSchema, render: SpotlightSurface },
    ],
  },
};

export {
  AuroraBackground,
  auroraBackgroundSchema,
  type AuroraBackgroundProps,
} from './components/AuroraBackground';

export { CloudShader, cloudShaderSchema, type CloudShaderProps } from './components/CloudShader';
export { CLOUD_ROLES, type CloudRole } from './components/CloudShader/colors';
export {
  SpotlightSurface,
  spotlightSurfaceSchema,
  type SpotlightSurfaceProps,
} from './components/SpotlightSurface';
