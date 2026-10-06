import type { BuilderKernel, SiteGroupStep } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  customCodeAssetSrc,
  isAssetRef,
  type AssetEntry,
  type BuilderSite,
  type PageId,
} from '@craftkit/builder-schema';

import { resolveCustomCodeAssetSrc, type AssetTable } from '@craftkit/builder-renderer';

import { resolveElementTarget, type ElementTarget } from '../../custom-code/element-target';
import { cropIntents, type CropValue } from '../ImageCropper/crop-math';

/*
  ── Asset operations (style-manager DESIGN.md §G "Asset manager") ──────────
  Pure step builders: register, edit alt, delete, and "use on the selected
  element". Each is one labelled transaction when the panel sends it.
*/

export type AssetStepsResult =
  | { readonly ok: true; readonly steps: readonly SiteGroupStep[] }
  | { readonly ok: false; readonly message: string };

/** The tree door caps an attribute at 2000 characters, and a class list at 1000. */
export const TREE_ATTRIBUTE_MAX = 2_000;
const CLASS_URL_MAX = 700;

/** A new asset entry for an uploaded picture. Alt starts empty: the person writes it. */
export function uploadedAssetEntry(
  id: string,
  image: { readonly dataUrl: string; readonly width: number; readonly height: number },
  fileName: string,
): AssetEntry {
  const description = fileName.replace(/\.[^.]*$/u, '').replace(/[-_]+/gu, ' ').trim().slice(0, 200);
  return {
    id,
    url: image.dataUrl,
    description: description === '' ? 'Uploaded picture' : description,
    mood: [],
    palette: [],
    alt: '',
    width: image.width,
    height: image.height,
  };
}

/** A fresh asset id (`upload-<time>-<random>`), unique against the site's table. */
export function freshAssetId(site: Readonly<BuilderSite>, now = Date.now(), random = Math.random()): string {
  const base = `upload-${now.toString(36)}-${Math.floor(random * 1e6).toString(36)}`;
  let id = base;
  for (let n = 2; Object.hasOwn(site.assets, id); n += 1) id = `${base}-${String(n)}`;
  return id;
}

/** The first prop of a registered block that holds a picture (`{assetId}` or a stated absence). */
export function imagePropKey(props: Readonly<Record<string, unknown>>): string | undefined {
  return Object.keys(props).find((key) => {
    const value = props[key];
    if (isAssetRef(value)) return true;
    return typeof value === 'object' && value !== null && (value as { absent?: unknown }).absent === true;
  });
}

/**
 * "Use on selected element":
 * - a registered block with an image prop → that prop becomes `{assetId}`;
 * - an `img` in a tree → its `src` (and `alt` when the asset has one);
 * - any other tree element → a cover background image through the engine.
 * A tree only holds addresses that fit its limits; a large inline upload is
 * refused with what to do instead.
 */
export function assetUseSteps(
  page: BuilderKernel,
  target: ElementTarget,
  asset: AssetEntry,
  pageId: PageId,
): AssetStepsResult {
  const resolved = resolveElementTarget(page, target);
  if (resolved === undefined) return { ok: false, message: 'The selected element no longer exists.' };
  if (resolved.kind === 'block') {
    const key = imagePropKey(resolved.node.props);
    if (key === undefined) return { ok: false, message: 'The selected block has no picture to replace.' };
    return {
      ok: true,
      steps: [{ command: 'setProp', args: { id: resolved.node.id, key, value: { assetId: asset.id } }, pageId }],
    };
  }
  const node = resolved.node;
  if (node.kind !== 'element') return { ok: false, message: 'Pick an image or a container to put the picture on.' };
  const at = { id: target.nodeId, path: [...resolved.target.path] };
  if (node.tag === 'img') {
    /*
      A picture stored inside the site (an upload's data URL) is too long for
      a tree attribute: the element points at it by reference instead
      (`/ck-assets/<id>`), which the canvas and the export resolve through
      the site's asset table. A short hosted address is written as it is.
    */
    const src =
      asset.url.length > TREE_ATTRIBUTE_MAX || asset.url.startsWith('data:')
        ? customCodeAssetSrc(asset.id)
        : asset.url;
    return {
      ok: true,
      steps: [
        {
          command: 'patchTreeNode',
          args: { ...at, attributes: { src, ...(asset.alt === '' ? {} : { alt: asset.alt }) } },
          pageId,
        },
      ],
    };
  }
  if (asset.url.length > CLASS_URL_MAX || !asset.url.startsWith('https://')) {
    return {
      ok: false,
      message: 'A background picture must be a hosted https address short enough for a class. Put the upload on an image element or an image block instead.',
    };
  }
  const result = applyStyleIntents(
    node.className ?? '',
    [
      { property: 'backgroundImage', value: { kind: 'raw', css: `url(${asset.url})` }, bucket: 'base', state: 'default' },
      { property: 'backgroundSize', value: { kind: 'keyword', keyword: 'cover' }, bucket: 'base', state: 'default' },
      { property: 'backgroundPosition', value: { kind: 'keyword', keyword: 'center' }, bucket: 'base', state: 'default' },
    ],
    { mode: 'free' },
  );
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, steps: [{ command: 'patchTreeNode', args: { ...at, set: { className: result.className } }, pageId }] };
}

/** A crop written on a tree image as classes (non-destructive), one `patchTreeNode`. */
export function cropElementSteps(
  page: BuilderKernel,
  target: ElementTarget,
  crop: CropValue,
  pageId: PageId,
): AssetStepsResult {
  const resolved = resolveElementTarget(page, target);
  if (resolved?.kind !== 'tree' || resolved.node.kind !== 'element') {
    return { ok: false, message: 'Select an image element to crop.' };
  }
  const result = applyStyleIntents(resolved.node.className ?? '', cropIntents(crop), { mode: 'free' });
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    steps: [
      {
        command: 'patchTreeNode',
        args: { id: target.nodeId, path: [...resolved.target.path], set: { className: result.className } },
        pageId,
      },
    ],
  };
}

/** The `src` of the selected tree image, for the cropper and the alt default. */
export function selectedImageSource(
  page: BuilderKernel,
  target: ElementTarget | undefined,
  assets: AssetTable = {},
): string | undefined {
  if (target === undefined) return undefined;
  const resolved = resolveElementTarget(page, target);
  if (resolved?.kind !== 'tree' || resolved.node.kind !== 'element' || resolved.node.tag !== 'img') return undefined;
  const src = resolved.node.attributes?.src;
  // A `/ck-assets/<id>` reference is the picture in the site's table.
  return src === undefined ? undefined : resolveCustomCodeAssetSrc(src, assets);
}
