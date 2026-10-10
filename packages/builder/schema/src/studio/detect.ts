import { STUDIO_LIB_KEYS, STUDIO_PIXI_BOUND_KEYS, type StudioLibKey } from './types';

export { STUDIO_LIB_KEYS, STUDIO_PIXI_BOUND_KEYS };

/**
 * What a region script needs loaded (pixi-studio DESIGN.md §A.1, §B.1, §G).
 *
 * ONE implementation, imported by the renderer (editor loaders and the static
 * export) and by the agent's door: the export emits exactly the assets this
 * says, so a page without `ck.scene`, `ck.use`, `ck.sound` or a pixi call
 * emits nothing new (§G.1).
 *
 * It reads the code LITERALLY — `ck.use('physics')`, `libs: ['filters']` —
 * which is why the scene API documentation tells authors to write the keys as
 * literals. A computed key (`ck.use(name)`) is invisible here; `scriptCodeIssues`
 * warns about it.
 */
export interface DeclaredLibs {
  /** Known keys the code loads, in `STUDIO_LIB_KEYS` order. */
  libs: StudioLibKey[];
  /** `ck.sound`, `audio: true`, `zzfx(` or a `.sound.play(` call. */
  sound: boolean;
  /** `ck.scene(` — implies `pixi` and `kit`. */
  scene: boolean;
  /** Today's pixi rule (`/pixi|ck\.stage/i`), the scene API, or a Pixi-bound library. */
  pixi: boolean;
}

export interface LibKeyScan {
  /** Literal keys that are known, de-duplicated, in `STUDIO_LIB_KEYS` order. */
  known: StudioLibKey[];
  /** Literal keys that are not library keys, in first-seen order. */
  unknown: string[];
  /** A `ck.use(…)` or `libs: […]` whose arguments are not all string literals. */
  dynamic: boolean;
}

const USE_CALL = /\bck\s*\.\s*use\s*\(([^()]*)\)/gu;
const LIBS_ARRAY = /\blibs\s*:\s*\[([^\]]*)\]/gu;
const STRING_LITERAL = /(['"`])([^'"`\\$\n]*)\1/gu;
const ONLY_LITERALS = /^(?:\s*(['"`])[^'"`\\$\n]*\1\s*,?)*\s*$/u;

const SCENE_CALL = /\bck\s*\.\s*scene\s*\(/u;
const PIXI_RULE = /pixi|ck\.stage/iu;
const SOUND_RULE =
  /\bck\s*\.\s*sound\b|\baudio\s*:\s*true\b|\bzzfx\s*\(|\.sound\s*\.\s*(?:play|ambient|analyser|setMuted)\s*\(/u;

function isLibKey(value: string): value is StudioLibKey {
  return (STUDIO_LIB_KEYS as readonly string[]).includes(value);
}

/** Every literal library key the code names, split into known and unknown. */
export function scanLibKeys(code: string): LibKeyScan {
  const known = new Set<StudioLibKey>();
  const unknown: string[] = [];
  let dynamic = false;
  const visit = (args: string): void => {
    if (!ONLY_LITERALS.test(args)) dynamic = true;
    for (const match of args.matchAll(STRING_LITERAL)) {
      const key = (match[2] ?? '').trim();
      if (key === '') continue;
      if (isLibKey(key)) {
        known.add(key);
      } else if (!unknown.includes(key)) {
        unknown.push(key);
      }
    }
  };
  for (const match of code.matchAll(USE_CALL)) visit(match[1] ?? '');
  for (const match of code.matchAll(LIBS_ARRAY)) visit(match[1] ?? '');
  return { known: STUDIO_LIB_KEYS.filter((key) => known.has(key)), unknown, dynamic };
}

/** What the code loads: `{ libs, sound, scene, pixi }` (§A.1). */
export function declaredLibs(code: string): DeclaredLibs {
  const scene = SCENE_CALL.test(code);
  const libs = new Set<StudioLibKey>(scanLibKeys(code).known);
  if (scene) libs.add('kit');
  const ordered = STUDIO_LIB_KEYS.filter((key) => libs.has(key));
  const pixi =
    scene || PIXI_RULE.test(code) || ordered.some((key) => STUDIO_PIXI_BOUND_KEYS.includes(key));
  return { libs: ordered, sound: SOUND_RULE.test(code), scene, pixi };
}
