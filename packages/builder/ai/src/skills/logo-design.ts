import type { AiSkillDefinitionV1 } from './types';

/**
 * An original logo for the person's own business (2026-10-14): a small mark and the name as a
 * wordmark, the mark drawn as inline svg in a custom-code tree from the shapes that tree admits
 * (`CUSTOM_CODE_SVG_TAGS`, packages/builder/schema) and painted in currentColor, so it takes the
 * page's accent. Before this skill a "design a logo" request got the floor and copywriting's
 * slogan rules (copywriting owns «شعار», which also means slogan).
 *
 * Auto on asks to MAKE a logo only: never on «شعار» alone, and never on a strip of other
 * companies' logos, which `craftkit.art-names` serves with verified `logo:` names.
 */
export const LOGO_DESIGN_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.logo-design',
  name: 'Original logo',
  description:
    "The person's own logo: a simple original mark in inline svg and the name as a wordmark, placed in the header and footer brand.",
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 47,
  activation: {
    mode: 'auto',
    intents: ['edit', 'add-section', 'build-page', 'build-site'],
    keywords: [
      'design a logo',
      'design me a logo',
      'design my logo',
      'design our logo',
      'create a logo',
      'make a logo',
      'make me a logo',
      'new logo',
      'logo design',
      'logo for my',
      'logo for our',
      'brand mark',
      'logomark',
      'wordmark',
      'صمم شعار',
      'صمم لي شعار',
      'تصميم شعار',
      'اعمل شعار',
      'سوي شعار',
      'شعار لمقهى',
      'شعار لمحلي',
      'شعار لشركتي',
      'شعار لمشروعي',
      'شعار لمطعمي',
      'شعار لمتجري',
      'صمم لوجو',
      'تصميم لوجو',
      'اعمل لوجو',
      'سوي لوجو',
      'لوجو لشركتي',
      'لوجو لمحلي',
      'لوجو لمشروعي',
      'لوجو لمقهى',
    ],
  },
  tags: ['brand', 'logo', 'svg'],
  instructions: `ORIGINAL LOGO for the person's own business: a simple mark plus the name as a wordmark. Never a lookalike of an existing brand, never a 'logo:' art name, a Simple Icons mark or a library glyph passed off as theirs, never an img.
MARK: one idea from the trade or the name (a cup's steam, a tooth, a key, the first letter cut from a shape) in at most four shapes: svg viewBox='0 0 48 48' aria-hidden='true' class='size-10 shrink-0 text-{accent}' > path, circle, rect, ellipse, polygon, line or g; one linearGradient in defs at most. Paint fill='currentColor', or stroke='currentColor' stroke-width='3' stroke-linecap='round', so the mark takes the accent and flips on a dark band; the person's brand hex (fill='#7c2d12') only when they gave it. No text, use, image or filter in the mark; whole numbers on the 48 grid, centred, 4 units of air each side; it must still read at 16px.
WORDMARK beside it as live text, not svg text: a href='/' aria-label='<name>' class='inline-flex min-h-11 items-center gap-3' > the svg + span class='ck-display text-xl font-bold' with the name exactly as written (a Latin name on an Arabic page in span lang='en' dir='ltr'). A tagline only when given: span text-xs text-text-muted.
WHERE: the header's brand link (first, before the nav) and the footer brand, the same mark in both; a brand or launch hero may repeat it at size-16 above the h1. A kit header's brand slot is text only: there the name stands alone, and followUp offers the mark. Asked for the logo alone: one customCode region "Logo" of div grid gap-6 md:grid-cols-3 > three div rounded-3xl p-8 ring-1 ring-black/5 — the lockup large (mark size-24, name text-4xl) on bg-surface, the mark alone on bg-{accent} text-{on-accent}, the lockup small (mark size-8).
NEVER: a known brand's shape or pose, more than two colours, gradient text, detail that vanishes when small.
FOLLOW-UP: a starting mark to refine with a designer; ask for brand colours or an existing logo file.`,
  references: {
    'checks/logo.md':
      "Mark original, in inline svg of at most four shapes on a 48 grid, painted currentColor (or the given brand hex); the name as live text beside it; the same lockup in header and footer; no logo: name, Simple Icons mark or img as the owner's own.",
  },
};
