import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionCustomProps } from '../section-custom';
import { sectionDesignGroups, sectionIntroGroups, sectionIntroParts } from '../section-intro';
import { sectionMotionProps } from '../section-motion';
import { numberLanguages } from '../section-numbers';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingProps } from '../section-spacing';
import { sectionTypographyProps } from '../section-typography';
import { safeHrefSchema } from '../section-urls';
import { reviewSummaryExamples } from './examples';

/* What the Library card inserts: a believable distribution that averages to its 4.7. */
const defaultBreakdown = [
  { label: '5 stars', count: 982 },
  { label: '4 stars', count: 187 },
  { label: '3 stars', count: 46 },
  { label: '2 stars', count: 19 },
  { label: '1 star', count: 14 },
];

const defaultReviews = [
  {
    quote: 'Booked on Monday, fixed by Tuesday. Clear prices and no surprises.',
    author: 'Hana M.',
    meta: 'Verified customer',
    rating: 5,
  },
  {
    quote: 'Friendly team and spotless work. The follow-up call was a nice touch.',
    author: 'Yousef A.',
    meta: 'Riyadh',
    rating: 5,
  },
  {
    quote: 'Great result, though the wait for a slot was a little long.',
    author: 'Claire D.',
    rating: 4,
  },
];

export const reviewSummarySchema = defineBlockSchema({
  type: 'reviewSummary',
  description:
    'Aggregate ratings: the average score (0–5) with stars, a total line, one bar per star level from review counts, and a few short reviews with their own star rating.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('What our customers say'),
    body: z.string().min(1).max(240).optional(),
    average: z.number().min(0).max(5).default(4.7),
    totalLabel: z.string().min(1).max(60).default('Based on 1,248 reviews'),
    breakdown: z
      .array(
        z.object({
          label: z.string().min(1).max(24),
          count: z.number().int().min(0).max(100_000_000),
        }),
      )
      .max(5)
      .default(defaultBreakdown),
    reviews: z
      .array(
        z.object({
          quote: z.string().min(1).max(280),
          author: z.string().min(1).max(60),
          meta: z.string().min(1).max(60).optional(),
          rating: z.number().int().min(1).max(5).default(5),
        }),
      )
      .max(6)
      .default(defaultReviews),
    /* Digits for the average and the shares: Arabic-Indic for `ar`. */
    numberLanguage: z.enum(numberLanguages).default('en'),
    /* What a screen reader hears for a row of stars; `{rating}` is replaced by the number. */
    ratingLabel: z.string().min(1).max(60).default('{rating} out of 5 stars'),
    actionLabel: z.string().min(1).max(40).optional(),
    actionHref: safeHrefSchema.optional(),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('wide'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    ...sectionIntroGroups,
    average: { tab: 'content', section: 'Rating' },
    totalLabel: { tab: 'content', section: 'Rating' },
    breakdown: { tab: 'content', section: 'Rating' },
    reviews: { tab: 'content', section: 'Reviews' },
    numberLanguage: { tab: 'content', section: 'Rating' },
    ratingLabel: { tab: 'advanced', section: 'Accessibility' },
    actionLabel: { tab: 'content', section: 'Action' },
    actionHref: { tab: 'content', section: 'Action' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  /*
    The introduction, the total line, every star level's label, every review's
    words, and the action. The average and the counts are numbers (Inspector
    rows); the star words are heard, not seen.
  */
  parts: {
    ...sectionIntroParts,
    totalLabel: {
      kind: 'text',
      bind: 'totalLabel',
      label: { en: 'Total line', ar: 'سطر الإجمالي' },
      aliases: ['total', 'count', 'based on', 'عدد التقييمات', 'الإجمالي'],
    },
    breakdown: {
      kind: 'list',
      bind: 'breakdown',
      label: { en: 'Star levels', ar: 'مستويات النجوم' },
      aliases: ['breakdown', 'distribution', 'bars', 'التوزيع', 'الأشرطة'],
    },
    'breakdown.label': {
      kind: 'text',
      bind: 'breakdown.*.label',
      label: { en: 'Star level', ar: 'مستوى النجوم' },
      aliases: ['stars', 'level', 'النجوم', 'المستوى'],
    },
    reviews: {
      kind: 'list',
      bind: 'reviews',
      label: { en: 'Reviews', ar: 'المراجعات' },
      aliases: ['reviews', 'testimonials', 'quotes', 'المراجعات', 'الآراء'],
    },
    review: {
      kind: 'item',
      bind: 'reviews.*',
      list: 'reviews',
      label: { en: 'Review', ar: 'مراجعة' },
      aliases: ['review', 'testimonial', 'مراجعة', 'رأي'],
    },
    'review.quote': {
      kind: 'text',
      bind: 'reviews.*.quote',
      label: { en: 'Review text', ar: 'نص المراجعة' },
      aliases: ['quote', 'text', 'comment', 'النص', 'التعليق'],
      multiline: true,
    },
    'review.author': {
      kind: 'text',
      bind: 'reviews.*.author',
      label: { en: 'Reviewer', ar: 'صاحب المراجعة' },
      aliases: ['author', 'name', 'customer', 'الاسم', 'العميل'],
    },
    'review.meta': {
      kind: 'text',
      bind: 'reviews.*.meta',
      label: { en: 'Review detail', ar: 'تفاصيل المراجعة' },
      aliases: ['date', 'location', 'verified', 'التاريخ', 'المدينة'],
    },
    action: {
      kind: 'link',
      bind: { text: 'actionLabel', href: 'actionHref' },
      label: { en: 'Link', ar: 'الرابط' },
      aliases: ['button', 'link', 'all reviews', 'write a review', 'الرابط', 'كل التقييمات'],
    },
  },
  examples: reviewSummaryExamples,
});

export type ReviewSummaryProps = z.output<typeof reviewSummarySchema.props>;
