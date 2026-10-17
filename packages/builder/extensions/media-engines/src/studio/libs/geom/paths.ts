/*
  Flat-polygon helpers for `s.lib.geom` (mural libraries, 2026-10-13). Every polygon is a flat
  [x0, y0, x1, y1, …] array in design units, ready for `Graphics.poly`, and every helper is our own
  code: area and centroid, point-in-polygon, Chaikin smoothing, a ribbon around a centre line, an
  inset (the grout between mosaic tiles) and an arch outline (round, pointed or horseshoe).
*/

export type Flat = number[];

export const PATH_LIMITS = Object.freeze({ maxPoints: 20_000, maxSmooth: 6, maxArchSteps: 96 });

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A copy holding only finite coordinates, an even count and at most `maxPoints` points. */
export function flatOf(input: unknown): Flat {
  if (!Array.isArray(input) && !ArrayBuffer.isView(input)) return [];
  const source = input as ArrayLike<unknown>;
  const out: Flat = [];
  const length = Math.min(source.length - (source.length % 2), PATH_LIMITS.maxPoints * 2);
  for (let i = 0; i < length; i += 2) {
    const x = source[i];
    const y = source[i + 1];
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y))
      out.push(x, y);
  }
  return out;
}

/** Signed area: positive when the points turn clockwise on screen (x right, y down). */
export function signedArea(poly: Flat): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length;
    sum += (poly[i] ?? 0) * (poly[j + 1] ?? 0) - (poly[j] ?? 0) * (poly[i + 1] ?? 0);
  }
  return sum / 2;
}

export function area(poly: Flat): number {
  return Math.abs(signedArea(poly));
}

/** The area centroid; the vertex mean for a degenerate polygon. */
export function centroid(poly: Flat): [number, number] {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    let x = 0;
    let y = 0;
    const n = Math.max(1, poly.length / 2);
    for (let i = 0; i < poly.length; i += 2) {
      x += poly[i] ?? 0;
      y += poly[i + 1] ?? 0;
    }
    return [x / n, y / n];
  }
  let x = 0;
  let y = 0;
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length;
    const f = (poly[i] ?? 0) * (poly[j + 1] ?? 0) - (poly[j] ?? 0) * (poly[i + 1] ?? 0);
    x += ((poly[i] ?? 0) + (poly[j] ?? 0)) * f;
    y += ((poly[i + 1] ?? 0) + (poly[j + 1] ?? 0)) * f;
  }
  return [x / (6 * a), y / (6 * a)];
}

/** Even-odd point-in-polygon. */
export function contains(poly: Flat, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i] ?? 0;
    const yi = poly[i + 1] ?? 0;
    const xj = poly[j] ?? 0;
    const yj = poly[j + 1] ?? 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Chaikin corner cutting: each pass replaces a corner with two points a quarter along. */
export function smooth(input: unknown, options?: { closed?: boolean; iterations?: number }): Flat {
  let points = flatOf(input);
  const closed = options?.closed === true;
  const passes = Math.min(
    PATH_LIMITS.maxSmooth,
    Math.max(0, Math.round(finite(options?.iterations, 2))),
  );
  for (let pass = 0; pass < passes && points.length >= 6; pass += 1) {
    if (points.length * 2 > PATH_LIMITS.maxPoints * 2) break;
    const next: Flat = [];
    const n = points.length / 2;
    const last = closed ? n : n - 1;
    if (!closed) next.push(points[0] ?? 0, points[1] ?? 0);
    for (let i = 0; i < last; i += 1) {
      const j = (i + 1) % n;
      const ax = points[i * 2] ?? 0;
      const ay = points[i * 2 + 1] ?? 0;
      const bx = points[j * 2] ?? 0;
      const by = points[j * 2 + 1] ?? 0;
      next.push(
        ax * 0.75 + bx * 0.25,
        ay * 0.75 + by * 0.25,
        ax * 0.25 + bx * 0.75,
        ay * 0.25 + by * 0.75,
      );
    }
    if (!closed) next.push(points[points.length - 2] ?? 0, points[points.length - 1] ?? 0);
    points = next;
  }
  return points;
}

export type RibbonWidth = number | ((t: number, index: number) => number);

/**
 * A filled band around a centre line: `width` is the full width, a number or a function of t in
 * [0, 1] along the line (a taper: t => 30 * Math.sin(Math.PI * t)). Returns one polygon, the left
 * edge forward then the right edge back.
 */
export function ribbon(input: unknown, width: RibbonWidth = 24): Flat {
  const points = flatOf(input);
  const n = points.length / 2;
  if (n < 2) return [];
  const left: Flat = [];
  const right: Flat = [];
  for (let i = 0; i < n; i += 1) {
    const prev = Math.max(0, i - 1);
    const next = Math.min(n - 1, i + 1);
    let tx = (points[next * 2] ?? 0) - (points[prev * 2] ?? 0);
    let ty = (points[next * 2 + 1] ?? 0) - (points[prev * 2 + 1] ?? 0);
    const length = Math.hypot(tx, ty) || 1;
    tx /= length;
    ty /= length;
    const t = n === 1 ? 0 : i / (n - 1);
    const raw = typeof width === 'function' ? width(t, i) : width;
    const half = Math.max(0, finite(raw, 0)) / 2;
    const x = points[i * 2] ?? 0;
    const y = points[i * 2 + 1] ?? 0;
    left.push(x - ty * half, y + tx * half);
    right.push(x + ty * half, y - tx * half);
  }
  for (let i = right.length - 2; i >= 0; i -= 2) left.push(right[i] ?? 0, right[i + 1] ?? 0);
  return left;
}

