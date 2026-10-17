import { defineTemplate, footer, header, json, photo } from '../build';
import type { TemplateLang } from '../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  SaaS launch (`saas-launch` / `saas-launch-ar`) — DESIGN §B.3.

  header → split hero with a product shot → logo cloud → bento (featured,
  tall, small, wide: fills the 12- and 6-column mosaics with no blank cell)
  → stats with their own body → split content with a photo → testimonials
  (2 × 2) → pricing as a comparison table (three plans, an action on every
  plan, no repeated label) → FAQ → newsletter → footer.

  Pricing uses `comparisonTable` rather than `pricing`/`pricingPlan`: those two
  render fixed English words ("Plans", "per month", "Popular") that an Arabic
  page cannot change. The comparison table carries every label as copy.

  Grounds: the logo band shares the hero's light ground, the stats are the
  page's dark band, and clear and light sections alternate around them.
*/

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'tall', emphasis: 'accent' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'wide', emphasis: 'neutral' },
] as const;

export const saasTemplate = defineTemplate({
  key: 'saas',
  category: 'saas',
  baseId: 'saas-launch',
  name: { en: 'SaaS launch', ar: 'إطلاق منتج رقمي' },
  description: {
    en: 'A software launch page with a product shot, features, results, pricing plans and FAQ.',
    ar: 'صفحة إطلاق لمنتج برمجي مع صورة المنتج والمزايا والنتائج وباقات الأسعار والأسئلة الشائعة.',
  },
  thumbnail: { topic: 'saas', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `saas-${lang}`;
    const heroPhoto = photo('saas', 0, lang);
    const contentPhoto = photo('saas', 2, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#signup',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#demo',
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'wide',
      radius: 'md',
      width: 'full',
      align: 'center',
    });
    page.section(
      'hero',
      'hero',
      {
        variant: 'split',
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('logos', 'logoCloud', {
      eyebrow: copy.logos.eyebrow,
      heading: copy.logos.heading,
      items: json(copy.logos.items),
      variant: 'minimal',
      columns: '6',
      align: 'center',
      tone: 'light',
      spacing: 'md',
      width: 'wide',
    });

    page.section('bento', 'bento-grid', {
      eyebrow: copy.bento.eyebrow,
      heading: copy.bento.heading,
      body: copy.bento.body,
      layout: 'mosaic',
      items: json(copy.bento.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] }))),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'minimal',
      columns: '4',
      headerLayout: 'split',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('content', 'content-section', {
      eyebrow: copy.content.eyebrow,
      heading: copy.content.heading,
      body: copy.content.body,
      highlights: json(copy.content.highlights),
      imageSrc: contentPhoto.src,
      imageAlt: contentPhoto.alt,
      mediaPosition: 'start',
      link: { label: copy.content.link, href: '#tour' },
      layout: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'cards',
      columns: '2',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('pricing', 'comparisonTable', {
      eyebrow: copy.pricing.eyebrow,
      heading: copy.pricing.heading,
      body: copy.pricing.body,
      featureLabel: copy.pricing.featureLabel,
      scrollLabel: copy.pricing.scrollLabel,
      includedLabel: copy.pricing.includedLabel,
      excludedLabel: copy.pricing.excludedLabel,
      plans: json(copy.pricing.plans),
      rows: json(copy.pricing.rows),
      note: copy.pricing.note,
      emptyValue: '—',
      showActions: true,
      variant: 'boxed',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'cards',
      openFirst: true,
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('newsletter', 'newsletter', {
      eyebrow: copy.newsletter.eyebrow,
      heading: copy.newsletter.heading,
      body: copy.newsletter.body,
      emailLabel: copy.newsletter.emailLabel,
      placeholder: copy.newsletter.placeholder,
      buttonLabel: copy.newsletter.buttonLabel,
      privacy: copy.newsletter.privacy,
      action: '/subscribe',
      variant: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.place(
      footer(
        { prefix, brand: copy.brand, tagline: copy.footer.tagline, columns: copy.footer.columns },
        lang,
      ),
    );
  },
});
