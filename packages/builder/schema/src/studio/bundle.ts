import { fnv1a64 } from './hash';
import { ckScriptsBundleSchema, STUDIO_LIMITS } from './schemas';
import type { CkScriptsBundle, ScriptEntry, SoundEntry } from './types';

export { ckScriptsBundleSchema };

/**
 * The `.ckscripts.json` bundle (pixi-studio DESIGN.md §A.1, §A.3, §F): how a
 * person carries their scripts and sounds between projects and browsers.
 *
 * Import is a trust boundary. Whatever a bundle says about itself, every
 * imported script lands `unreviewed` — it can be read and previewed in the
 * sandbox, never run on the canvas or inserted, until the person clicks Trust.
 */

export const CKSCRIPTS_FORMAT = 'craftkit.scripts';

/** The checksum key of a script or a sound inside `checksums`. */
export function ckScriptsChecksumKey(kind: 'script' | 'sound', id: string): string {
  return `${kind}:${id}`;
}

function soundChecksum(sound: SoundEntry): string {
  return fnv1a64(JSON.stringify(sound.source));
}

/** A bundle for `scripts` and `sounds`, checksummed. */
export function buildCkScriptsBundle(input: {
  scripts: readonly ScriptEntry[];
  sounds?: readonly SoundEntry[] | undefined;
  assets?: CkScriptsBundle['assets'];
  /** ISO instant from the caller's clock. */
  exportedAt: string;
}): CkScriptsBundle {
  const checksums: Record<string, string> = {};
  for (const script of input.scripts) {
    checksums[ckScriptsChecksumKey('script', script.id)] = fnv1a64(script.code);
  }
  for (const sound of input.sounds ?? []) {
    checksums[ckScriptsChecksumKey('sound', sound.id)] = soundChecksum(sound);
  }
  const bundle: CkScriptsBundle = {
    format: CKSCRIPTS_FORMAT,
    version: 1,
    exportedAt: input.exportedAt,
    scripts: [...input.scripts],
    sounds: [...(input.sounds ?? [])],
    checksums,
  };
  if (input.assets !== undefined && Object.keys(input.assets).length > 0) {
    bundle.assets = input.assets;
  }
  return bundle;
}

export type CkScriptsParseResult =
  | { ok: true; bundle: CkScriptsBundle }
  | { ok: false; problems: string[] };

/**
 * Parse and check a `.ckscripts.json` text: size cap (8 MB) before parsing,
 * JSON, the zod shape, then every checksum. A bundle that fails any of these
 * is refused whole, with the reasons.
 */
export function parseCkScriptsBundle(text: string): CkScriptsParseResult {
  // UTF-16 length is a lower bound on UTF-8 bytes; good enough to refuse a monster before parsing.
  if (text.length > STUDIO_LIMITS.bundleBytes) {
    return { ok: false, problems: ['The file is larger than 8 MB.'] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The file is not JSON.'] };
  }
  const parsed = ckScriptsBundleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues
        .slice(0, 12)
        .map((entry) => `${entry.path.map(String).join('.') || 'bundle'}: ${entry.message}`),
    };
  }
  const bundle = parsed.data;
  const problems: string[] = [];
  for (const script of bundle.scripts) {
    const key = ckScriptsChecksumKey('script', script.id);
    if (bundle.checksums[key] !== fnv1a64(script.code)) {
      problems.push(`Script "${script.id}" does not match its checksum.`);
    }
  }
  for (const sound of bundle.sounds) {
    const key = ckScriptsChecksumKey('sound', sound.id);
    if (bundle.checksums[key] !== soundChecksum(sound)) {
      problems.push(`Sound "${sound.id}" does not match its checksum.`);
    }
    if (sound.source.kind === 'asset' && bundle.assets?.[sound.source.assetId] === undefined) {
      problems.push(`Sound "${sound.id}" names asset "${sound.source.assetId}", which the bundle does not carry.`);
    }
  }
  return problems.length === 0 ? { ok: true, bundle } : { ok: false, problems };
}

/** `id`, or `id-2`, `id-3`, … — the first one not in `taken` (and ≤ 48 chars). */
export function freeLibraryId(id: string, taken: ReadonlySet<string>): string {
  if (!taken.has(id)) return id;
  for (let suffix = 2; ; suffix += 1) {
    const tail = `-${String(suffix)}`;
    const candidate = `${id.slice(0, 48 - tail.length).replace(/-+$/u, '')}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface BundleImportPlan {
  scripts: ScriptEntry[];
  sounds: SoundEntry[];
  /** Original id → the id it lands under, for every entry that was re-keyed. */
  renamed: Record<string, string>;
}

/**
 * What importing `bundle` into a library holding `existing` ids adds (§A.1):
 * every script becomes `unreviewed` (its author kept), and an id that clashes
 * is re-keyed `-2`, `-3`, … Sounds are re-keyed the same way.
 */
export function planBundleImport(
  bundle: CkScriptsBundle,
  existing: { scriptIds: Iterable<string>; soundIds: Iterable<string> },
): BundleImportPlan {
  const renamed: Record<string, string> = {};
  const scriptIds = new Set(existing.scriptIds);
  const soundIds = new Set(existing.soundIds);
  const scripts = bundle.scripts.map((script): ScriptEntry => {
    const id = freeLibraryId(script.id, scriptIds);
    scriptIds.add(id);
    if (id !== script.id) renamed[`script:${script.id}`] = id;
    return { ...script, id, trust: 'unreviewed' };
  });
  const sounds = bundle.sounds.map((sound): SoundEntry => {
    const id = freeLibraryId(sound.id, soundIds);
    soundIds.add(id);
    if (id !== sound.id) renamed[`sound:${sound.id}`] = id;
    return { ...sound, id };
  });
  return { scripts, sounds, renamed };
}
