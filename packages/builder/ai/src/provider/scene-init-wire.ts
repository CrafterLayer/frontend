/** A request-local contract for a writer that selects tested initialization, never custom JS. */
export const SCENE_INITIALIZATION_HEADER = 'SCENE INITIALIZATION v1:';

/** Exact standalone line with bounded preset ids; general ready-scene advice does not qualify. */
export function isSceneInitializationRequest(request: string): boolean {
  return sceneInitializationIds(request) !== undefined;
}

export function sceneInitializationIds(request: string): readonly string[] | undefined {
  return /^SCENE INITIALIZATION v1: ([a-z][a-z0-9-]{0,79}(?:\|[a-z][a-z0-9-]{0,79}){0,3})$/mu
    .exec(request)?.[1]
    ?.split('|');
}
