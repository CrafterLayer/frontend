/**
 * The section kit (DESIGN §B): section templates adapted from HyperUI,
 * Tailark and Meraki UI (MIT; vendor/VENDOR.md), filled from slot values by
 * code, so a writer answers with one `kit.section` tool step instead of a
 * whole tree.
 */
export type { SectionKit, SectionKitRole, SectionKitSlot } from './types';
export { SECTION_KIT_ROLES } from './types';
export { SECTION_KITS } from './kits';
export {
  KIT_FLIP_CLASS,
  KIT_MARKER_PREFIX,
  checkKitSlots,
  instantiateKit,
  kitIdOfTree,
  readKitSlots,
  type InstantiateKitOptions,
  type InstantiateKitResult,
  type KitTree,
} from './instantiate';
export { KIT_INDEX_MAX_CHARS, defaultKitForVariant, kitIndex, sectionKit } from './kit-index';
export { SECTION_KIT_TOOLS } from './tools';
