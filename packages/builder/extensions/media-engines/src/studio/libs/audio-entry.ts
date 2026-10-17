import { createAudio } from './audio/audio';
import { createPixiSoundBackend } from './audio/device';
import { AUDIO_LIMITS } from './audio/load';
import { presetOf, SFX_PRESET_NAMES } from './audio/presets';
import type { AudioOptions, AudioSceneLike } from './audio/types';
import { admittedMediaUrl } from './shared/media-url';

export const AUDIO_VERSION = '6.0.1';

/**
 * `s.lib.audio` (game libraries, 2026-10-12): @pixi/sound 6 (MIT) for music and voice from
 * admitted URLs, ZzFX (MIT) for procedural sound effects with no files, behind one scene-owned
 * controller: gesture-gated start, an accessible bilingual mute toggle whenever music plays,
 * pause on a hidden page, bounded tracks and voices, honest silent fallback and full disposal.
 * The sound engines load only on the first gesture inside the scene; @pixi/sound reaches the
 * page's ONE Pixi namespace.
 */
export function createAudioLibrary() {
  const backend = createPixiSoundBackend();
  return Object.freeze({
    version: AUDIO_VERSION,
    limits: AUDIO_LIMITS,
    presets: SFX_PRESET_NAMES,
    /** A preset's ZzFX parameters (a copy), e.g. to vary it: [...s.lib.audio.params('coin')]. */
    params: (name: string): (number | undefined)[] | undefined => {
      const found = presetOf(name);
      return found === undefined ? undefined : [...found];
    },
    /** True when `url` is a music URL the scene may load (https:, data:audio/ or blob:). */
    admits: (url: unknown): boolean => admittedMediaUrl(url, 'audio') !== undefined,
    create: (scene: unknown, options?: AudioOptions) =>
      createAudio(backend, scene as AudioSceneLike | null | undefined, options),
  });
}
