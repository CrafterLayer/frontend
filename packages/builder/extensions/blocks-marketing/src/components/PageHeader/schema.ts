import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionAlignments, sectionSpacings, sectionTones, sectionWidths } from '../section-options';
import { pageHeaderExamples } from './examples';

/**
 * The page's header.
 *
 * The option set is deliberately wide, because a header is the one block every
 * site has and the one people most want to look like THEIRS. What keeps that
 * width from becoming noise is the tab split: `content` is what the header
 * SAYS, `design` is what it LOOKS like, and `advanced` is the handful of
 * structural choices most pages never touch.
 *
 * Two rules shape every option below.
 *
 * Colour is a ROLE, never a literal: `packages/builder/schema/src/
 * style-values.ts` refuses hex outright, and that refusal is what lets a whole
 * site be re-themed by re-pointing one token. `kind: 'color-role'` is what tells
 * the inspector to offer the palette — declared by the block, never inferred
 * from a property being called "background".
 *
 * Every size is an ENUM, never a number. A header whose height is `72` is a
 * header that cannot be re-themed and cannot be made denser everywhere at once;
 * `density: 'compact'` resolves through the page's own tokens, so a theme moves
 * every header ever authored.
 */

/** How the three regions — brand, navigation, actions — are arranged. */
export const headerLayouts = ['split', 'centered', 'stacked', 'navStart'] as const;

/** The bar's vertical generosity. */
export const headerDensities = ['compact', 'regular', 'tall'] as const;

export const headerBorders = ['none', 'bottom'] as const;
export const headerShadows = ['none', 'soft', 'strong'] as const;
export const navStyles = ['plain', 'underline', 'pill'] as const;
export const textCases = ['normal', 'uppercase'] as const;
export const textWeights = ['regular', 'medium', 'semibold'] as const;
export const actionStyles = ['solid', 'outline', 'ghost'] as const;
export const controlSizes = ['sm', 'md', 'lg'] as const;
export const brandSizes = ['sm', 'md', 'lg'] as const;

const link = z.object({
  label: z.string().min(1).max(24),
  href: z.string().min(1).max(200),
});

export const pageHeaderSchema = defineBlockSchema({
  type: 'pageHeader',
  description:
    'The bar at the top of a page: a wordmark, optional navigation links, and up to two actions. One per page, above everything else.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    // ── What it says ────────────────────────────────────────────────────────
    brand: z.string().min(1).max(40).default('Your brand'),
    brandHref: z.string().max(200).optional(),
    tagline: z.string().max(80).optional(),
    links: z.array(link).max(8).default([]),
    actionLabel: z.string().max(24).optional(),
    actionHref: z.string().max(200).optional(),
    secondaryActionLabel: z.string().max(24).optional(),
    secondaryActionHref: z.string().max(200).optional(),

    // ── What it looks like ──────────────────────────────────────────────────
    layout: z.enum(headerLayouts).default('split'),
    density: z.enum(headerDensities).default('regular'),
    brandSize: z.enum(brandSizes).default('md'),
    navStyle: z.enum(navStyles).default('plain'),
    navCase: z.enum(textCases).default('normal'),
    navWeight: z.enum(textWeights).default('medium'),
    actionStyle: z.enum(actionStyles).default('solid'),
    actionSize: z.enum(controlSizes).default('md'),
    border: z.enum(headerBorders).default('none'),
    shadow: z.enum(headerShadows).default('none'),
    ...sectionColorProps,
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('sm'),
    width: z.enum(sectionWidths).default('wide'),

    // ── Structural ──────────────────────────────────────────────────────────
    sticky: z.boolean().default(false),
    /*
      Only meaningful while `sticky`. Kept as its own property rather than folded
      into a `stickyStyle` enum because a person reaches for "make it see
      through" without first deciding it is a sticky-header concern.
    */
    translucent: z.boolean().default(false),
  }),
  propertyGroups: {
    brand: { tab: 'content', section: 'Brand' },
    brandHref: { tab: 'content', section: 'Brand' },
    tagline: { tab: 'content', section: 'Brand' },
    links: { tab: 'content', section: 'Navigation' },
    actionLabel: { tab: 'content', section: 'Actions' },
    actionHref: { tab: 'content', section: 'Actions' },
    secondaryActionLabel: { tab: 'content', section: 'Actions' },
    secondaryActionHref: { tab: 'content', section: 'Actions' },

    layout: { tab: 'design', section: 'Layout' },
    density: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    width: { tab: 'design', section: 'Layout' },
    brandSize: { tab: 'design', section: 'Brand' },
    navStyle: { tab: 'design', section: 'Navigation' },
    navCase: { tab: 'design', section: 'Navigation' },
    navWeight: { tab: 'design', section: 'Navigation' },
    actionStyle: { tab: 'design', section: 'Actions' },
    actionSize: { tab: 'design', section: 'Actions' },
    ...sectionColorGroups,
    tone: { tab: 'design', section: 'Colour' },
    border: { tab: 'design', section: 'Edge' },
    shadow: { tab: 'design', section: 'Edge' },
    spacing: { tab: 'design', section: 'Spacing' },

    sticky: { tab: 'advanced', section: 'Behaviour' },
    translucent: { tab: 'advanced', section: 'Behaviour' },
  },
  inlineEditable: 'brand',
  examples: pageHeaderExamples,
});

export type PageHeaderProps = z.output<typeof pageHeaderSchema.props>;
