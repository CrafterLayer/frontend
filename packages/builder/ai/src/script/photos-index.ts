import { PHOTO_CATALOG } from '../context/providers/photo-catalog';
import type { ScriptPhoto } from './types';

/**
 * The verified photo catalog as a script reads it (`ck.photos(topic, n)`,
 * agent-script DESIGN §A.4): every entry's topic, its fetched address and its
 * alt text in the page's language. Only addresses that were fetched and
 * looked at reach a script, so a script cannot invent an image URL either.
 */
export function scriptPhotos(lang: string): readonly ScriptPhoto[] {
  const arabic = lang.trim().toLowerCase().startsWith('ar');
  return PHOTO_CATALOG.map((entry) => ({
    topic: entry.topic,
    src: entry.url,
    alt: arabic ? entry.alt.ar : entry.alt.en,
  }));
}
