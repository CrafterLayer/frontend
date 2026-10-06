import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

import type { SiteGroupStep } from '@craftkit/builder-core';
import type { AssetEntry, AssetLibraryPort, Author } from '@craftkit/builder-schema';

import type { ElementTarget } from '../../custom-code/element-target';
import { AssetPicker } from '../AssetPicker';
import { commitSiteSteps, useSiteSnapshot, type SiteDoor } from '../DesignSystemPanel/site-door';
import { IconBrowser } from '../IconBrowser/IconBrowser';
import type { IconBrowserLabels } from '../IconBrowser/IconBrowser.labels';
import { iconSteps } from '../IconBrowser/icon-search';
import { ImageCropper } from '../ImageCropper/ImageCropper';
import type { ImageCropperLabels } from '../ImageCropper/ImageCropper.labels';
import type { CropValue } from '../ImageCropper/crop-math';
import { AssetCard } from './AssetCard';
import { ASSET_MANAGER_LABELS_EN, type AssetManagerLabels } from './AssetManager.labels';
import { AssetUploadZone } from './AssetUploadZone';
import {
  cropElementSteps,
  freshAssetId,
  selectedImageSource,
  uploadedAssetEntry,
  assetUseSteps,
} from './asset-steps';
import { prepareImageUpload, type ImageCodec } from './image-upload';
import '../../styles/visually-hidden.css';
import './AssetManager.css';

