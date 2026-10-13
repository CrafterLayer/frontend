import { defineTemplate, footer, header, json, money, photo } from '../../build';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Restaurant (`restaurant` / `restaurant-ar`) — agent-script DESIGN §B.3.

  header (Menu · About · Reservations · Visit) → centred hero with a wide
  table photo and "Book a table" → three signatures as a bento (featured +
  two small cards fill the 6- and 12-column mosaics) → the menu as a product
  grid of 12 photographed dishes priced with money(…, 'JOD') (12 fills 2, 3
  and 4 columns) → a 6-photo editorial gallery (featured 1st and 4th, so the
  2-column masonry has no hole) → guest reviews → visit details with a table
  request form → a private-dining banner over a dining-room photo → footer.

  «مطعم بيت الزيتون — عمّان»: a Levantine house on Rainbow Street, Amman.

  Grounds: the reviews sit on a dark band, an evening note between the light
  gallery and the visit details.
*/

/** Dish photo index in TEMPLATE_PHOTOS.restaurant, per menu item. */
const DISH_PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** Menu prices in Jordanian dinars, per menu item. */
const DISH_PRICES = [3, 3, 4, 5, 18, 7, 14, 15, 5, 3, 4, 2] as const;
const DISH_HREFS = [
  '#menu-hummus',
  '#menu-falafel',
  '#menu-sambousek',
  '#menu-salad',
  '#menu-mixed-grill',
  '#menu-shawarma',
  '#menu-salmon',
  '#menu-beef',
  '#menu-rice',
  '#menu-muhallabia',
  '#menu-chocolate-cake',
  '#menu-lemon-mint',
] as const;
/** Gallery photo index; the 1st and 4th are featured (span two columns). */
const GALLERY_PHOTOS = [16, 18, 15, 14, 19, 17] as const;
const HERO_PHOTO = 0;
const PROMO_PHOTO = 13;
const PHONE = '+962 6 464 2210';
const PHONE_HREF = 'tel:+96264642210';

const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'small', emphasis: 'accent' },
] as const;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const restaurantTemplate = defineTemplate({
  key: 'restaurant',
  category: 'restaurant',
  baseId: 'restaurant',
  name: { en: 'Restaurant', ar: 'مطعم' },
  description: {
    en: 'A Levantine restaurant with signature dishes, a priced photo menu, a gallery and table requests.',
    ar: 'مطعم شامي بأطباق مميزة وقائمة طعام مصوّرة بالأسعار ومعرض صور وطلب حجز طاولة.',
  },
  thumbnail: { topic: 'restaurant', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `restaurant-${lang}`;
    const heroPhoto = photo('restaurant', HERO_PHOTO, lang);
    const promoPhoto = photo('restaurant', PROMO_PHOTO, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#reserve',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#menu',
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

    page.section('signatures', 'bento-grid', {
      eyebrow: copy.signatures.eyebrow,
      heading: copy.signatures.heading,
      body: copy.signatures.body,
      layout: 'mosaic',
      items: json(copy.signatures.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] }))),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('menu', 'productGrid', {
      eyebrow: copy.menu.eyebrow,
      heading: copy.menu.heading,
      body: copy.menu.body,
      actionLabel: copy.menu.actionLabel,
      showRatings: false,
      ratingPrefix: copy.menu.ratingPrefix,
      ratingSuffix: copy.menu.ratingSuffix,
      reviewCountLabel: copy.menu.reviewCountLabel,
      variant: 'grid',
      columns: '4',
      imageRatio: 'square',
      products: json(
        copy.menu.dishes.map((dish, index) => {
          const image = photo('restaurant', DISH_PHOTOS[index] ?? -1, lang);
          return {
            ...dish,
            price: money(DISH_PRICES[index] ?? 0, 'JOD', lang),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: DISH_HREFS[index] ?? '#menu',
          };
        }),
      ),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('restaurant', photoIndex, lang);
          return {
            src: image.src,
            alt: image.alt,
            caption: copy.gallery.captions[index],
            featured: index === 0 || index === 3,
          };
        }),
      ),
      layout: 'editorial',
      columns: '2',
      aspect: 'landscape',
      imageFit: 'cover',
      showCaptions: true,
      captionStyle: 'below',
      linkImages: false,
      linkLabel: copy.gallery.linkLabel,
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
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('visit', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'table@example.com',
      phone: PHONE,
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/reservations',
      method: 'post',
      variant: 'split',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('reserve', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#reserve', emphasis: 'primary' },
        { label: copy.promo.secondary, href: PHONE_HREF, emphasis: 'secondary' },
      ],
      imageSrc: promoPhoto.src,
      imageAlt: promoPhoto.alt,
      showMedia: true,
      variant: 'media',
      panelStyle: 'inverse',
      mediaPosition: 'end',
      mediaAspect: 'wide',
      padding: 'spacious',
      radius: 'xl',
      align: 'center',
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
