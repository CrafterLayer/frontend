/**
 * Builders for the set-B builtin scene presets (pixi-studio DESIGN.md §B.3, 2026-10-10).
 *
 * Set B is the interactive half of the builtin library: pointer, touch and scroll, particles and
 * light, physics, photo murals, audio-reactive scenes and metaballs. Every preset is a
 * `ScriptEntry` written by CraftKit — author 'craftkit', trust 'trusted', licence MIT, version 1,
 * kind 'scene', one still frame under reduced motion — so each file keeps only what is its own:
 * names, tags, libraries, its own params and its code.
 *
 * The code of every preset is plain JavaScript against the stable scene API (§B.2). It starts with
 * `const p = ck.params({...})` and `const s = await ck.scene({...})`, writes its library keys
 * literally (the export finds them by reading the code), keeps motion inside `s.tick`, scales its
 * counts through `s.count`, mirrors flow with `s.dir`, draws from `s.palette`, and releases
 * whatever it made outside `s` through `s.dispose`.
 */
import type {
  Bilingual,
  ScriptEntry,
  ScriptParamSpec,
  ScriptParamValue,
  StudioLibKey,
} from '@craftkit/builder-schema';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_B_SAVED_AT = '2026-10-10T00:00:00.000Z';

type Group = NonNullable<ScriptParamSpec['group']>;

function label(en: string, ar: string): Bilingual {
  return { en, ar };
}

/** A slider. */
export function range(
  key: string,
  en: string,
  ar: string,
  value: number,
  min: number,
  max: number,
  step: number,
  group: Group = 'look',
): ScriptParamSpec {
  return { key, type: 'range', label: label(en, ar), default: value, min, max, step, group };
}

/** A switch. */
export function toggle(
  key: string,
  en: string,
  ar: string,
  value: boolean,
  group: Group = 'look',
): ScriptParamSpec {
  return { key, type: 'toggle', label: label(en, ar), default: value, group };
}

/** A free text field. Scripts split it by WORDS only (`s.words`), so Arabic stays joined. */
export function text(
  key: string,
  en: string,
  ar: string,
  value: string,
  group: Group = 'look',
  help?: Bilingual,
): ScriptParamSpec {
  return {
    key,
    type: 'text',
    label: label(en, ar),
    default: value,
    group,
    ...(help === undefined ? {} : { help }),
  };
}

/** A picture: an https URL, a data URL or a site asset id (resolved at insert time). */
export function image(key: string, en: string, ar: string, value: string): ScriptParamSpec {
  return { key, type: 'image', label: label(en, ar), default: value, group: 'look' };
}

/** A closed choice. `options` are [value, en, ar]. */
export function select(
  key: string,
  en: string,
  ar: string,
  value: string,
  options: readonly (readonly [string, string, string])[],
  group: Group = 'look',
): ScriptParamSpec {
  return {
    key,
    type: 'select',
    label: label(en, ar),
    default: value,
    options: options.map(([optionValue, optionEn, optionAr]) => ({
      value: optionValue,
      label: label(optionEn, optionAr),
    })),
    group,
  };
}

/**
 * The opt-in sound switch of the two presets that may click (confetti, pendulum). Off by default:
 * a preset never makes a sound unless the person turned this on AND a visitor's gesture came first.
 */
export function soundToggle(): ScriptParamSpec {
  return {
    key: 'sound',
    type: 'toggle',
    label: label('Sound effects', 'المؤثرات الصوتية'),
    default: false,
    group: 'sound',
    help: label(
      'Muted by default; plays only after a visitor taps and turns sound on.',
      'مكتوم افتراضياً، ولا يعمل إلا بعد أن يلمس الزائر الصفحة ويشغّل الصوت.',
    ),
  };
}

/** The ambient bed an audio-reactive preset may ask for; 'none' listens to whatever the page plays. */
export function bedSelect(): ScriptParamSpec {
  return {
    ...select(
      'bed',
      'Ambient bed',
      'خلفية صوتية',
      'none',
      [
        ['none', 'None (react to the page)', 'بلا (يتفاعل مع صوت الصفحة)'],
        ['warm-pad', 'Warm pad', 'وسادة دافئة'],
        ['space-drone', 'Space drone', 'طنين فضائي'],
        ['ocean-waves', 'Ocean waves', 'أمواج البحر'],
        ['oud-drone', 'Oud drone', 'طنين العود'],
      ],
      'sound',
    ),
    help: label(
      'Starts only after the visitor turns sound on; never under reduced motion.',
      'لا يبدأ إلا بعد أن يشغّل الزائر الصوت، ولا يعمل مع تقليل الحركة.',
    ),
  };
}

