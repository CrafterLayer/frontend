import { pageHeaderSchema } from './components/PageHeader/schema';
import { pageFooterSchema } from './components/PageFooter/schema';
import { stackSchema } from './components/Stack/schema';
import { gridSchema } from './components/Grid/schema';
import { imageSchema } from './components/Image/schema';
import { announcementBarSchema } from './components/AnnouncementBar/schema';
import { promoBannerSchema } from './components/PromoBanner/schema';
import { heroSchema } from './components/Hero/schema';
import { carouselSchema } from './components/Carousel/schema';
import { videoSectionSchema } from './components/VideoSection/schema';
import { gallerySchema } from './components/Gallery/schema';
import { logoCloudSchema } from './components/LogoCloud/schema';
import { featuresSchema } from './components/Features/schema';
import { bentoGridSchema } from './components/BentoGrid/schema';
import { contentSectionSchema } from './components/ContentSection/schema';
import { statsSchema } from './components/Stats/schema';
import { processStepsSchema } from './components/ProcessSteps/schema';
import { teamSchema } from './components/Team/schema';
import { portfolioGridSchema } from './components/PortfolioGrid/schema';
import { productGridSchema } from './components/ProductGrid/schema';
import { pricingSchema } from './components/Pricing/schema';
import { pricingPlanSchema } from './components/PricingPlan/schema';
import { testimonialsSchema } from './components/Testimonials/schema';
import { comparisonTableSchema } from './components/ComparisonTable/schema';
import { faqSchema } from './components/Faq/schema';
import { blogGridSchema } from './components/BlogGrid/schema';
import { contactSchema } from './components/Contact/schema';
import { formSectionSchema } from './components/FormSection/schema';
import { newsletterSchema } from './components/Newsletter/schema';
import { ctaSchema } from './components/Cta/schema';
import { navLinksSchema } from './components/NavLinks/schema';
import { richTextBlockSchema } from './components/RichTextBlock/schema';

import type { BlockSchema } from '@craftkit/builder-schema';

/**
 * Every block schema this pack contributes, and NOT one line of React.
 *
 * ## Why a second entry point exists
 *
 * `./index.ts` pairs each schema with the component that draws it, so importing
 * it drags in `@craftkit/builder-renderer`, which reads DOM globals. That is
 * correct for the editor and fatal for everyone else: a Node service — an MCP
 * server, an eval harness, a batch renderer, a migration — needs the VOCABULARY
 * (what a `pricing` block is, which props it takes, which slots it opens) so it
 * can validate a document, and has no business loading a renderer it will never
 * call. Before this file the choice was to load React in Node or to work against
 * a six-block test fixture and pretend it was the product.
 *
 * Every module below is a `schema.ts`, and those import `zod`, this package's
 * own prop groups, and their `examples.ts` sibling. Nothing else. The barrel is
 * therefore browser-free by construction rather than by promise, and
 * `schemas.node.test.ts` fails the moment a component sneaks in.
 *
 * ## Order is meaningful
 *
 * The array follows `blocksMarketing.contributes.blocks` exactly: containers
 * before the sections that go inside them. A model reading the catalog reads it
 * in this order, and a page is framed before it is filled.
 */
export const marketingBlockSchemas: readonly BlockSchema[] = [
  pageHeaderSchema,
  pageFooterSchema,
  stackSchema,
  gridSchema,
  imageSchema,
  announcementBarSchema,
  promoBannerSchema,
  heroSchema,
  carouselSchema,
  videoSectionSchema,
  gallerySchema,
  logoCloudSchema,
  featuresSchema,
  bentoGridSchema,
  contentSectionSchema,
  statsSchema,
  processStepsSchema,
  teamSchema,
  portfolioGridSchema,
  productGridSchema,
  pricingSchema,
  pricingPlanSchema,
  testimonialsSchema,
  comparisonTableSchema,
  faqSchema,
  blogGridSchema,
  contactSchema,
  formSectionSchema,
  newsletterSchema,
  ctaSchema,
  navLinksSchema,
  richTextBlockSchema,
];

export {
  pageHeaderSchema,
  pageFooterSchema,
  stackSchema,
  gridSchema,
  imageSchema,
  announcementBarSchema,
  promoBannerSchema,
  heroSchema,
  carouselSchema,
  videoSectionSchema,
  gallerySchema,
  logoCloudSchema,
  featuresSchema,
  bentoGridSchema,
  contentSectionSchema,
  statsSchema,
  processStepsSchema,
  teamSchema,
  portfolioGridSchema,
  productGridSchema,
  pricingSchema,
  pricingPlanSchema,
  testimonialsSchema,
  comparisonTableSchema,
  faqSchema,
  blogGridSchema,
  contactSchema,
  formSectionSchema,
  newsletterSchema,
  ctaSchema,
  navLinksSchema,
  richTextBlockSchema,
};
