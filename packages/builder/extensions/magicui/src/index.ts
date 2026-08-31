/*
  @craftkit/builder-magicui — visual effects adapted from Magic UI (MIT),
  layer 4.

  The second effects pack, and it exists to prove the first one generalised:
  Aceternity and Magic UI are both copy-paste catalogs, both MIT, both built on
  Tailwind, and both adapted the same way — verbatim source under `vendor/`,
  the effect rewritten against `--t-*` so it follows the generated design
  system instead of shipping its author's palette.

  Adding a third catalog needs no architectural change at all. That was the
  point of doing the first two this way.
*/
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { ShineBorder, shineBorderSchema } from './components/ShineBorder';

export const builderMagicUi: TrustedExtensionManifest = {
  tier: 1,
  name: 'magicui',
  version: '0.1.0',
  contributes: {
    blocks: [{ schema: shineBorderSchema, render: ShineBorder }],
  },
};

export { ShineBorder, shineBorderSchema, type ShineBorderProps } from './components/ShineBorder';
