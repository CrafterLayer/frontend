import { defineTemplate, footer, header, json, photo } from '../build';
import type { TemplateLang } from '../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Creative agency (`creative-agency` / `creative-agency-ar`) — DESIGN §B.3.

  header → split hero with a studio photo → portfolio (6 case studies, 3 × 2,
  every one photographed, none repeated) → process (4 steps; the badge is the
  only number, the label is a duration) → stats with their own body → team
  (4 portraits) → testimonials (2 × 2 wall) → journal (featured layout: one
  wide post over two, so no cell is left empty) → contact → footer.

  Grounds: clear and light alternate, with two dark bands — the stats (big
  numbers, minimal) and the closing contact, which stays apart from the footer.
*/

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** agency photo index per case study, in COPY order. */
const WORK_PHOTOS = [3, 1, 2, 4, 5, 6] as const;
/** agency photo index per journal post. */
const POST_PHOTOS = [7, 8, 9] as const;
/** people photo index per team member. */
const TEAM_PHOTOS = [0, 7, 8, 15] as const;
const WORK_HREFS = ['#qamar-pay', '#darat-arts', '#ufuq', '#wasel', '#madrasati', '#sahab-cloud'];

export const agencyTemplate = defineTemplate({
  key: 'agency',
  category: 'agency',
  baseId: 'creative-agency',
  name: { en: 'Creative agency', ar: 'وكالة إبداعية' },
  description: {
    en: 'A studio site with case studies, process, team portraits, a journal and a project form.',
    ar: 'موقع استوديو بدراسات حالة ومنهجية عمل وصور الفريق ومدوّنة ونموذج لطلب مشروع.',
  },
  thumbnail: { topic: 'agency', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `agency-${lang}`;
    const heroPhoto = photo('agency', 0, lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#work',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#process',
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
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('work', 'portfolioGrid', {
      eyebrow: copy.work.eyebrow,
      heading: copy.work.heading,
      body: copy.work.body,
      actionLabel: copy.work.actionLabel,
      showMetrics: true,
      variant: 'grid',
      columns: '3',
      items: json(
        copy.work.items.map((item, index) => {
          const image = photo('agency', WORK_PHOTOS[index] ?? -1, lang);
          return {
            ...item,
            imageSrc: image.src,
            imageAlt: image.alt,
            href: WORK_HREFS[index] ?? '#work',
          };
        }),
      ),
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('process', 'processSteps', {
      eyebrow: copy.process.eyebrow,
      heading: copy.process.heading,
      body: copy.process.body,
      steps: json(copy.process.steps),
      variant: 'cards',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
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
      columns: '3',
      headerLayout: 'split',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('team', 'team', {
      eyebrow: copy.team.eyebrow,
      heading: copy.team.heading,
      body: copy.team.body,
      profileLabel: copy.team.profileLabel,
      members: json(
        copy.team.members.map((member, index) => {
          const portrait = photo('people', TEAM_PHOTOS[index] ?? -1, lang);
          return { ...member, imageSrc: portrait.src, imageAlt: portrait.alt };
        }),
      ),
      variant: 'cards',
      columns: '4',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items.map((item) => ({ ...item, rating: 5 }))),
      variant: 'wall',
      columns: '2',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('journal', 'blogGrid', {
      eyebrow: copy.journal.eyebrow,
      heading: copy.journal.heading,
      body: copy.journal.body,
      actionLabel: copy.journal.actionLabel,
      showImages: true,
      variant: 'featured',
      columns: '2',
      posts: json(
        copy.journal.posts.map((post, index) => {
          const image = photo('agency', POST_PHOTOS[index] ?? -1, lang);
          return {
            ...post,
            href: `#journal-${String(index + 1)}`,
            imageSrc: image.src,
            imageAlt: image.alt,
            featured: index === 0,
          };
        }),
      ),
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'hello@example.com',
      phone: '+962 6 555 0142',
      address: copy.contact.address,
      availability: copy.contact.availability,
      showForm: true,
      formTitle: copy.contact.formTitle,
      formBody: copy.contact.formBody,
      nameLabel: copy.contact.nameLabel,
      emailLabel: copy.contact.emailLabel,
      messageLabel: copy.contact.messageLabel,
      submitLabel: copy.contact.submitLabel,
      formAction: '/contact',
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
