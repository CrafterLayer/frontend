import Matter from 'matter-js';

/** Matter.js is plain JavaScript and does not bind to Pixi. */
export function createPhysicsLibrary() {
  return Matter;
}