/**
 * The polygon moved inward by `distance` (inward only): the original clipped by each edge's
 * half-plane pushed in along its normal, so a short edge that collapses simply drops out. Made
 * for convex polygons such as Voronoi cells and mosaic tiles; [] when the inset swallows it.
 */
export function inset(input: unknown, distance: number): Flat {
  const poly = flatOf(input);
  const n = poly.length / 2;
  const d = finite(distance, 0);
  if (n < 3) return [];
  if (d <= 0) return poly;
  // Inward normal (screen coordinates, y down): a clockwise polygon's interior is on its right.
  const orientation = signedArea(poly) >= 0 ? 1 : -1;
  let out = poly;
  for (let i = 0; i < n && out.length >= 6; i += 1) {
    const j = (i + 1) % n;
    const ax = poly[i * 2] ?? 0;
    const ay = poly[i * 2 + 1] ?? 0;
    const ex = (poly[j * 2] ?? 0) - ax;
    const ey = (poly[j * 2 + 1] ?? 0) - ay;
    const length = Math.hypot(ex, ey);
    if (length < 1e-9) continue;
    const nx = (-ey / length) * orientation;
    const ny = (ex / length) * orientation;
    out = clipHalfPlane(out, nx, ny, nx * ax + ny * ay + d);
  }
  return out.length >= 6 && area(out) > 1e-9 ? out : [];
}

/* Sutherland–Hodgman against one half-plane nx·x + ny·y ≥ c. */
function clipHalfPlane(poly: Flat, nx: number, ny: number, c: number): Flat {
  const out: Flat = [];
  const count = poly.length / 2;
  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % count;
    const px = poly[i * 2] ?? 0;
    const py = poly[i * 2 + 1] ?? 0;
    const qx = poly[j * 2] ?? 0;
    const qy = poly[j * 2 + 1] ?? 0;
    const p = nx * px + ny * py - c;
    const q = nx * qx + ny * qy - c;
    if (p >= 0) out.push(px, py);
    if (p >= 0 !== q >= 0) {
      const t = p / (p - q);
      out.push(px + (qx - px) * t, py + (qy - py) * t);
    }
  }
  return out;
}

export const ARCH_KINDS = Object.freeze(['round', 'pointed', 'horseshoe'] as const);
export type ArchKind = (typeof ARCH_KINDS)[number];

/**
 * An arch window or niche filling the box (x, y, w, h): straight sides, then a round, pointed
 * (two-centred, as in a mihrab) or horseshoe head. Symmetric, so it needs no mirroring in RTL.
 */
export function arch(
  x: number,
  y: number,
  w: number,
  h: number,
  kind: ArchKind = 'pointed',
  steps = 24,
): Flat {
  const left = finite(x, 0);
  const top = finite(y, 0);
  const width = Math.max(1, finite(w, 1));
  const height = Math.max(1, finite(h, 1));
  const segments = Math.min(PATH_LIMITS.maxArchSteps, Math.max(4, Math.round(finite(steps, 24))));
  const half = width / 2;
  const cx = left + half;
  const bottom = top + height;
  const out: Flat = [left, bottom];
  if (kind === 'round' || kind === 'horseshoe') {
    // Screen angles (y down): π is the left spring, 3π/2 the crown, 2π the right spring. A
    // horseshoe's circle is wider than the opening and carries on below its widest point.
    const radius = kind === 'horseshoe' ? half * 1.18 : half;
    const below = Math.acos(Math.min(1, half / radius));
    const cy = top + radius;
    const start = Math.PI - below;
    const end = 2 * Math.PI + below;
    for (let i = 0; i <= segments; i += 1) {
      const angle = start + ((end - start) * i) / segments;
      out.push(cx + Math.cos(angle) * radius, Math.min(bottom, cy + Math.sin(angle) * radius));
    }
  } else {
    // Two arcs, each centred on the spring line inside the opposite half, meeting at the apex.
    const radius = width * 0.8;
    const rise = Math.sqrt(Math.max(0, radius * radius - (radius - half) ** 2));
    const spring = Math.min(bottom, top + rise);
    out.push(left, spring);
    let apex = Math.atan2(-rise, half - radius);
    if (apex < 0) apex += 2 * Math.PI;
    for (let i = 1; i <= segments; i += 1) {
      const angle = Math.PI + ((apex - Math.PI) * i) / segments;
      out.push(left + radius + Math.cos(angle) * radius, spring + Math.sin(angle) * radius);
    }
    const rightApex = Math.atan2(-rise, radius - half);
    for (let i = segments - 1; i >= 0; i -= 1) {
      const angle = (rightApex * i) / segments;
      out.push(left + width - radius + Math.cos(angle) * radius, spring + Math.sin(angle) * radius);
    }
  }
  out.push(left + width, bottom);
  return out;
}
