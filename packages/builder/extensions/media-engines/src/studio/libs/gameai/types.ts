/* The `gameai` Studio library's public shapes (game libraries, 2026-10-12). */

import type { Fsm, FsmState } from './fsm';
import type { AI_LIMITS, GridSource, NavGrid, Point } from './grid';

/** The display object an agent drives (a Pixi Container, Sprite or Graphics, structurally). */
export interface DisplayLike {
  x: number;
  y: number;
  rotation?: number;
  scale?: { x: number };
  destroyed?: boolean;
}

/** The part of the Studio scene `s` the library reads (passed as `create(s)`). */
export interface GameAiSceneLike {
  random?(): number;
  dispose?(fn: () => void): void;
}

export interface GameAiOptions {
  /** Agent cap, 1..AI_LIMITS.maxAgents (default AI_LIMITS.agents). */
  max?: number;
  /** Random source for wander; default the scene's seeded s.random. */
  rng?: () => number;
  /** Seed when neither rng nor a scene is given. */
  seed?: number;
}

export interface AgentOptions {
  /** Start position (default: the display object's). */
  x?: number;
  y?: number;
  /** Top speed in px/s (default 100). */
  speed?: number;
  /** Steering force (default speed × 6): higher turns sharper. */
  force?: number;
  /** Lower turns and accelerates faster (default 0.2: about a fifth of a second to top speed). */
  mass?: number;
  /** Collision radius for avoidance and separation (default 12). */
  radius?: number;
  /** Collides with the grid's solid cells as a square box of this side (default radius × 1.6). */
  size?: number;
  /** Stop at solid cells of the controller's grid (set ai.grid first). */
  solid?: boolean;
  /** Turn the display to face its velocity. */
  rotate?: boolean;
  /** Mirror the display's scale.x by horizontal direction (side-view sprites). */
  flip?: boolean;
}

interface Weight {
  weight?: number;
}

export interface Agent {
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly speed: number;
  /** Direction of travel, radians. */
  readonly heading: number;
  /** False while chase() finds no path to its target. */
  readonly reachable: boolean;
  readonly display: DisplayLike | null;
  seek(target: Point, options?: Weight): Agent;
  flee(target: Point, options?: Weight & { panic?: number }): Agent;
  arrive(target: Point, options?: Weight & { slow?: number }): Agent;
  pursue(target: Point, options?: Weight & { predict?: number }): Agent;
  evade(target: Point, options?: Weight & { panic?: number; predict?: number }): Agent;
  wander(options?: Weight & { radius?: number; distance?: number; jitter?: number }): Agent;
  follow(points: readonly Point[], options?: Weight & { loop?: boolean; reach?: number }): Agent;
  patrol(points: readonly Point[], options?: Weight & { reach?: number }): Agent;
  chase(target: Point, options?: Weight & { grid?: NavGrid; every?: number }): Agent;
  avoid(options?: Weight): Agent;
  separate(options?: Weight & { radius?: number }): Agent;
  /** Drop every behaviour (keeps moving on momentum). */
  clear(): Agent;
  /** Drop every behaviour and stand still. */
  stop(): Agent;
  near(target: Point, distance: number): boolean;
  distanceTo(target: Point): number;
  remove(): void;
}

export interface GameAi {
  readonly limits: typeof AI_LIMITS;
  readonly agents: number;
  grid(source: Partial<GridSource>, options?: { diagonal?: boolean }): NavGrid;
  agent(display: unknown, options?: AgentOptions): Agent;
  obstacle(x: number, y: number, radius: number): { remove(): void };
  fsm(states: Readonly<Record<string, FsmState>>, initial: string): Fsm;
  /** Step steering, chases, collisions, display sync and machines; call from s.fixedTick. */
  update(dt: number): void;
  dispose(): void;
}
