/*
  The lazily loaded Studio assets `build-studio-engines.mjs` builds, and the licences their
  bundles may carry (split from the build script, game libraries 2026-10-12). Each target names
  its entry, the factory its IIFE calls, whether it binds to the page's one Pixi namespace, its
  gzip budget and where its version comes from.
*/

// CC0-1.0 (game libraries, 2026-10-12): a public-domain dedication with no conditions at all;
// @pixi/ui's typed-signals ships under it. Its full text still travels in the banner.
export const ALLOWED_LICENCES = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
]);

export const TARGETS = {
  kit: {
    entry: 'src/studio/kit-entry.ts',
    factory: 'createKitLibrary',
    pixi: true,
    budget: 16_000,
    version: '1.1.0',
    vendored: [
      {
        name: 'webgl-noise',
        version: 'git-22434e0',
        declared: 'MIT',
        licence: 'vendor/webgl-noise/LICENSE',
      },
    ],
  },
  filters: {
    entry: 'src/studio/libs/filters-entry.ts',
    factory: 'createFiltersLibrary',
    pixi: true,
    budget: 30_000,
    versionPackage: 'pixi-filters',
  },
  emitter: {
    entry: 'src/studio/libs/emitter-entry.ts',
    factory: 'createEmitterLibrary',
    pixi: true,
    budget: 14_000,
    version: '1.0.2',
    vendored: [
      {
        name: '@spd789562/particle-emitter',
        version: '1.0.2',
        declared: 'MIT',
        licence: 'vendor/particle-emitter/LICENSE',
      },
    ],
  },
  physics: {
    entry: 'src/studio/libs/physics-entry.ts',
    factory: 'createPhysicsLibrary',
    pixi: false,
    budget: 30_000,
    versionPackage: 'matter-js',
  },
  brush: {
    entry: 'src/studio/libs/brush-entry.ts',
    factory: 'createBrushLibrary',
    pixi: false,
    budget: 4_000,
    versionPackage: 'perfect-freehand',
  },
  rough: {
    entry: 'src/studio/libs/rough-entry.ts',
    factory: 'createRoughLibrary',
    pixi: false,
    budget: 11_000,
    versionPackage: 'roughjs',
  },
  viewport: {
    entry: 'src/studio/libs/viewport-entry.ts',
    factory: 'createViewportLibrary',
    pixi: true,
    budget: 13_000,
    versionPackage: 'pixi-viewport',
  },
  // creative engines (2026-10-12): character animation, effects, dialogue, Ink stories, tile worlds.
  anim: {
    entry: 'src/studio/libs/anim-entry.ts',
    factory: 'createAnimLibrary',
    pixi: false,
    budget: 9_000,
    version: '1.0.0',
  },
  fx: {
    entry: 'src/studio/libs/fx-entry.ts',
    factory: 'createFxLibrary',
    pixi: true,
    budget: 9_000,
    version: '1.0.0',
  },
  dialogue: {
    entry: 'src/studio/libs/dialogue-entry.ts',
    factory: 'createDialogueLibrary',
    pixi: false,
    budget: 12_000,
    version: '1.0.0',
  },
  ink: {
    entry: 'src/studio/libs/ink-entry.ts',
    factory: 'createInkLibrary',
    pixi: false,
    budget: 66_000,
    versionPackage: 'inkjs',
  },
  tilemap: {
    entry: 'src/studio/libs/tilemap-entry.ts',
    factory: 'createTilemapLibrary',
    pixi: true,
    budget: 14_000,
    versionPackage: '@pixi/tilemap',
  },
  // game libraries (2026-10-12): audio (@pixi/sound + zzfx), game AI (yuka), in-canvas HUD (@pixi/ui).
  audio: {
    entry: 'src/studio/libs/audio-entry.ts',
    factory: 'createAudioLibrary',
    pixi: true,
    budget: 18_000,
    versionPackage: '@pixi/sound',
  },
  gameai: {
    entry: 'src/studio/libs/gameai-entry.ts',
    factory: 'createGameAiLibrary',
    pixi: false,
    budget: 22_000,
    versionPackage: 'yuka',
    // yuka ships one ES module whose module-scope scratch math objects carry no pure annotation,
    // so esbuild must keep every class they name (navmesh, goals, fuzzy logic, glTF…). They only
    // allocate; marking them pure lets the unused ~40 % fall away (25.3 → 19.6 kB gzip).
    pureScratch: {
      file: /[\\/]yuka[\\/]build[\\/]yuka\.module\.js$/,
      classes: [
        'AABB',
        'Array',
        'BoundingSphere',
        'LineSegment',
        'Matrix3',
        'Matrix4',
        'OBB',
        'Plane',
        'Quaternion',
        'Ray',
        'SAT',
        'Vector3',
      ],
    },
  },
  hud: {
    entry: 'src/studio/libs/hud-entry.ts',
    factory: 'createHudLibrary',
    pixi: true,
    budget: 27_000,
    versionPackage: '@pixi/ui',
  },
  sound: {
    entry: 'src/sound/entry.ts',
    budget: 10_000,
    version: '1.0.0',
    vendored: [
      {
        name: 'zzfx',
        version: '1.4.0',
        declared: 'MIT',
        licence: 'vendor/zzfx/LICENSE',
      },
    ],
  },
};
