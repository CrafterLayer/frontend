/**
 * The renderer's ONE seam onto the Pixi Studio contract (DESIGN §A.1, §B.1).
 *
 * Every renderer file that needs a Studio name — the library keys, which keys bind to Pixi,
 * `declaredLibs` (what a region's code asks for), `fnv1a64` (sound file names) and the `ck.*`
 * reference — imports it from HERE, never from two places.
 *
 * pixi-studio:runtime-wiring (2026-10-10): `schema-library` (wave 1) owns these names in
 * `@craftkit/builder-schema` (`schema/src/studio/**`). When this file was written that package
 * had not landed yet, so the definitions below follow DESIGN §A.1 to the letter; once the schema
 * exports exist, this file becomes plain re-exports of them and nothing else changes.
 */

export const STUDIO_LIB_KEYS = [
  'kit',
  'filters',
  'emitter',
  'physics',
  'brush',
  'rough',
  'viewport',
  'anim',
  'fx',
  'dialogue',
  'ink',
  'tilemap',
  'audio',
  'gameai',
  'hud',
  'peeps',
  'procgen',
  'gif',
  'noise',
  'geom',
  'hex',
] as const;
export type StudioLibKey = (typeof STUDIO_LIB_KEYS)[number];
export const STUDIO_PIXI_BOUND_KEYS: readonly StudioLibKey[] = [
  'kit',
  'filters',
  'emitter',
  'viewport',
  'fx',
  'tilemap',
  'audio',
  'hud',
];

export interface DeclaredLibs {
  readonly libs: StudioLibKey[];
  readonly sound: boolean;
  readonly scene: boolean;
  readonly pixi: boolean;
}

const KNOWN: ReadonlySet<string> = new Set(STUDIO_LIB_KEYS);
const QUOTED = /(['"`])([a-z]+)\1/gu;

function quotedKeys(text: string, into: Set<StudioLibKey>): void {
  for (const match of text.matchAll(QUOTED)) {
    const key = match[2] ?? '';
    if (KNOWN.has(key)) into.add(key as StudioLibKey);
  }
}

/**
 * What a region's code asks for, read from its LITERAL text (DESIGN §A.1, §G): the keys named in
 * `ck.use('a', 'b')` and in any `libs: ['a']` array, whether it builds a scene (`ck.scene(` —
 * which always implies `kit` and Pixi), whether it uses sound (`ck.sound`, `s.sound.play(…)`,
 * `audio: true`), and whether it needs the pixi.js bundle at all.
 */
export function declaredLibs(code: string): DeclaredLibs {
  const libs = new Set<StudioLibKey>();
  for (const match of code.matchAll(/\bck\s*\.\s*use\s*\(([^)]*)\)/gu))
    quotedKeys(match[1] ?? '', libs);
  for (const match of code.matchAll(/\blibs\s*:\s*\[([^\]]*)\]/gu))
    quotedKeys(match[1] ?? '', libs);
  const scene = /\bck\s*\.\s*scene\s*\(/u.test(code);
  if (scene) libs.add('kit');
  const sound =
    /\bck\s*\.\s*sound\b/u.test(code) ||
    /\.\s*sound\s*\.\s*(?:play|ambient|analyser|setMuted)\s*\(/u.test(code) ||
    /\baudio\s*:\s*true\b/u.test(code);
  const ordered = STUDIO_LIB_KEYS.filter((key) => libs.has(key));
  const pixi =
    scene ||
    /pixi|ck\.stage/iu.test(code) ||
    ordered.some((key) => STUDIO_PIXI_BOUND_KEYS.includes(key));
  return { libs: ordered, sound, scene, pixi };
}

/** A 64-bit FNV-1a of the text's UTF-8 bytes, as 16 hex digits (DESIGN §A.1). */
export function fnv1a64(text: string): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (const byte of new TextEncoder().encode(text)) {
    low = (low ^ byte) >>> 0;
    const lowProduct = low * 0x1b3;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    const nextLow = lowProduct >>> 0;
    high = (Math.imul(high, 0x1b3) + Math.imul(low, 0x100) + carry) >>> 0;
    low = nextLow;
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

/**
 * The `ck.*` members a region script receives (DESIGN §B.2), as `CK_API_REFERENCE` names them.
 * The runtime test holds the real `ck` object to every one of them.
 */
export const CK_RUNTIME_NAMES: readonly string[] = [
  'ck.root',
  'ck.editor',
  'ck.reducedMotion',
  'ck.onDispose',
  'ck.pixi',
  'ck.stage',
  'ck.params',
  'ck.use',
  'ck.scene',
  'ck.sound',
  'ck.lang',
  'ck.rtl',
];
