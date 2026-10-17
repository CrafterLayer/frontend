import { z } from 'zod';

export type AssetId = string;

export interface AssetEntry {
  id: AssetId;
  url: string;
  description: string;
  mood: readonly string[];
  palette: readonly string[];
  alt: string;
  width: number;
  height: number;
}

export interface AssetRef {
  assetId: AssetId;
}

/** A block image is either a held asset or a stated, deliberate absence. */
export type ImageProp = AssetRef | { absent: true; reason: string };

export interface AssetLibraryPort {
  list(options?: { signal?: AbortSignal }): Promise<readonly AssetEntry[]>;
}

export const assetEntrySchema: z.ZodType<AssetEntry> = z.strictObject({
  id: z.string(),
  url: z.string(),
  description: z.string(),
  mood: z.array(z.string()),
  palette: z.array(z.string()),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
});

export const assetRefSchema: z.ZodType<AssetRef> = z.strictObject({
  assetId: z.string(),
});

export const imagePropSchema: z.ZodType<ImageProp> = z.union([
  assetRefSchema,
  z.strictObject({ absent: z.literal(true), reason: z.string() }),
]);
