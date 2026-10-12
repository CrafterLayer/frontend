import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { menuSectionExamples } from './examples';

export const menuCurrencyPositions = ['after', 'before'] as const;
export const menuPriceAligns = ['end', 'inline'] as const;
export const menuColumns = ['1', '2'] as const;

const safeImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value) ||
      /^data:image\/(?:avif|gif|jpeg|png|webp);/i.test(value),
    { message: 'Menu photos must use http(s), a root-relative path, or a raster data URL.' },
  );

/*
  What the Library card inserts: a small café menu with two categories. No
  currency: the symbol is the site's to choose (`currency`), never this file's.
*/
const defaultCategories = [
  {
    name: 'Coffee',
    items: [
      { name: 'Espresso', description: 'A double shot, house blend.', price: '3.00', tags: [] },
      {
        name: 'Flat white',
        description: 'Espresso with silky steamed milk.',
        price: '4.50',
        tags: ['Popular'],
      },
      {
        name: 'Cardamom latte',
        description: 'Our latte with freshly ground cardamom.',
        price: '5.00',
        tags: ['New'],
      },
    ],
  },
  {
    name: 'Bakery',
    items: [
      { name: 'Butter croissant', price: '3.50', tags: [] },
      {
        name: 'Zaatar manakish',
        description: 'Thyme, sesame and olive oil.',
        price: '4.00',
        tags: ['Vegetarian'],
      },
      { name: 'Date cake', description: 'Warm, with tahini caramel.', price: '5.50', tags: [] },
    ],
  },
];

