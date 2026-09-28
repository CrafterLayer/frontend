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
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 93,
  activation: { mode: 'explicit' },
  tags: ['content', 'images', 'photos'],
  instructions: `SOURCE: an image address comes only from PHOTOS YOU MAY USE in the context, from the request, or from the region being edited — never from memory, never a placeholder service (placehold, picsum, source.unsplash). An empty list means a type-led page: build the imagery from type, shape and the palette, and name in followUp the photos the owner should add.
HOW MANY, WHERE: the hero carries one photo unless the direction makes it type-led; after it at most one photo per section — a story or about section may take one, a gallery up to six — and never the same photo twice on a page. Choose by subject and alt first, then by aspect: landscape for a full-bleed, framed or split photo; portrait only in a tall column (aspect-3/4); object-top when a face shows.
TEXT ON A PHOTO sits on a darkening layer: img absolute inset-0 -z-10 h-full w-full object-cover under div absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent (or bg-black/60), the text in text-white; a dark-toned photo gets the layer too, and muted text never sits on a photo.
FRAMES: split img aspect-4/3 w-full rounded-3xl object-cover shadow-2xl; framed div overflow-hidden rounded-3xl ring-1 ring-black/10 > img aspect-video w-full object-cover; duotone div bg-{accent} > img grayscale mix-blend-multiply.
ALT: the list's alt in the page language (alt.ar on an Arabic page); alt='' with aria-hidden='true' only for a purely decorative background.
HONEST: a photo whose people value is faces never stands beside an invented name, quote or job title. Sample testimonials and team members carry an initials monogram — span flex size-12 shrink-0 items-center justify-center rounded-full bg-{accent} font-bold text-{on-accent} — and a real person's photo appears only when the request gives it. Religious imagery only on a religious or Ramadan page.`,
  references: {
    'checks/photos.md':
      'Every img src from the PHOTOS list, the request or the edited region; none from memory, no placeholder service; one hero photo at most, no photo repeated; a darkening layer under any text on a photo; alt in the page language; no face beside an invented name — initials instead.',
  },
};
