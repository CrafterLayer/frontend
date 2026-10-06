import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
} from '@craftkit/builder-schema';

import { breadcrumbsExamples } from './examples';

export const breadcrumbSeparators = ['chevron', 'slash', 'dot'] as const;
export const breadcrumbSizes = ['small', 'medium', 'large'] as const;
export const breadcrumbTones = ['default', 'muted', 'inverse'] as const;
export const breadcrumbAlignments = ['start', 'center', 'end'] as const;
export const breadcrumbCollapseModes = ['none', 'responsive'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    {
      message: 'Breadcrumb links must use a relative path, fragment, http URL, or https URL.',
    },
  );

const breadcrumbItemSchema = z.object({
  label: z.string().min(1).max(100),
  href: safeHrefSchema.optional(),
  current: z.boolean().optional(),
});

const breadcrumbItemsSchema = z
  .array(breadcrumbItemSchema)
  .max(12)
  .refine((items) => items.filter((item) => item.current === true).length <= 1, {
    message: 'Only one breadcrumb item can be marked as the current page.',
  })
  .refine(
    (items) => {
      const currentIndex = items.findIndex((item) => item.current === true);
      return currentIndex === -1 || currentIndex === items.length - 1;
    },
    { message: 'The current breadcrumb must be the final item.' },
  );

const defaultBreadcrumbItems = breadcrumbItemsSchema.parse([
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Current page', current: true },
]);

export const breadcrumbsSchema = defineBlockSchema({
  type: 'breadcrumbs',
  description:
    'A semantic breadcrumb navigation trail with safe links, a guaranteed current page, token-bound tone and size, RTL-aware separators, and responsive middle-item collapse. Adapted from shadcn/ui.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    label: z.string().min(1).max(80).default('Breadcrumb'),
    items: breadcrumbItemsSchema.default(defaultBreadcrumbItems),
    separator: z.enum(breadcrumbSeparators).default('chevron'),
    collapse: z.enum(breadcrumbCollapseModes).default('responsive'),
    size: z.enum(breadcrumbSizes).default('medium'),
    tone: z.enum(breadcrumbTones).default('default'),
    align: z.enum(breadcrumbAlignments).default('start'),
    motion: motionSpecSchema.optional(),
    className: z
      .string()
      .max(400)
      .refine((value) => findRejectedUtilities(value).length === 0, {
        error: (issue) =>
          findRejectedUtilities(String(issue.input))
            .map((rejection) => rejection.message)
            .join(' '),
      })
      .optional(),
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    label: { tab: 'content', section: 'Navigation' },
    items: { tab: 'content', section: 'Breadcrumb items' },
    separator: { tab: 'design', section: 'Trail' },
    collapse: { tab: 'design', section: 'Responsive layout' },
    size: { tab: 'design', section: 'Trail' },
    tone: { tab: 'design', section: 'Trail' },
    align: { tab: 'design', section: 'Layout' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  /*
    The trail's inner elements (block-parts DESIGN §1): the trail list, each
    crumb, and each crumb's link (label in place, destination in the Link
    popover). The current page is a link part without a destination. `label`
    names the navigation for assistive technology only, so it stays in the
    Inspector.
  */
  parts: {
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Trail', ar: 'المسار' },
      aliases: ['breadcrumbs', 'crumbs', 'path', 'list', 'مسار التنقل'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Crumb', ar: 'خطوة المسار' },
      aliases: ['crumb', 'step', 'level', 'عنصر', 'خطوة'],
    },
    'item.link': {
      kind: 'link',
      bind: { text: 'items.*.label', href: 'items.*.href' },
      label: { en: 'Crumb link', ar: 'رابط الخطوة' },
      aliases: ['link', 'label', 'page', 'رابط', 'الصفحة'],
    },
  },
  examples: breadcrumbsExamples,
});

export type BreadcrumbsProps = z.output<typeof breadcrumbsSchema.props>;
