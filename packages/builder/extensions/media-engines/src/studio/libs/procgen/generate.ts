/*
  The rot.js generators behind `s.lib.procgen` (procedural maps, 2026-10-13). rot-js 2.2.1
  (BSD-3-Clause) is imported module by module — six map generators, the RNG and precise
  shadowcasting — so the lazy asset carries only those.

  rot's generators all draw from ONE module-level RNG. Every call here seeds it immediately before
  generating and generates synchronously, so the result depends only on the seed (the scene's
  seeded random picks it), whatever else the page did with rot before.
*/

import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting.js';
import Cellular from 'rot-js/lib/map/cellular.js';
import Digger from 'rot-js/lib/map/digger.js';
import DividedMaze from 'rot-js/lib/map/dividedmaze.js';
import EllerMaze from 'rot-js/lib/map/ellermaze.js';
import IceyMaze from 'rot-js/lib/map/iceymaze.js';
import Uniform from 'rot-js/lib/map/uniform.js';
import RNG from 'rot-js/lib/rng.js';

import { closeBorder, type Cell, type GridData } from './grid';

export const PROCGEN_LIMITS = Object.freeze({
  minSize: 7,
  maxSize: 160,
  fovRadius: 40,
  scatter: 512,
});

export type DungeonStyle = 'digger' | 'rooms';
export type MazeStyle = 'divided' | 'icey' | 'eller';

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The room's centre cell. */
  readonly cx: number;
  readonly cy: number;
}

export interface Generated extends GridData {
  readonly rooms: readonly Room[];
}

export interface DungeonSettings {
  readonly style: DungeonStyle;
  readonly roomWidth: [number, number];
  readonly roomHeight: [number, number];
  readonly corridorLength: [number, number];
  readonly fill: number;
}

export interface CaveSettings {
  readonly fill: number;
  readonly steps: number;
}

export interface MazeSettings {
  readonly style: MazeStyle;
  readonly regularity: number;
}

function blank(
  width: number,
  height: number,
): { width: number; height: number; cells: Uint8Array } {
  return { width, height, cells: new Uint8Array(width * height).fill(1) };
}

function writer(grid: { width: number; cells: Uint8Array }) {
  return (x: number, y: number, value: number): void => {
    grid.cells[y * grid.width + x] = value === 0 ? 0 : 1;
  };
}

function roomsOf(map: Digger | Uniform): Room[] {
  return map.getRooms().map((room) => {
    const [cx = room.getLeft(), cy = room.getTop()] = room.getCenter();
    return {
      x: room.getLeft(),
      y: room.getTop(),
      w: room.getRight() - room.getLeft() + 1,
      h: room.getBottom() - room.getTop() + 1,
      cx,
      cy,
    };
  });
}

function seed(value: number): void {
  RNG.setSeed(value);
}

/** Rooms and corridors: 'digger' grows them from a first room; 'rooms' spreads rooms evenly. */
export function generateDungeon(
  width: number,
  height: number,
  settings: DungeonSettings,
  seedValue: number,
): Generated {
  const grid = blank(width, height);
  const options = {
    roomWidth: settings.roomWidth,
    roomHeight: settings.roomHeight,
    corridorLength: settings.corridorLength,
  };
  if (settings.style === 'rooms') {
    seed(seedValue);
    // Uniform gives up (null) after its time limit when the map cannot hold two rooms.
    const uniform = new Uniform(width, height, {
      ...options,
      roomDugPercentage: Math.min(0.5, settings.fill * 0.6),
      timeLimit: 250,
    });
    if (uniform.create(writer(grid)) !== null) {
      closeBorder(grid);
      return { ...grid, rooms: roomsOf(uniform) };
    }
    grid.cells.fill(1);
  }
  seed(seedValue);
  const digger = new Digger(width, height, {
    ...options,
    dugPercentage: settings.fill,
    timeLimit: 1000,
  });
  digger.create(writer(grid));
  closeBorder(grid);
  return { ...grid, rooms: roomsOf(digger) };
}

/** Caves: a cellular automaton (walls are the living cells), then tunnels join the pockets. */
export function generateCave(
  width: number,
  height: number,
  settings: CaveSettings,
  seedValue: number,
): Generated {
  const grid = blank(width, height);
  const write = writer(grid);
  seed(seedValue);
  const cave = new Cellular(width, height);
  cave.randomize(settings.fill);
  for (let step = 1; step < settings.steps; step += 1) cave.create();
  cave.create(write);
  // Close the edge first so the joining tunnels never run along it.
  const wall = (x: number, y: number): void => {
    cave.set(x, y, 1);
    write(x, y, 1);
  };
  for (let x = 0; x < width; x += 1) {
    wall(x, 0);
    wall(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    wall(0, y);
    wall(width - 1, y);
  }
  // A dense fill can leave no floor at all: open a small chamber in the middle.
  if (!grid.cells.includes(0)) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    for (let y = cy - 1; y <= cy + 1; y += 1)
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        cave.set(x, y, 0);
        write(x, y, 0);
      }
  }
  cave.connect(write, 0);
  closeBorder(grid);
  return { ...grid, rooms: [] };
}

/** Perfect mazes (one way between any two cells) on odd sizes. */
export function generateMaze(
  width: number,
  height: number,
  settings: MazeSettings,
  seedValue: number,
): Generated {
  const grid = blank(width, height);
  seed(seedValue);
  const write = writer(grid);
  if (settings.style === 'icey') new IceyMaze(width, height, settings.regularity).create(write);
  else if (settings.style === 'eller') new EllerMaze(width, height).create(write);
  else new DividedMaze(width, height).create(write);
  closeBorder(grid);
  return { ...grid, rooms: [] };
}

/** Cells seen from (x, y) within `radius` (walls that bound the view included). */
export function fieldOfView(grid: GridData, origin: Cell, radius: number): Set<number> {
  const seen = new Set<number>();
  const passes = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.cells[y * grid.width + x] === 0;
  new PreciseShadowcasting(passes, { topology: 8 }).compute(origin.x, origin.y, radius, (x, y) => {
    if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) seen.add(y * grid.width + x);
  });
  return seen;
}
