import type { JsonValue } from '@craftkit/builder-schema';
import { defineTemplate, footer, header, json, money, photo } from '../../build';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Event or conference (`events` / `events-ar`) — agent-script DESIGN §B.3.

  announcement (date · city) → header → centred hero over the main hall →
  three figures (speakers, sessions, days) → the agenda as process steps
  (Day 1 on the first row of three, Day 2 on the second) → four speakers with
  portraits → three ticket tiers (pricing + pricingPlan nodes, an action in
  every plan, prices via money(…, 'SAR')) → a 6-photo editorial gallery from
  last year → FAQ (2 × 3) → a "Get tickets" banner over the hall → footer.

  «ملتقى الرياض للتصميم», 18–19 November 2026.

  Grounds: the figures are a dark band straight under the hero; clear and
  light sections alternate after it.
*/

const HERO_PHOTO = 0;
const PROMO_PHOTO = 7;
/** Gallery photo index in TEMPLATE_PHOTOS.events; the 1st and 4th are featured. */
const GALLERY_PHOTOS = [1, 2, 3, 4, 5, 6] as const;
/** Speaker portraits in TEMPLATE_PHOTOS.portraits, per speaker. */
const SPEAKER_PHOTOS = [2, 3, 4, 5] as const;
const SPEAKER_HREFS = ['#session-dalia', '#session-majed', '#session-lina', '#session-tariq'];
/** Ticket prices in Saudi riyals, per tier. */
const TICKET_PRICES = [450, 750, 1500] as const;
const TICKET_KEYS = ['day', 'full', 'vip'] as const;
/** The tier the eye should land on. */
const FEATURED_TICKET = 1;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** A bulleted rich-text list: one list item per perk. */
function perkList(perks: readonly string[]): JsonValue {
  return {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: perks.map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
    ],
  };
}

export const eventsTemplate = defineTemplate({
  key: 'events',
  category: 'events',
  baseId: 'events',
  name: { en: 'Event or conference', ar: 'فعالية أو مؤتمر' },
  description: {
    en: 'A two-day conference with a date bar, programme, speakers, ticket tiers, past photos and FAQ.',
    ar: 'مؤتمر ليومين بشريط التاريخ والبرنامج والمتحدثين وفئات التذاكر وصور سابقة والأسئلة الشائعة.',
  },
  thumbnail: { topic: 'events', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `events-${lang}`;
    const heroPhoto = photo('events', HERO_PHOTO, lang);
    const promoPhoto = photo('events', PROMO_PHOTO, lang);

    page.section('announcement', 'announcementBar', {
      label: copy.announcement.label,
      message: copy.announcement.message,
      linkLabel: copy.announcement.linkLabel,
      href: '#tickets',
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
      href: '#tickets',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#programme',
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

    page.section('stats', 'stats', {
      eyebrow: copy.stats.eyebrow,
      heading: copy.stats.heading,
      body: copy.stats.body,
      items: json(copy.stats.items),
      variant: 'minimal',
      columns: '3',
      headerLayout: 'split',
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('programme', 'processSteps', {
      eyebrow: copy.agenda.eyebrow,
      heading: copy.agenda.heading,
      body: copy.agenda.body,
      steps: json(copy.agenda.items),
      variant: 'cards',
      layout: 'horizontal',
      columns: '3',
      showNumbers: false,
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('speakers', 'team', {
      eyebrow: copy.speakers.eyebrow,
      heading: copy.speakers.heading,
      body: copy.speakers.body,
      profileLabel: copy.speakers.profileLabel,
      members: json(
        copy.speakers.members.map((member, index) => {
          const portrait = photo('portraits', SPEAKER_PHOTOS[index] ?? -1, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: SPEAKER_HREFS[index] ?? '#speakers',
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

    const plans = copy.tickets.tiers.map((tier, index) => {
      const key = TICKET_KEYS[index] ?? `tier-${String(index + 1)}`;
      const featured = index === FEATURED_TICKET;
      const perks = page.add(`ticket-${key}-perks`, 'richText', {
        content: perkList(tier.perks),
      });
      const action = page.add(`ticket-${key}-cta`, 'cta', {
        label: tier.action,
        href: `#checkout-${key}`,
        emphasis: featured ? 'primary' : 'secondary',
        size: 'md',
        width: 'full',
      });
      return page.add(
        `ticket-${key}`,
        'pricingPlan',
        {
          name: tier.name,
          price: money(TICKET_PRICES[index] ?? 0, 'SAR', lang),
          period: 'once',
          periodLabel: copy.tickets.periodLabel,
          emphasis: featured ? 'featured' : 'normal',
          ...(featured ? { badge: copy.tickets.badge } : {}),
        },
        { default: [perks, action] },
      );
    });
    page.section(
      'tickets',
      'pricing',
      {
        eyebrow: copy.tickets.eyebrow,
        heading: copy.tickets.heading,
        body: copy.tickets.body,
        columns: 'auto',
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { default: plans },
    );

    page.section('gallery', 'gallery', {
      eyebrow: copy.gallery.eyebrow,
      heading: copy.gallery.heading,
      body: copy.gallery.body,
      items: json(
        GALLERY_PHOTOS.map((photoIndex, index) => {
          const image = photo('events', photoIndex, lang);
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

    page.section('get-tickets', 'promoBanner', {
      label: copy.promo.label,
      headline: copy.promo.headline,
      body: copy.promo.body,
      actions: [
        { label: copy.promo.primary, href: '#tickets', emphasis: 'primary' },
        { label: copy.promo.secondary, href: 'mailto:groups@example.com', emphasis: 'secondary' },
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
