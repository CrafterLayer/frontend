import { defineTemplate, footer, header, json, photo } from '../../build';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Portfolio and CV (`portfolio-cv` / `portfolio-cv-ar`) — agent-script
  DESIGN §B.3.

  header (Work · About · Experience · Contact) → split hero with a portrait,
  the name and the role → about (content split with a work photo) → three
  figures → six projects (fills 2 and 3 columns) → the experience timeline
  (vertical process steps, the years as each step's meta) → six skills →
  testimonials (2 × 2) → contact with a project form → footer.

  The person is fictional: «رنا حداد», a product designer in Amman.

  Grounds: the figures are a dark band under the about section; clear and
  light alternate from there, and the contact stays clear of the light footer.
*/

const PORTRAIT: readonly [string, number] = ['people', 20];
const ABOUT_PHOTO: readonly [string, number] = ['agency', 7];
/** Project photo index in TEMPLATE_PHOTOS.portfolio, per project. */
const WORK_PHOTOS = [0, 1, 2, 3, 4, 5] as const;
const WORK_HREFS = [
  '#work-wallet',
  '#work-design-system',
  '#work-banking',
  '#work-cafe-identity',
  '#work-patient-journey',
  '#work-fleet-console',
] as const;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const portfolioTemplate = defineTemplate({
  key: 'portfolio',
  category: 'portfolio',
  baseId: 'portfolio-cv',
  name: { en: 'Portfolio and CV', ar: 'ملف أعمال وسيرة ذاتية' },
  description: {
    en: 'A personal portfolio with a portrait hero, projects, an experience timeline, skills and a contact form.',
    ar: 'ملف أعمال شخصي بصورة تعريفية ومشاريع وخط زمني للخبرات والمهارات ونموذج تواصل.',
  },
  thumbnail: { topic: PORTRAIT[0], index: PORTRAIT[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `portfolio-${lang}`;
    const portrait = photo(PORTRAIT[0], PORTRAIT[1], lang);
    const aboutPhoto = photo(ABOUT_PHOTO[0], ABOUT_PHOTO[1], lang);

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#work',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#cv',
      emphasis: 'ghost',
      size: 'lg',
    });
    const heroImage = page.add('hero-image', 'image', {
      src: portrait.src,
      alt: portrait.alt,
      fit: 'cover',
      ratio: 'portrait',
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

    page.section('about', 'content-section', {
      eyebrow: copy.about.eyebrow,
      heading: copy.about.heading,
      body: copy.about.body,
      highlights: json(copy.about.highlights),
      imageSrc: aboutPhoto.src,
      imageAlt: aboutPhoto.alt,
      imageFit: 'cover',
      mediaPosition: 'start',
      link: { label: copy.about.link, href: '#principles' },
      layout: 'split',
      align: 'start',
      tone: 'light',
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
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

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
          const image = photo('portfolio', WORK_PHOTOS[index] ?? -1, lang);
          return {
            ...item,
            imageSrc: image.src,
            imageAlt: image.alt,
            href: WORK_HREFS[index] ?? '#work',
          };
        }),
      ),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('experience', 'processSteps', {
      eyebrow: copy.experience.eyebrow,
      heading: copy.experience.heading,
      body: copy.experience.body,
      steps: json(copy.experience.items),
      variant: 'minimal',
      layout: 'vertical',
      columns: 'auto',
      showNumbers: false,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('skills', 'features', {
      eyebrow: copy.skills.eyebrow,
      heading: copy.skills.heading,
      body: copy.skills.body,
      items: json(copy.skills.items),
      columns: '3',
      variant: 'bordered',
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

    page.section('contact', 'contact', {
      eyebrow: copy.contact.eyebrow,
      heading: copy.contact.heading,
      body: copy.contact.body,
      email: 'hello@example.com',
      phone: '+962 79 555 0186',
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
