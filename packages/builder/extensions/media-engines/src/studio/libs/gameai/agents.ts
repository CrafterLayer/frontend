/*
  `s.lib.gameai.create(s, options?)` (game libraries, 2026-10-12): yuka (MIT) steering vehicles
  bound to Pixi display objects, grid pathfinding over tile worlds and small state machines.

    const ai = s.lib.gameai.create(s);                    // s.random drives every random choice
    const grid = ai.grid(world);                          // a s.lib.tilemap world
    const bat = ai.agent(sprite, { x, y, speed: 110, solid: true });
    bat.chase(hero);                                      // A* around walls, re-planned as hero moves
    s.fixedTick((dt) => { …move hero…; ai.update(dt); });

  Yuka steers on its x/z ground plane; the scene's (x, y) pixels map to yuka's (x, z), and after
  each update every agent writes x, y (and optionally rotation or a mirrored scale.x) back to its
  display object. Each behaviour kind is held once per agent: calling seek() again retargets it,
  and follow/patrol/chase share one path slot. Targets are read LIVE every update — pass the
  hero's sprite or box, not a copy of its position.

  Bounded: AI_LIMITS agents (create option `max`, ≤ maxAgents), obstacles, waypoints, path cells
  and search nodes. dispose() (also registered with s.dispose) empties the entity manager,
  machines and grids; display objects stay the scene's.
*/

import {
  ArriveBehavior,
  EntityManager,
  EvadeBehavior,
  FleeBehavior,
  FollowPathBehavior,
  GameEntity,
  MovingEntity,
  ObstacleAvoidanceBehavior,
  Path,
  PursuitBehavior,
  SeekBehavior,
  Vector3,
  Vehicle,
  type SteeringBehavior,
} from 'yuka';

import { createFsm, type Fsm, type FsmState } from './fsm';
import { AI_LIMITS, createNavGrid, type GridSource, type NavGrid, type Point } from './grid';
import { SeededWanderBehavior, SpacingBehavior } from './behaviors';
import type {
  Agent,
  AgentOptions,
  DisplayLike,
  GameAi,
  GameAiOptions,
  GameAiSceneLike,
} from './types';

type Kind =
  'seek' | 'flee' | 'arrive' | 'pursue' | 'evade' | 'wander' | 'path' | 'avoid' | 'separate';

interface Chase {
  readonly target: Point;
  readonly grid: NavGrid;
  readonly every: number;
  readonly path: Path;
  timer: number;
  cell: string;
  last: Vector3 | null;
  found: boolean;
}

interface AgentRecord {
  readonly handle: Agent;
  readonly vehicle: Vehicle;
  readonly display: DisplayLike | null;
  readonly kinds: Map<Kind, SteeringBehavior>;
  readonly refresh: Map<Kind, () => void>;
  chase: Chase | null;
  readonly solid: boolean;
  readonly w: number;
  readonly h: number;
  readonly rotate: boolean;
  readonly flip: boolean;
}

interface Proxy {
  readonly entity: MovingEntity;
  readonly source: Point;
  x: number;
  y: number;
}

const finite = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

