import { z } from 'zod';

import {
  bilingualSchema,
  builderError,
  describeScriptIssues,
  LIBRARY_LIMITS,
  libraryIdSchema,
  scriptCodeErrors,
  scriptEntrySchema,
  soundEntrySchema,
  STUDIO_LIMITS,
  studioTagsSchema,
  type Bilingual,
  type BuilderSite,
  type LibraryId,
  type RegisteredSiteCommand,
  type ScriptEntry,
  type ScriptVersion,
  type SiteLibrary,
  type SoundEntry,
} from '@craftkit/builder-schema';

import { snapshot } from '../patches/immer';

/**
 * The Pixi Studio PROJECT tier (pixi-studio DESIGN.md §A.2, D9): the scripts
 * and sounds a site keeps in `site.library.scripts` / `site.library.sounds`.
 *
 * Site commands, so every write is one transaction and one Undo, rides vault
 * autosave, and travels in `.craftkit.json`. Modelled on `saveTemplate`; the
 * differences are the ones a code library needs:
 *
 * - `saveScript` OWNS the version: saving changed code or params pushes the
 *   old version onto `history` (the project keeps the last 5) and bumps it;
 *   saving the same code again changes nothing about the version.
 * - A refusal lists EVERY zod issue, not the first: these commands are called
 *   by the agent's harvester and the Studio, and the issues are the repair text.
 * - An `unreviewed` script (an import nobody trusted yet, §F) is refused.
 */
export interface ScriptLibraryCommands {
  /** Upsert by id; the command owns `version`, `history` and `createdAt` of an existing entry. */
  saveScript: { entry: ScriptEntry };
  removeScript: { id: LibraryId };
  renameScript: { id: LibraryId; name: Bilingual; tags?: string[]; updatedAt?: string };
  /** Upsert by id. An asset sound's asset must already be registered (a data:audio url). */
  saveSound: { entry: SoundEntry };
  removeSound: { id: LibraryId };
}

export type ScriptLibraryCommandName = keyof ScriptLibraryCommands;

/**
 * `defineSiteCommand` with one difference: a refusal names every issue (up to
 * eight), each with its path, rather than only the first.
 */
function defineLibrarySiteCommand<S extends z.ZodType>(def: {
  args: S;
  run: (args: z.output<S>) => (draft: BuilderSite) => void;
}): RegisteredSiteCommand {
  return {
    argsSchema: def.args,
    apply(raw: unknown) {
      const parsed = def.args.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        const text = issues
          .slice(0, 8)
          .map((issue) => {
            const path = issue.path.map(String).join('.');
            return path === '' ? issue.message : `${path}: ${issue.message}`;
          })
          .join('; ');
        throw builderError(
          'cmd/invalid-args',
          `Invalid command arguments: ${text === '' ? 'validation failed' : text}${issues.length > 8 ? ` (+${String(issues.length - 8)} more)` : ''}`,
          issues[0]?.path as (string | number)[] | undefined,
        );
      }
      return def.run(parsed.data);
    },
  };
}

function sameParams(a: ScriptEntry['params'], b: ScriptEntry['params']): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The entry as it lands: version and history decided against what the library holds. */
function nextScript(previous: ScriptEntry | undefined, incoming: ScriptEntry): ScriptEntry {
  if (previous === undefined) {
    const next: ScriptEntry = { ...incoming };
    if (incoming.history !== undefined) {
      const kept = incoming.history.slice(0, STUDIO_LIMITS.projectHistory);
      if (kept.length > 0) next.history = kept;
      else delete next.history;
    }
    return next;
  }
  const changed = previous.code !== incoming.code || !sameParams(previous.params, incoming.params);
  const next: ScriptEntry = { ...incoming, createdAt: previous.createdAt };
  if (changed) {
    const past: ScriptVersion = {
      version: previous.version,
      code: previous.code,
      params: previous.params,
      savedAt: previous.updatedAt,
    };
    next.version = previous.version + 1;
    next.history = [past, ...(previous.history ?? [])].slice(0, STUDIO_LIMITS.projectHistory);
  } else {
    next.version = previous.version;
    if (previous.history === undefined) delete next.history;
    else next.history = previous.history;
  }
  return next;
}

