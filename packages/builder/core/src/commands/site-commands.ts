import { z } from 'zod';

import {
  assetEntrySchema,
  builderError,
  designSystemSchema,
  isTokenName,
  jsonValueZod,
  siteNestedDocumentSchema,
  validateAssetEntry,
  validateAssetReferences,
  validateDesignSystem,
  validateDocument,
  validateSite,
  type AssetEntry,
  type BuilderDocument,
  type BuilderSite,
  type ContentDirection,
  type DesignSystem,
  type PageId,
  type RegisteredSiteCommand,
  type SharedRegionId,
  type SharedRegionKind,
  type TokenName,
} from '@craftkit/builder-schema';

import { snapshot } from '../patches/immer';
import { applyOnePatch, type RootPatch } from '../patches/apply-one-patch';
import { defineSiteCommand } from './define-site-command';
import { codeProjectCommands, type CodeProjectCommands } from './code-project-commands';
import { libraryCommands, type LibraryCommands } from './library-commands';
import { pageCommands, type PageCommands } from './page-commands';
// pixi-studio:schema-library additions (2026-10-10): the Pixi Studio project tier (DESIGN §A.2).
import {
  scriptLibraryCommands,
  type ScriptLibraryCommands,
} from './script-library-commands';
// end pixi-studio:schema-library additions

/**
 * The SITE command set (013, ق١).
 *
 * Every one of these is a change a person or the agent makes to the site as a
 * whole rather than to one page: adding a page, moving a page, giving the site
 * a header, repainting its palette. They exist as commands — not as helper
 * functions a caller invokes around a kernel — for the reason the plan states:
 * a site change and a page change have to be able to land in ONE
 * `produceWithPatches`, and that is only possible when both are producers over
 * the same draft.
 *
 * The refusals matter more than the writes. Each command below refuses BEFORE
 * it mutates, so a rejected command leaves the draft byte-identical and the
 * transaction never opens. `validateSite` is the backstop, not the guard: a
 * command that could only be caught by the backstop would report its fault as
 * "the site is invalid" instead of "that address is already taken".
 */
export interface SiteCommands extends CodeProjectCommands, PageCommands, LibraryCommands {
  addPage: {
    address: string;
    title: string;
    purpose?: string;
    audience?: string;
    regions?: SharedRegionId[];
    index?: number;
  };
  renamePage: { pageId: PageId; title?: string; address?: string };
  reorderPage: { pageId: PageId; toIndex: number };
  setSharedRegion: {
    regionId: SharedRegionId;
    kind: SharedRegionKind;
    document: BuilderDocument | null;
  };
  setPageRegions: { pageId: PageId; regions: SharedRegionId[] };
  setDesignToken: { token: TokenName; value: string };
  setDesignSystem: { system: DesignSystem };
  registerAsset: { entry: AssetEntry };
  setSiteDirection: { dir: ContentDirection };
  applySitePatches: { patches: RootPatch[] };
}

// pixi-studio:schema-library additions (2026-10-10): saveScript, removeScript, renameScript, saveSound,
// removeSound join the site namespace by declaration merging, so the interface
// above stays untouched.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
export interface SiteCommands extends ScriptLibraryCommands {}
// end pixi-studio:schema-library additions

export type SiteCommandName = keyof SiteCommands;

const regionId = z.string().min(1);
const pageId = z.string().min(1);
const SAFE_PATCH_PATH_SEGMENT = /^(?!(?:__proto__|constructor|prototype)$).*$/;
const patchPathSegment = z.union([
  z.string().regex(SAFE_PATCH_PATH_SEGMENT, 'Patch paths may not contain a reserved object key.'),
  z.number().int().min(0),
]);

/**
 * Does this name address the SITE draft rather than a page's document?
 *
 * The site dispatcher needs one namespace: `dispatchGroup` must accept
 * `[{ command: 'addPage' }, { command: 'setProp' }]` and route each step to the
 * draft it belongs to, inside one production. This is that routing test, stated
 * once. (T025 asked instead for the site commands to be registered in
 * `coreCommands` and `CoreCommandName` to widen — which is unbuildable as
 * written: a `RegisteredCommand`'s producer takes a `BuilderDocument`, and
 * these take a `BuilderSite`. The plan's ق١ supersedes it.)
 */
export function isSiteCommandName(name: string): name is SiteCommandName {
  return Object.hasOwn(siteCommands, name);
}

