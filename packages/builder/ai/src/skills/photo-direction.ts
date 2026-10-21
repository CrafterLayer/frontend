import type { AiSkillDefinitionV1 } from './types';

/**
 * How to use a photo, now that the model is handed real ones.
 *
 * The catalog itself arrives as DATA — the `craftkit.photo-catalog` context
 * provider's "PHOTOS YOU MAY USE" fragment, filtered by the brief — because a
 * skill reference is sent whole on every request and seventy-eight photos
 * would outweigh any skill. This skill is only the rules for what arrives:
 * where a photo goes, how text sits on it, and the one honesty rule the
 * recorded answers broke most (10 of 14 photos were stock portraits beside
 * invented Arabic customer names, measured 2026-09-28).
 *
 * Explicit-only: the orchestrator selects it for every section writer and for
 * whole-page runs, together with the provider. A skill that promised photos
 * with no provider behind it would be an instruction to invent URLs.
 */
export const PHOTO_DIRECTION_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.photo-direction',
  name: 'Photo direction',
  description:
    'Photos only from the verified list the context carries: where they go, how many, how text sits on them, and no stock face beside an invented name.',
  version: '1.3.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 93,
  activation: { mode: 'explicit' },
  tags: ['content', 'images', 'photos'],
  // The ART lines moved to their own auto skill (2026-10-14); every writer still carries them.
  dependencies: ['craftkit.art-names'],
  instructions: `SOURCE: an image address comes only from PHOTOS YOU MAY USE in the context, from the request, from the region being edited, or an art name — never from memory, never a placeholder service (placehold, picsum, source.unsplash). An empty list means a type-led page: build the imagery from type, shape and the palette, and name in followUp the photos the owner should add.
COMPOSITION: choose image count, crop, aspect, reuse and placement from the supplied content and brief. Type-led screens may need none; a collection may need many. Do not impose one hero photo, a per-section quota, portrait columns or a prescribed frame. Repeat an image only when its content role warrants it.
TEXT ON IMAGERY: keep text readable against the actual image. Choose an adequate contrast layer, solid caption, separate text panel or a clear image area; a dark overlay and white text are options, not mandatory styling. Preserve subject visibility and meaningful cropping.
FRAMES: radius, shadow, borders, full-bleed crops and duotone follow the page's visual direction; choose the frame rather than a universal radius or shadow.
ALT: the list's alt in the page language (alt.ar on an Arabic page); alt='' with aria-hidden='true' only for a purely decorative background.
HONEST: a photo whose people value is faces never stands beside an invented name, quote or job title. Sample testimonials and team members carry an initials monogram — span flex size-12 shrink-0 items-center justify-center rounded-full bg-{accent} font-bold text-{on-accent} — or a cartoon character, and a real person's photo appears only when the request gives it. Religious imagery only on a religious or Ramadan page.`,
  references: {
    'checks/photos.md':
      'Every img src from the PHOTOS list, the request, the edited region or an art name; no placeholder service; content-led image count/crop/reuse and frame; readable text against the actual image; alt in the page language; initials or a character, never a face, beside an invented name.',
  },
};
