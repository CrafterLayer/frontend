// @craftkit/builder-blocks-marketing — the first real content extension (layer 4).
// A production marketing vocabulary: layout primitives, page chrome, and
// complete responsive sections for the major landing-page jobs.

import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Cta, ctaSchema } from './components/Cta';
import { AnnouncementBar, announcementBarSchema } from './components/AnnouncementBar';
import { BentoGrid, bentoGridSchema } from './components/BentoGrid';
import { BlogGrid, blogGridSchema } from './components/BlogGrid';
import { ComparisonTable, comparisonTableSchema } from './components/ComparisonTable';
import { Contact, contactSchema } from './components/Contact';
import { ContentSection, contentSectionSchema } from './components/ContentSection';
import { Faq, faqSchema } from './components/Faq';
import { Features, featuresSchema } from './components/Features';
import { Grid, gridSchema } from './components/Grid';
import { Image, imageSchema } from './components/Image';
import { NavLinks, navLinksSchema } from './components/NavLinks';
import { Newsletter, newsletterSchema } from './components/Newsletter';
import { PageFooter, pageFooterSchema } from './components/PageFooter';
import { PageHeader, pageHeaderSchema } from './components/PageHeader';
import { Stack, stackSchema } from './components/Stack';
import { Hero, heroSchema } from './components/Hero';
import { Pricing, pricingSchema } from './components/Pricing';
import { PricingPlan, pricingPlanSchema } from './components/PricingPlan';
import { ProcessSteps, processStepsSchema } from './components/ProcessSteps';
import { RichTextBlock, richTextBlockSchema } from './components/RichTextBlock';
import { Testimonials, testimonialsSchema } from './components/Testimonials';
import { LogoCloud, logoCloudSchema } from './components/LogoCloud';
import { Stats, statsSchema } from './components/Stats';
import { Team, teamSchema } from './components/Team';

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
      { schema: announcementBarSchema, render: AnnouncementBar },
      { schema: heroSchema, render: Hero },
      { schema: logoCloudSchema, render: LogoCloud },
      { schema: featuresSchema, render: Features },
      { schema: bentoGridSchema, render: BentoGrid },
      { schema: contentSectionSchema, render: ContentSection },
      { schema: statsSchema, render: Stats },
      { schema: processStepsSchema, render: ProcessSteps },
      { schema: teamSchema, render: Team },
      { schema: pricingSchema, render: Pricing },
      // The card that goes inside it. Composed, so a plan can hold a button.
      { schema: pricingPlanSchema, render: PricingPlan },
      { schema: testimonialsSchema, render: Testimonials },
      { schema: comparisonTableSchema, render: ComparisonTable },
      { schema: faqSchema, render: Faq },
      { schema: blogGridSchema, render: BlogGrid },
      { schema: contactSchema, render: Contact },
      { schema: newsletterSchema, render: Newsletter },
      { schema: ctaSchema, render: Cta },
      // A row of links: the composition primitive a header or footer slot holds.
      { schema: navLinksSchema, render: NavLinks },
      { schema: richTextBlockSchema, render: RichTextBlock },
    ],
  },
};

export { marketingTemplates } from './templates';

export { Cta, ctaSchema, type CtaProps } from './components/Cta';
export {
  AnnouncementBar,
  announcementBarSchema,
  type AnnouncementBarProps,
} from './components/AnnouncementBar';
export { BentoGrid, bentoGridSchema, type BentoGridProps } from './components/BentoGrid';
export { BlogGrid, blogGridSchema, type BlogGridProps } from './components/BlogGrid';
export {
  ComparisonTable,
  comparisonTableSchema,
  type ComparisonTableProps,
} from './components/ComparisonTable';
export { Contact, contactSchema, type ContactProps } from './components/Contact';
export {
  ContentSection,
  contentSectionSchema,
  type ContentSectionProps,
} from './components/ContentSection';
export { Faq, faqSchema, type FaqProps } from './components/Faq';
export { Features, featuresSchema, type FeaturesProps } from './components/Features';
export { Hero, heroSchema, type HeroProps } from './components/Hero';
export { Pricing, pricingSchema, type PricingProps } from './components/Pricing';
export { LogoCloud, logoCloudSchema, type LogoCloudProps } from './components/LogoCloud';
export { Newsletter, newsletterSchema, type NewsletterProps } from './components/Newsletter';
export { PricingPlan, pricingPlanSchema, type PricingPlanProps } from './components/PricingPlan';
export {
  ProcessSteps,
  processStepsSchema,
  type ProcessStepsProps,
} from './components/ProcessSteps';
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
export { Stats, statsSchema, type StatsProps } from './components/Stats';
export { Team, teamSchema, type TeamProps } from './components/Team';