export const scriptLibraryCommands: Record<ScriptLibraryCommandName, RegisteredSiteCommand> = {
  saveScript: defineLibrarySiteCommand({
    args: z.strictObject({ entry: scriptEntrySchema }),
    run: (args) => (draft) => {
      const incoming = args.entry;
      if (incoming.trust === 'unreviewed') {
        throw scriptError(
          `Script "${incoming.id}" is unreviewed (imported). Trust it in the Script Studio before saving it to the project.`,
          ['entry', 'trust'],
        );
      }
      const errors = scriptCodeErrors(incoming.code, { switchOn: true });
      if (errors.length > 0) {
        throw scriptError(`Script "${incoming.id}": ${describeScriptIssues(errors)}`, [
          'entry',
          'code',
        ]);
      }
      const library = mutableLibrary(draft);
      const scripts = snapshot(library.scripts ?? {});
      requireRoom(scripts, incoming.id, LIBRARY_LIMITS.scripts, 'scripts', ['entry']);
      const previous = Object.hasOwn(scripts, incoming.id) ? scripts[incoming.id] : undefined;
      const next = nextScript(previous, incoming);
      // The version and history were rewritten: hold the result to the schema once more.
      const checked = scriptEntrySchema.safeParse(next);
      if (!checked.success) {
        throw scriptError(
          `Script "${incoming.id}" would be stored invalid: ${checked.error.issues[0]?.message ?? 'unknown'}`,
          ['entry'],
        );
      }
      library.scripts = { ...scripts, [incoming.id]: checked.data };
    },
  }),

  removeScript: defineLibrarySiteCommand({
    args: z.strictObject({ id: libraryIdSchema }),
    run: (args) => (draft) => {
      const scripts = snapshot(draft.library?.scripts ?? {});
      if (!Object.hasOwn(scripts, args.id)) {
        throw scriptError(`Script "${args.id}" is not in the project library.`, ['id']);
      }
      /*
        No usage refusal: a region carries its own code (D8), so a page that
        placed this script keeps working after the library forgets it.
      */
      const next = { ...scripts };
      delete next[args.id];
      mutableLibrary(draft).scripts = next;
      pruneLibrary(draft);
    },
  }),

  renameScript: defineLibrarySiteCommand({
    args: z.strictObject({
      id: libraryIdSchema,
      name: bilingualSchema,
      tags: studioTagsSchema.optional(),
      updatedAt: z.iso.datetime({ offset: true }).optional(),
    }),
    run: (args) => (draft) => {
      const scripts = snapshot(draft.library?.scripts ?? {});
      const current = Object.hasOwn(scripts, args.id) ? scripts[args.id] : undefined;
      if (current === undefined) {
        throw scriptError(`Script "${args.id}" is not in the project library.`, ['id']);
      }
      const next: ScriptEntry = { ...current, name: args.name };
      if (args.tags !== undefined) next.tags = args.tags;
      if (args.updatedAt !== undefined) next.updatedAt = args.updatedAt;
      mutableLibrary(draft).scripts = { ...scripts, [args.id]: next };
    },
  }),

  saveSound: defineLibrarySiteCommand({
    args: z.strictObject({ entry: soundEntrySchema }),
    run: (args) => (draft) => {
      const entry = args.entry;
      if (entry.source.kind === 'asset') {
        const assetId = entry.source.assetId;
        const asset = Object.hasOwn(draft.assets, assetId) ? draft.assets[assetId] : undefined;
        if (asset === undefined) {
          throw scriptError(
            `Sound "${entry.id}" plays asset "${assetId}", which is not registered. Register the asset first (registerAsset), in the same group.`,
            ['entry', 'source', 'assetId'],
          );
        }
        if (!asset.url.startsWith('data:audio/')) {
          throw scriptError(
            `Sound "${entry.id}" plays asset "${assetId}", which is not audio (its url is not data:audio/…).`,
            ['entry', 'source', 'assetId'],
          );
        }
      }
      const library = mutableLibrary(draft);
      const sounds = snapshot(library.sounds ?? {});
      requireRoom(sounds, entry.id, LIBRARY_LIMITS.sounds, 'sounds', ['entry']);
      const previous = Object.hasOwn(sounds, entry.id) ? sounds[entry.id] : undefined;
      library.sounds = {
        ...sounds,
        [entry.id]: previous === undefined ? entry : { ...entry, createdAt: previous.createdAt },
      };
    },
  }),

  removeSound: defineLibrarySiteCommand({
    args: z.strictObject({ id: libraryIdSchema }),
    run: (args) => (draft) => {
      const sounds = snapshot(draft.library?.sounds ?? {});
      if (!Object.hasOwn(sounds, args.id)) {
        throw scriptError(`Sound "${args.id}" is not in the project library.`, ['id']);
      }
      const next = { ...sounds };
      delete next[args.id];
      mutableLibrary(draft).sounds = next;
      pruneLibrary(draft);
    },
  }),
};

// ── Helpers (the library-commands idiom, restated: those are module-private) ──

function scriptError(message: string, path?: (string | number)[]) {
  return builderError('site/structural-violation', message, path);
}

function mutableLibrary(draft: BuilderSite): SiteLibrary {
  draft.library ??= {};
  return draft.library;
}

/** An emptied collection, and then an emptied library, is removed (byte-identical round trips). */
function pruneLibrary(draft: BuilderSite): void {
  const library = draft.library;
  if (library === undefined) return;
  const record = library as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    const empty =
      value === undefined ||
      (Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0);
    if (empty) delete record[key];
  }
  if (Object.keys(record).length === 0) delete draft.library;
}

function requireRoom(
  record: Readonly<Record<string, unknown>>,
  id: string,
  max: number,
  what: string,
  path: (string | number)[],
): void {
  if (!Object.hasOwn(record, id) && Object.keys(record).length >= max) {
    throw scriptError(`The library already holds ${String(max)} ${what}; remove one first.`, path);
  }
}
