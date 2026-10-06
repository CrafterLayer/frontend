import type { AgentTool } from '../tools/agent/types';
import { mediaAddTool } from './media-add';
import { motionAddTool } from './motion-add';

/**
 * The media agent tools (media-motion DESIGN §F, D9): `media.add` inserts a
 * gallery, video, scene or widget; `motion.add` puts a named scroll timeline
 * on an existing element. Two tools, not eight — the edit lane's prompt is the
 * budget. Registered in tools/agent/registry.ts after STYLE_AGENT_TOOLS.
 */
export const MEDIA_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  mediaAddTool,
  motionAddTool,
] as readonly AgentTool[]);

export { mediaAddTool, MEDIA_KINDS, VIDEO_MODES, type MediaAddInput, type MediaKind, type VideoMode } from './media-add';
export { motionAddTool, type MotionAddInput } from './motion-add';
export { readMedia, type MediaReading } from './direct-media';
export { heroOf, heroRegionId } from './placement';
export {
  catalogImages,
  mediaLocale,
  parseImageField,
  parseImagesField,
  resolveImage,
  resolveImages,
  topicBrief,
  type CatalogImagesOptions,
  type ImageRequest,
  type ImagesRequest,
} from './resolve-images';
export { resolveVideo, type ResolvedVideo, type VideoResolution } from './resolve-video';
