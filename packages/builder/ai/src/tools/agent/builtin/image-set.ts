import { artKindOfUrl, isArtSpec, resolveArtImage } from '../../../art-catalog/runtime';
import { selectCatalogPhotos } from '../../../context/providers/photo-catalog';
import {
  PHOTO_CATALOG_ENTRIES,
  PHOTO_TOPIC_KEYWORDS,
  type PhotoOrientation,
  type PhotoTopic,
} from '../../../context/providers/photo-catalog.data';
import {
  fail,
  inputRecord,
  isElement,
  mapTree,
  okParse,
  readTree,
  setProp,
  treeNodes,
  unknownKeys,
  type TreeRoot,
} from '../shared';
import { COLUMN_IMAGE_SIZES, srcsetFor } from '../../../section-kit/srcset';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';

/**
 * image.set — swap one picture for a verified catalog photo.
 *
 * The img is found by its current `src`; the new one comes from
 * `selectCatalogPhotos` (never a remembered stock URL), with its intrinsic
 * `width`/`height` from the catalog entry so the page does not shift, a
 * responsive `srcset`, and the alt text the call supplies — required, in the
 * page's own language.
 */

export interface ImageSetInput {
  readonly id: string;
  readonly find: string;
  readonly subject: string;
  readonly aspect?: PhotoOrientation;
  readonly alt: string;
}

const ASPECTS: Readonly<Record<string, PhotoOrientation>> = {
  landscape: 'landscape',
  portrait: 'portrait',
  square: 'square',
  '16:9': 'landscape',
  '3:2': 'landscape',
  '4:3': 'landscape',
  '1:1': 'square',
  '4:5': 'portrait',
  '3:4': 'portrait',
  '2:3': 'portrait',
};

const TOPICS = Object.keys(PHOTO_TOPIC_KEYWORDS) as PhotoTopic[];

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<ImageSetInput>('input must be {"id","find","subject","alt"}.');
  const extra = unknownKeys(record, ['id', 'find', 'subject', 'aspect', 'alt']);
  if (extra.length > 0) return fail<ImageSetInput>(`unknown keys ${extra.join(', ')}; use id, find, subject, aspect, alt.`);
  const { id, find, subject, alt, aspect } = record;
  if (typeof id !== 'string' || id === '') return fail<ImageSetInput>('"id" must be the region id holding the image.');
  if (typeof find !== 'string' || find.trim() === '') return fail<ImageSetInput>('"find" must be the image\'s current src.');
  if (typeof subject !== 'string' || subject.trim() === '') {
    return fail<ImageSetInput>(`"subject" must name what the photo shows; topics: ${TOPICS.join(', ')}.`);
  }
  if (typeof alt !== 'string' || alt.trim() === '' || alt.length > 250) {
    return fail<ImageSetInput>('"alt" is required: 1-250 characters describing the photo in the page language.');
  }
  let orientation: PhotoOrientation | undefined;
  if (aspect !== undefined) {
    orientation = typeof aspect === 'string' ? ASPECTS[aspect] : undefined;
    if (orientation === undefined) return fail<ImageSetInput>('"aspect" is landscape, portrait, square, 16:9, 1:1 or 4:5.');
  }
  return okParse<ImageSetInput>({ id, find, subject, alt, ...(orientation === undefined ? {} : { aspect: orientation }) });
}

