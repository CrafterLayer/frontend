import { defineTemplate, footer, header, json, money, photo } from '../../build';
import { heroSection, type PhotoRef } from '../../sections';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Hotel and travel (`hotel-travel` / `hotel-travel-ar`): a beach resort that
  also sells days out to Petra and Wadi Rum.

  header → editorial hero (serif copy, the sea-view pool below it) → six
  rooms and villas priced per night in dinars, with guest ratings (fills 2
  and 3 columns) → six amenities → experiences as an editorial gallery on a
  dark band → dining with its photo and three restaurants → guest reviews
  (2 × 2) → location with arrival times, reservations and WhatsApp → FAQ
  (2 × 3) → a book-direct offer → footer.

  «منتجع خليج المرجان»: Tala Bay, Aqaba, Jordan.
*/

const HERO_PHOTO: PhotoRef = ['hotel', 0];
/** One photo per room, in room order. */
const ROOM_PHOTOS: readonly PhotoRef[] = [
  ['realestate', 9],
  ['realestate', 7],
  ['realestate', 10],
  ['realestate', 12],
  ['realestate', 4],
  ['realestate', 1],
];
/** Nightly rates in Jordanian dinars; the spa suite shows its usual rate too. */
const ROOM_RATES = [95, 140, 175, 210, 260, 420] as const;
const USUAL_RATES: readonly (number | undefined)[] = [
  undefined,
  undefined,
  195,
  undefined,
  undefined,
  undefined,
];
const ROOM_RATINGS = [4.7, 4.9, 4.8, 4.8, 4.9, 5] as const;
const ROOM_REVIEWS = [312, 486, 158, 207, 94, 61] as const;
const ROOM_HREFS = [
  '#room-garden',
  '#room-junior-suite',
  '#room-spa-suite',
  '#room-family-suite',
  '#room-pool-suite',
  '#room-pool-villa',
] as const;
/** Experience photos, in caption order; the 1st and 4th are featured. */
const EXPERIENCE_PHOTOS: readonly PhotoRef[] = [
  ['hotel', 2],
  ['hotel', 3],
  ['hotel', 4],
  ['hotel', 1],
  ['hotel', 5],
  ['restaurant', 16],
];
const DINING_PHOTO: PhotoRef = ['restaurant', 13];
const OFFER_PHOTO: PhotoRef = ['realestate', 5];
const PHONE = '+962 3 209 4400';
const PHONE_HREF = 'tel:+96232094400';

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const hotelTemplate = defineTemplate({
  key: 'hotel',
  category: 'hospitality',
  baseId: 'hotel-travel',
  name: { en: 'Hotel and travel', ar: 'فندق وسياحة' },
  description: {
    en: 'A beach resort with rooms and nightly rates, amenities, day trips, dining, guest reviews, location and a booking offer.',
    ar: 'منتجع شاطئي بالغرف وأسعار الليلة والمرافق والرحلات والمطاعم وآراء النزلاء والموقع وعرض للحجز المباشر.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `hotel-${lang}`;
    const diningPhoto = photo(DINING_PHOTO[0], DINING_PHOTO[1], lang);
    const offerPhoto = photo(OFFER_PHOTO[0], OFFER_PHOTO[1], lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#book',
      secondaryHref: '#rooms',
      photo: HERO_PHOTO,
      variant: 'editorial',
      ratio: 'wide',
      align: 'start',
      tone: 'transparent',
    });

    page.section('rooms', 'productGrid', {
      eyebrow: copy.rooms.eyebrow,
      heading: copy.rooms.heading,
      body: copy.rooms.body,
      actionLabel: copy.rooms.actionLabel,
      showRatings: true,
      ratingPrefix: copy.rooms.ratingPrefix,
      ratingSuffix: copy.rooms.ratingSuffix,
      reviewCountLabel: copy.rooms.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.rooms.items.map((room, index) => {
          const [topic, photoIndex] = ROOM_PHOTOS[index] ?? ['realestate', -1];
          const image = photo(topic, photoIndex, lang);
          const usual = USUAL_RATES[index];
          return {
            ...room,
            price: money(ROOM_RATES[index] ?? 0, 'JOD', lang),
            ...(usual === undefined ? {} : { originalPrice: money(usual, 'JOD', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: ROOM_HREFS[index] ?? '#rooms',
            rating: ROOM_RATINGS[index],
            reviewCount: ROOM_REVIEWS[index],
          };
        }),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('amenities', 'features', {
      eyebrow: copy.amenities.eyebrow,
      heading: copy.amenities.heading,
      body: copy.amenities.body,
      items: json(copy.amenities.items),
      columns: '3',
      variant: 'bordered',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('experiences', 'gallery', {
      eyebrow: copy.experiences.eyebrow,
      heading: copy.experiences.heading,
      body: copy.experiences.body,
      items: json(
        EXPERIENCE_PHOTOS.map(([topic, photoIndex], index) => {
          const image = photo(topic, photoIndex, lang);
          return {
            src: image.src,
            alt: image.alt,
            caption: copy.experiences.captions[index],
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
      linkLabel: copy.experiences.linkLabel,
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('dining', 'content-section', {
      eyebrow: copy.dining.eyebrow,
      heading: copy.dining.heading,
      body: copy.dining.body,
      highlights: json(copy.dining.highlights),
      imageSrc: diningPhoto.src,
      imageAlt: diningPhoto.alt,
      imageFit: 'cover',
      mediaPosition: 'end',
      link: { label: copy.dining.link, href: '#menus' },
      layout: 'split',
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

    const where = copy.location;
    page.section('location', 'location', {
      eyebrow: where.eyebrow,
      heading: where.heading,
      body: where.body,
      address: where.address,
      addressLabel: where.addressLabel,
      mapsLabel: where.mapsLabel,
      latitude: 29.4216,
      longitude: 34.981,
      embedMap: false,
      mapTitle: where.mapTitle,
      hoursLabel: where.hoursLabel,
      hours: json(where.hours),
      hoursNote: where.hoursNote,
      contactLabel: where.contactLabel,
      phone: PHONE,
      phoneLabel: where.phoneLabel,
      email: 'stay@example.com',
      emailLabel: where.emailLabel,
      whatsapp: '+962 79 555 0144',
      whatsappLabel: where.whatsappLabel,
      whatsappMessage: where.whatsappMessage,
      layout: 'split',
      align: 'start',
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
      openFirst: true,
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('book', 'promoBanner', {
      label: copy.book.label,
      headline: copy.book.headline,
      body: copy.book.body,
      actions: [
        { label: copy.book.primary, href: '/book', emphasis: 'primary' },
        { label: copy.book.secondary, href: PHONE_HREF, emphasis: 'secondary' },
      ],
      imageSrc: offerPhoto.src,
      imageAlt: offerPhoto.alt,
      showMedia: true,
      variant: 'media',
      panelStyle: 'inverse',
      mediaPosition: 'end',
      mediaAspect: 'wide',
      padding: 'spacious',
      radius: 'xl',
      align: 'start',
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
