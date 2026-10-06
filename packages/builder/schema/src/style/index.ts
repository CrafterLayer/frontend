/**
 * The style manager's headless engine (style-manager DESIGN.md §A.2–A.4).
 * Pure: no React, no DOM; its one dependency is tailwind-merge.
 */
export type {
  ApplyStyleOptions,
  ApplyStyleResult,
  ReadStyleOptions,
  ResolvedStyle,
  StyleBoxSide,
  StyleBucket,
  StyleCorner,
  StyleIntent,
  StyleLabels,
  StyleMode,
  StyleSide,
  StyleSource,
  StyleState,
  StyleValue,
} from './types';
export {
  isStylePropertyId,
  quickBarProperties,
  SPACING_SCALE,
  STYLE_PROPERTIES,
  STYLE_PROPERTY_IDS,
  STYLE_SECTORS,
  styleSidesOf,
  type StyleControlKind,
  type StyleElementKind,
  type StyleOption,
  type StylePhysicalSide,
  type StylePropertyDef,
  type StylePropertyId,
  type StyleRange,
  type StyleRawKind,
  type StyleSector,
  type StyleSectorId,
  type StyleSidePrefixes,
  type StyleTokenKind,
} from './catalogue';
export {
  BUCKET_LIMIT,
  BUCKET_PREFIX,
  bucketPrefix,
  slotPrefix,
  STATE_PREFIX,
  STYLE_STATES,
} from './class-syntax';
export { matchUtility, writeUtility, type UtilityMatch } from './codec';
export {
  applyStyleIntents,
  customBreakpointProperties,
  namedStyleUtilities,
  readStyle,
} from './engine';
export { normalizeResponsive } from './responsive';
export {
  expandNamedStyles,
  extractStyleClasses,
  NAMED_STYLE_PREFIX,
  namedStyleIds,
  pasteStyleClasses,
} from './named-styles';
export {
  tokensModeRejections,
  type TokensModeRejection,
  type TokensModeRejectionCode,
} from './tokens-mode';
export { ckTwMerge } from './tw-merge';
// COLOR_TOKENS / SPACING_TOKENS / CONTAINER_TOKENS stay internal: the schema
// barrel already exports a different COLOR_TOKENS from theme/design-system.ts.
export { TOKEN_UTILITY_NAMES, type TokenUtilityNamespace } from './token-utilities';
