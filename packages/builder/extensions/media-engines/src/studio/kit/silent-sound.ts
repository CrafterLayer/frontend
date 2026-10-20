import type { SceneAudioBands, SceneSound } from './types';

export const SILENT_BANDS: Readonly<SceneAudioBands> = Object.freeze({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: false,
  active: false,
});

/** ck.sound when the host has none (older runtimes, tests): every call is a silent no-op. */
export const SILENT_SOUND: SceneSound = Object.freeze({
  play(): boolean {
    return false;
  },
  ambient(): () => void {
    return function stop(): void {
      /* nothing plays */
    };
  },
  analyser(): SceneAudioBands {
    return { ...SILENT_BANDS };
  },
  muted: true,
  unlocked: false,
  setMuted(): void {
    /* silent */
  },
  onChange(): void {
    /* silent */
  },
});
