/*
  Delaunay triangulation, Voronoi cells and nearest-point lookup for the scene kit
  (pixi-studio §B.2: s.delaunay(points) -> { triangles, voronoi(bounds?), find(x, y) }).

  Own code (DESIGN D3): it replaces d3-delaunay, whose robust-predicates dependency is Unlicense,
  outside the owner's licence list.

  - Triangulation: Bowyer–Watson with the points swept in x order (Paul Bourke's variant): a
    triangle whose circumcircle lies wholly left of the sweep can never be broken again, so it
    leaves the working list early and the cost stays near O(n^1.5) for scattered points.
  - Degenerate input: exact duplicates (and non-finite points) are folded onto their first
    occurrence; a tiny deterministic perturbation (1e-9 of the extent, from the index) breaks
    cocircular grids and collinear runs, so dot grids triangulate cleanly. Triangles reference the
    ORIGINAL indices and coordinates. An all-collinear set (or fewer than 3 distinct points) has
    no triangles; voronoi and find still work.
  - Voronoi: each cell is the bounds rectangle clipped by the perpendicular bisector to each
    Delaunay neighbour (all other points when there are no triangles). Cells are flat polygons
    [x0, y0, x1, y1, ...] ready for Graphics.poly; a duplicate point's cell is [].
  - find: greedy walk over the Delaunay graph (always reaches the true nearest point), starting
    from the previous answer, so pointer-follow lookups are O(1) amortised.
*/

export type Point2Like = readonly [number, number] | { readonly x: number; readonly y: number };

export type Bounds = readonly [x0: number, y0: number, x1: number, y1: number];

export interface Delaunay {
  /** Index triplets into the input points; each triangle has positive signed area (x right, y down). */
  triangles: Uint32Array;
  /** One flat polygon per input point, clipped to `bounds` (default: the points' box padded 10%). */
  voronoi(bounds?: Bounds): number[][];
  /** Index of the input point nearest (x, y); -1 when there are no usable points. */
  find(x: number, y: number): number;
  /** Delaunay neighbours of point i (original indices; [] for duplicates). */
  neighbors(index: number): number[];
}

function coordinates(point: Point2Like): [number, number] {
  if (Array.isArray(point)) {
    return [Number(point[0]), Number(point[1])];
  }
  const object = point as { readonly x: number; readonly y: number };
  return [Number(object.x), Number(object.y)];
}

