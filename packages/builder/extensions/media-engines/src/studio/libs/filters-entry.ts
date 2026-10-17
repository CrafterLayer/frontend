import {
  AdvancedBloomFilter,
  AsciiFilter,
  ColorMapFilter,
  CRTFilter,
  DotFilter,
  GlitchFilter,
  GlowFilter,
  GodrayFilter,
  KawaseBlurFilter,
  OldFilmFilter,
  RGBSplitFilter,
  ShockwaveFilter,
  TiltShiftFilter,
  TwistFilter,
  ZoomBlurFilter,
} from 'pixi-filters';

/** The reviewed Pixi v8-compatible filter surface exposed to authored scenes. */
export function createFiltersLibrary() {
  return Object.freeze({
    AdvancedBloomFilter,
    AsciiFilter,
    ColorMapFilter,
    CRTFilter,
    DotFilter,
    GlitchFilter,
    GlowFilter,
    GodrayFilter,
    KawaseBlurFilter,
    OldFilmFilter,
    RGBSplitFilter,
    ShockwaveFilter,
    TiltShiftFilter,
    TwistFilter,
    ZoomBlurFilter,
  });
}