/** Host + path: the part of an address that names the picture (a character's seed is in its query). */
function pathOf(url: string): string {
  const address = url.replaceAll('&amp;', '&').trim();
  return artKindOfUrl(address) === 'character' ? address : address.replace(/[?#].*$/u, '');
}

/**
 * art catalog (2026-10-14): a `subject` such as 'illustration:doctor',
 * 'character:<style>:<seed>' or 'logo:visa' swaps the picture for the
 * verified art, square, with its alt in the page language.
 */
function runArt(
  input: ImageSetInput,
  context: AgentToolContext,
  tree: TreeRoot,
  wanted: string,
): AgentToolRun {
  const art = resolveArtImage(input.subject, { locale: context.locale.lang, alt: input.alt });
  if (!art.ok) return art;
  const { src, alt, width, height } = art.value;
  const next = mapTree(tree, (node) => {
    if (!isElement(node) || node.tag !== 'img' || pathOf(node.attributes?.['src'] ?? '') !== wanted)
      return node;
    const kept: Record<string, string> = { ...node.attributes };
    delete kept['srcset'];
    delete kept['sizes'];
    return {
      ...node,
      attributes: { ...kept, src, alt, width: String(width), height: String(height) },
    };
  });
  return { ok: true, steps: [setProp(input.id, 'tree', next)] };
}


/** A catalog photo's own description in the page's language, when it has one. */
function catalogAlt(
  entry: { readonly alt: { readonly ar: string; readonly en: string } } | undefined,
  lang: string,
): string | undefined {
  if (entry === undefined) return undefined;
  const text = (lang.trim().toLowerCase().startsWith('ar') ? entry.alt.ar : entry.alt.en).trim();
  return text === '' ? undefined : text;
}

function run(input: ImageSetInput, context: AgentToolContext): AgentToolRun {
  const tree = readTree(context, input.id);
  if (tree === undefined) return { ok: false, error: `"${input.id}" is not a composed region on this page.` };
  const wanted = pathOf(input.find);
  const images = treeNodes(tree).filter(
    (node) => isElement(node) && node.tag === 'img' && pathOf(node.attributes?.['src'] ?? '') === wanted,
  );
  if (images.length === 0) {
    return { ok: false, error: `no <img> in "${input.id}" has src "${input.find}"; quote the current src exactly.` };
  }
  if (isArtSpec(input.subject)) return runArt(input, context, tree, wanted);
  const subject = input.subject.trim().toLowerCase();
  const brief = (TOPICS as readonly string[]).includes(subject) ? `${subject} ${PHOTO_TOPIC_KEYWORDS[subject as PhotoTopic].en.join(' ')}` : input.subject;
  const photos = selectCatalogPhotos(brief).filter(
    (photo) => (input.aspect === undefined || photo.aspect === input.aspect) && pathOf(photo.url) !== wanted,
  );
  const photo = photos[0];
  if (photo === undefined) {
    return {
      ok: false,
      error: `no catalog photo matches subject "${input.subject}"${input.aspect === undefined ? '' : ` (${input.aspect})`}; use a topic: ${TOPICS.join(', ')}.`,
    };
  }
  const entry = PHOTO_CATALOG_ENTRIES.find((candidate) => candidate.url === photo.url);
  const srcset = srcsetFor(photo.url);
  const next = mapTree(tree, (node) => {
    if (!isElement(node) || node.tag !== 'img' || pathOf(node.attributes?.['src'] ?? '') !== wanted) return node;
    // The old picture's candidates never describe the new one.
    const kept: Record<string, string> = { ...node.attributes };
    delete kept['srcset'];
    delete kept['sizes'];
    return {
      ...node,
      attributes: {
        ...kept,
        src: photo.url,
        // The catalog entry was written from the picture; the caller's words describe the request.
        alt: catalogAlt(entry, context.locale.lang) ?? input.alt.trim(),
        ...(entry === undefined ? {} : { width: String(entry.width), height: String(entry.height) }),
        ...(srcset === undefined ? {} : { srcset, sizes: COLUMN_IMAGE_SIZES }),
      },
    };
  });
  return { ok: true, steps: [setProp(input.id, 'tree', next)] };
}

export const imageSetTool = defineAgentTool<ImageSetInput>({
  name: 'image.set',
  lanes: ['edit', 'section'],
  summary: 'Swap an image for a catalog photo',
  signature: '{id,find:src,subject,aspect?,alt}',
  parse,
  run,
});
