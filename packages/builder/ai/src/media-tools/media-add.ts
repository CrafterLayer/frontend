import {
  BG_VIDEO_HOST,
  buildBgVideoLayer,
  buildCompare,
  buildGallery,
  buildLottie,
  buildMapFacade,
  buildPricingToggle,
  buildSceneLayer,
  buildSceneSection,
  buildVideoFacade,
  buildVideoPlayer,
  buildVideoSection,
  CUSTOM_CODE_SCENES,
  GALLERY_LAYOUTS,
  GALLERY_MAX_IMAGES,
  isMediaRecipeError,
  PRICING_MAX_PLANS,
  SCENE_DENSITIES,
  SCENE_HOST,
  SCENE_MAX_IMAGES,
  SCENE_PALETTES,
  SCENES_NEEDING_IMAGES,
  type CustomCodeScene,
  type GalleryLayout,
  type MediaImage,
  type MediaRecipe,
  type MediaRecipeResult,
  type PricingPlan,
  type SceneDensity,
  type ScenePalette,
} from '@craftkit/builder-schema';

import { isRecord, readTree } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolParse, type AgentToolRun } from '../tools/agent/types';
import { heroRegionId, insertBehind, insertInto, insertSection } from './placement';
import {
  mediaLocale,
  pagePoster,
  parseImageField,
  parseImagesField,
  resolveImage,
  resolveImages,
  type ImageRequest,
  type ImagesRequest,
} from './resolve-images';
import { resolveVideo } from './resolve-video';

/**
 * media.add — one call adds a gallery, a video, a canvas scene or a widget
 * (media-motion DESIGN §F.1, D9/D10). The tree comes from the shared schema
 * builders (`@craftkit/builder-schema` media recipes, the same ones the shell's
 * Insert presets call), images from the verified catalog with alt text in the
 * page language, and the result is ONE `insertNode customCode` (a new
 * section) or `insertTreeNode` steps into an existing region (`into`,
 * `behind`). The door judges every step; the model writes ~40 tokens.
 */

export const MEDIA_KINDS = ['gallery', 'video', 'scene', 'compare', 'pricing', 'map', 'lottie'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const VIDEO_MODES = ['player', 'background', 'facade'] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

export interface MediaAddInput {
  readonly kind: MediaKind;
  readonly after?: string | undefined;
  readonly into?: string | undefined;
  readonly behind?: string | undefined;
  readonly title?: string | undefined;
  readonly text?: string | undefined;
  // gallery
  readonly layout?: GalleryLayout | undefined;
  readonly images?: ImagesRequest | undefined;
  readonly count?: number | undefined;
  readonly captions?: boolean | undefined;
  // video
  readonly url?: string | undefined;
  readonly mode?: VideoMode | undefined;
  readonly poster?: ImageRequest | undefined;
  readonly captionsUrl?: string | undefined;
  // scene
  readonly scene?: CustomCodeScene | undefined;
  readonly density?: SceneDensity | undefined;
  readonly palette?: ScenePalette | undefined;
  // compare
  readonly before?: ImageRequest | undefined;
  readonly afterImage?: ImageRequest | undefined;
  // pricing
  readonly plans?: readonly PricingPlan[] | undefined;
  readonly sides?: { readonly a: string; readonly b: string } | undefined;
  // map
  readonly address?: string | undefined;
  // lottie
  readonly src?: string | undefined;
}

const COMMON_KEYS = ['kind', 'after', 'into', 'behind', 'title'] as const;

const KIND_KEYS: Readonly<Record<MediaKind, readonly string[]>> = {
  gallery: ['layout', 'images', 'count', 'captions'],
  video: ['url', 'mode', 'poster', 'captions', 'text'],
  scene: ['scene', 'density', 'palette', 'images', 'count', 'text'],
  compare: ['images', 'before'],
  pricing: ['plans', 'sides'],
  map: ['address'],
  lottie: ['src', 'poster'],
};

const MAX_TITLE = 120;
const MAX_TEXT = 300;
const MAX_ID = 120;
const GALLERY_DEFAULT_COUNT = 6;

type Parse = AgentToolParse<MediaAddInput>;

function no(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

function oneOf<T extends string>(value: unknown, list: readonly T[], key: string): { ok: true; value: T | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string' && (list as readonly string[]).includes(value)) return { ok: true, value: value as T };
  return no(`"${key}" is one of ${list.join(', ')}.`);
}

function text(value: unknown, key: string, max: number): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    return no(`"${key}" must be text of 1-${String(max)} characters.`);
  }
  return { ok: true, value: value.trim() };
}

