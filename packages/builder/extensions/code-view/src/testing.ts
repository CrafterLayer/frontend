// TEST-ONLY entry. The loopback runs the real worker handlers without the
// thread hop (jsdom has no Worker), and raw client construction exists so a
// test can drive it against that loopback. NEITHER belongs on the production
// surface: re-exporting them from the main entry put worker/client.ts and
// worker/protocol.ts on every consumer's initial module graph, taxing sessions
// that never open the code view (SC-006's spirit; review 011/T033 finding 8).
export { createLoopbackWorkerLike } from './worker/loopback';
export { createTransformWorkerClient } from './worker/client';
export type {
  TransformWorkerClient,
  TransformWorkerClientSnapshot,
  WorkerLike,
} from './worker/client';
