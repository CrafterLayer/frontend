/*
  @craftkit/builder-magicui — visual effects adapted from Magic UI (MIT),
  layer 4.

  The second effects pack, and it exists to prove the first one generalised:
  both source catalogs are adapted through the same extension boundary. The
  implementations here are original, token-bound Builder blocks rather than
  pasted catalog source, so they follow the generated design system instead of
  shipping another author's palette or document contract.

  Adding a third catalog needs no architectural change at all. That was the
  point of doing the first two this way.
*/
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { DotPatternSurface, dotPatternSurfaceSchema } from './components/DotPatternSurface';
import { Marquee, marqueeSchema } from './components/Marquee';
import { ShimmerButton, shimmerButtonSchema } from './components/ShimmerButton';
import { ShineBorder, shineBorderSchema } from './components/ShineBorder';

export const builderMagicUi: TrustedExtensionManifest = {
  tier: 1,
  name: 'magicui',
  version: '0.1.0',
  contributes: {
    blocks: [
      { schema: shineBorderSchema, render: ShineBorder },
      { schema: marqueeSchema, render: Marquee },
      { schema: shimmerButtonSchema, render: ShimmerButton },
      { schema: dotPatternSurfaceSchema, render: DotPatternSurface },
    ],
  },
};

export { ShineBorder, shineBorderSchema, type ShineBorderProps } from './components/ShineBorder';
export {
  Marquee,
  marqueeItemSchema,
  marqueeSchema,
  type MarqueeItem,
  type MarqueeProps,
} from './components/Marquee';
export {
  ShimmerButton,
  shimmerButtonSchema,
  type ShimmerButtonProps,
} from './components/ShimmerButton';
export {
  DotPatternSurface,
  dotPatternSurfaceSchema,
  type DotPatternSurfaceProps,
} from './components/DotPatternSurface';
