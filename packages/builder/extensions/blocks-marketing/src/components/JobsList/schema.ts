import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionCustomProps } from '../section-custom';
import { sectionDesignGroups, sectionIntroGroups, sectionIntroParts } from '../section-intro';
import { sectionMotionProps } from '../section-motion';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingProps } from '../section-spacing';
import { sectionTypographyProps } from '../section-typography';
import { safeHrefSchema } from '../section-urls';
import { jobsListExamples } from './examples';

export const jobsListLayouts = ['rows', 'cards'] as const;

const defaultJobs = [
  {
    title: 'Senior Product Designer',
    team: 'Design',
    location: 'Riyadh',
    type: 'Full-time',
    href: '#',
  },
  {
    title: 'Backend Engineer',
    team: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    href: '#',
  },
  {
    title: 'Customer Success Lead',
    team: 'Operations',
    location: 'Dubai',
    type: 'Full-time',
    href: '#',
  },
];

export const jobsListSchema = defineBlockSchema({
  type: 'jobsList',
  description:
    'Open positions for a careers page: each job has a title, team, location, type and its own link; a message when nothing is open, and an optional open-application link.',
  surfaces: ['site'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Open positions'),
    body: z.string().min(1).max(240).optional(),
    jobs: z
      .array(
        z.object({
          title: z.string().min(1).max(90),
          team: z.string().min(1).max(40).optional(),
          location: z.string().min(1).max(60).optional(),
          type: z.string().min(1).max(30).optional(),
          href: safeHrefSchema.optional(),
        }),
      )
      .max(30)
      .default(defaultJobs),
    /* Shown beside every linked job; one part, edited once. */
    applyLabel: z.string().min(1).max(24).default('Apply'),
    emptyMessage: z.string().min(1).max(160).default('No open roles right now — check back soon.'),
    actionLabel: z.string().min(1).max(40).optional(),
    actionHref: safeHrefSchema.optional(),
    layout: z.enum(jobsListLayouts).default('rows'),
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
    jobs: { tab: 'content', section: 'Positions' },
    applyLabel: { tab: 'content', section: 'Positions' },
    emptyMessage: { tab: 'content', section: 'Positions', kind: 'multiline' },
    actionLabel: { tab: 'content', section: 'Action' },
    actionHref: { tab: 'content', section: 'Action' },
    layout: { tab: 'design', section: 'Layout' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  parts: {
    ...sectionIntroParts,
    jobs: {
      kind: 'list',
      bind: 'jobs',
      label: { en: 'Positions', ar: 'الوظائف' },
      aliases: ['jobs', 'roles', 'openings', 'positions', 'vacancies', 'الوظائف', 'الشواغر'],
    },
    job: {
      kind: 'item',
      bind: 'jobs.*',
      list: 'jobs',
      label: { en: 'Position', ar: 'الوظيفة' },
      aliases: ['job', 'role', 'opening', 'وظيفة', 'شاغر'],
    },
    'job.title': {
      kind: 'link',
      bind: { text: 'jobs.*.title', href: 'jobs.*.href' },
      label: { en: 'Job title', ar: 'المسمى الوظيفي' },
      aliases: ['title', 'role', 'job title', 'المسمى', 'اسم الوظيفة'],
    },
    'job.team': {
      kind: 'text',
      bind: 'jobs.*.team',
      label: { en: 'Team', ar: 'الفريق' },
      aliases: ['team', 'department', 'الفريق', 'القسم'],
    },
    'job.location': {
      kind: 'text',
      bind: 'jobs.*.location',
      label: { en: 'Location', ar: 'الموقع' },
      aliases: ['location', 'city', 'remote', 'الموقع', 'المدينة'],
    },
    'job.type': {
      kind: 'text',
      bind: 'jobs.*.type',
      label: { en: 'Job type', ar: 'نوع الدوام' },
      aliases: ['type', 'full-time', 'part-time', 'contract', 'نوع الدوام', 'دوام'],
    },
    applyLabel: {
      kind: 'text',
      bind: 'applyLabel',
      label: { en: 'Apply label', ar: 'نص التقديم' },
      aliases: ['apply', 'view role', 'تقديم', 'قدّم'],
    },
    emptyMessage: {
      kind: 'text',
      bind: 'emptyMessage',
      label: { en: 'No-openings message', ar: 'رسالة عدم وجود شواغر' },
      aliases: ['empty', 'no jobs', 'لا توجد وظائف'],
      multiline: true,
    },
    action: {
      kind: 'link',
      bind: { text: 'actionLabel', href: 'actionHref' },
      label: { en: 'Button', ar: 'الزر' },
      aliases: ['button', 'open application', 'cta', 'link', 'زر', 'طلب توظيف'],
    },
  },
  examples: jobsListExamples,
});

export type JobsListProps = z.output<typeof jobsListSchema.props>;
