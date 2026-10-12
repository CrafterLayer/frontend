/*
  zzfx 1.3.2 ships plain JavaScript without types (game libraries, 2026-10-12). Only the members
  `studio/libs/audio/device.ts` reads are declared: its sample builder and the module-scope
  AudioContext it closes. `zzfx()` itself plays through that context and is never called.
*/
declare module 'zzfx' {
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...params: (number | undefined)[]): number[];
  };
  export function zzfx(...params: (number | undefined)[]): AudioBufferSourceNode;
}
