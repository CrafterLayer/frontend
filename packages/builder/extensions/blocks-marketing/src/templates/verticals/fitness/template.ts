import { defineTemplate, footer, header, json, money, photo } from '../../build';
import { heroSection, membersWithPortraits, pricingPlans, type PhotoRef } from '../../sections';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Fitness studio (`fitness` / `fitness-ar`): small-group strength classes and
  personal training.

  header → split hero on a dark ground (the studio's voice) → four figures on
  a light band → four programmes as a bento (featured, tall, small, wide) →
  the first week in three steps → four coaches with portraits → three
  membership plans in riyals, the middle one featured → members' words
  (2 × 2) → FAQ (2 × 3) → a "first week free" banner on an accent panel →
  footer.

  «استوديو عزم للياقة»: Al Rawdah, Jeddah, with women-only and men-only floors.
*/

const HERO_PHOTO: PhotoRef = ['fitness', 0];
const TRIAL_PHOTO: PhotoRef = ['fitness', 2];
const COACH_PHOTOS: readonly PhotoRef[] = [
  ['fitness', 1],
  ['people', 20],
  ['people', 5],
  ['portraits', 4],
];
const COACH_HREFS = ['#coach-faris', '#coach-huda', '#coach-majed', '#coach-lama'];
const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'tall', emphasis: 'accent' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'wide', emphasis: 'neutral' },
] as const;
/** Monthly prices in Saudi riyals, per plan. */
const PLAN_PRICES = [349, 549, 1800] as const;
const PLAN_KEYS = ['flex', 'unlimited', 'personal'] as const;
/** The plan the eye should land on. */
const FEATURED_PLAN = 1;
const PHONE_HREF = 'tel:+966122345600';

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const fitnessTemplate = defineTemplate({
  key: 'fitness',
  category: 'fitness',
  baseId: 'fitness',
  name: { en: 'Fitness studio', ar: 'نادٍ رياضي' },
  description: {
    en: 'A gym and personal training studio with programmes, coaches, membership plans, FAQ and a free-trial offer.',
    ar: 'نادٍ رياضي واستوديو تدريب شخصي بالبرامج والمدرّبين وباقات الاشتراك والأسئلة الشائعة وعرض تجربة مجانية.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `fitness-${lang}`;
    const trialPhoto = photo(TRIAL_PHOTO[0], TRIAL_PHOTO[1], lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#trial',
      secondaryHref: '#membership',
      photo: HERO_PHOTO,
      variant: 'split',
      ratio: 'portrait',
      align: 'start',
      tone: 'dark',
    });

    page.section('numbers', 'stats', {
      eyebrow: copy.numbers.eyebrow,
      heading: copy.numbers.heading,
      body: copy.numbers.body,
      items: json(copy.numbers.items),
      variant: 'cards',
      columns: '4',
      headerLayout: 'split',
      align: 'start',
      tone: 'light',
      spacing: 'md',
      width: 'wide',
    });

    page.section('programmes', 'bento-grid', {
      eyebrow: copy.programmes.eyebrow,
      heading: copy.programmes.heading,
      body: copy.programmes.body,
      layout: 'mosaic',
      items: json(copy.programmes.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] }))),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('start', 'processSteps', {
      eyebrow: copy.start.eyebrow,
      heading: copy.start.heading,
      body: copy.start.body,
      steps: json(copy.start.steps),
      variant: 'cards',
      layout: 'horizontal',
      columns: '3',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('coaches', 'team', {
      eyebrow: copy.coaches.eyebrow,
      heading: copy.coaches.heading,
      body: copy.coaches.body,
      profileLabel: copy.coaches.profileLabel,
      members: membersWithPortraits(
        copy.coaches.members,
        COACH_PHOTOS,
        COACH_HREFS,
        '#coaches',
        lang,
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    const plans = pricingPlans(
      page,
      copy.membership.plans.map((plan, index) => {
        const key = PLAN_KEYS[index] ?? `plan-${String(index + 1)}`;
        const featured = index === FEATURED_PLAN;
        return {
          copy: plan,
          spec: {
            key,
            price: money(PLAN_PRICES[index] ?? 0, 'SAR', lang),
            period: 'month',
            href: `#join-${key}`,
            featured,
            ...(featured ? { badge: copy.membership.badge } : {}),
          },
        };
      }),
    );
    page.section(
      'membership',
      'pricing',
      {
        eyebrow: copy.membership.eyebrow,
        heading: copy.membership.heading,
        body: copy.membership.body,
        columns: 'auto',
        align: 'center',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { default: plans },
    );

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

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'divided',
      openFirst: true,
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('trial', 'promoBanner', {
      label: copy.trial.label,
      headline: copy.trial.headline,
      body: copy.trial.body,
      actions: [
        { label: copy.trial.primary, href: '/trial', emphasis: 'primary' },
        { label: copy.trial.secondary, href: PHONE_HREF, emphasis: 'secondary' },
      ],
      imageSrc: trialPhoto.src,
      imageAlt: trialPhoto.alt,
      showMedia: true,
      variant: 'media',
      panelStyle: 'accent',
      mediaPosition: 'end',
      mediaAspect: 'square',
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