export const siteCommands: Record<SiteCommandName, RegisteredSiteCommand> = {
  setSharedRegion: defineSiteCommand({
    args: z.strictObject({
      regionId,
      kind: z.enum(['header', 'footer']),
      document: siteNestedDocumentSchema.nullable(),
    }),
    run: (args) => (draft, rt) => {
      const regions = mutableRegions(draft);
      if (args.document === null) {
        if (!Object.hasOwn(regions, args.regionId)) {
          throw siteError(`Shared region "${args.regionId}" does not exist.`, ['regionId']);
        }
        /*
          A region a page still points at cannot be deleted: the page would
          reference a region that is gone, which `validateSite` reports as
          `unknown-shared-region` on the PAGE — blaming the wrong object for a
          deletion that happened elsewhere.
        */
        const holders = draft.pages.filter((page) => page.regions.includes(args.regionId));
        if (holders.length > 0) {
          throw siteError(
            `Shared region "${args.regionId}" is still used by ${String(holders.length)} page(s); clear it from them first.`,
            ['regionId'],
          );
        }
        delete regions[args.regionId];
        return;
      }

      requireSameDirection(draft, args.document, `Shared region "${args.regionId}"`);
      requireValidDocument(rt, args.document, `Shared region "${args.regionId}"`);
      requireResolvableAssets(draft, args.document, `Shared region "${args.regionId}"`);
      regions[args.regionId] = {
        id: args.regionId,
        kind: args.kind,
        document: args.document,
      };
    },
  }),

  setPageRegions: defineSiteCommand({
    args: z.strictObject({ pageId, regions: z.array(regionId) }),
    run: (args) => (draft) => {
      const index = pageIndex(draft, args.pageId);
      const page = draft.pages[index];
      if (page === undefined) return;
      requireKnownRegions(draft, args.regions);
      requireDistinct(args.regions, 'regions');
      mutablePages(draft)[index] = { ...page, regions: args.regions };
    },
  }),

  setDesignToken: defineSiteCommand({
    args: z.strictObject({ token: z.string().min(1), value: z.string().min(1) }),
    run: (args) => (draft) => {
      /*
        The vocabulary is checked at runtime, not only in the type: the args
        arrive as JSON from a plan the model wrote, where `TokenName` is a
        compile-time fiction. `isTokenName` is derived from the same map the
        type is, so the two cannot drift.
      */
      if (!isTokenName(args.token)) {
        throw siteError(`"${args.token}" is not a token in the site's vocabulary.`, ['token']);
      }
      const next: DesignSystem = {
        ...snapshot(draft.designSystem),
        tokens: { ...snapshot(draft.designSystem).tokens, [args.token]: args.value },
      };
      /*
        FR-014 enforced at the door. Changing one colour can push a pairing the
        site DECLARED as legible under the threshold, and the person who typed
        the colour is the only one who can still choose a different one. Letting
        it land and reporting it later means the page ships unreadable in every
        preview between the edit and the next validation.
      */
      requireLegible(next, ['value']);
      draft.designSystem = next;
    },
  }),

  setDesignSystem: defineSiteCommand({
    args: z.strictObject({ system: designSystemSchema }),
    run: (args) => (draft) => {
      requireLegible(args.system, ['system']);
      draft.designSystem = args.system;
    },
  }),

  registerAsset: defineSiteCommand({
    args: z.strictObject({ entry: assetEntrySchema }),
    run: (args) => (draft) => {
      const parsed = validateAssetEntry(args.entry);
      if (!parsed.ok) {
        throw siteError(parsed.issues[0]?.message ?? 'The asset entry is malformed.', ['entry']);
      }
      const assets = mutableAssets(draft);
      /*
        Refused rather than overwritten. An asset id is a content identity that
        documents already reference by name; silently replacing what it points
        at would change every page that uses it, in a transaction whose label
        says "register asset".
      */
      if (Object.hasOwn(assets, parsed.entry.id)) {
        throw siteError(`Asset "${parsed.entry.id}" is already registered.`, ['entry', 'id']);
      }
      assets[parsed.entry.id] = parsed.entry;
    },
  }),

  setSiteDirection: defineSiteCommand({
    args: z.strictObject({ dir: z.enum(['ltr', 'rtl']) }),
    run: (args) => (draft) => {
      if (draft.dir === args.dir) {
        throw siteError(`The site is already "${args.dir}".`, ['dir']);
      }
      /*
        The whole site turns, in one production. A site whose `dir` moved but
        whose pages did not is invalid by `page-direction-mismatch` on EVERY
        page — so doing this as "set the site, then fix the pages" would mean
        one transaction that is valid and one intermediate state that is not,
        and an undo that could land on the broken half.

        Shared regions turn too. `validateSite` does not check their direction
        today (only pages), but a header rendered ltr above an rtl page is the
        same defect with no validator behind it.
      */
      draft.dir = args.dir;
      for (const page of mutablePages(draft)) {
        page.document.dir = args.dir;
      }
      for (const region of Object.values(mutableRegions(draft))) {
        region.document.dir = args.dir;
      }
    },
  }),

  applySitePatches: defineSiteCommand({
    args: z.strictObject({
      patches: z
        .array(
          z.discriminatedUnion('op', [
            z.strictObject({
              op: z.literal('remove'),
              path: z.array(patchPathSegment).min(1),
              value: jsonValueZod.optional(),
            }),
            z.strictObject({
              op: z.enum(['add', 'replace']),
              path: z.array(patchPathSegment).min(1),
              value: jsonValueZod,
            }),
          ]),
        )
        .min(1),
    }),
    run: (args) => (draft) => {
      /*
        The site mirror of `applyPatches`, and the same reasoning: this is the
        ONE command whose input does not come from a handler that preserves
        invariants by construction — it comes from a diff — so the whole site is
        validated before the door commits. It is host-owned
        (`EXPLICIT_HOST_ALLOW_COMMANDS`): the agent commits through it, but only
        via a draft the host fingerprinted and diffed, never by writing patches
        of its own choosing.
      */
      const before = draft.siteVersion;
      for (const patch of args.patches) {
        applyOnePatch(draft, patch, 'site/invalid-patch');
      }
      if (draft.siteVersion !== before) {
        throw builderError(
          'site/invalid-patch',
          'A patch batch may not change siteVersion; migrations own that field (Law M).',
          ['patches'],
        );
      }
      const result = validateSite(snapshot(draft));
      if (!result.ok) {
        const first = result.issues[0];
        throw builderError(
          'site/invalid-patch',
          `The patch batch produces an invalid site: ${first?.message ?? 'unknown violation'}`,
          ['patches'],
        );
      }
    },
  }),
  ...pageCommands,
  ...codeProjectCommands,
  /* style-manager DESIGN.md §2: the site design library (P5). */
  ...libraryCommands,
  // pixi-studio:schema-library additions (2026-10-10)
  ...scriptLibraryCommands,
  // end pixi-studio:schema-library additions
};

