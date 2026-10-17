import { defineTemplate, footer, header, json, money, photo } from '../../build';
import { heroSection, pricingPlans, type PhotoRef } from '../../sections';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Personal brand (`personal-brand` / `personal-brand-ar`): a leadership coach
  and consultant who sells sessions, programmes and team workshops.

  header → split hero with her portrait → organisations she works with (a
  logo band on the hero's ground) → about, with a speaking photo and four
  credentials → three results on a dark band → three programmes in dirhams,
  the accelerator featured → the method in four steps → client stories
  (2 × 2) → three articles (one featured) → FAQ → a discovery-call contact
  section on a dark ground → footer.

  «سارة المنصوري»: Dubai.
*/

const HERO_PHOTO: PhotoRef = ['people', 20];
const ABOUT_PHOTO: PhotoRef = ['events', 5];
/** One photo per article, in post order; the first is featured. */
const POST_PHOTOS: readonly PhotoRef[] = [
  ['services', 9],
  ['agency', 10],
  ['saas', 4],
];
const POST_DATES = ['2026-10-02', '2026-09-18', '2026-09-04'] as const;
/** Programme fees in UAE dirhams. */
const PROGRAMME_FEES = [950, 7500, 18000] as const;
const PROGRAMME_KEYS = ['clarity', 'accelerator', 'workshop'] as const;
/** The programme the eye should land on. */
const FEATURED_PROGRAMME = 1;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const personalBrandTemplate = defineTemplate({
  key: 'personal',
  category: 'personal',
  baseId: 'personal-brand',
  name: { en: 'Coach or consultant', ar: 'مدرّب أو مستشار' },
  description: {
    en: 'A personal brand site for a coach or consultant: story, results, programmes, method, articles and a discovery call.',
    ar: 'موقع شخصي لمدرّب أو مستشار: القصة والنتائج والبرامج والمنهجية والمقالات وحجز مكالمة تعارف مجانية.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `personal-${lang}`;
    const aboutPhoto = photo(ABOUT_PHOTO[0], ABOUT_PHOTO[1], lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#contact',
      secondaryHref: '#programmes',
      photo: HERO_PHOTO,
      variant: 'split',
      ratio: 'portrait',
      align: 'start',
      tone: 'light',
    });

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

    page.section('about', 'content-section', {
      eyebrow: copy.about.eyebrow,
      heading: copy.about.heading,
      body: copy.about.body,
      highlights: json(copy.about.highlights),
      imageSrc: aboutPhoto.src,
      imageAlt: aboutPhoto.alt,
      imageFit: 'cover',
      mediaPosition: 'start',
      link: { label: copy.about.link, href: '#insights' },
      layout: 'split',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('results', 'stats', {
      eyebrow: copy.results.eyebrow,
      heading: copy.results.heading,
      body: copy.results.body,
      items: json(copy.results.items),
      variant: 'minimal',
      columns: '3',
      headerLayout: 'split',
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    const programmes = pricingPlans(
      page,
      copy.programmes.plans.map((plan, index) => {
        const key = PROGRAMME_KEYS[index] ?? `programme-${String(index + 1)}`;
        const featured = index === FEATURED_PROGRAMME;
        return {
          copy: plan,
          spec: {
            key,
            price: money(PROGRAMME_FEES[index] ?? 0, 'AED', lang),
            period: 'once',
            href: `#apply-${key}`,
            featured,
            ...(featured ? { badge: copy.programmes.badge } : {}),
          },
        };
      }),
    );
    page.section(
      'programmes',
      'pricing',
      {
        eyebrow: copy.programmes.eyebrow,
        heading: copy.programmes.heading,
        body: copy.programmes.body,
        columns: 'auto',
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { default: programmes },
    );

    page.section('method', 'processSteps', {
      eyebrow: copy.method.eyebrow,
      heading: copy.method.heading,
      body: copy.method.body,
      steps: json(copy.method.steps),
      variant: 'accented',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'wall',
      columns: '2',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('insights', 'blogGrid', {
      eyebrow: copy.insights.eyebrow,
      heading: copy.insights.heading,
      body: copy.insights.body,
      actionLabel: copy.insights.actionLabel,
      showImages: true,
      variant: 'featured',
      columns: '2',
      posts: json(
        copy.insights.posts.map((post, index) => {
          const [topic, photoIndex] = POST_PHOTOS[index] ?? ['saas', -1];
          const image = photo(topic, photoIndex, lang);
          return {
            ...post,
            href: `#insight-${String(index + 1)}`,
            dateTime: POST_DATES[index],
            imageSrc: image.src,
            imageAlt: image.alt,
            featured: index === 0,
          };
        }),
      ),
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'single',
      variant: 'divided',
      openFirst: true,
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'hello@example.com',
      phone: '+971 50 555 0172',
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/discovery-call',
      method: 'post',
      variant: 'split',
      align: 'start',
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