export const menuSectionSchema = defineBlockSchema({
  type: 'menuSection',
  description:
    'A restaurant, café or services price list: categories of items, each with a name, an optional one-line description, a price, optional tags (Vegetarian, Spicy, New) and an optional photo. The currency is a text prop (`currency`, e.g. "SAR", "ر.س", "$") placed before or after every price; prices sit at the row end behind dotted leaders or inline after the name. Use for food and drink menus and simple service price lists; use pricing for subscription plans.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Our menu'),
    body: z.string().min(1).max(240).optional(),
    categories: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          description: z.string().min(1).max(200).optional(),
          items: z
            .array(
              z.object({
                name: z.string().min(1).max(80),
                description: z.string().min(1).max(200).optional(),
                price: z.string().min(1).max(24),
                tags: z.array(z.string().min(1).max(24)).max(4).default([]),
                imageSrc: safeImageSchema.optional(),
                imageAlt: z.string().max(160).optional(),
              }),
            )
            .max(24)
            .default([]),
        }),
      )
      .max(8)
      .default(defaultCategories),
    currency: z.string().max(12).default(''),
    currencyPosition: z.enum(menuCurrencyPositions).default('after'),
    priceAlign: z.enum(menuPriceAligns).default('end'),
    leaders: z.boolean().default(true),
    showImages: z.boolean().default(true),
    columns: z.enum(menuColumns).default('2'),
    note: z.string().min(1).max(200).optional(),
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
    eyebrow: { tab: 'content', section: 'Introduction' },
    heading: { tab: 'content', section: 'Introduction' },
    body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
    categories: { tab: 'content', section: 'Menu' },
    currency: { tab: 'content', section: 'Prices' },
    currencyPosition: { tab: 'content', section: 'Prices' },
    priceAlign: { tab: 'design', section: 'Prices' },
    leaders: { tab: 'design', section: 'Prices' },
    showImages: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
    note: { tab: 'content', section: 'Footnote', kind: 'multiline' },
    align: { tab: 'design', section: 'Alignment' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  inlineEditable: 'heading',
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    each category with its name and description, each dish with its name,
    description, price, tags and photo, and the footnote. A dish is addressed
    by category and position (`dish.price@1.2` is the second category's third
    dish). The currency is one prop printed beside every price, so it stays an
    Inspector row.
  */
  parts: {
    eyebrow: {
      kind: 'text',
      bind: 'eyebrow',
      label: { en: 'Eyebrow', ar: 'الشارة' },
      aliases: ['badge', 'overline', 'kicker', 'شارة', 'العنوان الصغير'],
    },
    heading: {
      kind: 'text',
      bind: 'heading',
      label: { en: 'Heading', ar: 'العنوان' },
      aliases: ['title', 'headline', 'h2', 'عنوان', 'العنوان الرئيسي'],
    },
    body: {
      kind: 'text',
      bind: 'body',
      label: { en: 'Body', ar: 'الوصف' },
      aliases: ['intro', 'paragraph', 'description', 'text', 'وصف', 'الفقرة', 'النص'],
      multiline: true,
    },
    categories: {
      kind: 'list',
      bind: 'categories',
      label: { en: 'Menu categories', ar: 'أقسام القائمة' },
      aliases: ['menu', 'sections', 'categories', 'القائمة', 'المنيو', 'الأقسام'],
    },
    category: {
      kind: 'item',
      bind: 'categories.*',
      list: 'categories',
      label: { en: 'Category', ar: 'القسم' },
      aliases: ['category', 'section', 'course', 'قسم', 'فئة'],
    },
    'category.name': {
      kind: 'text',
      bind: 'categories.*.name',
      label: { en: 'Category name', ar: 'اسم القسم' },
      aliases: ['category title', 'h3', 'اسم الفئة'],
    },
    'category.description': {
      kind: 'text',
      bind: 'categories.*.description',
      label: { en: 'Category description', ar: 'وصف القسم' },
      aliases: ['category note', 'وصف الفئة'],
    },
    'category.items': {
      kind: 'list',
      bind: 'categories.*.items',
      label: { en: 'Dishes', ar: 'الأصناف' },
      aliases: ['items', 'dishes', 'drinks', 'products', 'الأطباق', 'المشروبات'],
    },
    dish: {
      kind: 'item',
      bind: 'categories.*.items.*',
      list: 'category.items',
      label: { en: 'Dish', ar: 'الصنف' },
      aliases: ['item', 'dish', 'drink', 'service', 'طبق', 'صنف', 'مشروب'],
    },
    'dish.name': {
      kind: 'text',
      bind: 'categories.*.items.*.name',
      label: { en: 'Dish name', ar: 'اسم الصنف' },
      aliases: ['name', 'item name', 'الاسم'],
    },
    'dish.description': {
      kind: 'text',
      bind: 'categories.*.items.*.description',
      label: { en: 'Dish description', ar: 'وصف الصنف' },
      aliases: ['description', 'ingredients', 'المكونات', 'الوصف'],
    },
    'dish.price': {
      kind: 'text',
      bind: 'categories.*.items.*.price',
      label: { en: 'Price', ar: 'السعر' },
      aliases: ['price', 'cost', 'سعر', 'الثمن'],
    },
    'dish.tag': {
      kind: 'text',
      bind: 'categories.*.items.*.tags.*',
      label: { en: 'Dish tag', ar: 'وسم الصنف' },
      aliases: ['tag', 'label', 'vegetarian', 'spicy', 'new', 'وسم', 'نباتي', 'حار', 'جديد'],
    },
    'dish.image': {
      kind: 'image',
      bind: { src: 'categories.*.items.*.imageSrc', alt: 'categories.*.items.*.imageAlt' },
      label: { en: 'Dish photo', ar: 'صورة الصنف' },
      aliases: ['photo', 'image', 'picture', 'صورة', 'الصورة'],
    },
    note: {
      kind: 'text',
      bind: 'note',
      label: { en: 'Footnote', ar: 'الحاشية' },
      aliases: ['footnote', 'fine print', 'note', 'allergens', 'ملاحظة', 'حاشية'],
      multiline: true,
    },
  },
  examples: menuSectionExamples,
});

export type MenuSectionProps = z.output<typeof menuSectionSchema.props>;