// ── Refusal helpers ──────────────────────────────────────────────────────────

function siteError(message: string, path?: (string | number)[]) {
  return builderError('site/structural-violation', message, path);
}

/*
  `BuilderSite` publishes `pages`, `sharedRegions`, and `assets` as readonly so
  no consumer can write through a site it was handed. Inside a producer the
  draft IS writable — that is what a draft is — and these three helpers are
  where that fact is stated once, next to the reason, instead of at ten call
  sites. Only `pages` needs an assertion: TypeScript ignores `readonly` property
  modifiers when checking assignability, so the two record fields widen on their
  own, while `readonly T[]` genuinely is a different type from `T[]`.
*/
function mutablePages(draft: BuilderSite): BuilderSite['pages'][number][] {
  return draft.pages as BuilderSite['pages'][number][];
}

function mutableRegions(
  draft: BuilderSite,
): Record<SharedRegionId, BuilderSite['sharedRegions'][SharedRegionId]> {
  return draft.sharedRegions;
}

function mutableAssets(draft: BuilderSite): Record<string, AssetEntry> {
  return draft.assets;
}

function pageIndex(draft: BuilderSite, id: PageId): number {
  const index = draft.pages.findIndex((page) => page.id === id);
  if (index === -1) {
    throw siteError(`Page "${id}" does not exist.`, ['pageId']);
  }
  return index;
}

function requireKnownRegions(draft: BuilderSite, regions: readonly SharedRegionId[]): void {
  for (const id of regions) {
    if (!Object.hasOwn(draft.sharedRegions, id)) {
      throw siteError(`Shared region "${id}" does not exist.`, ['regions']);
    }
  }
}

function requireDistinct(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw siteError('The same shared region was listed twice.', [field]);
  }
}

function requireSameDirection(draft: BuilderSite, document: BuilderDocument, what: string): void {
  if (document.dir !== draft.dir) {
    throw siteError(
      `${what} direction "${document.dir}" does not match site direction "${draft.dir}".`,
      ['document', 'dir'],
    );
  }
}

function requireValidDocument(
  rt: { blocks: Parameters<typeof validateDocument>[1] },
  document: BuilderDocument,
  what: string,
): void {
  const violations = validateDocument(document, rt.blocks);
  if (violations.length > 0) {
    throw siteError(`${what} is not a valid document: ${violations[0]?.message ?? 'unknown'}`, [
      'document',
    ]);
  }
}

/*
  site-model.md §2, the sixth refusal: a command may not introduce an asset
  reference the site does not hold. `validateDocument` cannot see this — it
  knows nothing about the site's asset library — so a region carrying a dangling
  `{ assetId }` would parse, validate, land, and surface later as
  `unresolved-asset-reference` on a region nobody had just edited.
*/
function requireResolvableAssets(
  draft: BuilderSite,
  document: BuilderDocument,
  what: string,
): void {
  const issues = validateAssetReferences(document.nodes, draft.assets);
  if (issues.length > 0) {
    throw siteError(
      `${what} references an asset the site does not hold: ${issues[0]?.message ?? 'unknown'}`,
      ['document'],
    );
  }
}

function requireLegible(system: DesignSystem, path: (string | number)[]): void {
  const result = validateDesignSystem(system);
  if (!result.ok) {
    throw siteError(
      `The design system would not be legible: ${result.issues[0]?.message ?? 'unknown'}`,
      path,
    );
  }
}
