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
import { mountBackToTop } from './back-to-top';
import { mountBgVideo } from './bg-video';
import { mountCarousel } from './carousel';
import { mountCompare } from './compare';
import { mountCountdown } from './countdown';
import { mountDismiss } from './dismiss';
import { mountEmbedFacade } from './embed-facade';
import { ENGINES_PACK_CSS, mountEngines } from './engines';
import { mountFilter } from './filter';
import { CAROUSEL_PACK_CSS, GALLERY_PACK_CSS } from './gallery-css';
import { mountGallery } from './gallery';
import { mountMailtoForm } from './mailto-form';
import { mountReadMore } from './read-more';
import { mountScripts } from './scripts';
import { mountScrollSpy } from './scroll-spy';
import { mountTableTools } from './table-tools';
import { mountToggleGroup } from './toggle-group';
import { mountTypedWords } from './typed-words';
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
  // blocks (2026-10-12): the Countdown block's live clock (`countdown-clock`).
  mountCountdown,
  // blocks (2026-10-12): the Table block's sort, search and pages (`table-tools`).
  mountTableTools,
  // everyday site behaviours (2026-10-13): each ships only to a page whose markup names it.
  mountBackToTop,
  mountReadMore,
  mountScrollSpy,
  mountTypedWords,
  mountFilter,
  mountDismiss,
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
  mountBackToTop,
  mountBgVideo,
  mountCarousel,
  mountCompare,
  mountCountdown,
  mountDismiss,
  mountEmbedFacade,
  mountEngines,
  mountFilter,
  mountGallery,
  mountMailtoForm,
  mountReadMore,
  mountScripts,
  mountScrollSpy,
  mountTableTools,
  mountToggleGroup,
  mountTypedWords,
  mountVideoPlayer,
};
export type { CkScriptApi } from './scripts';