function nodeId(value: unknown, key: string): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_ID) {
    return no(`"${key}" is the node id of a region on the page.`);
  }
  return { ok: true, value: value.trim() };
}

function parsePlans(value: unknown): { ok: true; value: readonly PricingPlan[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0 || value.length > PRICING_MAX_PLANS) {
    return no(`"plans" is 1-${String(PRICING_MAX_PLANS)} of {"name","a","b","features?"} (a = monthly price, b = yearly).`);
  }
  const plans: PricingPlan[] = [];
  for (const [index, entry] of (value as unknown[]).entries()) {
    const where = `plans[${String(index)}]`;
    if (!isRecord(entry)) return no(`${where} must be {"name","a","b","features?"}.`);
    const extra = Object.keys(entry).filter((key) => !['name', 'a', 'b', 'features'].includes(key));
    if (extra.length > 0) return no(`${where}: unknown keys ${extra.join(', ')}; use name, a, b, features.`);
    const fields: Record<'name' | 'a' | 'b', string> = { name: '', a: '', b: '' };
    for (const key of ['name', 'a', 'b'] as const) {
      const raw = entry[key];
      const field = typeof raw === 'number' ? String(raw) : raw;
      if (typeof field !== 'string' || field.trim() === '' || field.length > 60) {
        return no(`${where}.${key} must be text of 1-60 characters${key === 'name' ? '' : ' (the price as shown, e.g. "9 JD")'}.`);
      }
      fields[key] = field.trim();
    }
    const features = entry['features'];
    if (
      features !== undefined &&
      (!Array.isArray(features) ||
        features.length > 8 ||
        (features as unknown[]).some((feature) => typeof feature !== 'string' || feature.length > 80))
    ) {
      return no(`${where}.features is at most 8 texts of up to 80 characters.`);
    }
    plans.push({ ...fields, ...(features === undefined ? {} : { features: features as string[] }) });
  }
  return { ok: true, value: plans };
}

