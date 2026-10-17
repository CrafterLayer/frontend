/* The eight ambient recipes, by bank id (pixi-studio DESIGN §C.1). */
import { desertWind } from './desert-wind';
import type { RecipeTable } from './kit';
import { nightCrickets } from './night-crickets';
import { oceanWaves } from './ocean-waves';
import { oudDrone } from './oud-drone';
import { rain } from './rain';
import { spaceDrone } from './space-drone';
import { warmPad } from './warm-pad';
import { wind } from './wind';

export const RECIPES: RecipeTable = {
  wind,
  rain,
  'ocean-waves': oceanWaves,
  'night-crickets': nightCrickets,
  'space-drone': spaceDrone,
  'warm-pad': warmPad,
  'desert-wind': desertWind,
  'oud-drone': oudDrone,
};

export type { Recipe, RecipeContext, RecipeTuning, RecipeVoice } from './kit';
