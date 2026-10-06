import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
} from '@craftkit/builder-schema';

import { paginationExamples } from './examples';

const safePageDestination = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      value.startsWith('?') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    { error: 'Use a relative query, path, fragment, or an http or https URL.' },
  );

const pageHrefTemplate = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => value.includes('{page}'), {
    error: 'Page URL template must contain {page}.',
  })
  .refine(
    (value) => {
      const resolved = value.split('{page}').join('1');
      return (
        resolved.startsWith('#') ||
        resolved.startsWith('?') ||
        (resolved.startsWith('/') && !resolved.startsWith('//') && !resolved.startsWith('/\\')) ||
        /^https?:\/\//i.test(resolved)
      );
    },
    { error: 'Page URL template must resolve to a safe web destination.' },
  );

const utilityClasses = z
  .string()
  .max(400)
  .refine((value) => findRejectedUtilities(value).length === 0, {
    error: (issue) =>
      findRejectedUtilities(String(issue.input))
        .map((rejection) => rejection.message)
        .join(' '),
  });

const paginationItemsSchema = z
  .array(
    z.object({
      label: z.string().min(1).max(64),
      href: safePageDestination.optional(),
      current: z.boolean().default(false),
      disabled: z.boolean().default(false),
    }),
  )
  .max(30)
  .refine(
    (items) => {
      const currentItems = items.filter((item) => item.current);
      return currentItems.length <= 1 && currentItems[0]?.disabled !== true;
    },
    { error: 'Choose at most one current page, and keep that page enabled.' },
  )
  .default([]);

export const paginationSchema = defineBlockSchema({
  type: 'pagination',
  description:
    'Semantic pagination with generated sibling ranges or explicit items, safe destinations, compact and full layouts, and RTL-aware controls.',
  surfaces: ['site', 'store'],
  props: z.object({
    navigationLabel: z.string().min(1).max(80).default('Pagination'),
    previousLabel: z.string().min(1).max(64).default('Previous'),
    nextLabel: z.string().min(1).max(64).default('Next'),
    pageLabel: z.string().min(1).max(40).default('Page'),
    ellipsisLabel: z.string().min(1).max(64).default('More pages'),
    mode: z.enum(['generated', 'explicit']).default('generated'),
    currentPage: z.number().int().min(1).max(10000).default(1),
    pageCount: z.number().int().min(1).max(10000).default(1),
    siblingCount: z.number().int().min(0).max(2).default(1),
    showFirstLast: z.boolean().default(true),
    pageHrefTemplate: pageHrefTemplate.default('?page={page}'),
    previousHref: safePageDestination.optional(),
    nextHref: safePageDestination.optional(),
    items: paginationItemsSchema,
    variant: z.enum(['full', 'compact']).default('full'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    align: z.enum(['start', 'center', 'end']).default('center'),
    tone: z.enum(['transparent', 'surface', 'inverse']).default('transparent'),
    motion: motionSpecSchema.optional(),
    className: utilityClasses.optional(),
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    navigationLabel: { tab: 'content', section: 'Accessibility' },
    previousLabel: { tab: 'content', section: 'Labels' },
    nextLabel: { tab: 'content', section: 'Labels' },
    pageLabel: { tab: 'content', section: 'Labels' },
    ellipsisLabel: { tab: 'content', section: 'Accessibility' },
    mode: { tab: 'advanced', section: 'Data mode' },
    currentPage: { tab: 'content', section: 'Pages' },
    pageCount: { tab: 'content', section: 'Pages' },
    siblingCount: { tab: 'design', section: 'Range' },
    showFirstLast: { tab: 'design', section: 'Range' },
    pageHrefTemplate: { tab: 'advanced', section: 'Destinations' },
    previousHref: { tab: 'content', section: 'Destinations' },
    nextHref: { tab: 'content', section: 'Destinations' },
    items: { tab: 'content', section: 'Explicit pages' },
    variant: { tab: 'design', section: 'Layout' },
    size: { tab: 'design', section: 'Size' },
    align: { tab: 'design', section: 'Alignment' },
    tone: { tab: 'design', section: 'Style' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  /*
    The control's inner elements (block-parts DESIGN §1): the Previous and Next
    labels, the page word ("Page 2 / 9" in the compact layout; the prefix every
    page link's accessible name reads in the full one), and in explicit mode
    the page list, each page, and each page's link. `navigationLabel` and
    `ellipsisLabel` are for assistive technology only, so they stay in the
    Inspector.
  */
  parts: {
    previousLabel: {
      kind: 'text',
      bind: 'previousLabel',
      label: { en: 'Previous label', ar: 'نص السابق' },
      aliases: ['previous', 'prev', 'back', 'السابق', 'الخلف'],
    },
    nextLabel: {
      kind: 'text',
      bind: 'nextLabel',
      label: { en: 'Next label', ar: 'نص التالي' },
      aliases: ['next', 'forward', 'التالي', 'الأمام'],
    },
    pageLabel: {
      kind: 'text',
      bind: 'pageLabel',
      label: { en: 'Page word', ar: 'كلمة الصفحة' },
      aliases: ['page', 'page label', 'status', 'صفحة', 'الحالة'],
    },
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Pages', ar: 'الصفحات' },
      aliases: ['pages', 'explicit pages', 'list', 'القائمة'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Page', ar: 'الصفحة' },
      aliases: ['page', 'entry', 'صفحة', 'عنصر'],
    },
    'item.link': {
      kind: 'link',
      bind: { text: 'items.*.label', href: 'items.*.href' },
      label: { en: 'Page link', ar: 'رابط الصفحة' },
      aliases: ['link', 'label', 'page link', 'رابط', 'نص الرابط'],
    },
  },
  examples: paginationExamples,
});

export type PaginationProps = z.output<typeof paginationSchema.props>;
