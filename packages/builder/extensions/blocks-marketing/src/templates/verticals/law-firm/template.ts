import { defineTemplate, footer, header, json, photo } from '../../build';
import {
  formFields,
  heroSection,
  membersWithPortraits,
  selectOptions,
  type PhotoRef,
} from '../../sections';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN } from './copy-en';

/*
  Law firm (`law-firm` / `law-firm-ar`): a litigation and dispute-resolution
  practice.

  header → split hero on a dark ground in a serif voice → the firm, with its
  library photo and four commitments → six practice areas (fills 2 and 3
  columns) → four case results as a bento with their figures, under a
  past-results disclaimer → how a case moves, in four steps → the four
  partners, editorial portraits (2 × 2) → clients' words (2 × 2, anonymised,
  as a law firm writes them) → FAQ → the consultation request on a dark
  ground → footer with the disclaimer in its legal line.

  «الهاشمي للمحاماة والاستشارات القانونية»: Dubai and Abu Dhabi.
*/

const HERO_PHOTO: PhotoRef = ['services', 4];
const ABOUT_PHOTO: PhotoRef = ['services', 5];
const PARTNER_PHOTOS: readonly PhotoRef[] = [
  ['people', 1],
  ['people', 20],
  ['people', 3],
  ['people', 0],
];
const PARTNER_HREFS = ['#partner-khalid', '#partner-mariam', '#partner-tarek', '#partner-nadia'];
const BENTO_SHAPE = [
  { size: 'featured', emphasis: 'inverse' },
  { size: 'tall', emphasis: 'accent' },
  { size: 'small', emphasis: 'neutral' },
  { size: 'wide', emphasis: 'neutral' },
] as const;
const MATTER_VALUES = [
  'commercial',
  'arbitration',
  'real-estate',
  'employment',
  'family',
  'criminal',
] as const;
const CONTACT_VALUES = ['phone', 'email', 'whatsapp'] as const;

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const lawFirmTemplate = defineTemplate({
  key: 'lawfirm',
  category: 'legal',
  baseId: 'law-firm',
  name: { en: 'Law firm', ar: 'مكتب محاماة' },
  description: {
    en: 'A litigation law firm with practice areas, case results, partner profiles, FAQ and a confidential consultation form.',
    ar: 'مكتب محاماة وتقاضٍ بمجالات الممارسة ونتائج القضايا وملفات الشركاء والأسئلة الشائعة ونموذج استشارة سرية.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `lawfirm-${lang}`;
    const aboutPhoto = photo(ABOUT_PHOTO[0], ABOUT_PHOTO[1], lang);
    const fields = copy.consultation.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#consultation',
      secondaryHref: '#practice',
      photo: HERO_PHOTO,
      variant: 'split',
      ratio: 'portrait',
      align: 'start',
      tone: 'dark',
      fontFamily: 'serif',
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
      link: { label: copy.about.link, href: '#attorneys' },
      layout: 'split',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('practice', 'features', {
      eyebrow: copy.practice.eyebrow,
      heading: copy.practice.heading,
      body: copy.practice.body,
      items: json(copy.practice.items),
      columns: '3',
      variant: 'cards',
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('results', 'bento-grid', {
      eyebrow: copy.results.eyebrow,
      heading: copy.results.heading,
      body: copy.results.body,
      layout: 'mosaic',
      items: json(copy.results.items.map((item, index) => ({ ...item, ...BENTO_SHAPE[index] }))),
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('approach', 'processSteps', {
      eyebrow: copy.approach.eyebrow,
      heading: copy.approach.heading,
      body: copy.approach.body,
      steps: json(copy.approach.steps),
      variant: 'minimal',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('attorneys', 'team', {
      eyebrow: copy.attorneys.eyebrow,
      heading: copy.attorneys.heading,
      body: copy.attorneys.body,
      profileLabel: copy.attorneys.profileLabel,
      members: membersWithPortraits(
        copy.attorneys.members,
        PARTNER_PHOTOS,
        PARTNER_HREFS,
        '#attorneys',
        lang,
      ),
      variant: 'editorial',
      columns: '2',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('quotes', 'testimonials', {
      eyebrow: copy.quotes.eyebrow,
      heading: copy.quotes.heading,
      items: json(copy.quotes.items),
      variant: 'cards',
      columns: '2',
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

    page.section('consultation', 'formSection', {
      eyebrow: copy.consultation.eyebrow,
      heading: copy.consultation.heading,
      body: copy.consultation.body,
      fields: formFields([
        {
          id: 'name',
          type: 'text',
          label: fields.name,
          autoComplete: 'name',
          required: true,
          width: 'half',
        },
        {
          id: 'phone',
          type: 'tel',
          label: fields.phone,
          autoComplete: 'tel',
          required: true,
          width: 'half',
        },
        {
          id: 'email',
          type: 'email',
          label: fields.email,
          autoComplete: 'email',
          required: false,
          width: 'half',
        },
        {
          id: 'matter',
          type: 'select',
          label: fields.matter,
          required: true,
          width: 'half',
          options: selectOptions(fields.matters, MATTER_VALUES),
        },
        {
          id: 'contact',
          type: 'select',
          label: fields.contact,
          required: true,
          width: 'full',
          options: selectOptions(fields.contacts, CONTACT_VALUES),
        },
        {
          id: 'summary',
          type: 'textarea',
          label: fields.summary,
          required: true,
          width: 'full',
          rows: 5,
        },
        { id: 'consent', type: 'checkbox', label: fields.consent, required: true, width: 'full' },
      ]),
      submitLabel: copy.consultation.submitLabel,
      footerNote: copy.consultation.footerNote,
      successHint: copy.consultation.successHint,
      action: '/consultations',
      method: 'post',
      variant: 'card',
      controlDensity: 'comfortable',
      controlRadius: 'small',
      buttonVariant: 'solid',
      buttonWidth: 'full',
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.place(
      footer(
        {
          prefix,
          brand: copy.brand,
          tagline: copy.footer.tagline,
          columns: copy.footer.columns,
          legal: copy.footer.legal,
        },
        lang,
      ),
    );
  },
});
