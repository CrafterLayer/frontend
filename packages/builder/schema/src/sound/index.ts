/*
  The sound vocabulary (pixi-studio DESIGN §C): the built-in bank as data,
  the ZzFX parameter rule and the `data-ck-sound` grammar. Headless and
  dependency-free; the `ck-sound.js` engine bundles it.
*/

export {
  isSoundBankId,
  isSoundRecipeId,
  searchSoundBank,
  SOUND_BANK,
  SOUND_BANK_IDS,
  SOUND_MAQAMS,
  SOUND_RECIPE_IDS,
  SOUND_RECIPE_PARAM_KEYS,
  soundBankEntry,
  soundRecipeParamsProblem,
  type RecipeBankEntry,
  type SoundBankEntry,
  type SoundRecipeId,
  type SoundRecipeParamKey,
  type SoundRecipeParams,
  type ZzfxBankEntry,
} from './sound-bank';
export {
  parseZzfxCall,
  validateZzfxParams,
  ZZFX_DEFAULTS,
  ZZFX_MAX_DURATION_SECONDS,
  ZZFX_MAX_PARAMS,
  ZZFX_MAX_VOLUME,
  ZZFX_PARAM_NAMES,
  zzfxDurationSeconds,
  zzfxParam,
  type ZzfxParamName,
  type ZzfxParams,
} from './zzfx-params';
export {
  parseSoundAttribute,
  parseSoundRef,
  SOUND_ATTRIBUTE_MAX_TOKENS,
  SOUND_TRIGGERS,
  soundAttributeProblem,
  type SoundRefSpec,
  type SoundToken,
  type SoundTrigger,
} from './attribute';
export {
  isRuntimeSoundId,
  isRuntimeZzfxParams,
  parseRuntimeZzfx,
  parseSoundAttributeRuntime,
  runtimeZzfxParam,
  SOUND_PLAYBACK_BANK,
  soundPlaybackEntry,
  type RuntimeZzfxParams,
  type SoundPlaybackEntry,
} from './runtime';
