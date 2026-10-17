import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder';

/**
 * The pictures this playground can offer, and nothing beyond them (FR-050).
 *
 * ## Why they are drawings and not photographs
 *
 * Because a photograph library needs photographs, and this repository has none
 * it owns. The dishonest options were both available and both refused: shipping
 * remote URLs to someone else's stock host, which makes every generated site
 * depend on a third party staying up and licensing unchecked; or writing
 * photographic descriptions — "a kiln glowing in a workshop" — over images that
 * are nothing of the kind, which would make selection score against a lie and
 * put wrong alt text in front of a screen reader.
 *
 * So the library holds abstract grounds, drawn here, described as what they
 * are. Selection still works exactly as designed — it scores mood and palette
 * against the brief and the design system — and every alt text is true.
 *
 * ## Why it is a port and not an array
 *
 * FR-050: a host-supplied backend must be able to populate the same library,
 * including from people uploading images, with no change to how generation
 * selects from it. `list()` is the whole boundary. This implementation answers
 * from memory; the next one will answer from a network, and `selectAssets` will
 * not know the difference.
 */

const svg = (body: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">${body}</svg>`,
  )}`;

const linear = (id: string, from: string, to: string): string =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`;

const wash = (from: string, to: string): string =>
  svg(`${linear('g', from, to)}<rect width="1200" height="800" fill="url(%23g)"/>`);

const arcs = (from: string, to: string, ink: string): string =>
  svg(
    `${linear('g', from, to)}<rect width="1200" height="800" fill="url(%23g)"/>` +
      `<g fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="28">` +
      `<circle cx="300" cy="640" r="220"/><circle cx="760" cy="240" r="300"/></g>`,
  );

const grid = (ground: string, ink: string): string =>
  svg(
    `<rect width="1200" height="800" fill="${ground}"/>` +
      `<g fill="${ink}" fill-opacity=".2">` +
      Array.from({ length: 24 }, (_unused, index) => {
        const column = index % 6;
        const row = Math.floor(index / 6);
        return `<rect x="${String(90 + column * 180)}" y="${String(90 + row * 180)}" width="120" height="120" rx="24"/>`;
      }).join('') +
      `</g>`,
  );

const horizon = (sky: string, ground: string, sun: string): string =>
  svg(
    `${linear('g', sky, ground)}<rect width="1200" height="800" fill="url(%23g)"/>` +
      `<circle cx="880" cy="250" r="130" fill="${sun}" fill-opacity=".75"/>` +
      `<path d="M0 640 L340 400 L560 560 L760 430 L1200 700 L1200 800 L0 800 Z" fill="${ground}" fill-opacity=".55"/>`,
  );

/**
 * Ten grounds across the moods a small business site actually needs.
 *
 * The metadata is what selection reads, so it is written for that job: `mood`
 * carries the words a brief uses ("warm", "formal", "calm"), `palette` carries
 * the colours the design system will be compared against, and `description`
 * says what the picture is so a person reading a chosen result can tell whether
 * the choice was reasonable.
 */
export const LOCAL_ASSETS: readonly AssetEntry[] = [
  {
    id: 'ember-wash',
    url: wash('%23c2410c', '%237c2d12'),
    description: 'A warm amber and rust gradient, deepening toward the corner',
    mood: ['warm', 'craft', 'bold', 'food'],
    palette: ['#c2410c', '#7c2d12'],
    alt: 'A warm gradient moving from amber to deep rust',
    width: 1200,
    height: 800,
  },
  {
    id: 'ink-wash',
    url: wash('%231e293b', '%230f172a'),
    description: 'A deep slate gradient, almost black at one edge',
    mood: ['formal', 'quiet', 'serious', 'technology'],
    palette: ['#1e293b', '#0f172a'],
    alt: 'A dark gradient moving from slate to near black',
    width: 1200,
    height: 800,
  },
  {
    id: 'sea-wash',
    url: wash('%230e7490', '%23155e75'),
    description: 'A cool teal gradient, calm and even',
    mood: ['calm', 'clean', 'health', 'clinic'],
    palette: ['#0e7490', '#155e75'],
    alt: 'A calm gradient moving between two shades of teal',
    width: 1200,
    height: 800,
  },
  {
    id: 'sand-wash',
    url: wash('%23fde68a', '%23d97706'),
    description: 'A pale sand gradient warming to honey',
    mood: ['warm', 'welcome', 'food', 'bakery'],
    palette: ['#fde68a', '#d97706'],
    alt: 'A soft gradient moving from pale sand to honey',
    width: 1200,
    height: 800,
  },
  {
    id: 'violet-arcs',
    url: arcs('%236d28d9', '%233b0764', '%23e9d5ff'),
    description: 'Two large pale arcs crossing a violet ground',
    mood: ['bold', 'creative', 'studio', 'agency'],
    palette: ['#6d28d9', '#3b0764'],
    alt: 'Two wide pale circles overlapping on a violet background',
    width: 1200,
    height: 800,
  },
  {
    id: 'moss-arcs',
    url: arcs('%23166534', '%23052e16', '%23bbf7d0'),
    description: 'Two pale arcs crossing a deep green ground',
    mood: ['calm', 'natural', 'garden', 'growth'],
    palette: ['#166534', '#052e16'],
    alt: 'Two wide pale circles overlapping on a deep green background',
    width: 1200,
    height: 800,
  },
  {
    id: 'paper-grid',
    url: grid('%23f8fafc', '%23334155'),
    description: 'A grid of rounded squares on a near-white ground',
    mood: ['order', 'formal', 'office', 'law', 'consulting'],
    palette: ['#f8fafc', '#334155'],
    alt: 'A regular grid of rounded squares on an off-white background',
    width: 1200,
    height: 800,
  },
  {
    id: 'slate-grid',
    url: grid('%230f172a', '%2394a3b8'),
    description: 'A grid of rounded squares on a dark slate ground',
    mood: ['order', 'technology', 'product', 'dashboard'],
    palette: ['#0f172a', '#94a3b8'],
    alt: 'A regular grid of rounded squares on a dark slate background',
    width: 1200,
    height: 800,
  },
  {
    id: 'dawn-horizon',
    url: horizon('%23fca5a5', '%237f1d1d', '%23fef3c7'),
    description: 'A low ridge under a pale sun, in dawn reds',
    mood: ['warm', 'early', 'travel', 'welcome'],
    palette: ['#fca5a5', '#7f1d1d'],
    alt: 'A simple ridge line beneath a pale sun in reds and cream',
    width: 1200,
    height: 800,
  },
  {
    id: 'dusk-horizon',
    url: horizon('%23a5b4fc', '%23312e81', '%23fef9c3'),
    description: 'A low ridge under a pale sun, in dusk indigos',
    mood: ['calm', 'quiet', 'travel', 'evening'],
    palette: ['#a5b4fc', '#312e81'],
    alt: 'A simple ridge line beneath a pale sun in indigo and cream',
    width: 1200,
    height: 800,
  },
];

export interface LocalAssetLibraryOptions {
  /** Overrides the entries; used to depict an empty library. */
  readonly entries?: readonly AssetEntry[];
}

export function createLocalAssetLibrary(options: LocalAssetLibraryOptions = {}): AssetLibraryPort {
  const entries = options.entries ?? LOCAL_ASSETS;
  return {
    list(listOptions: { signal?: AbortSignal } | undefined) {
      /*
        Answered from memory, but honouring the signal anyway. The next
        implementation will be a network call, and a caller that never learned
        to expect an abort here would leak a request per cancelled run.
      */
      if (listOptions?.signal?.aborted === true) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      return Promise.resolve(entries);
    },
  };
}