function parse(input: unknown): Parse {
  if (!isRecord(input)) return no(`input must be {"kind":${MEDIA_KINDS.map((kind) => `"${kind}"`).join('|')},…}.`);
  const kind = input['kind'];
  if (typeof kind !== 'string' || !(MEDIA_KINDS as readonly string[]).includes(kind)) {
    return no(`"kind" is one of ${MEDIA_KINDS.join(', ')}.`);
  }
  const media = kind as MediaKind;
  const known = [...COMMON_KEYS, ...KIND_KEYS[media]];
  const extra = Object.keys(input).filter((key) => !known.includes(key));
  if (extra.length > 0) return no(`unknown keys ${extra.join(', ')} for kind ${media}; it takes ${known.join(', ')}.`);

  // A compare given `before` reads `after` as the after picture, not a placement.
  const compareImages = media === 'compare' && input['before'] !== undefined;
  const after = compareImages ? { ok: true as const, value: undefined } : nodeId(input['after'], 'after');
  if (!after.ok) return after;
  const into = nodeId(input['into'], 'into');
  if (!into.ok) return into;
  const behind = nodeId(input['behind'], 'behind');
  if (!behind.ok) return behind;
  const placements = [after.value, into.value, behind.value].filter((value) => value !== undefined);
  if (placements.length > 1) return no('say where with at most one of "after" (a new section), "into" or "behind" (a region id).');
  if (behind.value !== undefined && media !== 'scene' && media !== 'video') {
    return no('"behind" places a background layer: only kind scene or a background video takes it; use "into" or "after".');
  }
  if (into.value !== undefined && media === 'scene') return no('a scene is a background: put it "behind" a region, or omit both for a new section.');
  const title = text(input['title'], 'title', MAX_TITLE);
  if (!title.ok) return title;

  const base: MediaAddInput = {
    kind: media,
    ...(after.value === undefined ? {} : { after: after.value }),
    ...(into.value === undefined ? {} : { into: into.value }),
    ...(behind.value === undefined ? {} : { behind: behind.value }),
    ...(title.value === undefined ? {} : { title: title.value }),
  };

  switch (media) {
    case 'gallery': {
      const layout = oneOf(input['layout'], GALLERY_LAYOUTS, 'layout');
      if (!layout.ok) return layout;
      const images = parseImagesField(input['images'], 'images', GALLERY_MAX_IMAGES);
      if (!images.ok) return images;
      const count = input['count'];
      if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > GALLERY_MAX_IMAGES)) {
        return no(`"count" is a whole number of images, 1-${String(GALLERY_MAX_IMAGES)} (default ${String(GALLERY_DEFAULT_COUNT)}).`);
      }
      const captions = input['captions'];
      if (captions !== undefined && typeof captions !== 'boolean') return no('"captions" is true or false.');
      return {
        ok: true,
        value: {
          ...base,
          ...(layout.value === undefined ? {} : { layout: layout.value }),
          ...(images.value === undefined ? {} : { images: images.value }),
          ...(count === undefined ? {} : { count }),
          ...(captions === undefined ? {} : { captions }),
        },
      };
    }
    case 'video': {
      const url = input['url'];
      if (typeof url !== 'string' || url.trim() === '') {
        return no('"url" is required: the YouTube, Vimeo or .mp4/.webm address from the request. Never invent one; ask for it.');
      }
      const mode = oneOf(input['mode'], VIDEO_MODES, 'mode');
      if (!mode.ok) return mode;
      if (behind.value !== undefined && mode.value !== undefined && mode.value !== 'background') {
        return no('"behind" plays the video as a background: use mode "background", or "into"/"after" for a player.');
      }
      if (into.value !== undefined && mode.value === 'background') {
        return no('a background video goes "behind" a region (or omit placement for a new hero section), not "into" it.');
      }
      const poster = parseImageField(input['poster'], 'poster');
      if (!poster.ok) return poster;
      const captionsUrl = text(input['captions'], 'captions', 2_000);
      if (!captionsUrl.ok) return no('"captions" is the https or uploaded address of a .vtt file.');
      const body = text(input['text'], 'text', MAX_TEXT);
      if (!body.ok) return body;
      return {
        ok: true,
        value: {
          ...base,
          url: url.trim(),
          ...(mode.value === undefined ? (behind.value === undefined ? {} : { mode: 'background' as const }) : { mode: mode.value }),
          ...(poster.value === undefined ? {} : { poster: poster.value }),
          ...(captionsUrl.value === undefined ? {} : { captionsUrl: captionsUrl.value }),
          ...(body.value === undefined ? {} : { text: body.value }),
        },
      };
    }
    case 'scene': {
      const scene = oneOf(input['scene'], CUSTOM_CODE_SCENES, 'scene');
      if (!scene.ok) return scene;
      if (scene.value === undefined) return no(`"scene" is required: one of ${CUSTOM_CODE_SCENES.join(', ')}.`);
      const density = oneOf(input['density'], SCENE_DENSITIES, 'density');
      if (!density.ok) return density;
      const palette = oneOf(input['palette'], SCENE_PALETTES, 'palette');
      if (!palette.ok) return palette;
      const images = parseImagesField(input['images'], 'images', SCENE_MAX_IMAGES);
      if (!images.ok) return images;
      const count = input['count'];
      if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > SCENE_MAX_IMAGES)) {
        return no(`"count" is 1-${String(SCENE_MAX_IMAGES)} scene images.`);
      }
      const body = text(input['text'], 'text', MAX_TEXT);
      if (!body.ok) return body;
      return {
        ok: true,
        value: {
          ...base,
          scene: scene.value,
          ...(density.value === undefined ? {} : { density: density.value }),
          ...(palette.value === undefined ? {} : { palette: palette.value }),
          ...(images.value === undefined ? {} : { images: images.value }),
          ...(count === undefined ? {} : { count }),
          ...(body.value === undefined ? {} : { text: body.value }),
        },
      };
    }
    case 'compare': {
      if (compareImages) {
        const before = parseImageField(input['before'], 'before');
        if (!before.ok) return before;
        const afterImage = parseImageField(input['after'], 'after');
        if (!afterImage.ok) return afterImage;
        if (afterImage.value === undefined) return no('with "before", give "after" too: the after picture.');
        return { ok: true, value: { ...base, before: before.value, afterImage: afterImage.value } };
      }
      const images = parseImagesField(input['images'], 'images', 2);
      if (!images.ok) return images;
      if (images.value?.kind === 'list' && images.value.images.length !== 2) {
        return no('"images" for a compare is exactly two: [before, after].');
      }
      return { ok: true, value: { ...base, ...(images.value === undefined ? {} : { images: images.value }) } };
    }
    case 'pricing': {
      const plans = parsePlans(input['plans']);
      if (!plans.ok) return plans;
      const sides = input['sides'];
      if (sides !== undefined) {
        if (!isRecord(sides) || typeof sides['a'] !== 'string' || typeof sides['b'] !== 'string' || sides['a'].trim() === '' || sides['b'].trim() === '') {
          return no('"sides" is {"a","b"}: the two labels, e.g. {"a":"شهري","b":"سنوي"}.');
        }
        return { ok: true, value: { ...base, plans: plans.value, sides: { a: sides['a'].trim().slice(0, 30), b: sides['b'].trim().slice(0, 30) } } };
      }
      return { ok: true, value: { ...base, plans: plans.value } };
    }
    case 'map': {
      const address = text(input['address'], 'address', 300);
      if (!address.ok || address.value === undefined) return no('"address" is required: the place as people search it, at most 300 characters.');
      return { ok: true, value: { ...base, address: address.value } };
    }
    case 'lottie': {
      const src = input['src'];
      if (typeof src !== 'string' || !/^https:\/\/\S+\.json(?:[?#]\S*)?$/iu.test(src.trim())) {
        return no('"src" is the https address of a Lottie .json file.');
      }
      const poster = parseImageField(input['poster'], 'poster');
      if (!poster.ok) return poster;
      return { ok: true, value: { ...base, src: src.trim(), ...(poster.value === undefined ? {} : { poster: poster.value }) } };
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

function built(result: MediaRecipeResult): { ok: true; recipe: MediaRecipe } | { ok: false; error: string } {
  return isMediaRecipeError(result) ? { ok: false, error: result.error } : { ok: true, recipe: result };
}

/** Whether a region sits on the first screen: the hero, or the first region of the page. */
function aboveFold(context: AgentToolContext, id: string): boolean {
  return heroRegionId(context) === id;
}

function place(context: AgentToolContext, input: MediaAddInput, recipe: MediaRecipe, anchor: string): AgentToolRun {
  if (input.into !== undefined) return insertInto(context, input.into, recipe);
  return insertSection(context, recipe, { after: input.after, title: input.title, anchor });
}

function runGallery(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const count = input.count ?? (input.images?.kind === 'list' ? input.images.images.length : GALLERY_DEFAULT_COUNT);
  const images = resolveImages(context, input.images, count);
  if (!images.ok) return images;
  const recipe = built(
    buildGallery({
      layout: input.layout,
      images: images.value,
      captions: input.captions,
      title: input.title,
      locale: mediaLocale(context),
      standalone: input.into === undefined,
    }),
  );
  if (!recipe.ok) return recipe;
  const run = place(context, input, recipe.recipe, 'gallery');
  return run.ok ? { ...run, note: `gallery ${input.layout ?? 'grid'} · ${String(images.value.length)} images` } : run;
}

function poster(context: AgentToolContext, request: ImageRequest | undefined): { ok: true; image: MediaImage | undefined } | { ok: false; error: string } {
  if (request === undefined) return { ok: true, image: pagePoster(context) };
  const resolved = resolveImage(context, request);
  return resolved.ok ? { ok: true, image: resolved.value } : resolved;
}

function runVideo(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const video = resolveVideo(input.url);
  if (!video.ok) return video;
  const locale = mediaLocale(context);
  const picture = poster(context, input.poster);
  if (!picture.ok) return picture;
  const embedded = video.video.kind === 'youtube' || video.video.kind === 'vimeo' ? video.video : undefined;
  if (input.mode === 'background' && embedded !== undefined) {
    return {
      ok: false,
      error: 'a background video needs an https or uploaded .mp4/.webm file; YouTube and Vimeo play through the facade (mode player).',
    };
  }
  if (input.behind !== undefined) {
    if (video.video.kind !== 'file') return { ok: false, error: 'a background video needs an .mp4/.webm file.' };
    const layer = built(buildBgVideoLayer({ src: video.video.src, type: video.video.type, poster: picture.image }));
    if (!layer.ok) return layer;
    return insertBehind(context, input.behind, layer.recipe, {
      className: BG_VIDEO_HOST.className,
      behavior: BG_VIDEO_HOST.attributes['data-ck-behavior'],
    });
  }
  if (input.into !== undefined) {
    const element =
      embedded !== undefined
        ? buildVideoFacade(locale, { video: embedded, poster: picture.image, title: input.title })
        : video.video.kind === 'file'
          ? buildVideoPlayer(locale, {
              src: video.video.src,
              type: video.video.type,
              poster: picture.image,
              captions: input.captionsUrl,
              title: input.title,
            })
          : { error: 'unsupported video' };
    const recipe = built(element);
    if (!recipe.ok) return recipe;
    return insertInto(context, input.into, recipe.recipe);
  }
  const recipe = built(
    buildVideoSection(locale, {
      url: video.video.kind === 'file' ? video.video.src : (input.url ?? ''),
      mode: input.mode,
      // A catalog poster keeps the facade free of third-party requests until the click (DESIGN Q3, §4.2);
      // with no page topic the facade falls back to YouTube's own still.
      poster: picture.image,
      captions: input.captionsUrl,
      title: input.title,
      text: input.text,
    }),
  );
  if (!recipe.ok) return recipe;
  return insertSection(context, recipe.recipe, { after: input.after, title: input.title, anchor: 'video' });
}

const SCENE_IMAGE_COUNT: Readonly<Record<CustomCodeScene, number>> = {
  particles: 1,
  'mesh-gradient': 1,
  'parallax-layers': 3,
  mural: 6,
  ripple: 1,
};

function runScene(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const scene = input.scene ?? 'particles';
  const needsImages = SCENES_NEEDING_IMAGES.includes(scene);
  let images: readonly MediaImage[] = [];
  if (needsImages || input.images !== undefined) {
    const resolved = resolveImages(context, input.images, input.count ?? SCENE_IMAGE_COUNT[scene]);
    if (!resolved.ok) return resolved;
    images = resolved.value;
  }
  if (input.behind !== undefined) {
    if (readTree(context, input.behind) === undefined) {
      return { ok: false, error: `"behind": "${input.behind}" is not a composed region on this page.` };
    }
    const layer = built(
      buildSceneLayer({
        scene,
        density: input.density,
        palette: input.palette,
        images,
        aboveFold: aboveFold(context, input.behind),
      }),
    );
    if (!layer.ok) return layer;
    const run = insertBehind(context, input.behind, layer.recipe, { className: SCENE_HOST.className });
    return run.ok ? { ...run, note: `scene ${scene} behind ${input.behind}` } : run;
  }
  const recipe = built(
    buildSceneSection({
      scene,
      density: input.density,
      palette: input.palette,
      images,
      locale: mediaLocale(context),
      title: input.title,
      text: input.text,
      aboveFold: false,
    }),
  );
  if (!recipe.ok) return recipe;
  return insertSection(context, recipe.recipe, { after: input.after, title: input.title, anchor: 'scene' });
}

function runCompare(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  let pair: readonly MediaImage[];
  if (input.before !== undefined && input.afterImage !== undefined) {
    const before = resolveImage(context, input.before);
    if (!before.ok) return before;
    const after = resolveImage(context, input.afterImage, new Set(before.value === undefined ? [] : [before.value.src]));
    if (!after.ok) return after;
    pair = [before.value, after.value].filter((image): image is MediaImage => image !== undefined);
  } else {
    const resolved = resolveImages(context, input.images, 2);
    if (!resolved.ok) return resolved;
    pair = resolved.value;
  }
  const [before, after] = pair;
  if (before === undefined || after === undefined) {
    return { ok: false, error: "a before/after compare needs two pictures; give images:'catalog:<topic>' or [before, after]." };
  }
  const recipe = built(
    buildCompare({ locale: mediaLocale(context), title: input.title, standalone: input.into === undefined, before, after }),
  );
  if (!recipe.ok) return recipe;
  return place(context, input, recipe.recipe, 'compare');
}

function runPricing(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const recipe = built(
    buildPricingToggle({
      locale: mediaLocale(context),
      title: input.title,
      standalone: input.into === undefined,
      plans: input.plans ?? [],
      ...(input.sides === undefined ? {} : { sides: input.sides }),
    }),
  );
  if (!recipe.ok) return recipe;
  return place(context, input, recipe.recipe, 'pricing');
}

function runMap(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const recipe = built(
    buildMapFacade(input.address ?? '', { locale: mediaLocale(context), title: input.title, standalone: input.into === undefined }),
  );
  if (!recipe.ok) return recipe;
  return place(context, input, recipe.recipe, 'map');
}

function runLottie(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  const posterImage = resolveImage(context, input.poster);
  if (!posterImage.ok) return posterImage;
  const recipe = built(
    buildLottie(input.src ?? '', posterImage.value, {
      locale: mediaLocale(context),
      title: input.title,
      standalone: input.into === undefined,
    }),
  );
  if (!recipe.ok) return recipe;
  return place(context, input, recipe.recipe, 'animation');
}

function run(input: MediaAddInput, context: AgentToolContext): AgentToolRun {
  switch (input.kind) {
    case 'gallery':
      return runGallery(input, context);
    case 'video':
      return runVideo(input, context);
    case 'scene':
      return runScene(input, context);
    case 'compare':
      return runCompare(input, context);
    case 'pricing':
      return runPricing(input, context);
    case 'map':
      return runMap(input, context);
    case 'lottie':
      return runLottie(input, context);
  }
}

export const mediaAddTool = defineAgentTool<MediaAddInput>({
  name: 'media.add',
  lanes: ['edit', 'build'],
  summary: 'Add a gallery, video, scene or widget',
  signature: '{kind,after?:id,into?:id,behind?:id,…}',
  parse,
  run,
});
