import type { BlockPartDecl, BlockPropertyGroup } from '@craftkit/builder-schema';

import { sectionColorGroups } from './section-color';
import { sectionCustomGroups } from './section-custom';
import { sectionMotionGroups } from './section-motion';
import { sectionSpacingGroups } from './section-spacing';
import { sectionTypographyGroups } from './section-typography';

/**
 * The introduction most sections open with — an eyebrow, the heading that names
 * the section, a body line — as part declarations and Inspector rows, plus the
 * shared design rows. Spelled once for the blocks added on 2026-10-13 (the
 * older blocks keep their own identical copies). Schema-safe: no React.
 */
export const sectionIntroParts = {
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
} as const satisfies Readonly<Record<string, BlockPartDecl>>;

export const sectionIntroGroups = {
  eyebrow: { tab: 'content', section: 'Introduction' },
  heading: { tab: 'content', section: 'Introduction' },
  body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
} as const satisfies Readonly<Record<string, BlockPropertyGroup>>;

/** Alignment, tone, spacing and width rows, then every shared design and advanced row. */
export const sectionDesignGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  align: { tab: 'design', section: 'Alignment' },
  tone: { tab: 'design', section: 'Colour' },
  spacing: { tab: 'design', section: 'Spacing' },
  width: { tab: 'design', section: 'Width' },
  ...sectionColorGroups,
  ...sectionMotionGroups,
  ...sectionCustomGroups,
  ...sectionTypographyGroups,
  ...sectionSpacingGroups,
};
