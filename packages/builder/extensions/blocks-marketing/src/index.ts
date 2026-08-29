// @craftkit/builder-blocks-marketing — the first real content extension (layer 4).
// Six landing-page blocks, each a complete mechanically-validated component.

import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Cta, ctaSchema } from './components/Cta';
import { Features, featuresSchema } from './components/Features';
import { Grid, gridSchema } from './components/Grid';
import { Image, imageSchema } from './components/Image';
import { NavLinks, navLinksSchema } from './components/NavLinks';
import { PageFooter, pageFooterSchema } from './components/PageFooter';
import { PageHeader, pageHeaderSchema } from './components/PageHeader';
import { Stack, stackSchema } from './components/Stack';
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
      // The container comes first: it is what the others go INSIDE.
      // A page is framed before it is filled.
      { schema: pageHeaderSchema, render: PageHeader },
      { schema: pageFooterSchema, render: PageFooter },
      { schema: stackSchema, render: Stack },
      // The other layout primitive: a grid, where Stack is a flex row or column.
      { schema: gridSchema, render: Grid },
      { schema: imageSchema, render: Image },
      { schema: heroSchema, render: Hero },
      { schema: featuresSchema, render: Features },
      { schema: pricingSchema, render: Pricing },
      { schema: testimonialsSchema, render: Testimonials },
      { schema: ctaSchema, render: Cta },
      // A row of links: the composition primitive a header or footer slot holds.
      { schema: navLinksSchema, render: NavLinks },
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
