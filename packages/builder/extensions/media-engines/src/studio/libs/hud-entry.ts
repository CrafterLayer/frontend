import { CheckBox, FancyButton, ProgressBar, ScrollBox, Slider } from '@pixi/ui';

import { createHud } from './hud/hud';
import type { HudOptions, HudSceneLike, UiClasses } from './hud/types';
import { HUD_LIMITS } from './hud/widgets';
import type { PixiNamespace } from './shared/pixi-types';

export const HUD_VERSION = '2.3.2';

/**
 * `s.lib.hud` (game libraries, 2026-10-12): @pixi/ui 2 (MIT) widgets for an in-canvas HUD —
 * ProgressBar health/xp bars, Slider, FancyButton, CheckBox, ScrollBox lists and score text —
 * themed from the site tokens, laid out in RTL-aware corners, each mirrored by a native DOM
 * control so every canvas control has a keyboard and screen-reader path. Binds to the page's ONE
 * Pixi namespace; @pixi/ui's tweened button animations are not used (they would add a ticker
 * callback nothing removes).
 */
export function createHudLibrary(PIXI: unknown) {
  const classes = { CheckBox, FancyButton, ProgressBar, ScrollBox, Slider } as unknown as UiClasses;
  return Object.freeze({
    version: HUD_VERSION,
    limits: HUD_LIMITS,
    create: (scene: unknown, options?: HudOptions) =>
      createHud(PIXI as PixiNamespace, classes, scene as HudSceneLike | null | undefined, options),
  });
}