function readPoint(value: unknown): Point {
  const point = value as Partial<Point> | null | undefined;
  return { x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
}

/*
  FollowPathBehavior arrives at its last waypoint through an internal ArriveBehavior whose default
  deceleration (3) is tuned for metres: at Pixi scale the final approach would crawl for seconds.
*/
function settle(behavior: FollowPathBehavior): FollowPathBehavior {
  const inner = (behavior as unknown as { _arrive?: { deceleration: number; tolerance: number } })
    ._arrive;
  if (inner !== undefined) {
    inner.deceleration = 0.5;
    inner.tolerance = 1;
  }
  return behavior;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createGameAi(
  // Authored scene code is plain JavaScript: the scene or options may be anything.
  scene: GameAiSceneLike | null | undefined,
  input?: GameAiOptions | null,
): GameAi {
  const options = input ?? {};
  const random =
    typeof options.rng === 'function'
      ? options.rng
      : typeof scene?.random === 'function'
        ? scene.random.bind(scene)
        : mulberry32(finite(options.seed, 1, 0, 2 ** 32));
  const max = Math.round(finite(options.max, AI_LIMITS.agents, 1, AI_LIMITS.maxAgents));
  const manager = new EntityManager();
  const records = new Map<Agent, AgentRecord>();
  const proxies = new Map<Point, Proxy>();
  const obstacles: GameEntity[] = [];
  const machines = new Set<Fsm>();
  let grid: NavGrid | null = null;
  let disposed = false;

  const live = (): void => {
    if (disposed) throw new Error('gameai: this controller was disposed');
  };

  /** The yuka entity standing for a target: an agent's vehicle, or a proxy that tracks a point. */
  function entityOf(target: Point): MovingEntity {
    const record = records.get(target as Agent);
    if (record !== undefined) return record.vehicle;
    let proxy = proxies.get(target);
    if (proxy === undefined) {
      const entity = new MovingEntity();
      const { x, y } = readPoint(target);
      entity.position.set(x, 0, y);
      proxy = { entity, source: target, x, y };
      proxies.set(target, proxy);
    }
    return proxy.entity;
  }

  function vectorFollowing(record: AgentRecord, kind: Kind, target: Point): Vector3 {
    const vector = new Vector3();
    const copy = (): void => {
      const { x, y } = readPoint(target);
      vector.set(x, 0, y);
    };
    copy();
    record.refresh.set(kind, copy);
    return vector;
  }

  function put(record: AgentRecord, kind: Kind, behavior: SteeringBehavior, weight: unknown) {
    const previous = record.kinds.get(kind);
    if (previous !== undefined) record.vehicle.steering.remove(previous);
    behavior.weight = finite(weight, 1, 0, 10);
    record.vehicle.steering.add(behavior);
    record.kinds.set(kind, behavior);
    if (kind !== 'path') return;
    record.chase = null;
  }

  function drop(record: AgentRecord): void {
    record.vehicle.steering.clear();
    record.kinds.clear();
    record.refresh.clear();
    record.chase = null;
  }

  function followPath(points: readonly Point[], loop: boolean, reach: number) {
    const path = new Path();
    path.loop = loop;
    for (const point of points.slice(0, AI_LIMITS.waypoints)) {
      const { x, y } = readPoint(point);
      path.add(new Vector3(x, 0, y));
    }
    return settle(new FollowPathBehavior(path, reach));
  }

  function plan(record: AgentRecord, chase: Chase): void {
    const from = { x: record.vehicle.position.x, y: record.vehicle.position.z };
    const to = readPoint(chase.target);
    const cells = chase.grid.path(from, to);
    chase.path.clear();
    chase.found = cells.length > 0;
    // The agent's own cell is behind it; the last waypoint is the target itself, kept live.
    for (const cell of cells.slice(1, -1)) chase.path.add(new Vector3(cell.x, 0, cell.y));
    chase.last = new Vector3(to.x, 0, to.y);
    chase.path.add(chase.found ? chase.last : new Vector3(from.x, 0, from.y));
    const goal = chase.grid.cellOf(to.x, to.y);
    chase.cell = `${String(goal.col)},${String(goal.row)}`;
    chase.timer = chase.every;
  }

  function makeAgent(display: DisplayLike | null, agentOptions: AgentOptions): Agent {
    live();
    if (records.size >= max) throw new RangeError(`gameai: at most ${String(max)} agents`);
    const vehicle = new Vehicle();
    const radius = finite(agentOptions.radius, 12, 1, 512);
    const speed = finite(agentOptions.speed, 100, 0, 5000);
    vehicle.maxSpeed = speed;
    vehicle.maxForce = finite(agentOptions.force, speed * 6, 0, 100_000);
    vehicle.mass = finite(agentOptions.mass, 0.2, 0.01, 1000);
    vehicle.boundingRadius = radius;
    const start = {
      x: finite(agentOptions.x, display?.x ?? 0, -1e6, 1e6),
      y: finite(agentOptions.y, display?.y ?? 0, -1e6, 1e6),
    };
    vehicle.position.set(start.x, 0, start.y);
    const size = finite(agentOptions.size, radius * 1.6, 1, 1024);
    const handle = {} as Agent;
    const record: AgentRecord = {
      handle,
      vehicle,
      display,
      kinds: new Map(),
      refresh: new Map(),
      chase: null,
      solid: agentOptions.solid === true,
      w: size,
      h: size,
      rotate: agentOptions.rotate === true,
      flip: agentOptions.flip === true,
    };
    const chain =
      <T extends unknown[]>(fn: (...args: T) => void) =>
      (...args: T): Agent => {
        if (records.has(handle)) fn(...args);
        return handle;
      };
    Object.assign(handle, {
      seek: chain((target: Point, o?: { weight?: number }) => {
        put(record, 'seek', new SeekBehavior(vectorFollowing(record, 'seek', target)), o?.weight);
      }),
      flee: chain((target: Point, o?: { panic?: number; weight?: number }) => {
        const panic = finite(o?.panic, radius * 12, 0, 1e5);
        put(
          record,
          'flee',
          new FleeBehavior(vectorFollowing(record, 'flee', target), panic),
          o?.weight,
        );
      }),
      arrive: chain((target: Point, o?: { slow?: number; weight?: number }) => {
        const behavior = new ArriveBehavior(
          vectorFollowing(record, 'arrive', target),
          finite(o?.slow, 0.5, 0.05, 10),
          1,
        );
        put(record, 'arrive', behavior, o?.weight);
      }),
      pursue: chain((target: Point, o?: { weight?: number; predict?: number }) => {
        const behavior = new PursuitBehavior(entityOf(target), finite(o?.predict, 1, 0, 5));
        put(record, 'pursue', behavior, o?.weight);
      }),
      evade: chain((target: Point, o?: { panic?: number; weight?: number; predict?: number }) => {
        const panic = finite(o?.panic, radius * 12, 0, 1e5);
        const behavior = new EvadeBehavior(entityOf(target), panic, finite(o?.predict, 1, 0, 5));
        put(record, 'evade', behavior, o?.weight);
      }),
      wander: chain(
        (o?: { radius?: number; distance?: number; jitter?: number; weight?: number }) => {
          const behavior = new SeededWanderBehavior(
            random,
            finite(o?.radius, 30, 1, 1e4),
            finite(o?.distance, 60, 0, 1e4),
            finite(o?.jitter, 150, 0, 1e5),
          );
          put(record, 'wander', behavior, o?.weight);
        },
      ),
      follow: chain(
        (points: readonly Point[], o?: { loop?: boolean; reach?: number; weight?: number }) => {
          if (!Array.isArray(points) || points.length === 0) return;
          const reach = finite(o?.reach, radius * 1.5, 1, 1e4);
          put(record, 'path', followPath(points, o?.loop === true, reach), o?.weight);
        },
      ),
      patrol: chain((points: readonly Point[], o?: { reach?: number; weight?: number }) => {
        handle.follow(points, { ...o, loop: true });
      }),
      chase: chain((target: Point, o?: { grid?: NavGrid; every?: number; weight?: number }) => {
        const chaseGrid = o?.grid ?? grid;
        if (chaseGrid === null) {
          handle.arrive(target, o);
          return;
        }
        const path = new Path();
        const reach = Math.max(4, chaseGrid.tileSize * 0.35);
        put(record, 'path', settle(new FollowPathBehavior(path, reach)), o?.weight);
        record.chase = {
          target,
          grid: chaseGrid,
          every: finite(o?.every, 0.5, 0.1, 10),
          path,
          timer: 0,
          cell: '',
          last: null,
          found: false,
        };
        plan(record, record.chase);
      }),
      avoid: chain((o?: { weight?: number }) => {
        const behavior = new ObstacleAvoidanceBehavior(obstacles);
        behavior.dBoxMinLength = radius * 4;
        put(record, 'avoid', behavior, o?.weight ?? 2);
      }),
      separate: chain((o?: { radius?: number; weight?: number }) => {
        vehicle.updateNeighborhood = true;
        vehicle.neighborhoodRadius = finite(o?.radius, radius * 4, 1, 1e4);
        put(record, 'separate', new SpacingBehavior(), o?.weight);
      }),
      clear: chain(() => {
        drop(record);
      }),
      stop: chain(() => {
        drop(record);
        vehicle.velocity.set(0, 0, 0);
      }),
      near: (target: Point, distance: number) => handle.distanceTo(target) <= distance,
      distanceTo: (target: Point) => {
        const { x, y } = readPoint(target);
        return Math.hypot(vehicle.position.x - x, vehicle.position.z - y);
      },
      remove: () => {
        if (!records.delete(handle)) return;
        drop(record);
        manager.remove(vehicle);
      },
    });
    Object.defineProperties(handle, {
      x: {
        get: () => vehicle.position.x,
        set: (value: number) => {
          vehicle.position.x = finite(value, vehicle.position.x, -1e6, 1e6);
        },
      },
      y: {
        get: () => vehicle.position.z,
        set: (value: number) => {
          vehicle.position.z = finite(value, vehicle.position.z, -1e6, 1e6);
        },
      },
      vx: { get: () => vehicle.velocity.x },
      vy: { get: () => vehicle.velocity.z },
      speed: { get: () => vehicle.getSpeed() },
      heading: { get: () => Math.atan2(vehicle.velocity.z, vehicle.velocity.x) },
      reachable: { get: () => record.chase?.found ?? true },
      display: { value: display },
    });
    records.set(handle, record);
    manager.add(vehicle);
    return handle;
  }

  function sync(record: AgentRecord): void {
    const display = record.display;
    if (display === null || display.destroyed === true) return;
    const { position, velocity } = record.vehicle;
    display.x = position.x;
    display.y = position.z;
    if (record.rotate && record.vehicle.getSpeedSquared() > 1e-6)
      display.rotation = Math.atan2(velocity.z, velocity.x);
    if (record.flip && display.scale !== undefined && Math.abs(velocity.x) > 1)
      display.scale.x = Math.sign(velocity.x) * Math.abs(display.scale.x);
  }

  const before = new Map<AgentRecord, { x: number; y: number }>();

  function update(dt: number): void {
    if (disposed || !(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    for (const proxy of proxies.values()) {
      const { x, y } = readPoint(proxy.source);
      proxy.entity.velocity.set((x - proxy.x) / step, 0, (y - proxy.y) / step);
      proxy.entity.position.set(x, 0, y);
      proxy.x = x;
      proxy.y = y;
    }
    before.clear();
    for (const record of records.values()) {
      for (const refresh of record.refresh.values()) refresh();
      const chase = record.chase;
      if (chase !== null) {
        chase.timer -= step;
        const to = readPoint(chase.target);
        const cell = chase.grid.cellOf(to.x, to.y);
        if (chase.timer <= 0 || `${String(cell.col)},${String(cell.row)}` !== chase.cell)
          plan(record, chase);
        else if (chase.found) chase.last?.set(to.x, 0, to.y);
      }
      if (record.solid && grid !== null)
        before.set(record, { x: record.vehicle.position.x, y: record.vehicle.position.z });
    }
    manager.update(step);
    for (const [record, from] of before) {
      const { position, velocity } = record.vehicle;
      const box = { x: from.x - record.w / 2, y: from.y - record.h / 2, w: record.w, h: record.h };
      const moved = grid?.move(box, position.x - from.x, position.z - from.y);
      if (moved === undefined) continue;
      position.x = moved.x + record.w / 2;
      position.z = moved.y + record.h / 2;
      if (moved.hitX) velocity.x = 0;
      if (moved.hitY) velocity.z = 0;
    }
    for (const record of records.values()) sync(record);
    for (const machine of machines) machine.update(step);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const record of records.values()) drop(record);
    records.clear();
    proxies.clear();
    obstacles.length = 0;
    for (const machine of machines) machine.dispose();
    machines.clear();
    manager.clear();
    grid = null;
  }
  scene?.dispose?.(dispose);

  return {
    limits: AI_LIMITS,
    get agents() {
      return records.size;
    },
    grid(source: Partial<GridSource>, gridOptions?: { diagonal?: boolean }) {
      live();
      grid = createNavGrid(source, gridOptions);
      return grid;
    },
    agent(display: unknown, agentOptions?: AgentOptions) {
      const target =
        typeof display === 'object' && display !== null ? (display as DisplayLike) : null;
      return makeAgent(target, agentOptions ?? {});
    },
    obstacle(x: number, y: number, radius: number) {
      live();
      if (obstacles.length >= AI_LIMITS.obstacles)
        throw new RangeError(`gameai: at most ${String(AI_LIMITS.obstacles)} obstacles`);
      const entity = new GameEntity();
      entity.position.set(finite(x, 0, -1e6, 1e6), 0, finite(y, 0, -1e6, 1e6));
      entity.boundingRadius = finite(radius, 16, 1, 1e4);
      obstacles.push(entity);
      return {
        remove() {
          const at = obstacles.indexOf(entity);
          if (at >= 0) obstacles.splice(at, 1);
        },
      };
    },
    fsm(states: Readonly<Record<string, FsmState>>, initial: string) {
      live();
      const machine = createFsm(states, initial);
      machines.add(machine);
      return machine;
    },
    update,
    dispose,
  };
}
