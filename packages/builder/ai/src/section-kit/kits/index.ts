import type { SectionKit } from '../types';
import { FOOTER_KITS, HEADER_KITS } from './chrome';
import { CLOSING_KITS } from './closing';
import { FEATURES_KITS } from './features';
import { HERO_KITS } from './hero';
import { MEDIA_KITS } from './media';
import { OFFER_KITS } from './offer';
import { PROOF_KITS } from './proof';

/** Every kit, in page order by role: header, hero, features, proof, offer, media, closing, footer. */
export const SECTION_KITS: readonly SectionKit[] = Object.freeze([
  ...HEADER_KITS,
  ...HERO_KITS,
  ...FEATURES_KITS,
  ...PROOF_KITS,
  ...OFFER_KITS,
  ...MEDIA_KITS,
  ...CLOSING_KITS,
  ...FOOTER_KITS,
]);