/** Twice the signed area of (a, b, c); positive when counter-clockwise in a y-up frame. */
function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Deterministic value in [-1, 1) from an index (a 32-bit integer hash). */
function jitter(index: number, salt: number): number {
  let h = Math.imul(index ^ salt, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

export function delaunay(input: readonly Point2Like[]): Delaunay {
  const count = input.length;
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  /** canonical[i] = the first index with the same coordinates, or -1 for unusable points. */
  const canonical = new Int32Array(count);
  const seen = new Map<string, number>();
  const unique: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const [x, y] = coordinates(input[index] as Point2Like);
    xs[index] = x;
    ys[index] = y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      canonical[index] = -1;
      continue;
    }
    const key = `${String(x + 0)},${String(y + 0)}`;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, index);
      canonical[index] = index;
      unique.push(index);
    } else {
      canonical[index] = first;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const index of unique) {
    const x = xs[index] as number;
    const y = ys[index] as number;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const extent = unique.length > 0 ? Math.max(maxX - minX, maxY - minY, 1e-9) : 1;
  const midX = unique.length > 0 ? (minX + maxX) / 2 : 0;
  const midY = unique.length > 0 ? (minY + maxY) / 2 : 0;

  /* Working coordinates: centred, scaled to ~[-0.5, 0.5], perturbed. Three super vertices follow. */
  const n = unique.length;
  const wx = new Float64Array(n + 3);
  const wy = new Float64Array(n + 3);
  for (let k = 0; k < n; k += 1) {
    const index = unique[k] as number;
    wx[k] = ((xs[index] as number) - midX) / extent + jitter(index, 0x51ed) * 1e-9;
    wy[k] = ((ys[index] as number) - midY) / extent + jitter(index, 0x2c1b) * 1e-9;
  }
  // The super triangle sits ~1000 extents away, so only near-flat hull triangles can be lost.
  wx[n] = -1000;
  wy[n] = -800;
  wx[n + 1] = 1000;
  wy[n + 1] = -800;
  wx[n + 2] = 0;
  wy[n + 2] = 1200;

  const triangleList: number[] = [];
  if (n >= 3) {
    const order = Array.from({ length: n }, (_, k) => k).sort(
      (a, b) => (wx[a] as number) - (wx[b] as number) || (wy[a] as number) - (wy[b] as number),
    );

    interface Tri {
      a: number;
      b: number;
      c: number;
      cx: number;
      cy: number;
      r2: number;
    }

    const make = (a: number, b: number, c: number): Tri => {
      let ta = a;
      let tb = b;
      // Keep every working triangle counter-clockwise (y up) so the final pass is uniform.
      if (
        orient(
          wx[a] as number,
          wy[a] as number,
          wx[b] as number,
          wy[b] as number,
          wx[c] as number,
          wy[c] as number,
        ) < 0
      ) {
        ta = b;
        tb = a;
      }
      const ax = wx[ta] as number;
      const ay = wy[ta] as number;
      const bx = (wx[tb] as number) - ax;
      const by = (wy[tb] as number) - ay;
      const cx = (wx[c] as number) - ax;
      const cy = (wy[c] as number) - ay;
      const d = 2 * (bx * cy - by * cx);
      if (Math.abs(d) < 1e-300) {
        return { a: ta, b: tb, c, cx: ax, cy: ay, r2: Infinity };
      }
      const b2 = bx * bx + by * by;
      const c2 = cx * cx + cy * cy;
      const ux = (cy * b2 - by * c2) / d;
      const uy = (bx * c2 - cx * b2) / d;
      return { a: ta, b: tb, c, cx: ax + ux, cy: ay + uy, r2: ux * ux + uy * uy };
    };

    let open: Tri[] = [make(n, n + 1, n + 2)];
    const closed: Tri[] = [];
    const edgeCounts = new Map<number, number>();
    const edgeList: number[] = [];
    const stride = n + 3;

    for (const k of order) {
      const px = wx[k] as number;
      const py = wy[k] as number;
      edgeCounts.clear();
      edgeList.length = 0;
      const kept: Tri[] = [];
      for (const tri of open) {
        const dx = px - tri.cx;
        if (dx > 0 && dx * dx > tri.r2) {
          closed.push(tri);
          continue;
        }
        const dy = py - tri.cy;
        if (dx * dx + dy * dy < tri.r2) {
          for (const [u, v] of [
            [tri.a, tri.b],
            [tri.b, tri.c],
            [tri.c, tri.a],
          ] as const) {
            const key = u < v ? u * stride + v : v * stride + u;
            const seenCount = edgeCounts.get(key);
            if (seenCount === undefined) {
              edgeCounts.set(key, 1);
              edgeList.push(u, v);
            } else {
              edgeCounts.set(key, seenCount + 1);
            }
          }
        } else {
          kept.push(tri);
        }
      }
      for (let e = 0; e < edgeList.length; e += 2) {
        const u = edgeList[e] as number;
        const v = edgeList[e + 1] as number;
        const key = u < v ? u * stride + v : v * stride + u;
        if (edgeCounts.get(key) === 1) {
          kept.push(make(u, v, k));
        }
      }
      open = kept;
    }

    for (const tri of [...closed, ...open]) {
      if (tri.a >= n || tri.b >= n || tri.c >= n) continue;
      const ia = unique[tri.a] as number;
      const ib = unique[tri.b] as number;
      const ic = unique[tri.c] as number;
      // Orientation on the ORIGINAL coordinates (y down): positive signed area, drop slivers.
      const area = orient(
        xs[ia] as number,
        ys[ia] as number,
        xs[ib] as number,
        ys[ib] as number,
        xs[ic] as number,
        ys[ic] as number,
      );
      const scale = extent * extent * 1e-12;
      if (Math.abs(area) <= scale) continue;
      if (area > 0) triangleList.push(ia, ib, ic);
      else triangleList.push(ia, ic, ib);
    }
  }

  const triangles = Uint32Array.from(triangleList);

  /* Adjacency (original indices). */
  const adjacency = new Map<number, Set<number>>();
  const link = (u: number, v: number): void => {
    let set = adjacency.get(u);
    if (set === undefined) {
      set = new Set();
      adjacency.set(u, set);
    }
    set.add(v);
  };
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t] as number;
    const b = triangles[t + 1] as number;
    const c = triangles[t + 2] as number;
    link(a, b);
    link(b, a);
    link(b, c);
    link(c, b);
    link(c, a);
    link(a, c);
  }
  const hasGraph = triangles.length > 0;

  function neighbors(index: number): number[] {
    if (index < 0 || index >= count || canonical[index] !== index) return [];
    if (hasGraph) {
      return [...(adjacency.get(index) ?? [])];
    }
    return unique.filter((other) => other !== index);
  }

  let last = unique[0] ?? -1;

  function find(x: number, y: number): number {
    if (unique.length === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return -1;
    const distance = (index: number): number => {
      const dx = (xs[index] as number) - x;
      const dy = (ys[index] as number) - y;
      return dx * dx + dy * dy;
    };
    if (!hasGraph) {
      let best = unique[0] as number;
      let bestDistance = distance(best);
      for (const index of unique) {
        const d = distance(index);
        if (d < bestDistance) {
          best = index;
          bestDistance = d;
        }
      }
      last = best;
      return best;
    }
    // Points outside the triangulation (isolated by slivers) are reached by a scan fallback.
    let current = adjacency.has(last) ? last : (triangles[0] as number);
    let currentDistance = distance(current);
    for (let guard = 0; guard < count + 1; guard += 1) {
      let moved = false;
      for (const next of adjacency.get(current) ?? []) {
        const d = distance(next);
        if (d < currentDistance) {
          current = next;
          currentDistance = d;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const index of unique) {
      if (!adjacency.has(index) && distance(index) < currentDistance) {
        current = index;
        currentDistance = distance(index);
      }
    }
    last = current;
    return current;
  }

  function voronoi(bounds?: Bounds): number[][] {
    let box: Bounds;
    if (bounds !== undefined) {
      box = bounds;
    } else if (unique.length === 0) {
      box = [0, 0, 0, 0];
    } else {
      const padX = Math.max((maxX - minX) * 0.1, 1);
      const padY = Math.max((maxY - minY) * 0.1, 1);
      box = [minX - padX, minY - padY, maxX + padX, maxY + padY];
    }
    const [x0, y0, x1, y1] = box;
    const cells: number[][] = [];
    for (let index = 0; index < count; index += 1) {
      if (canonical[index] !== index) {
        cells.push([]);
        continue;
      }
      let polygon: number[] = [x0, y0, x1, y0, x1, y1, x0, y1];
      const px = xs[index] as number;
      const py = ys[index] as number;
      for (const other of neighbors(index)) {
        const qx = xs[other] as number;
        const qy = ys[other] as number;
        // Keep the side of the bisector nearer p: (point - mid) · (q - p) <= 0.
        const nx = qx - px;
        const ny = qy - py;
        const mx = (px + qx) / 2;
        const my = (py + qy) / 2;
        polygon = clipHalfPlane(polygon, nx, ny, nx * mx + ny * my);
        if (polygon.length === 0) break;
      }
      cells.push(polygon);
    }
    return cells;
  }

  return { triangles, voronoi, find, neighbors };
}

/** Sutherland–Hodgman against one half-plane: keep points with nx*x + ny*y <= c. */
function clipHalfPlane(polygon: number[], nx: number, ny: number, c: number): number[] {
  const out: number[] = [];
  const vertices = polygon.length / 2;
  if (vertices === 0) return out;
  const eps = 1e-9 * (Math.abs(c) + 1);
  for (let i = 0; i < vertices; i += 1) {
    const ax = polygon[i * 2] as number;
    const ay = polygon[i * 2 + 1] as number;
    const j = (i + 1) % vertices;
    const bx = polygon[j * 2] as number;
    const by = polygon[j * 2 + 1] as number;
    const da = nx * ax + ny * ay - c;
    const db = nx * bx + ny * by - c;
    const aIn = da <= eps;
    const bIn = db <= eps;
    if (aIn) out.push(ax, ay);
    if (aIn !== bIn) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out.length >= 6 ? out : [];
}
