import type { StyleSource as StyleValueSource } from '@craftkit/builder-schema';

/** Where a control's value comes from: the engine's provenance, or nothing at all. */
export type ValueOrigin = StyleValueSource | 'unset';
