/**
 * Tabler icons (MIT, (c) Paweł Kuna — `@tabler/icons` 3.48.0), the second
 * icon set beside Lucide (style-manager DESIGN §C.3, §D.1).
 *
 * ## Why lazily, and why from the package's JSON
 *
 * Tabler has over 6 000 icons; drawing data for all of them is ~2.7 MB of
 * JSON. Lucide stays the default and is bundled; Tabler is loaded the first
 * time a tree names one (`tabler:<name>` / `tabler-filled:<name>`), so an
 * editor or page that never uses it never pays for it.
 *
 * - On the canvas and in preview, `CustomCode` starts the load in an effect
 *   and re-renders when it lands; until then the icon keeps its box.
 * - A static render (the export) cannot wait inside a render, so the host
 *   awaits `loadTablerIcons()` once before rendering, and the render reads the
 *   cache directly.
 *
 * `@tabler/icons` exports only `./icons/*` (the SVG files), so its node JSON
 * cannot be named through the package's export map. It is reached by its path
 * inside this package's own `node_modules` — pnpm always links a direct
 * dependency there — as `new URL('<literal>', import.meta.url)`: the bundler
 * copies the file as a hashed asset (dev serves it in place), the browser
 * fetches it on first use, and TypeScript never types a 2 MB literal.
 *
 * The drawing data is never trusted as markup: `tablerIconNode` keeps only the
 * shape tags and paint/geometry attributes below, the same closed family the
 * Lucide path draws.
 */

export type TablerIconStyle = 'outline' | 'filled';

/** One drawn icon: `[tag, attributes]` pairs inside a 24×24 grid. */
export type TablerIconNode = readonly (readonly [string, Readonly<Record<string, string>>])[];

/** What a loader hands back: the two node maps, as parsed JSON. */
export interface TablerIconSets {
  readonly outline: unknown;
  readonly filled: unknown;
}

export type TablerIconLoader = () => Promise<TablerIconSets>;

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tabler icon data did not load (${String(response.status)}).`);
  return (await response.json()) as unknown;
}

/*
  The URLs are built inside the loader, never at module load: a host that
  never names a Tabler icon never resolves them, and a test that injects its
  own loader never touches the network.
*/
const defaultLoader: TablerIconLoader = async () => {
  const [outline, filled] = await Promise.all([
    fetchJson(
      new URL('../../../node_modules/@tabler/icons/tabler-nodes-outline.json', import.meta.url),
    ),
    fetchJson(
      new URL('../../../node_modules/@tabler/icons/tabler-nodes-filled.json', import.meta.url),
    ),
  ]);
  return { outline, filled };
};

let loader: TablerIconLoader = defaultLoader;
let sets: { outline: Record<string, unknown>; filled: Record<string, unknown> } | undefined;
let pending: Promise<boolean> | undefined;
let failed = false;
let version = 0;
const listeners = new Set<() => void>();

function asMap(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function notify(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}

/**
 * Replace where the drawing data comes from (tests, or a host that serves the
 * JSON itself). Passing nothing restores the default. Clears the cache.
 */
export function setTablerIconLoader(next?: TablerIconLoader): void {
  loader = next ?? defaultLoader;
  sets = undefined;
  pending = undefined;
  failed = false;
  notify();
}

/**
 * Load both sets once. Resolves true when the data is in the cache, false when
 * the load failed (the icons then keep their placeholder). Never rejects.
 */
export function loadTablerIcons(): Promise<boolean> {
  if (sets !== undefined) return Promise.resolve(true);
  if (failed) return Promise.resolve(false);
  pending ??= loader().then(
    (loaded) => {
      sets = { outline: asMap(loaded.outline), filled: asMap(loaded.filled) };
      notify();
      return true;
    },
    () => {
      failed = true;
      pending = undefined;
      notify();
      return false;
    },
  );
  return pending;
}

/** Whether the drawing data is in the cache, so a static render can draw Tabler icons. */
export function tablerIconsLoaded(): boolean {
  return sets !== undefined;
}

/** Whether the last load failed (the package is missing, or the chunk did not arrive). */
export function tablerIconsFailed(): boolean {
  return failed;
}

/** Subscribe to cache changes (load, failure, loader swap). Returns the unsubscribe. */
export function subscribeTablerIcons(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A number that changes whenever the cache does — a `useSyncExternalStore` snapshot. */
export function tablerIconsVersion(): number {
  return version;
}

const SHAPE_TAGS: ReadonlySet<string> = new Set([
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
]);

const SHAPE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'd',
  'fill',
  'stroke',
  'opacity',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
  'transform',
]);

/** Paint values the drawing may carry: a colour keyword or currentColor, never a url(). */
const SAFE_PAINT = /^(?:none|currentColor|#[0-9a-fA-F]{3,8}|[a-z]+)$/u;

/**
 * The icon's drawing data, or undefined when the set is not loaded yet or has
 * no such icon. Only the closed shape family survives the read.
 */
export function tablerIconNode(name: string, style: TablerIconStyle): TablerIconNode | undefined {
  if (sets === undefined) return undefined;
  const map = style === 'filled' ? sets.filled : sets.outline;
  if (!Object.hasOwn(map, name)) return undefined;
  const raw = map[name];
  if (!Array.isArray(raw)) return undefined;
  const out: [string, Record<string, string>][] = [];
  for (const entry of raw as unknown[]) {
    if (!Array.isArray(entry)) continue;
    const [tag, attrs] = entry as [unknown, unknown];
    if (typeof tag !== 'string' || !SHAPE_TAGS.has(tag)) continue;
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(asMap(attrs))) {
      if (!SHAPE_ATTRIBUTES.has(key) || (typeof value !== 'string' && typeof value !== 'number')) {
        continue;
      }
      const text = String(value);
      if ((key === 'fill' || key === 'stroke') && !SAFE_PAINT.test(text)) continue;
      clean[key] = text;
    }
    out.push([tag, clean]);
  }
  return out;
}
