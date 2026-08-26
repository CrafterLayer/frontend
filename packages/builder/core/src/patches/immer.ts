import { enablePatches } from 'immer';

// Immer's patches plugin is opt-in and process-wide; this module is the single
// place that turns it on, and every patch producer/consumer imports from here.
enablePatches();

export { applyPatches, current, produceWithPatches } from 'immer';
