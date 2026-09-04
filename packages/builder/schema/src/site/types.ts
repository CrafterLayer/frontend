import { z } from 'zod';

import { assetEntrySchema, type AssetEntry, type AssetId } from '../assets/types';
import type { BuilderDocument, ContentDirection, Node } from '../document/types';
import { jsonRecordZod } from '../json/json-value-schema';
import { designSystemSchema, type DesignSystem } from '../theme/design-system';

/*
  Still 1 after T007 replaced the placeholder `SiteDesignSystem` (name + a bare
  token bag) with the real `DesignSystem`. That is a BREAKING shape change to a
  persisted field, and it is safe to make in place only because nothing has ever
  persisted a site: `siteVersion` appears in this directory and in one spike
  test, and no adapter, storage key, or app constructs a `BuilderSite`. The
  moment one does, this constant goes to 2 and `migrations.ts` gains a real
  v1 -> v2 step that lifts the old two-field shape into a validated system.
*/
export const LATEST_SITE_VERSION = 1;

export type PageId = string;
export type SharedRegionId = string;
export type SharedRegionKind = 'header' | 'footer';

export interface SitePage {
  id: PageId;
  address: string;
  title: string;
  purpose: string;
  audience: string;
  /** Nested verbatim so a page remains an independently valid document. */
  document: BuilderDocument;
  regions: readonly SharedRegionId[];
}

export interface SharedRegion {
  id: SharedRegionId;
  kind: SharedRegionKind;
  document: BuilderDocument;
}

export interface BuilderSite {
  siteVersion: number;
  dir: ContentDirection;
  pages: readonly SitePage[];
  sharedRegions: Readonly<Record<SharedRegionId, SharedRegion>>;
  designSystem: DesignSystem;
  assets: Readonly<Record<AssetId, AssetEntry>>;
}

export const pageIdSchema: z.ZodType<PageId> = z.string();
export const sharedRegionIdSchema: z.ZodType<SharedRegionId> = z.string();
export const sharedRegionKindSchema: z.ZodType<SharedRegionKind> = z.enum(['header', 'footer']);

/*
  `BuilderDocument` has no exported Zod schema in this package yet. Keep this
  private structural mirror at the site boundary, and leave semantic page
  validity exclusively to `validateDocument()` in validate.ts.

  The transform deliberately removes explicitly-undefined optional fields.
  That keeps the output assignable to `Node` under exactOptionalPropertyTypes.
*/
const documentNodeShapeSchema = z.strictObject({
  id: z.string(),
  type: z.string(),
  props: jsonRecordZod,
  bindings: z.record(z.string(), z.string()).optional(),
  variantOf: z.string().optional(),
  responsive: z.partialRecord(z.enum(['tablet', 'mobile']), jsonRecordZod).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
});

const documentNodeSchema: z.ZodType<Node> = documentNodeShapeSchema.transform(
  ({ bindings, id, props, responsive, slots, type, variantOf }): Node => {
    const cleanResponsive: NonNullable<Node['responsive']> = {};
    if (responsive?.tablet !== undefined) {
      cleanResponsive.tablet = responsive.tablet;
    }
    if (responsive?.mobile !== undefined) {
      cleanResponsive.mobile = responsive.mobile;
    }

    return {
      id,
      type,
      props,
      ...(bindings === undefined ? {} : { bindings }),
      ...(variantOf === undefined ? {} : { variantOf }),
      ...(Object.keys(cleanResponsive).length === 0 ? {} : { responsive: cleanResponsive }),
      ...(slots === undefined ? {} : { slots }),
    };
  },
);

/*
  Exported for `setSharedRegion`, whose argument IS a whole document. The name
  says what it is and is not: a STRUCTURAL mirror used at the site boundary, not
  the document's semantic validator. A document that parses here can still be
  rejected by `validateDocument` for an orphan, a cycle, or an unknown block —
  which is why every site command that accepts one runs that check too.
*/
export const siteNestedDocumentSchema: z.ZodType<BuilderDocument> = z.strictObject({
  schemaVersion: z.number().int().nonnegative(),
  surface: z.string(),
  dir: z.enum(['ltr', 'rtl']),
  rootId: z.string(),
  nodes: z.record(z.string(), documentNodeSchema),
});

export const sitePageSchema: z.ZodType<SitePage> = z.strictObject({
  id: pageIdSchema,
  address: z.string(),
  title: z.string(),
  purpose: z.string(),
  audience: z.string(),
  document: siteNestedDocumentSchema,
  regions: z.array(sharedRegionIdSchema),
});

export const sharedRegionSchema: z.ZodType<SharedRegion> = z.strictObject({
  id: sharedRegionIdSchema,
  kind: sharedRegionKindSchema,
  document: siteNestedDocumentSchema,
});

export const builderSiteSchema: z.ZodType<BuilderSite> = z.strictObject({
  siteVersion: z.number().int().nonnegative(),
  dir: z.enum(['ltr', 'rtl']),
  pages: z.array(sitePageSchema),
  sharedRegions: z.record(sharedRegionIdSchema, sharedRegionSchema),
  designSystem: designSystemSchema,
  assets: z.record(z.string(), assetEntrySchema),
});
