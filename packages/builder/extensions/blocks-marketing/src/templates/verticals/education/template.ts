import { defineTemplate, footer, header, json, money, photo } from '../../build';
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
  Online academy (`education` / `education-ar`): live courses in software,
  design and data, taught in small cohorts.

  header → split hero over a study session → where graduates work (a logo
  band on the hero's ground) → six courses with prices in dinars, ratings and
  a four-part description (fills 2 and 3 columns) → how it works in four
  stages → outcomes on a dark band → four mentors with portraits → graduates'
  words (2 × 2) → FAQ (2 × 3) → the admissions form, whose own dark panel
  closes the page → footer.

  «أكاديمية مدار»: Amman and online, fees in Jordanian dinars.
*/

const HERO_PHOTO: PhotoRef = ['saas', 3];
/** One photo per course, in course order. */
const COURSE_PHOTOS: readonly PhotoRef[] = [
  ['saas', 8],
  ['agency', 3],
  ['saas', 0],
  ['saas', 6],
  ['saas', 1],
  ['services', 8],
];
/** Course fees in Jordanian dinars; the early-bird course shows its full price too. */
const COURSE_PRICES = [690, 540, 420, 620, 360, 390] as const;
const ORIGINAL_PRICES: readonly (number | undefined)[] = [
  undefined,
  undefined,
  480,
  undefined,
  undefined,
  undefined,
];
const COURSE_RATINGS = [4.9, 4.8, 4.9, 4.7, 4.8, 4.9] as const;
const COURSE_REVIEWS = [1240, 860, 310, 540, 690, 270] as const;
const COURSE_VALUES = ['web', 'design', 'data', 'mobile', 'marketing', 'finance'] as const;
const START_VALUES = ['january', 'march', 'undecided'] as const;
const MENTOR_PHOTOS: readonly PhotoRef[] = [
  ['people', 9],
  ['people', 4],
  ['people', 22],
  ['people', 20],
];
const MENTOR_HREFS = ['#mentor-omar', '#mentor-dana', '#mentor-yazan', '#mentor-rania'];

const COPY: Record<TemplateLang, typeof EN> = { en: EN, ar: AR };

export const educationTemplate = defineTemplate({
  key: 'education',
  category: 'education',
  baseId: 'education',
  name: { en: 'Online academy', ar: 'أكاديمية تعليمية' },
  description: {
    en: 'Live online courses with prices, mentors, graduate outcomes, admissions FAQ and an adviser call-back form.',
    ar: 'دورات مباشرة عبر الإنترنت بالأسعار والمرشدين ونتائج الخريجين وأسئلة القبول ونموذج اتصال من مستشار.',
  },
  thumbnail: { topic: HERO_PHOTO[0], index: HERO_PHOTO[1] },
  surfaces: ['site'],
  page(lang, page) {
    const copy = COPY[lang];
    const prefix = `education-${lang}`;
    const fields = copy.apply.fields;

    page.place(header({ prefix, brand: copy.brand, nav: copy.nav, cta: copy.headerCta }, lang));

    heroSection(page, lang, {
      copy: copy.hero,
      primaryHref: '#courses',
      secondaryHref: '#apply',
      photo: HERO_PHOTO,
      variant: 'split',
      ratio: 'square',
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

    page.section('courses', 'productGrid', {
      eyebrow: copy.courses.eyebrow,
      heading: copy.courses.heading,
      body: copy.courses.body,
      actionLabel: copy.courses.actionLabel,
      showRatings: true,
      ratingPrefix: copy.courses.ratingPrefix,
      ratingSuffix: copy.courses.ratingSuffix,
      reviewCountLabel: copy.courses.reviewCountLabel,
      variant: 'grid',
      columns: '3',
      imageRatio: 'square',
      products: json(
        copy.courses.items.map((course, index) => {
          const [topic, photoIndex] = COURSE_PHOTOS[index] ?? ['saas', -1];
          const image = photo(topic, photoIndex, lang);
          const original = ORIGINAL_PRICES[index];
          return {
            ...course,
            price: money(COURSE_PRICES[index] ?? 0, 'JOD', lang),
            ...(original === undefined ? {} : { originalPrice: money(original, 'JOD', lang) }),
            imageSrc: image.src,
            imageAlt: image.alt,
            href: `#course-${COURSE_VALUES[index] ?? String(index + 1)}`,
            rating: COURSE_RATINGS[index],
            reviewCount: COURSE_REVIEWS[index],
          };
        }),
      ),
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
      variant: 'accented',
      layout: 'horizontal',
      columns: '4',
      showNumbers: true,
      align: 'start',
      tone: 'light',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('outcomes', 'stats', {
      eyebrow: copy.outcomes.eyebrow,
      heading: copy.outcomes.heading,
      body: copy.outcomes.body,
      items: json(copy.outcomes.items),
      variant: 'minimal',
      columns: '4',
      headerLayout: 'split',
      align: 'start',
      tone: 'dark',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('mentors', 'team', {
      eyebrow: copy.mentors.eyebrow,
      heading: copy.mentors.heading,
      body: copy.mentors.body,
      profileLabel: copy.mentors.profileLabel,
      members: membersWithPortraits(
        copy.mentors.members,
        MENTOR_PHOTOS,
        MENTOR_HREFS,
        '#mentors',
        lang,
      ),
      variant: 'cards',
      columns: '4',
      align: 'start',
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

    page.section('faq', 'faq', {
      eyebrow: copy.faq.eyebrow,
      heading: copy.faq.heading,
      items: json(copy.faq.items),
      layout: 'columns',
      variant: 'cards',
      openFirst: true,
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
    });

    page.section('apply', 'formSection', {
      eyebrow: copy.apply.eyebrow,
      heading: copy.apply.heading,
      body: copy.apply.body,
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
          id: 'course',
          type: 'select',
          label: fields.course,
          required: true,
          width: 'half',
          options: selectOptions(
            copy.courses.items.map((course) => course.name),
            COURSE_VALUES,
          ),
        },
        {
          id: 'start',
          type: 'select',
          label: fields.start,
          required: true,
          width: 'full',
          options: selectOptions(fields.starts, START_VALUES),
        },
        {
          id: 'notes',
          type: 'textarea',
          label: fields.notes,
          required: false,
          width: 'full',
          rows: 4,
        },
        { id: 'consent', type: 'checkbox', label: fields.consent, required: true, width: 'full' },
      ]),
      submitLabel: copy.apply.submitLabel,
      footerNote: copy.apply.footerNote,
      successHint: copy.apply.successHint,
      action: '/admissions',
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
