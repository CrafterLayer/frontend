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

// Budgets (performance pass, 2026-10-12): the measured gzip size plus 5 %, rounded up to 100 bytes,
// and never above the budget each target had before; studio-sources.test.ts holds the same numbers.
export const TARGETS = {
  kit: {
    entry: 'src/studio/kit-entry.ts',
    factory: 'createKitLibrary',
    pixi: true,
    budget: 15_800,
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
    budget: 24_900,
    versionPackage: 'pixi-filters',
  },
  // particles and physics (2026-10-13): 12,000 → 17,400. The asset now carries 13 tuned,
  // theme-aware presets (fire … embers), their config builder, the procedural texture atlas, the
  // spawn/burst lifecycle and two behaviours on top of the unchanged upstream emitter: measured
  // 16,545 bytes gzip (was 11,364), + 5 % rounded up to 100 bytes. physics stays at 29,500 with
  // world(s) inside it (29,424).
  emitter: {
    entry: 'src/studio/libs/emitter-entry.ts',
    factory: 'createEmitterLibrary',
    pixi: true,
    budget: 17_400,
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
    budget: 29_500,
    versionPackage: 'matter-js',
  },
  brush: {
    entry: 'src/studio/libs/brush-entry.ts',
    factory: 'createBrushLibrary',
    pixi: false,
    budget: 3_500,
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
    budget: 6_500,
    version: '1.0.0',
  },
  fx: {
    entry: 'src/studio/libs/fx-entry.ts',
    factory: 'createFxLibrary',
    pixi: true,
    budget: 5_400,
    version: '1.0.0',
  },
  dialogue: {
    entry: 'src/studio/libs/dialogue-entry.ts',
    factory: 'createDialogueLibrary',
    pixi: false,
    budget: 9_700,
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
    budget: 11_400,
    versionPackage: '@pixi/tilemap',
  },
  // game libraries (2026-10-12): audio (@pixi/sound + zzfx), game AI (yuka), in-canvas HUD (@pixi/ui).
  audio: {
    entry: 'src/studio/libs/audio-entry.ts',
    factory: 'createAudioLibrary',
    pixi: true,
    budget: 16_900,
    versionPackage: '@pixi/sound',
  },
  gameai: {
    entry: 'src/studio/libs/gameai-entry.ts',
    factory: 'createGameAiLibrary',
    pixi: false,
    budget: 21_800,
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
    budget: 26_500,
    versionPackage: '@pixi/ui',
  },
  // character art (2026-10-13): Open Peeps people (design CC0 1.0) through DiceBear's open-peeps
  // style and core (MIT). Nearly all of it is the hand-drawn SVG path data of 48 hair styles and 30
  // faces, which is why it is the largest lazy library; only scenes listing 'peeps' load it.
  peeps: {
    entry: 'src/studio/libs/peeps-entry.ts',
    factory: 'createPeepsLibrary',
    pixi: false,
    budget: 116_900,
    versionPackage: '@dicebear/open-peeps',
  },
  // procedural maps (2026-10-13): rot.js (BSD-3-Clause) dungeons, caves and mazes, imported module
  // by module (six generators, the RNG and precise shadowcasting; rot's display, scheduler, noise
  // and A* stay out), plus first-party BFS, scatter, tilemap rows and a Graphics drawer. Measured
  // 11,745 bytes gzip; budget + 5 % rounded up to 100 bytes.
  procgen: {
    entry: 'src/studio/libs/procgen-entry.ts',
    factory: 'createProcgenLibrary',
    pixi: false,
    budget: 12_400,
    versionPackage: 'rot-js',
  },
  // animated GIFs (2026-10-13): gifuct-js (MIT) decodes, first-party compositing and a sprite on
  // the scene's own PIXI.Sprite; plain, so it never waits for or bundles Pixi. Measured 7,480.
  gif: {
    entry: 'src/studio/libs/gif-entry.ts',
    factory: 'createGifLibrary',
    pixi: false,
    budget: 7_900,
    versionPackage: 'gifuct-js',
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
