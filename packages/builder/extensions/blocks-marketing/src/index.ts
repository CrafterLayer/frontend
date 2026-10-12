// @craftkit/builder-blocks-marketing — the first real content extension (layer 4).
// A production marketing vocabulary: layout primitives, page chrome, and
// complete responsive sections for the major landing-page jobs.

import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Cta, ctaSchema } from './components/Cta';
import { AnnouncementBar, announcementBarSchema } from './components/AnnouncementBar';
import { BentoGrid, bentoGridSchema } from './components/BentoGrid';
import { BlogGrid, blogGridSchema } from './components/BlogGrid';
import { Carousel, carouselSchema } from './components/Carousel';
import { Chart, chartSchema } from './components/Chart';
import { ComparisonTable, comparisonTableSchema } from './components/ComparisonTable';
import { Contact, contactSchema } from './components/Contact';
import { Countdown, countdownSchema } from './components/Countdown';
import { ContentSection, contentSectionSchema } from './components/ContentSection';
import { Faq, faqSchema } from './components/Faq';
import { Features, featuresSchema } from './components/Features';
import { FormSection, formSectionSchema } from './components/FormSection';
import { Gallery, gallerySchema } from './components/Gallery';
import { Grid, gridSchema } from './components/Grid';
import { Image, imageSchema } from './components/Image';
import { Location, locationSchema } from './components/Location';
import { MenuSection, menuSectionSchema } from './components/MenuSection';
import { NavLinks, navLinksSchema } from './components/NavLinks';
import { Newsletter, newsletterSchema } from './components/Newsletter';
import { PageFooter, pageFooterSchema } from './components/PageFooter';
import { PageHeader, pageHeaderSchema } from './components/PageHeader';
import { Stack, stackSchema } from './components/Stack';
import { Hero, heroSchema } from './components/Hero';
import { Pricing, pricingSchema } from './components/Pricing';
import { PricingPlan, pricingPlanSchema } from './components/PricingPlan';
import { ProductGrid, productGridSchema } from './components/ProductGrid';
import { ProcessSteps, processStepsSchema } from './components/ProcessSteps';
import { PromoBanner, promoBannerSchema } from './components/PromoBanner';
import { Report, reportSchema } from './components/Report';
import { PortfolioGrid, portfolioGridSchema } from './components/PortfolioGrid';
import { RichTextBlock, richTextBlockSchema } from './components/RichTextBlock';
import { Testimonials, testimonialsSchema } from './components/Testimonials';
import { LogoCloud, logoCloudSchema } from './components/LogoCloud';
import { Stats, statsSchema } from './components/Stats';
import { Table, tableSchema } from './components/Table';
import { Team, teamSchema } from './components/Team';
import { Timeline, timelineSchema } from './components/Timeline';
import { VideoSection, videoSectionSchema } from './components/VideoSection';

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
      { schema: promoBannerSchema, render: PromoBanner },
      { schema: heroSchema, render: Hero },
      { schema: carouselSchema, render: Carousel },
      { schema: videoSectionSchema, render: VideoSection },
      { schema: gallerySchema, render: Gallery },
      { schema: logoCloudSchema, render: LogoCloud },
      { schema: featuresSchema, render: Features },
      { schema: bentoGridSchema, render: BentoGrid },
      { schema: contentSectionSchema, render: ContentSection },
      { schema: statsSchema, render: Stats },
      { schema: processStepsSchema, render: ProcessSteps },
      { schema: teamSchema, render: Team },
      { schema: portfolioGridSchema, render: PortfolioGrid },
      { schema: productGridSchema, render: ProductGrid },
      { schema: pricingSchema, render: Pricing },
      // The card that goes inside it. Composed, so a plan can hold a button.
      { schema: pricingPlanSchema, render: PricingPlan },
      { schema: testimonialsSchema, render: Testimonials },
      { schema: comparisonTableSchema, render: ComparisonTable },
      // Data: a rows-and-columns table and an SVG chart, both script-free when published.
      { schema: tableSchema, render: Table },
      { schema: chartSchema, render: Chart },
      // One dataset as a report: KPI cards, a chart and the table (2026-10-12).
      { schema: reportSchema, render: Report },
      // Local business and events: milestones, a menu or price list, where to find it, and a countdown.
      { schema: timelineSchema, render: Timeline },
      { schema: menuSectionSchema, render: MenuSection },
      { schema: locationSchema, render: Location },
      { schema: countdownSchema, render: Countdown },
      { schema: faqSchema, render: Faq },
      { schema: blogGridSchema, render: BlogGrid },
      { schema: contactSchema, render: Contact },
      { schema: formSectionSchema, render: FormSection },
      { schema: newsletterSchema, render: Newsletter },
      { schema: ctaSchema, render: Cta },
      // A row of links: the composition primitive a header or footer slot holds.
      { schema: navLinksSchema, render: NavLinks },
      { schema: richTextBlockSchema, render: RichTextBlock },
    ],
  },
};

export { marketingTemplates } from './templates';
// templates-core additions
// The Library's template cards (one per en/ar composition) and their shape.
export {
  marketingTemplateCatalog,
  TEMPLATE_PHOTOS,
  type MarketingTemplateCard,
  type TemplateCategory,
  type TemplateLang,
} from './templates';
// end templates-core additions

export { Cta, ctaSchema, type CtaProps } from './components/Cta';
export {
  AnnouncementBar,
  announcementBarSchema,
  type AnnouncementBarProps,
} from './components/AnnouncementBar';
export { BentoGrid, bentoGridSchema, type BentoGridProps } from './components/BentoGrid';
export { BlogGrid, blogGridSchema, type BlogGridProps } from './components/BlogGrid';
export { Carousel, carouselSchema, type CarouselProps } from './components/Carousel';
export { Chart, chartSchema, type ChartProps } from './components/Chart';
export {
  ComparisonTable,
  comparisonTableSchema,
  type ComparisonTableProps,
} from './components/ComparisonTable';
export { Contact, contactSchema, type ContactProps } from './components/Contact';
export { Countdown, countdownSchema, type CountdownProps } from './components/Countdown';
export {
  ContentSection,
  contentSectionSchema,
  type ContentSectionProps,
} from './components/ContentSection';
export { Faq, faqSchema, type FaqProps } from './components/Faq';
export { Features, featuresSchema, type FeaturesProps } from './components/Features';
export { FormSection, formSectionSchema, type FormSectionProps } from './components/FormSection';
export { Gallery, gallerySchema, type GalleryProps } from './components/Gallery';
export { Hero, heroSchema, type HeroProps } from './components/Hero';
export { Location, locationSchema, type LocationProps } from './components/Location';
export { MenuSection, menuSectionSchema, type MenuSectionProps } from './components/MenuSection';
export { Pricing, pricingSchema, type PricingProps } from './components/Pricing';
export {
  PortfolioGrid,
  portfolioGridSchema,
  type PortfolioGridProps,
} from './components/PortfolioGrid';
export { ProductGrid, productGridSchema, type ProductGridProps } from './components/ProductGrid';
export { PromoBanner, promoBannerSchema, type PromoBannerProps } from './components/PromoBanner';
export { Report, reportSchema, type ReportProps } from './components/Report';
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
export { Table, tableSchema, type TableProps } from './components/Table';
export { Team, teamSchema, type TeamProps } from './components/Team';
export { Timeline, timelineSchema, type TimelineProps } from './components/Timeline';
export {
  VideoSection,
  videoSectionSchema,
  type VideoSectionProps,
} from './components/VideoSection';
