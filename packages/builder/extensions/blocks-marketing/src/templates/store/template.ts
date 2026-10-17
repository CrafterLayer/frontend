import { defineTemplate, footer, header, json, money, photo } from '../build';
import type { TemplateLang } from '../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Store (`commerce-launch` / `commerce-launch-ar`) — DESIGN §B.3.

  A perfume house in Riyadh. announcement → header → split hero with a
  product photo → product grid (6 products, every one photographed, 3 × 2 with
  no featured blank) → features (6 service promises, 3 × 2) → promo banner
  with a DIFFERENT photo from the hero → reviews (2 × 2) → FAQ → newsletter →
  footer. Prices come from `money(…, 'SAR', lang)`: `SAR 380` / `380 ر.س`.

  Grounds: the newsletter closes the page on a dark band, apart from the light
  footer; the promo banner's own inverse panel is the mid-page contrast.
*/

const PRICES = [380, 290, 320, 650, 145, 260] as const;
const ORIGINAL_PRICES: Readonly<Record<number, number>> = { 2: 360 };
const RATINGS = [4.9, 4.7, 4.8, 4.9, 4.8, 4.7] as const;
const REVIEWS = [214, 132, 98, 61, 77, 143] as const;
const PRODUCT_HREFS = [
  '#amber-nights',
  '#saffron-musk',
  '#taif-rose',
  '#pure-oud-oil',
  '#bakhoor-candle',
  '#white-oud',
];

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** store photo index per product (the hero is #0 and the promo #7; neither repeats). */
const PRODUCT_PHOTOS = [1, 2, 3, 4, 5, 6] as const;

export const storeTemplate = defineTemplate({
  key: 'store',
  category: 'store',
  baseId: 'commerce-launch',
  name: { en: 'Perfume store', ar: 'متجر عطور' },
  description: {
    en: 'A fragrance shop with best sellers, delivery promises, gift sets, reviews and help.',
    ar: 'متجر عطور بالأكثر مبيعاً ومزايا التوصيل وأطقم الهدايا وآراء العملاء والمساعدة.',
  },
  thumbnail: { topic: 'store', index: 0 },
  surfaces: ['site', 'store'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `store-${lang}`;
    const heroPhoto = photo('store', 0, lang);
    const promoPhoto = photo('store', 7, lang);

    page.section('announcement', 'announcementBar', {
      label: copy.announcement.label,
      message: copy.announcement.message,
      linkLabel: copy.announcement.linkLabel,
      href: '#gifts',
      showLabel: true,
      showLink: true,
      emphasis: 'accent',
      layout: 'inline',
      density: 'compact',
      align: 'center',
      tone: 'transparent',
      spacing: 'none',
      width: 'wide',
    });

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#shop',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#story',
      emphasis: 'link',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: heroPhoto.src,
      alt: heroPhoto.alt,
      fit: 'cover',
      ratio: 'square',
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

    page.section('products', 'productGrid', {
      eyebrow: copy.products.eyebrow,
      heading: copy.products.heading,
      body: copy.products.body,
      actionLabel: copy.products.actionLabel,
      showRatings: true,
      ratingPrefix: copy.products.ratingPrefix,
      ratingSuffix: copy.products.ratingSuffix,
      reviewCountLabel: copy.products.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.products.items.map((item, index) => {
          const image = photo('store', PRODUCT_PHOTOS[index] ?? -1, lang);
          const original = ORIGINAL_PRICES[index];
          return {
            ...item,
            price: money(PRICES[index] ?? 0, 'SAR', lang),
            ...(original === undefined ? {} : { originalPrice: money(original, 'SAR', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: PRODUCT_HREFS[index] ?? '#shop',
            rating: RATINGS[index],
            reviewCount: REVIEWS[index],
          };
        }),
      ),
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('features', 'features', {
      eyebrow: copy.features.eyebrow,
      heading: copy.features.heading,
      body: copy.features.body,
      items: json(copy.features.items),
      columns: '3',
      variant: 'bordered',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('promo', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#gifts', emphasis: 'primary' },
        { label: copy.promo.secondary, href: '#build-a-set', emphasis: 'secondary' },
      ],
      imageSrc: promoPhoto.src,
      imageAlt: promoPhoto.alt,
      showMedia: true,
      variant: 'split',
      panelStyle: 'inverse',
      mediaPosition: 'end',
      mediaAspect: 'square',
      padding: 'spacious',
      radius: 'xl',
      align: 'start',
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

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'divided',
      tone: 'transparent',
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
      variant: 'card',
      tone: 'dark',
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
