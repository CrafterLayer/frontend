/**
 * Pixi Studio builtin scene presets, set F (mural stories, 2026-10-14): illustrated murals that
 * tell a short story across a wide panorama on one `s.lib.anim` timeline — a desert caravan from
 * dawn to an oasis, a fishing village's day, a seed that becomes a forest and an old souq waking
 * up. Like sets D and E, the mural playbook names them and they stay out of the cached tool menu;
 * `scene.preset` applies any of them in one call.
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { DESERT_CARAVAN } from './desert-caravan';
import { FISHING_VILLAGE } from './fishing-village';
import { SEED_TO_FOREST } from './seed-to-forest';
import { SOUQ_MORNING } from './souq-morning';

/** The set-F presets and their categories, in catalogue order. */
export const PRESETS_SET_F: readonly (readonly [ScriptEntry, 'mural'])[] = [
  [DESERT_CARAVAN, 'mural'],
  [FISHING_VILLAGE, 'mural'],
  [SEED_TO_FOREST, 'mural'],
  [SOUQ_MORNING, 'mural'],
];

export { DESERT_CARAVAN, FISHING_VILLAGE, SEED_TO_FOREST, SOUQ_MORNING };
