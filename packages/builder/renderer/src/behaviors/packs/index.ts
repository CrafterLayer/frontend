/**
 * The behaviour packs (media-motion DESIGN §2.1, D4): one self-contained,
 * serialisable `mount<Name>(root, options) => dispose` per file.
 *
 * - `script.ts` serialises `[mountBehaviors, ...BEHAVIOR_PACKS]` into
 *   `assets/ck-behaviors.js` for the published site;
 * - `mount.ts` (`mountSiteBehaviors`) mounts the same functions on the canvas;
 * - `PACK_CSS` is appended to `BEHAVIOR_CSS`, so `ensureBehaviorCss` and
 *   `assets/ck-behaviors.css` carry every pack's styles.
 */
import { mountBgVideo } from './bg-video';
import { mountCarousel } from './carousel';
import { mountCompare } from './compare';
import { mountEmbedFacade } from './embed-facade';
import { ENGINES_PACK_CSS, mountEngines } from './engines';
import { CAROUSEL_PACK_CSS, GALLERY_PACK_CSS } from './gallery-css';
import { mountGallery } from './gallery';
import { mountMailtoForm } from './mailto-form';
import { mountScripts } from './scripts';
import { mountToggleGroup } from './toggle-group';
import { VIDEO_PACK_CSS } from './video-css';
import { mountVideoPlayer } from './video-player';
import { WIDGETS_PACK_CSS } from './widgets-css';

export type BehaviorPack = (
  root: ParentNode,
  options?: { readonly interactive?: boolean },
) => () => void;

export const BEHAVIOR_PACKS: readonly BehaviorPack[] = [
  mountGallery,
  mountCarousel,
  mountVideoPlayer,
  mountBgVideo,
  mountEmbedFacade,
  mountCompare,
  mountToggleGroup,
  mountMailtoForm,
  mountEngines,
  // free-code mode (2026-10-09): a region's `js` (data-ck-js).
  mountScripts,
];

export const PACK_CSS: string = [
  GALLERY_PACK_CSS,
  CAROUSEL_PACK_CSS,
  VIDEO_PACK_CSS,
  WIDGETS_PACK_CSS,
  ENGINES_PACK_CSS,
]
  .map((css) => css.trim())
  .filter((css) => css !== '')
  .join('\n\n');

export {
  mountBgVideo,
  mountCarousel,
  mountCompare,
  mountEmbedFacade,
  mountEngines,
  mountGallery,
  mountMailtoForm,
  mountScripts,
  mountToggleGroup,
  mountVideoPlayer,
};
export type { CkScriptApi } from './scripts';
