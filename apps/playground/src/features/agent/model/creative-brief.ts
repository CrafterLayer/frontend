import { planCreativeBrief, type CreativeGenre } from '@craftkit/builder';

import type { CreativeBriefGenre, CreativeBriefView } from './view-types';

/*
  creative agent (2026-10-12): a creative build's brief, as its record shows it.

  The section writers read `planCreativeBrief(request)` as a `data` fragment; the record
  re-derives the same brief from the same request, so what the person sees is what the
  writers were told (cast from the bible aside: the record reads the request alone). The
  planner is deterministic and network-free, so nothing is stored on the turn but its
  `creative` mark, and a reload shows the same card.
*/

/* Compile-time proof the two genre lists are the same set, in both directions. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const GENRES_MATCH: Same<CreativeGenre, CreativeBriefGenre> = true;
void GENRES_MATCH;

/** Effects and weather together, at most this many: the card is a summary, not the brief. */
const EFFECT_LIMIT = 6;

/** The view is rebuilt on every clock tick of a live build; one plan per request is enough. */
const CACHE_LIMIT = 16;
const cache = new Map<string, CreativeBriefView>();

export function creativeBriefView(request: string): CreativeBriefView {
  const cached = cache.get(request);
  if (cached !== undefined) return cached;
  const brief = planCreativeBrief(request);
  const view: CreativeBriefView = {
    genre: brief.genre,
    libs: brief.libs,
    effects: [...brief.effects, ...brief.weather].slice(0, EFFECT_LIMIT),
    cast: brief.cast.map(({ id, name, role, color }) => ({
      id,
      name,
      ...(role === undefined ? {} : { role }),
      ...(color === undefined ? {} : { color }),
    })),
  };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done !== true) cache.delete(oldest.value);
  }
  cache.set(request, view);
  return view;
}
