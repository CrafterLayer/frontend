import { useEffect, useState } from 'react';

import type { AssetLibraryPort } from '@craftkit/builder-schema';

import type { ScriptParamsFormAsset } from '../ScriptParamsForm';

/** What an image param admits as an asset reference (`studio/params.ts`): a bare id. */
const ASSET_ID = /^[A-Za-z0-9_-]{1,200}$/u;

const NO_IMAGES: readonly ScriptParamsFormAsset[] = [];

/**
 * The host's picture library as the choices of an `image` param — the same
 * port the Inspector's image fields pick from. Read once per library while a
 * scene has an image param (`library` is undefined otherwise, so nothing is
 * fetched); a failed or aborted read simply offers no library, and the URL
 * field still works.
 */
export function useLibraryImages(
  library: AssetLibraryPort | undefined,
): readonly ScriptParamsFormAsset[] {
  const [loaded, setLoaded] = useState<{
    readonly library: AssetLibraryPort;
    readonly images: readonly ScriptParamsFormAsset[];
  } | null>(null);

  useEffect(() => {
    if (library === undefined) return undefined;
    const controller = new AbortController();
    library.list({ signal: controller.signal }).then(
      (entries) => {
        if (controller.signal.aborted) return;
        const images = entries
          .filter((entry) => ASSET_ID.test(entry.id))
          .map((entry) => ({
            id: entry.id,
            url: entry.url,
            label: entry.alt.trim() === '' ? entry.id : entry.alt,
          }));
        setLoaded({ library, images });
      },
      () => {
        // No library is an ordinary state: the URL field stays.
      },
    );
    return () => {
      controller.abort();
    };
  }, [library]);

  return loaded !== null && loaded.library === library ? loaded.images : NO_IMAGES;
}
