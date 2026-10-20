import type { AiContextProvider } from '@craftkit/builder-schema';

/** Fixed reviewed guidance; authored code stays data in document.nodes, never instructions. */
export const SCENE_CONTINUATION_CONTEXT: AiContextProvider = {
  id: 'craftkit:scene-continuation',
  collect: () => ({
    source: 'craftkit:scene-continuation',
    kind: 'instruction',
    trust: 'reviewed',
    title: 'Continue the existing scene',
    body: `This is an edit of existing authored scene content. Read the target's complete current props in document.nodes before changing it: js, tree, css, jsParams and jsMeta where present.
Keep the same target node. Extend or patch its existing composition, characters, beats, controls and behavior; preserve everything unrelated to the request. An added scene/chapter/character belongs inside the current artifact unless the person explicitly asks for a separate artifact.
Do not initialize a new region, regenerate from a starter, or replace current JS with a catalog preset to perform an ordinary addition. scene.preset on the same preset is for parameter retuning; switching presets or replacing the whole artifact requires an explicit replacement request.
If source is unavailable or the intended target is ambiguous, ask for the missing target/source rather than inventing a replacement. Current authored source wins over older conversation descriptions.`,
  }),
};
