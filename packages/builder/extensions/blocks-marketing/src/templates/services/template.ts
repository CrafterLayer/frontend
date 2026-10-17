import { defineTemplate, footer, header, json, photo } from '../build';
import type { TemplateLang } from '../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Professional services (`professional-services` / `professional-services-ar`)
  — DESIGN §B.3. A corporate law and advisory firm in Amman and Riyadh.

  header → split hero with a business photo (light tone: no offset dark band)
  → logo cloud → split content with a photo → process (4 steps) → stats with
  their own body → team (4 portraits) → testimonials (2 × 2 wall) → FAQ →
  consultation form → footer.

  Grounds: the logo band shares the hero's light ground and the stats sit on
  the page's dark band; clear and light sections alternate around them.
*/

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

/** people photo index per team member (the last is the catalog's portrait in hijab). */
const TEAM_PHOTOS = [1, 2, 3, 20] as const;
const TOPIC_VALUES = ['formation', 'contracts', 'disputes', 'investment', 'employment'] as const;

export const servicesTemplate = defineTemplate({
  key: 'services',
  category: 'services',
  baseId: 'professional-services',
  name: { en: 'Professional services', ar: 'خدمات مهنية' },
  description: {
    en: 'A law and advisory firm site with services, approach, partners and a consultation form.',
    ar: 'موقع مكتب محاماة واستشارات بالخدمات والمنهجية والشركاء ونموذج لحجز استشارة.',
  },
  thumbnail: { topic: 'services', index: 0 },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `services-${lang}`;
    const heroPhoto = photo('services', 0, lang);
    const contentPhoto = photo('services', 1, lang);
    const fields = copy.form.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#contact',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: '#services',
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

    page.section('content', 'content-section', {
      eyebrow: copy.content.eyebrow,
      heading: copy.content.heading,
      body: copy.content.body,
      highlights: json(copy.content.highlights),
      imageSrc: contentPhoto.src,
      imageAlt: contentPhoto.alt,
      mediaPosition: 'start',
      link: { label: copy.content.link, href: '#services' },
      layout: 'split',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('process', 'processSteps', {
      eyebrow: copy.process.eyebrow,
      heading: copy.process.heading,
      body: copy.process.body,
      steps: json(copy.process.steps),
      variant: 'minimal',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
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
      columns: '4',
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

    page.section('contact', 'formSection', {
      eyebrow: copy.form.eyebrow,
      heading: copy.form.heading,
      body: copy.form.body,
      fields: [
        {
          id: 'name',
          name: 'name',
          type: 'text',
          label: fields.name,
          autoComplete: 'name',
          required: true,
          width: 'half',
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: fields.email,
          autoComplete: 'email',
          required: true,
          width: 'half',
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: fields.phone,
          autoComplete: 'tel',
          required: false,
          width: 'half',
        },
        {
          id: 'topic',
          name: 'topic',
          type: 'select',
          label: fields.topic,
          required: true,
          width: 'half',
          options: fields.topics.map((label, index) => ({
            label,
            value: TOPIC_VALUES[index] ?? `topic-${String(index + 1)}`,
          })),
        },
        {
          id: 'message',
          name: 'message',
          type: 'textarea',
          label: fields.message,
          required: true,
          width: 'full',
          rows: 5,
        },
        {
          id: 'consent',
          name: 'consent',
          type: 'checkbox',
          label: fields.consent,
          required: true,
          width: 'full',
        },
      ],
      submitLabel: copy.form.submitLabel,
      footerNote: copy.form.footerNote,
      successHint: copy.form.successHint,
      action: '/contact',
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
