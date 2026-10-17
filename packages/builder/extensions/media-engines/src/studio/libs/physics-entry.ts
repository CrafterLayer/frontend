import Matter from 'matter-js';

import { createWorld, type MatterSlice } from './physics/world';

/**
 * Matter.js is plain JavaScript and does not bind to Pixi: every Matter module stays on
 * s.lib.physics unchanged. `world(s, options)` (particles and physics, 2026-10-13) is the
 * optional scene wiring — engine, walls, fixed-step loop, body ↔ display links, pointer drag,
 * calm settling and disposal (physics/world.ts).
 */
export function createPhysicsLibrary() {
  return { ...Matter, world: createWorld(Matter as unknown as MatterSlice) };
}
