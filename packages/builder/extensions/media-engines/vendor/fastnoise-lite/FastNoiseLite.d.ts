/*
  Types for the vendored FastNoiseLite.js (fastnoise-lite 1.1.1, MIT; see PROVENANCE.md), which
  ships none. Only what src/studio/libs/noise/fast.ts calls is declared.
*/
export default class FastNoiseLite {
  static readonly NoiseType: Readonly<{
    OpenSimplex2: string;
    OpenSimplex2S: string;
    Cellular: string;
    Perlin: string;
    ValueCubic: string;
    Value: string;
  }>;
  static readonly FractalType: Readonly<{
    None: string;
    FBm: string;
    Ridged: string;
    PingPong: string;
    DomainWarpProgressive: string;
    DomainWarpIndependent: string;
  }>;
  constructor(seed?: number);
  SetSeed(seed: number): void;
  SetFrequency(frequency: number): void;
  SetNoiseType(noiseType: string): void;
  SetFractalType(fractalType: string): void;
  GetNoise(x: number, y: number, z?: number): number;
}
