import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { avatarGroupExamples } from './examples';

export const avatarGroupSizes = ['small', 'medium', 'large'] as const;
export const avatarGroupOverlaps = ['none', 'subtle', 'medium', 'strong'] as const;
export const avatarGroupShapes = ['circle', 'rounded'] as const;
export const avatarGroupTones = ['accent', 'neutral', 'inverse'] as const;
export const avatarGroupAlignments = ['start', 'center', 'end'] as const;

const safeImageUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^\.{1,2}\//.test(value) ||
      /^https?:\/\//i.test(value),
    {
      message: 'Avatar image must use a relative path or an http or https URL.',
    },
  );

export const avatarGroupSchema = defineBlockSchema({
  type: 'avatarGroup',
  description:
    'An accessible list of people shown as overlapping shadcn-style avatars, with safe imagery, fallback initials, logical RTL stacking, and a labelled overflow count.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    groupLabel: z.string().min(1).max(80).default('People'),
    people: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          imageSrc: safeImageUrlSchema.optional(),
          initials: z.string().min(1).max(3).optional(),
        }),
      )
      .max(20)
      .default([
        { name: 'Maya Chen', initials: 'MC' },
        { name: 'Omar Haddad', initials: 'OH' },
        { name: 'Lina Faris', initials: 'LF' },
      ]),
    size: z.enum(avatarGroupSizes).default('medium'),
    overlap: z.enum(avatarGroupOverlaps).default('medium'),
    maxVisible: z.number().int().min(1).max(12).default(5),
    overflowLabel: z.string().min(1).max(60).default('More people:'),
    shape: z.enum(avatarGroupShapes).default('circle'),
    tone: z.enum(avatarGroupTones).default('accent'),
    align: z.enum(avatarGroupAlignments).default('start'),
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
  }),
  propertyGroups: {
    groupLabel: { tab: 'content', section: 'Accessibility' },
    people: { tab: 'content', section: 'People' },
    size: { tab: 'design', section: 'Avatars' },
    overlap: { tab: 'design', section: 'Stacking' },
    maxVisible: { tab: 'design', section: 'Overflow' },
    overflowLabel: { tab: 'content', section: 'Accessibility' },
    shape: { tab: 'design', section: 'Avatars' },
    tone: { tab: 'design', section: 'Avatars' },
    align: { tab: 'design', section: 'Layout' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  examples: avatarGroupExamples,
});

export type AvatarGroupProps = z.output<typeof avatarGroupSchema.props>;
