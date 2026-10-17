import { CORE_PHOTOS } from './core';
import { PEOPLE_PHOTOS, PORTRAIT_PHOTOS } from './people';
import { SECTOR_PHOTOS } from './sectors';
import type { TemplatePhoto } from './verified';
import { VERTICAL_PHOTOS } from './verticals';

/*
  The template photo list, one module per template family; ./verified.ts holds
  the rules every entry follows, and each module says where its photos came
  from. Templates reach a photo only through `photo(topic, index, lang)` in
  ../build.ts. Topics never collide across modules, and indexes are
  positional: append, never reorder.
*/
export const TEMPLATE_PHOTOS: Readonly<Record<string, readonly TemplatePhoto[]>> = {
  ...CORE_PHOTOS,
  ...PEOPLE_PHOTOS,
  // templates-verticals additions
  ...VERTICAL_PHOTOS,
  ...PORTRAIT_PHOTOS,
  // end templates-verticals additions
  ...SECTOR_PHOTOS,
};

export { TEMPLATE_PHOTOS_VERIFIED_AT, type TemplatePhoto } from './verified';
