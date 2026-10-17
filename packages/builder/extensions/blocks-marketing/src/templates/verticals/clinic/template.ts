import { defineTemplate, footer, header, json, photo } from '../../build';
import type { TemplateLang } from '../../types';
import { AR } from './copy-ar';
import { EN, PHONE_HREF } from './copy-en';

/*
  Dental clinic (`clinic` / `clinic-ar`) — agent-script DESIGN §B.3.

  header (Services · Doctors · Insurance · Book) → split hero with the
  treatment room → six services (fills 2 and 3 columns) → booking in three
  steps (one row of three) → four doctors with portraits → four figures →
  patient reviews (2 × 2) → FAQ with insurance and hours (2 × 3) → the
  appointment form → footer.

  «عيادات ابتسامة»: a family dental clinic in Al Olaya, Riyadh.

  Grounds: the figures are the page's dark band, between the doctors and
  the reviews; the booking steps use accented cards, so three card grids never
  follow one another.
*/

const HERO_PHOTO = 0;
/** Doctor portraits, in member order: [topic, index]. */
const DOCTOR_PHOTOS: readonly (readonly [string, number])[] = [
  ['clinic', 1],
  ['people', 17],
  ['clinic', 2],
  ['clinic', 3],
];
const DOCTOR_HREFS = ['#doctor-faisal', '#doctor-noura', '#doctor-khalid', '#doctor-reem'];
const SERVICE_VALUES = [
  'checkup',
  'children',
  'orthodontics',
  'whitening',
  'implants',
  'emergency',
] as const;
const TIME_VALUES = ['morning', 'afternoon', 'evening'] as const;
const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const clinicTemplate = defineTemplate({
  key: 'clinic',
  category: 'clinic',
  baseId: 'clinic',
  name: { en: 'Dental clinic', ar: 'عيادة أسنان' },
  description: {
    en: 'A family dental clinic with services, booking steps, doctor profiles, insurance FAQ and an appointment form.',
    ar: 'عيادة أسنان عائلية بالخدمات وخطوات الحجز وملفات الأطباء وأسئلة التأمين ونموذج حجز موعد.',
  },
  thumbnail: { topic: 'clinic', index: HERO_PHOTO },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `clinic-${lang}`;
    const heroPhoto = photo('clinic', HERO_PHOTO, lang);
    const fields = copy.form.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    const primary = page.add('hero-primary', 'cta', {
      label: copy.hero.primary,
      href: '#book',
      emphasis: 'primary',
      size: 'lg',
    });
    const secondary = page.add('hero-secondary', 'cta', {
      label: copy.hero.secondary,
      href: PHONE_HREF,
      emphasis: 'ghost',
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
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
      { actions: [primary, secondary], media: [heroImage] },
    );

    page.section('services', 'features', {
      eyebrow: copy.services.eyebrow,
      heading: copy.services.heading,
      body: copy.services.body,
      items: json(copy.services.items),
      columns: '3',
      variant: 'cards',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('steps', 'processSteps', {
      eyebrow: copy.steps.eyebrow,
      heading: copy.steps.heading,
      body: copy.steps.body,
      steps: json(copy.steps.items),
      variant: 'accented',
      layout: 'horizontal',
      columns: '3',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('doctors', 'team', {
      eyebrow: copy.doctors.eyebrow,
      heading: copy.doctors.heading,
      body: copy.doctors.body,
      profileLabel: copy.doctors.profileLabel,
      members: json(
        copy.doctors.members.map((member, index) => {
          const [topic, photoIndex] = DOCTOR_PHOTOS[index] ?? ['clinic', -1];
          const portrait = photo(topic, photoIndex, lang);
          return {
            ...member,
            imageSrc: portrait.src,
            imageAlt: portrait.alt,
            profileHref: DOCTOR_HREFS[index] ?? '#doctors',
          };
        }),
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
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
      columns: '4',
      headerLayout: 'split',
      align: 'start',
      tone: 'dark',
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

    page.section('book', 'formSection', {
      eyebrow: copy.form.eyebrow,
      heading: copy.form.heading,
      body: copy.form.body,
      fields: json([
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
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: fields.phone,
          autoComplete: 'tel',
          required: true,
          width: 'half',
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: fields.email,
          autoComplete: 'email',
          required: false,
          width: 'half',
        },
        {
          id: 'service',
          name: 'service',
          type: 'select',
          label: fields.service,
          required: true,
          width: 'half',
          options: fields.services.map((label, index) => ({
            label,
            value: SERVICE_VALUES[index] ?? `service-${String(index + 1)}`,
          })),
        },
        {
          id: 'date',
          name: 'date',
          type: 'date',
          label: fields.date,
          required: true,
          width: 'half',
        },
        {
          id: 'time',
          name: 'time',
          type: 'select',
          label: fields.time,
          required: true,
          width: 'half',
          options: fields.times.map((label, index) => ({
            label,
            value: TIME_VALUES[index] ?? `time-${String(index + 1)}`,
          })),
        },
        {
          id: 'notes',
          name: 'notes',
          type: 'textarea',
          label: fields.notes,
          required: false,
          width: 'full',
          rows: 4,
        },
        {
          id: 'consent',
          name: 'consent',
          type: 'checkbox',
          label: fields.consent,
          required: true,
          width: 'full',
        },
      ]),
      submitLabel: copy.form.submitLabel,
      footerNote: copy.form.footerNote,
      successHint: copy.form.successHint,
      action: '/appointments',
      method: 'post',
      variant: 'split',
      controlDensity: 'comfortable',
      controlRadius: 'large',
      buttonVariant: 'solid',
      buttonWidth: 'auto',
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
