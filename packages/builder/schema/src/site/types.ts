import { z } from 'zod';

import { assetEntrySchema, type AssetEntry, type AssetId } from '../assets/types';
import type { BuilderDocument, ContentDirection, Node } from '../document/types';
import { jsonRecordZod } from '../json/json-value-schema';

export const LATEST_SITE_VERSION = 1;

export type PageId = string;
export type SharedRegionId = string;
export type SharedRegionKind = 'header' | 'footer';

/**
 * Temporary Wave 2 bridge. Wave 3 replaces this with the validated
 * `DesignSystem` exported from `../theme`.
 */
export interface SiteDesignSystem {
  name: string;
  tokens: Readonly<Record<string, string>>;
}

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
  designSystem: SiteDesignSystem;
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

const builderDocumentShapeSchema: z.ZodType<BuilderDocument> = z.strictObject({
  schemaVersion: z.number().int().nonnegative(),
  surface: z.string(),
  dir: z.enum(['ltr', 'rtl']),
  rootId: z.string(),
  nodes: z.record(z.string(), documentNodeSchema),
});

export const siteDesignSystemSchema: z.ZodType<SiteDesignSystem> = z.strictObject({
  name: z.string(),
  tokens: z.record(z.string(), z.string()),
});

export const sitePageSchema: z.ZodType<SitePage> = z.strictObject({
  id: pageIdSchema,
  address: z.string(),
  title: z.string(),
  purpose: z.string(),
  audience: z.string(),
  document: builderDocumentShapeSchema,
  regions: z.array(sharedRegionIdSchema),
});

export const sharedRegionSchema: z.ZodType<SharedRegion> = z.strictObject({
  id: sharedRegionIdSchema,
  kind: sharedRegionKindSchema,
  document: builderDocumentShapeSchema,
});

export const builderSiteSchema: z.ZodType<BuilderSite> = z.strictObject({
  siteVersion: z.number().int().nonnegative(),
  dir: z.enum(['ltr', 'rtl']),
  pages: z.array(sitePageSchema),
  sharedRegions: z.record(sharedRegionIdSchema, sharedRegionSchema),
  designSystem: siteDesignSystemSchema,
  assets: z.record(z.string(), assetEntrySchema),
});
