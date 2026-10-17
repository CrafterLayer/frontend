import { compose, layerX, type MuralScene } from './mural/compose';
import { MOODS, TIMES, resolvePalette } from './mural/palette';
import { DEPTHS, normalize } from './mural/spec';
import { ITEMS, lookup, vocabulary } from './mural/registry';
import type { Box, Ctx, Depth, Drawn, MuralPixi } from './mural/types';
import { ctxP, mixRgb, rng } from './mural/util';

export const MURAL_VERSION = '1.0.0';

/**
 * `s.lib.mural` (mural kit, 2026-10-14): any illustrated mural as a short composition. A small
 * JSON-like spec — panorama width, mood, a time-of-day arc, depth layers of named items, a cast
 * and 3–5 beats — becomes a painted, seeded panorama in s.world with parallax, atmospheric fade
 * and time-of-day light, told by one labelled s.lib.anim timeline that loops, scrubs with
 * s.scroll or holds its strongest beat still. `item` draws one primitive into any container for
 * custom compositions. Plain JavaScript: it draws with the scene's s.PIXI, animates through the
 * scene's s.lib.anim (list 'anim' beside 'mural'), never throws on a bad spec (warnings instead)
 * and releases everything with the scene.
 */
export function createMuralLibrary() {
  return Object.freeze({
    version: MURAL_VERSION,
    /** Item names by group: sky, land, water, plants, built, creatures, people, space, fantasy. */
    items: vocabulary(),
    kinds: Object.fromEntries(
      Object.entries(ITEMS).flatMap(([name, e]) => (e.kinds ? [[name, e.kinds]] : [])),
    ),
    moods: Object.keys(MOODS),
    times: TIMES,
    depths: DEPTHS,
    compose: (s: unknown, spec: unknown) => compose(s as MuralScene, spec),
    /** The warnings a spec would raise, without drawing. */
    validate(spec: unknown): string[] {
      const warnings: string[] = [];
      normalize(spec, warnings);
      return warnings;
    },
    /**
     * One primitive into `parent` at (x, y): `item(s, s.world, 'tree', { kind: 'palm', x, y, size,
     * seed, mood, depth })`. Mirrors with s.dir; its lights show unless `lit: false`. Returns the
     * drawn parts (view, rig for s.lib.anim, ambient(t)) or undefined for an unknown name.
     */
    item(
      s: unknown,
      parent: unknown,
      name: string,
      options: Record<string, unknown> = {},
    ): Drawn | undefined {
      const scene = s as MuralScene;
      const found = typeof name === 'string' ? lookup(name) : {};
      if (!('name' in found)) return undefined;
      const entry = ITEMS[found.name];
      if (entry === undefined) return undefined;
      const P = scene.PIXI as MuralPixi;
      ctxP.current = P;
      const mix =
        typeof scene.palette?.mix === 'function' ? scene.palette.mix.bind(scene.palette) : mixRgb;
      const depth = (DEPTHS as readonly string[]).includes(String(options['depth']))
        ? (options['depth'] as Depth)
        : 'near';
      const pal = resolvePalette(
        typeof options['mood'] === 'string' ? options['mood'] : 'meadow',
        {},
        mix,
      );
      const host = parent as Box;
      const fills: Ctx['fills'] = [];
      const num = (key: string, fallback: number) =>
        typeof options[key] === 'number' && Number.isFinite(options[key]) ? options[key] : fallback;
      const ctx: Ctx = {
        P,
        art: host,
        glow: host,
        pal,
        mix,
        fills,
        depth,
        c: (c) => c,
        r: rng(num('seed', 1)),
        n: (count) =>
          Math.max(1, Math.round(typeof scene.count === 'function' ? scene.count(count) : count)),
        span: 1280,
      };
      const drawn = entry.draw(ctx, {
        x: num('x', 640),
        y: num('y', 600),
        size: num('size', entry.size),
        from: num('from', 0),
        to: num('to', 1280),
        kind:
          typeof options['kind'] === 'string'
            ? options['kind']
            : (found.kind ?? entry.kinds?.[0] ?? ''),
        count: num('count', entry.count ?? 1),
        seed: num('seed', 1),
        flag: options,
        ...(typeof options['color'] === 'number' ? { color: options['color'] } : {}),
      });
      if (scene.dir === -1 && entry.wide !== true) drawn.view.scale.x *= -1;
      for (const v of drawn.lights ?? []) v.alpha = options['lit'] === false ? 0 : 1;
      for (const v of drawn.night ?? []) v.alpha = 1;
      scene.dispose?.(() => {
        for (const f of fills) f.destroy();
      });
      return drawn;
    },
    /** The layer x of a panorama x (how compose places items in far/mid layers). */
    layerX: (depth: Depth, x: number) => layerX(depth, x),
  });
}
