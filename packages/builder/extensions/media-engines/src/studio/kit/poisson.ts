/*
  Poisson-disk sampling for the scene kit (pixi-studio §B.2: s.poisson(w, h, r, max?)).

  Own implementation of Bridson's algorithm ("Fast Poisson Disk Sampling in Arbitrary
  Dimensions", SIGGRAPH 2007 sketch): a background grid of cell size r/√2 holds at most one
  sample per cell, and each active sample tries `k` candidates in the annulus [r, 2r). Every pair
  of returned points is at least `r` apart. Seeded through the random function, so it is
  deterministic.
*/

export type Point2 = [number, number];

/** Hard cap on samples whatever the caller asks for: a mural never needs more. */
export const POISSON_HARD_MAX = 20_000;

export function poissonDisk(
  width: number,
  height: number,
  radius: number,
  random: () => number,
  max: number = POISSON_HARD_MAX,
  tries = 30,
): Point2[] {
  const limit = Math.max(0, Math.min(POISSON_HARD_MAX, Math.floor(max)));
  if (!(width > 0) || !(height > 0) || !(radius > 0) || limit === 0) {
    return [];
  }
  // A radius so small that the grid would explode is clamped to keep memory bounded.
  const r = Math.max(radius, Math.sqrt((width * height) / (POISSON_HARD_MAX * 1.5)));
  const cell = r / Math.SQRT2;
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = new Int32Array(columns * rows).fill(-1);
  const points: Point2[] = [];
  const active: number[] = [];
  const r2 = r * r;

  function place(x: number, y: number): void {
    const index = points.length;
    points.push([x, y]);
    active.push(index);
    grid[Math.floor(y / cell) * columns + Math.floor(x / cell)] = index;
  }

  function fits(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const x0 = Math.max(0, gx - 2);
    const x1 = Math.min(columns - 1, gx + 2);
    const y0 = Math.max(0, gy - 2);
    const y1 = Math.min(rows - 1, gy + 2);
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) {
        const other = grid[cy * columns + cx] ?? -1;
        if (other < 0) continue;
        const point = points[other] as Point2;
        const dx = point[0] - x;
        const dy = point[1] - y;
        if (dx * dx + dy * dy < r2) return false;
      }
    }
    return true;
  }

  place(random() * width, random() * height);
  while (active.length > 0 && points.length < limit) {
    const slot = Math.floor(random() * active.length);
    const origin = points[active[slot] as number] as Point2;
    let found = false;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const angle = random() * Math.PI * 2;
      // Uniform over the annulus area, not over the radius.
      const distance = Math.sqrt(r2 + random() * 3 * r2);
      const x = origin[0] + Math.cos(angle) * distance;
      const y = origin[1] + Math.sin(angle) * distance;
      if (fits(x, y)) {
        place(x, y);
        found = true;
        if (points.length >= limit) break;
      }
    }
    if (!found) {
      active[slot] = active[active.length - 1] as number;
      active.pop();
    }
  }
  return points;
}
