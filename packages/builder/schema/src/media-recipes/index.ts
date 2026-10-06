/**
 * Media recipes (media-motion DESIGN D10, 2026-10-06): the ONE set of pure tree
 * builders behind the agent's `media.add` / `motion.add` tools and the shell's
 * manual Insert presets. Every output passes `customCodeTreeSchema`.
 */
export {
  isMediaRecipeError,
  mediaRecipeNode,
  mediaSection,
  type ImageLoading,
  type MediaHeading,
  type MediaImage,
  type MediaLocale,
  type MediaRecipe,
  type MediaRecipeError,
  type MediaRecipeResult,
  type MediaSectionOptions,
} from './types';
export { mediaRecipeProblems } from './checks';
export {
  classifyVideoUrl,
  mapsEmbedUrl,
  mapsLinkUrl,
  videoEmbedUrl,
  vimeoPageUrl,
  VIDEO_HLS_REFUSAL,
  VIDEO_URL_REFUSAL,
  youtubeThumb,
  youtubeWatchUrl,
  type VideoUrlClass,
} from './urls';
export {
  BG_VIDEO_HOST,
  buildBgVideoLayer,
  buildVideoFacade,
  buildVideoPlayer,
  buildVideoSection,
  type BgVideoLayerOptions,
  type VideoCaptions,
  type VideoFacadeOptions,
  type VideoFile,
  type VideoPlayerOptions,
  type VideoPoster,
  type VideoSectionOptions,
} from './video';
export {
  buildGallery,
  GALLERY_LAYOUTS,
  GALLERY_MAX_IMAGES,
  type GalleryLayout,
  type GalleryOptions,
} from './gallery';
export {
  buildSceneLayer,
  buildSceneSection,
  SCENE_HOST,
  SCENE_MAX_IMAGES,
  SCENES_NEEDING_IMAGES,
  type SceneLayerOptions,
  type SceneSectionOptions,
} from './scene';
export {
  applyAttributePatch,
  clearTimelineAttrs,
  depthAttrs,
  timelineAttrs,
  timelineLabel,
  type MediaAttributePatch,
  type TimelineAttrOptions,
} from './timeline';
export {
  buildCompare,
  buildLottie,
  buildMailtoForm,
  buildMapFacade,
  buildPricingToggle,
  PRICING_MAX_PLANS,
  type CompareOptions,
  type MailtoFormOptions,
  type PricingPlan,
  type PricingToggleOptions,
  type WidgetOptions,
} from './widgets';
