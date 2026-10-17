import type { BilingualText } from '../types';

/*
  The template photo list's shared rules (agent-script DESIGN §B.2, package
  templates-core). The entries live one module per template family beside
  this file; ./index.ts joins them into TEMPLATE_PHOTOS.

  Every URL answered a real GET with 200 and an image/* content type on
  2026-10-08 (durable/agent-script/photo-verify.mjs; curl is blocked here, so
  the check uses node's fetch), and every photo was looked at on a contact
  sheet before its alt text was written: the alt says what is IN the picture,
  in both languages. Unbranded subjects only — no visible product logos.

  Sources: Unsplash (Unsplash License) and, where the shared photo catalog
  already has the topic, its Pexels entries copied verbatim
  (packages/builder/ai/src/context/providers/photo-catalog.data.ts, Pexels
  License). Both licences allow free commercial use without attribution.

  The sector photos (./sectors.ts) are the one exception to the date above:
  copied verbatim from that catalog, they carry its own verification date.

  Templates reach a photo only through `photo(topic, index, lang)` in
  ../build.ts, which throws on an unknown topic or index, so a typo fails a test
  instead of rendering a broken image. Indexes are positional: append, never
  reorder.
*/

export interface TemplatePhoto {
  /** The exact verified address (w=1600). Thumbnails swap in w=640. */
  readonly src: string;
  readonly alt: BilingualText;
  /** When `src` last answered 200 image/*. */
  readonly verifiedAt: string;
}

export const TEMPLATE_PHOTOS_VERIFIED_AT = '2026-10-08';
