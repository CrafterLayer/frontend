import { HEX_ATLAS_SHA256, HEX_FRAME_SOURCES, HEX_TILE_SIZE } from './hex/atlas.generated';
import {
  HEX_BUILDINGS,
  HEX_LIMITS,
  HEX_NAMES,
  HEX_TERRAINS,
  HEX_WATER_MIX,
  loadHex,
} from './hex/board';

export const HEX_VERSION = '1.0.0';

/** Kenney asks for nothing; we credit anyway, as the pack's notice says it would be nice. */
export const HEX_CREDIT = 'Hexagon Pack by Kenney (www.kenney.nl), CC0 1.0';

/**
 * `s.lib.hex` (hex art, 2026-10-13): 28 tiles of Kenney's Hexagon Pack (CC0 1.0) — five terrains
 * with trees, rocks, cacti and crystals, and eight buildings — bundled as one lossless WebP, plus a
 * seeded pointy-top board in design units that mirrors in RTL, a palette-painted water hex and
 * picking. Plain JavaScript that never imports Pixi: tiles are the scene's own PIXI.Sprite.
 */
export function createHexLibrary() {
  return Object.freeze({
    version: HEX_VERSION,
    credit: HEX_CREDIT,
    limits: HEX_LIMITS,
    tileSize: HEX_TILE_SIZE,
    names: HEX_NAMES,
    terrains: HEX_TERRAINS,
    buildings: HEX_BUILDINGS,
    /** Water hexes are s.palette.mix(accent, surface, waterMix): a sea painted so is seamless. */
    waterMix: HEX_WATER_MIX,
    /** Which frame of kenney-hexagon-pack each tile is, and the atlas hash (provenance). */
    sources: Object.freeze({ ...HEX_FRAME_SOURCES }),
    atlasSha256: HEX_ATLAS_SHA256,
    load: (s: unknown) => loadHex(s),
  });
}
