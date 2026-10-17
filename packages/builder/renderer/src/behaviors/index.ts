export { mountBehaviors } from './runtime';
export { BEHAVIOR_CSS, ensureBehaviorCss, ensureMotionCss } from './behaviors-css';
export {
  BEHAVIOR_RUNTIME_SELECTOR,
  SCRIPT_SELECTOR,
  behaviorRuntimeScript,
  codeUsesPixi,
  hasBehaviors,
  // media-motion (2026-10-06): which lazy engines (scene, timeline, lottie) a page uses.
  pageEngines,
  type PageEngine,
} from './script';
export { replayMotion } from './preview';
// media-motion (2026-10-06): the behaviour packs and their composed mount.
export { mountRegionScripts, mountSiteBehaviors } from './mount';
// free-code mode (2026-10-09): the region-script runtime and the `ck` object it hands a script.
export { mountScripts, type CkScriptApi } from './packs';
export { BEHAVIOR_PACKS, PACK_CSS, type BehaviorPack } from './packs';