export interface SharedParamOptions {
  seed: number;
  speed?: number;
  density?: number;
  /** Every set-B preset reacts to the pointer; false hides the switch. */
  interactive?: boolean;
}

/**
 * The params every preset shares (§B.3): palette, seed, speed, density and, where the scene reacts
 * to the pointer, interactive. The labels match set A so the Studio form reads the same.
 */
export function sharedParams(options: SharedParamOptions): ScriptParamSpec[] {
  const shared: ScriptParamSpec[] = [
    {
      key: 'palette',
      type: 'palette',
      label: label('Palette', 'لوحة الألوان'),
      default: 'theme',
      group: 'look',
      help: label('Theme colours, or up to six of your own.', 'ألوان القالب، أو حتى ستة ألوان من اختيارك.'),
    },
    {
      key: 'seed',
      type: 'number',
      label: label('Seed', 'البذرة'),
      default: options.seed,
      min: 1,
      max: 9999,
      step: 1,
      group: 'look',
      help: label('Same seed, same picture.', 'البذرة نفسها تعطي الصورة نفسها.'),
    },
    range('speed', 'Speed', 'السرعة', options.speed ?? 1, 0, 3, 0.05, 'motion'),
    range('density', 'Density', 'الكثافة', options.density ?? 1, 0.2, 2, 0.05, 'look'),
  ];
  if (options.interactive !== false) {
    shared.push(toggle('interactive', 'React to pointer', 'التفاعل مع المؤشر', true, 'interaction'));
  }
  return shared;
}

export interface PresetDefinition {
  id: string;
  name: Bilingual;
  description: Bilingual;
  tags: string[];
  /** Equal to `declaredLibs(code).libs`: always 'kit' (ck.scene implies it) plus the literal keys. */
  libs: StudioLibKey[];
  /** The code uses `ck.sound` or `audio: true`. */
  sound?: boolean;
  params: ScriptParamSpec[];
  code: string;
}

/** A builtin set-B preset as a ScriptEntry. */
export function definePreset(definition: PresetDefinition): ScriptEntry {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    tags: definition.tags,
    kind: 'scene',
    code: definition.code.trim(),
    params: definition.params,
    libs: definition.libs,
    sound: definition.sound ?? false,
    reducedMotion: 'still',
    version: 1,
    author: 'craftkit',
    trust: 'trusted',
    licence: 'MIT',
    createdAt: SET_B_SAVED_AT,
    updatedAt: SET_B_SAVED_AT,
  };
}

/** The default value of each param, keyed (tests compare it with what `ck.params` received). */
export function paramDefaults(entry: ScriptEntry): Record<string, ScriptParamValue> {
  return Object.fromEntries(entry.params.map((spec) => [spec.key, spec.default]));
}

/**
 * Verified photo-catalog pictures with no faces (ai/src/context/providers/photo-catalog.data.ts,
 * Pexels License, each fetched and looked at on 2026-09-28). Preset defaults only; a person's own
 * image replaces them through the `image` / `images` param.
 */
export const SET_B_PHOTOS = {
  /** Hotel pool overlooking the sea at sunset. */
  poolSea:
    'https://images.pexels.com/photos/261327/pexels-photo-261327.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Ad-Deir monastery at Petra. */
  petraDeir:
    'https://images.pexels.com/photos/23124407/pexels-photo-23124407.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Rock-cut tomb in Petra, Jordan. */
  petraTomb:
    'https://images.pexels.com/photos/720254/pexels-photo-720254.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Wadi Rum desert at golden hour. */
  wadiRum:
    'https://images.pexels.com/photos/28086996/pexels-photo-28086996.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Sunlit path through an olive grove. */
  oliveGrove:
    'https://images.pexels.com/photos/33168420/pexels-photo-33168420.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Young plantation rows under a mountain sky. */
  plantation:
    'https://images.pexels.com/photos/5283373/pexels-photo-5283373.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Dubai skyline at night with busy roads. */
  dubaiNight:
    'https://images.pexels.com/photos/13256066/pexels-photo-13256066.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Burj Khalifa lit up at night. */
  burjNight:
    'https://images.pexels.com/photos/3230927/pexels-photo-3230927.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Construction cranes silhouetted at dusk. */
  cranesDusk:
    'https://images.pexels.com/photos/29174068/pexels-photo-29174068.jpeg?auto=compress&cs=tinysrgb&w=1600',
  /** Burj Khalifa against the night sky. */
  burjSky:
    'https://images.pexels.com/photos/31747295/pexels-photo-31747295.jpeg?auto=compress&cs=tinysrgb&w=1600',
} as const;