export interface AssetManagerProps {
  /** The site kernel (or any `SiteDoor`). */
  readonly site: SiteDoor;
  /** The host's photo catalogue; absent ⇒ only the site's own pictures. */
  readonly library?: AssetLibraryPort | undefined;
  /** The selected element: "use on selected", crop and icons act on it. */
  readonly target?: ElementTarget | undefined;
  /** Test seam: the canvas codec. */
  readonly codec?: ImageCodec | undefined;
  /** Test seam: a new asset id. */
  readonly newAssetId?: (() => string) | undefined;
  readonly author?: Author | undefined;
  readonly labels?: AssetManagerLabels | undefined;
  readonly cropperLabels?: ImageCropperLabels | undefined;
  readonly iconLabels?: IconBrowserLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

type Status =
  | { readonly kind: 'busy' | 'done' | 'refused'; readonly text: string }
  | undefined;

type Cropping =
  | { readonly kind: 'upload'; readonly file: File; readonly src: string }
  | { readonly kind: 'element'; readonly src: string }
  | undefined;

function objectUrl(file: File): string | undefined {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;
}

/**
 * The Assets rail (style-manager DESIGN.md §G): the site's pictures and the
 * host's photo catalogue, upload by picker or drop (resized to ≤ 2400px, WebP
 * q≈0.85, ≤ 2 MB, stored inline), alt text, an optional crop before saving,
 * crop of the selected image, "use on selected", delete (refused while
 * referenced, with where), and the icon browser. Every write is one labelled
 * transaction through the site door.
 */
export function AssetManager({
  site,
  library,
  target,
  codec,
  newAssetId,
  author = 'user',
  labels = ASSET_MANAGER_LABELS_EN,
  cropperLabels,
  iconLabels,
  dir,
}: AssetManagerProps) {
  const snapshot = useSiteSnapshot(site);
  const [status, setStatus] = useState<Status>(undefined);
  const [cropping, setCropping] = useState<Cropping>(undefined);
  const pageId = site.currentPage();
  const page = site.page(pageId);
  const assets = Object.values(snapshot.assets);
  const selectedSrc = selectedImageSource(page, target);

  const send = (steps: readonly SiteGroupStep[], label: string): boolean => {
    const sent = commitSiteSteps(site, steps, label, author);
    setStatus(sent.ok ? { kind: 'done', text: label } : { kind: 'refused', text: sent.message });
    return sent.ok;
  };
  const refuse = (message: string): void => {
    setStatus({ kind: 'refused', text: message });
  };

  const upload = async (file: File, crop?: CropValue): Promise<void> => {
    setStatus({ kind: 'busy', text: labels.uploading });
    const prepared = await prepareImageUpload(file, { codec, crop });
    if (!prepared.ok) {
      refuse(labels.refusals[prepared.reason]);
      return;
    }
    const id = newAssetId?.() ?? freshAssetId(site.getSite());
    const entry = uploadedAssetEntry(id, prepared.image, file.name);
    if (send([{ command: 'registerAsset', args: { entry } }], labels.commit.upload(entry.description))) {
      setStatus({ kind: 'done', text: labels.uploaded(entry.description) });
    }
  };

  const applyAsset = (entry: AssetEntry): void => {
    const registered = Object.hasOwn(snapshot.assets, entry.id);
    if (target === undefined) {
      /* Nothing selected: a catalogue photo joins the site's pictures. */
      if (registered) refuse(labels.selectFirst);
      else send([{ command: 'registerAsset', args: { entry } }], labels.commit.upload(entry.description));
      return;
    }
    const steps = assetUseSteps(page, target, entry, pageId);
    if (!steps.ok) {
      refuse(steps.message);
      return;
    }
    const register = registered ? [] : [{ command: 'registerAsset', args: { entry } }];
    send([...register, ...steps.steps], labels.commit.use(entry.description));
  };

  return (
    <section className="bldr-asset-manager" aria-label={labels.title} dir={dir}>
      <h3 className="bldr-asset-manager__title">{labels.title}</h3>
      <Tabs.Root className="bldr-asset-manager__tabs" defaultValue="pictures" dir={dir}>
        <Tabs.List className="bldr-asset-manager__tablist" aria-label={labels.tabs}>
          <Tabs.Trigger className="bldr-asset-manager__tab" value="pictures">
            {labels.pictures}
          </Tabs.Trigger>
          <Tabs.Trigger className="bldr-asset-manager__tab" value="icons">
            {labels.icons}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className="bldr-asset-manager__panel" value="pictures">
          {cropping === undefined ? (
            <>
              <AssetUploadZone
                labels={labels}
                busy={status?.kind === 'busy'}
                onFile={(file, cropFirst) => {
                  const src = cropFirst ? objectUrl(file) : undefined;
                  if (src === undefined) {
                    void upload(file);
                    return;
                  }
                  setCropping({ kind: 'upload', file, src });
                }}
              />
              {selectedSrc === undefined || target === undefined ? null : (
                <button
                  type="button"
                  className="bldr-asset-manager__button"
                  onClick={() => {
                    setCropping({ kind: 'element', src: selectedSrc });
                  }}
                >
                  {labels.cropSelected}
                </button>
              )}
            </>
          ) : (
            <ImageCropper
              src={cropping.src}
              labels={cropperLabels}
              dir={dir}
              onCancel={() => {
                if (cropping.kind === 'upload') URL.revokeObjectURL(cropping.src);
                setCropping(undefined);
              }}
              onApply={(crop) => {
                setCropping(undefined);
                if (cropping.kind === 'upload') {
                  URL.revokeObjectURL(cropping.src);
                  void upload(cropping.file, crop);
                  return;
                }
                if (target === undefined) return;
                const steps = cropElementSteps(page, target, crop, pageId);
                if (steps.ok) send(steps.steps, labels.commit.crop);
                else refuse(steps.message);
              }}
            />
          )}

          <p className="bldr-asset-manager__status" role="status" data-kind={status?.kind}>
            {status?.text ?? ''}
          </p>

          <h4 className="bldr-asset-manager__subtitle">{labels.siteAssets}</h4>
          {assets.length === 0 ? (
            <p className="bldr-asset-manager__muted">{labels.noAssets}</p>
          ) : (
            <ul className="bldr-asset-manager__grid" aria-label={labels.siteAssets}>
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  labels={labels}
                  onAlt={(alt) => {
                    send(
                      [{ command: 'updateAsset', args: { id: asset.id, patch: { alt } } }],
                      labels.commit.alt(asset.description),
                    );
                  }}
                  onUse={
                    target === undefined
                      ? undefined
                      : () => {
                          applyAsset(asset);
                        }
                  }
                  onRemove={() => {
                    send([{ command: 'removeAsset', args: { id: asset.id } }], labels.commit.remove(asset.description));
                  }}
                />
              ))}
            </ul>
          )}

          {library === undefined ? null : (
            <>
              <h4 className="bldr-asset-manager__subtitle">{labels.catalogue}</h4>
              <AssetPicker
                library={library}
                label={labels.catalogue}
                filterLabel={labels.catalogueFilter}
                onSelect={applyAsset}
              />
            </>
          )}
        </Tabs.Content>

        <Tabs.Content className="bldr-asset-manager__panel" value="icons">
          <IconBrowser
            labels={iconLabels}
            dir={dir}
            onPick={(name) => {
              if (target === undefined) {
                refuse(labels.selectFirst);
                return;
              }
              const steps = iconSteps(page, target, name, pageId);
              if (steps.ok) send(steps.steps, labels.commit.icon(name));
              else refuse(steps.message);
            }}
          />
          <p className="bldr-asset-manager__status" role="status" data-kind={status?.kind}>
            {status?.text ?? ''}
          </p>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
