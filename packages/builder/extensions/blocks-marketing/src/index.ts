// @craftkit/builder-blocks-marketing — the first real content extension (layer 4).
// Six landing-page blocks, each a complete mechanically-validated component.

import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Cta, ctaSchema } from './components/Cta';
import { Features, featuresSchema } from './components/Features';
import { Hero, heroSchema } from './components/Hero';
import { Pricing, pricingSchema } from './components/Pricing';
import { RichTextBlock, richTextBlockSchema } from './components/RichTextBlock';
import { Testimonials, testimonialsSchema } from './components/Testimonials';

export const blocksMarketing: TrustedExtensionManifest = {
  tier: 1,
  name: 'blocks-marketing',
  version: '0.1.0',
  contributes: {
    blocks: [
      { schema: heroSchema, render: Hero },
      { schema: featuresSchema, render: Features },
      { schema: pricingSchema, render: Pricing },
      { schema: testimonialsSchema, render: Testimonials },
      { schema: ctaSchema, render: Cta },
      { schema: richTextBlockSchema, render: RichTextBlock },
    ],
  },
};

export { Cta, ctaSchema, type CtaProps } from './components/Cta';
export { Features, featuresSchema, type FeaturesProps } from './components/Features';
export { Hero, heroSchema, type HeroProps } from './components/Hero';
export { Pricing, pricingSchema, type PricingProps } from './components/Pricing';
export {
  RichTextBlock,
  richTextBlockSchema,
  type RichTextBlockProps,
} from './components/RichTextBlock';
export {
  Testimonials,
  testimonialsSchema,
  type TestimonialsProps,
} from './components/Testimonials';
