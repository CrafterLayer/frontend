import type { StyleSectorId } from '@craftkit/builder-schema';

/** The class sectors the panel draws; motion has its own tab, advanced its own group. */
export const STYLE_PANEL_SECTORS: readonly StyleSectorId[] = [
  'layout',
  'spacing',
  'size',
  'position',
  'typography',
  'backgrounds',
  'borders',
  'effects',
  'transforms',
  'transitions',
];
