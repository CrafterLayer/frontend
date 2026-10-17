import { defineTemplate, footer, header, json, money, photo } from '../../build';
import { heroSection, pricingPlans, type PhotoRef } from '../../sections';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Charity or NGO (`nonprofit` / `nonprofit-ar`).

  a Ramadan-appeal bar → header with "Donate" → split hero over volunteers
  packing food → the year's impact on a dark band → four programmes (2 × 2) →
  where the money goes, in three steps → three ways to give in dinars (one
  monthly sponsorship, featured) → six photos from the field (editorial) →
  donors', volunteers' and families' words (2 × 2) → FAQ with Zakat and
  receipts (2 × 3) → a volunteering banner → footer.

  «مؤسسة غراس الخيرية»: Amman, Jordan.
*/

const HERO_PHOTO: PhotoRef = ['nonprofit', 0];
const VOLUNTEER_PHOTO: PhotoRef = ['nonprofit', 7];
/** Field photos in TEMPLATE_PHOTOS.nonprofit; the 1st and 4th are featured. */
const STORY_PHOTOS = [1, 2, 3, 4, 5, 6] as const;
/** Gift amounts in Jordanian dinars, per way to give. */
const GIFT_AMOUNTS = [20, 35, 50] as const;
const GIFT_PERIODS = ['once', 'month', 'once'] as const;
const GIFT_KEYS = ['basket', 'student', 'olives'] as const;
/** The monthly sponsorship is the gift the eye should land on. */
const FEATURED_GIFT = 1;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const nonprofitTemplate = defineTemplate({
  key: 'nonprofit',
  category: 'nonprofit',
  baseId: 'nonprofit',
  name: { en: 'Charity or NGO', ar: 'جمعية خيرية' },
  description: {
    en: 'A charity site with an appeal bar, impact figures, programmes, ways to give, field photos, FAQ and a volunteer call.',
    ar: 'موقع جمعية خيرية بشريط حملة وأرقام الأثر والبرامج وطرق التبرع وصور من الميدان والأسئلة الشائعة ودعوة للتطوع.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `nonprofit-${lang}`;
    const volunteerPhoto = photo(VOLUNTEER_PHOTO[0], VOLUNTEER_PHOTO[1], lang);

    page.section('announcement', 'announcementBar', {
      label: copy.announcement.label,
      message: copy.announcement.message,
      linkLabel: copy.announcement.linkLabel,
      href: '#donate',
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

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#donate',
      secondaryHref: '#impact',
      photo: HERO_PHOTO,
      variant: 'split',
      ratio: 'square',
      align: 'start',
      tone: 'light',
    });

    page.section('impact', 'stats', {
      eyebrow: copy.impact.eyebrow,
      heading: copy.impact.heading,
      body: copy.impact.body,
      items: json(copy.impact.items),
      variant: 'minimal',
      columns: '4',
      headerLayout: 'split',
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('work', 'features', {
      eyebrow: copy.work.eyebrow,
      heading: copy.work.heading,
      body: copy.work.body,
      items: json(copy.work.items),
      columns: '2',
      variant: 'bordered',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('how', 'processSteps', {
      eyebrow: copy.how.eyebrow,
      heading: copy.how.heading,
      body: copy.how.body,
      steps: json(copy.how.steps),
      variant: 'cards',
      layout: 'horizontal',
      columns: '3',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    const gifts = pricingPlans(
      page,
      copy.donate.plans.map((plan, index) => {
        const key = GIFT_KEYS[index] ?? `gift-${String(index + 1)}`;
        const featured = index === FEATURED_GIFT;
        return {
          copy: plan,
          spec: {
            key,
            price: money(GIFT_AMOUNTS[index] ?? 0, 'JOD', lang),
            period: GIFT_PERIODS[index] ?? 'once',
            href: `#give-${key}`,
            featured,
            ...(featured ? { badge: copy.donate.badge } : {}),
          },
        };
      }),
    );
    page.section(
      'donate',
      'pricing',
      {
        eyebrow: copy.donate.eyebrow,
        heading: copy.donate.heading,
        body: copy.donate.body,
        columns: 'auto',
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { default: gifts },
    );

    page.section('stories', 'gallery', {
      eyebrow: copy.stories.eyebrow,
      heading: copy.stories.heading,
      body: copy.stories.body,
      items: json(
        STORY_PHOTOS.map((photoIndex, index) => {
          const image = photo('nonprofit', photoIndex, lang);
          return {
            src: image.src,
            alt: image.alt,
            caption: copy.stories.captions[index],
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
      linkLabel: copy.stories.linkLabel,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items),
      variant: 'cards',
      columns: '2',
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

    page.section('volunteer', 'promoBanner', {
      label: copy.volunteer.label,
      headline: copy.volunteer.headline,
      body: copy.volunteer.body,
      actions: [
        { label: copy.volunteer.primary, href: '/volunteer', emphasis: 'primary' },
        { label: copy.volunteer.secondary, href: '#donate', emphasis: 'secondary' },
      ],
      imageSrc: volunteerPhoto.src,
      imageAlt: volunteerPhoto.alt,
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
