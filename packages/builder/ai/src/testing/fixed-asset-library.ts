import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

/**
 * A library that answers the same way every time (T130).
 *
 * Selection is scored arithmetic over descriptions, moods and palettes, so a
 * test needs a library whose CONTENT is fixed — otherwise every assertion about
 * which picture was chosen is really an assertion about whatever the real
 * library happened to hold that day.
 *
 * It also has to be able to fail on purpose. An empty library and an
 * unavailable one are normal outcomes the pipeline must degrade through
 * (FR-051), and the only honest way to test a degradation is to cause it.
 */

export interface FixedAssetLibraryOptions {
  /** What the library holds. Defaults to the six entries below. */
  readonly entries?: readonly AssetEntry[];
  /** Throw instead of answering, with this message. */
  readonly unavailable?: string | undefined;
  /** Never settle, so a caller's abort is the only way out. */
  readonly hang?: boolean | undefined;
}

export const FIXED_ASSETS: readonly AssetEntry[] = [
  {
    id: 'kiln',
    url: 'https://assets.example.test/kiln.jpg',
    description: 'A ceramics kiln glowing in a workshop',
    mood: ['warm', 'craft', 'quiet'],
    palette: ['#c2410c', '#1f2937'],
    alt: 'A kiln glowing orange in a dim ceramics workshop',
    width: 1600,
    height: 1067,
  },
  {
    id: 'throwing',
    url: 'https://assets.example.test/throwing.jpg',
    description: 'Hands throwing a clay pot on a wheel',
    mood: ['craft', 'hands', 'focus'],
    palette: ['#78716c', '#f5f5f4'],
    alt: 'Two hands shaping a clay pot on a spinning wheel',
    width: 1600,
    height: 1067,
  },
  {
    id: 'shelf',
    url: 'https://assets.example.test/shelf.jpg',
    description: 'Finished ceramics drying on a wooden shelf',
    mood: ['calm', 'craft', 'order'],
    palette: ['#a8a29e', '#fafaf9'],
    alt: 'Rows of unglazed bowls drying on a wooden shelf',
    width: 1600,
    height: 1067,
  },
  {
    id: 'desk',
    url: 'https://assets.example.test/desk.jpg',
    description: 'A tidy law office desk with documents',
    mood: ['formal', 'quiet', 'order'],
    palette: ['#1e3a8a', '#f8fafc'],
    alt: 'A desk with neatly stacked documents and a pen',
    width: 1600,
    height: 1067,
  },
  {
    id: 'meeting',
    url: 'https://assets.example.test/meeting.jpg',
    description: 'Two people talking across a meeting table',
    mood: ['formal', 'people'],
    palette: ['#334155', '#e2e8f0'],
    alt: 'Two people in conversation across a meeting table',
    width: 1600,
    height: 1067,
  },
  {
    id: 'bread',
    url: 'https://assets.example.test/bread.jpg',
    description: 'Bread cooling on a bakery rack at dawn',
    mood: ['warm', 'early', 'craft'],
    palette: ['#b45309', '#fef3c7'],
    alt: 'Loaves of bread cooling on a metal bakery rack',
    width: 1600,
    height: 1067,
  },
];

export function createFixedAssetLibrary(options: FixedAssetLibraryOptions = {}): AssetLibraryPort {
  return {
    list(listOptions) {
      if (options.hang === true) {
        return new Promise<readonly AssetEntry[]>((_resolve, reject) => {
          const abort = (): void => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };
          if (listOptions?.signal?.aborted === true) {
            abort();
            return;
          }
          listOptions?.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      if (options.unavailable !== undefined) {
        return Promise.reject(new Error(options.unavailable));
      }
      return Promise.resolve(options.entries ?? FIXED_ASSETS);
    },
  };
}
