import { defineTemplate, footer, header, json, money, photo } from '../../build';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Real estate (`real-estate` / `real-estate-ar`) — agent-script DESIGN §B.3.

  header → centred hero over the Dubai skyline with "Browse listings" →
  six listings as a product grid (price via money(…, 'AED'); type, beds,
  baths and area in the description; fills 2 and 3 columns) → why us (2 × 2)
  → four figures → six interiors (fills 2 and 3 columns) → four agents with
  portraits → client reviews (2 × 2) → contact with a call-back form → footer.

  «منزل للعقارات»: a brokerage in Downtown Dubai.

  Grounds: two dark bands, the figures and the closing contact; clear and
  light alternate between them.
*/

const HERO_PHOTO = 0;
/** Listing photo index in TEMPLATE_PHOTOS.realestate, per listing. */
const LISTING_PHOTOS = [1, 2, 3, 4, 5, 6] as const;
/** Asking prices in UAE dirhams, per listing. */
const LISTING_PRICES = [7_450_000, 3_100_000, 3_950_000, 6_800_000, 12_500_000, 1_350_000] as const;
/** The price before a reduction, where there was one. */
const ORIGINAL_PRICES: readonly (number | undefined)[] = [
  undefined,
  undefined,
  4_200_000,
  undefined,
  undefined,
  undefined,
];
const LISTING_HREFS = [
  '#listing-dubai-hills-villa',
  '#listing-downtown-apartment',
  '#listing-ranches-townhouse',
  '#listing-marina-penthouse',
  '#listing-jumeirah-villa',
  '#listing-business-bay-apartment',
] as const;
const GALLERY_PHOTOS = [7, 8, 9, 10, 11, 12] as const;
/** Agent portraits, in member order: [topic, index]. */
const AGENT_PHOTOS: readonly (readonly [string, number])[] = [
  ['portraits', 0],
  ['portraits', 1],
  ['people', 0],
  ['people', 1],
];
const AGENT_HREFS = ['#agent-yousef', '#agent-hala', '#agent-mariam', '#agent-karim'];

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const realEstateTemplate = defineTemplate({
  key: 'realestate',
  category: 'realestate',
  baseId: 'real-estate',
  name: { en: 'Real estate', ar: 'عقارات' },
  description: {
    en: 'A property site with verified listings, reasons to choose you, interiors, advisers and a viewing request form.',
    ar: 'موقع عقاري بعقارات موثّقة وأسباب لاختيارك وصور من الداخل والمستشارين ونموذج طلب معاينة.',
  },
  thumbnail: { topic: 'realestate', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `realestate-${lang}`;
    const heroPhoto = photo('realestate', HERO_PHOTO, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#listings',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#contact',
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
        variant: 'centered',
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('listings', 'productGrid', {
      eyebrow: copy.listings.eyebrow,
      heading: copy.listings.heading,
      body: copy.listings.body,
      actionLabel: copy.listings.actionLabel,
      showRatings: false,
      ratingPrefix: copy.listings.ratingPrefix,
      ratingSuffix: copy.listings.ratingSuffix,
      reviewCountLabel: copy.listings.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.listings.items.map((item, index) => {
          const image = photo('realestate', LISTING_PHOTOS[index] ?? -1, lang);
          const original = ORIGINAL_PRICES[index];
          return {
            ...item,
            price: money(LISTING_PRICES[index] ?? 0, 'AED', lang),
            ...(original === undefined ? {} : { originalPrice: money(original, 'AED', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: LISTING_HREFS[index] ?? '#listings',
          };
        }),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('why', 'features', {
      eyebrow: copy.why.eyebrow,
      heading: copy.why.heading,
      body: copy.why.body,
      items: json(copy.why.items),
      columns: '2',
      variant: 'bordered',
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
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('realestate', photoIndex, lang);
          return { src: image.src, alt: image.alt, caption: copy.gallery.captions[index] };
        }),
      ),
      layout: 'grid',
      columns: '3',
      aspect: 'landscape',
      imageFit: 'cover',
      showCaptions: true,
      captionStyle: 'below',
      linkImages: false,
      linkLabel: copy.gallery.linkLabel,
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('agents', 'team', {
      eyebrow: copy.agents.eyebrow,
      heading: copy.agents.heading,
      body: copy.agents.body,
      profileLabel: copy.agents.profileLabel,
      members: json(
        copy.agents.members.map((member, index) => {
          const [topic, photoIndex] = AGENT_PHOTOS[index] ?? ['portraits', -1];
          const portrait = photo(topic, photoIndex, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: AGENT_HREFS[index] ?? '#agents',
          };
        }),
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'cards',
      columns: '2',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'homes@example.com',
      phone: '+971 4 555 0177',
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/viewings',
      method: 'post',
      variant: 'split',
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
