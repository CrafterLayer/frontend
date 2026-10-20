import type { Box, Depth, Drawn, Gfx, Palette, Time, View } from './types';
import { LIGHT, TIMES } from './palette';
import type { NBeat, NItem, NSpec } from './spec';
import { gfx } from './util';
import type { MuralScene } from './compose';

/*
  The story (mural kit, 2026-10-14): `beats` become ONE labelled s.lib.anim timeline — the camera
  pans, the time of day changes (sky, layer tint, sun, night marks), lights come on one after
  another, the cast walks or flies to a place, things appear, hide or grow — and one s.tick drives
  it: looping (a veil in the first sky colour hides the jump back), scrubbed by s.scroll, or held
  on the strongest beat as the still frame (s.editor, reduced motion, mode 'still'). Rig states
  are a function of timeline time, so scrubbing backwards walks the cast backwards correctly.
*/

export interface Placed {
  drawn: Drawn;
  item: NItem;
  x: number;
  sy: number;
}

export interface Built {
  root: Box;
  back: Box;
  overlay: Box;
  layers: Record<Depth, { container: Box; art: Box; glow: Box; f: number }>;
  pal: Palette;
  skies: Partial<Record<Time, Gfx>>;
  placed: Placed[];
  ids: Record<string, Placed[]>;
  fills: { destroy(): void }[];
  n: NSpec;
}

interface Anim {
  create(o: { reducedMotion?: boolean }): {
    timeline(o: { repeat?: number; paused?: boolean }): Timeline;
    rig(parts: Record<string, unknown>, o: { size?: number; state?: string }): Rig;
    update(dt: number): void;
    dispose(): void;
  };
}

interface Timeline {
  readonly duration: number;
  to(
    t: unknown,
    p: Record<string, number>,
    o?: Record<string, unknown>,
    at?: number | string,
  ): Timeline;
  fromTo(
    t: unknown,
    a: Record<string, number>,
    b: Record<string, number>,
    o?: Record<string, unknown>,
    at?: number | string,
  ): Timeline;
  call(fn: () => void, at?: number | string): Timeline;
  label(name: string, at?: number | string): Timeline;
  seek(at: number | string): Timeline;
  progress(): number;
  progress(p: number): Timeline;
  time(): number;
  pause(): void;
  resume(): void;
}

interface Rig {
  set(state: string): boolean;
  face(d: 1 | -1): void;
  speed: number;
  stop(): void;
}

interface Member {
  placed: Placed;
  rig?: Rig;
  rest: string;
  x: number;
  moves: { start: number; end: number; dir: 1 | -1 }[];
  states: { at: number; state: string }[];
}

const night = (t: Time, space: boolean) =>
  space ? 1 : Math.min(1, Math.max(0, (LIGHT[t].night - 0.2) / 0.6));
const lightsOn = (t: Time) => LIGHT[t].night >= 0.8;

/** Assign the time arc to beats that name no time of their own (first beat keeps the start). */
function arc(n: NSpec): void {
  if (n.beats.some((beat) => beat.time !== undefined) || n.times.length < 2) return;
  const last = n.beats.length - 1;
  n.times.slice(1).forEach((time, j) => {
    const at = Math.max(1, Math.round(((j + 1) * last) / (n.times.length - 1)));
    const beat = n.beats[Math.min(last, at)];
    if (beat !== undefined) beat.time = time;
  });
}

function weight(beat: NBeat): number {
  return (
    (beat.still ? 100 : 0) +
    Object.keys(beat.move).length +
    beat.show.length +
    beat.grow.length +
    (beat.time === undefined ? 0 : 1) +
    (beat.lights === undefined ? 0 : 2) +
    Object.keys(beat.state).length
  );
}

export function tell(s: MuralScene, b: Built, warn: (m: string) => void) {
  const n = b.n;
  const anim = s.lib?.['anim'] as Anim | undefined;
  const still = s.reducedMotion === true || s.editor === true || n.mode === 'still';
  const scrub = n.mode === 'scrub';
  const unpin = scrub && !still ? s.scroll?.pin?.() : undefined;
  const space = n.mood === 'space';
  const A = anim?.create({ reducedMotion: s.reducedMotion === true });
  if (A === undefined)
    warn("add 'anim' to libs to animate the beats: ck.scene({libs:['mural','anim']})");
  const cam = { pan: 0 };
  const time0 = n.times[0] ?? 'day';
  const lights: { v: View; x: number }[] = [];
  const nights: View[] = [];
  const suns: View[] = [];
  const ambient: ((T: number) => void)[] = [];
  const follow: [View, Box][] = [];
  const rollers: { p: Placed; last: number }[] = [];
  const members = new Map<Placed, Member>();
  for (const p of b.placed) {
    const d = p.drawn;
    for (const v of d.lights ?? []) {
      v.alpha = lightsOn(time0) ? 1 : 0;
      lights.push({ v, x: p.x * b.layers[p.item.depth].f });
    }
    for (const v of d.night ?? []) {
      v.alpha = night(time0, space);
      nights.push(v);
    }
    if (d.sun !== undefined && p.item.y === undefined) {
      d.sun.y = LIGHT[time0].sun;
      suns.push(d.sun);
    }
    if (d.ambient !== undefined) ambient.push(d.ambient);
    if (d.follow !== undefined) follow.push([d.view, d.follow]);
    if (d.roll !== undefined) rollers.push({ p, last: d.view.x });
    if (d.rig !== undefined && A !== undefined) {
      const rest = d.rest ?? 'idle';
      try {
        const rig = A.rig(d.rig, { size: p.item.size ?? p.item.entry.size, state: rest });
        members.set(p, { placed: p, rig, rest, x: d.view.x, moves: [], states: [] });
      } catch (error) {
        warn(`${p.item.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  lights.sort((a, c) => a.x - c.x);
  const layerList = Object.values(b.layers);
  const W = n.width;
  arc(n);
  const tl = A?.timeline({ repeat: n.mode === 'loop' ? -1 : 0, paused: still || scrub });
  let end = 0;
  let stillAt = 0;
  if (tl !== undefined) {
    let cursor = 0;
    let best = -1;
    let litNow = lightsOn(time0);
    const ease = { ease: 'inOutSine' };
    const starts = new Map<NBeat, number>();
    for (const beat of n.beats) {
      const start = beat.at ?? cursor;
      const dur = beat.dur;
      tl.label(beat.label, start);
      if (beat.camera !== undefined) {
        const pan =
          typeof beat.camera === 'number'
            ? beat.camera
            : (beat.camera.x - 640) / Math.max(1, W - 1280);
        tl.to(cam, { pan: Math.min(1, Math.max(0, pan)) }, { duration: dur, ...ease }, start);
      }
      if (beat.time !== undefined) {
        const t = beat.time;
        const d = Math.min(dur, 4);
        for (const [name, g] of Object.entries(b.skies))
          if (name !== time0)
            tl.to(g, { alpha: name === t ? 1 : 0 }, { duration: d, ...ease }, start);
        tl.to(
          [...layerList.map((l) => l.art), b.overlay],
          { tint: LIGHT[t].tint },
          { duration: d, ...ease, colors: ['tint'] },
          start,
        );
        if (suns.length > 0) tl.to(suns, { y: LIGHT[t].sun }, { duration: d, ...ease }, start);
        if (nights.length > 0)
          tl.to(nights, { alpha: night(t, space) }, { duration: d, ...ease }, start);
        if (beat.lights === undefined && lightsOn(t) !== litNow) beat.lights = lightsOn(t);
      }
      if (beat.lights !== undefined && lights.length > 0) {
        litNow = beat.lights;
        const views = (beat.lights ? lights : [...lights].reverse()).map((l) => l.v);
        tl.to(
          views,
          { alpha: beat.lights ? 1 : 0 },
          { duration: 0.8, ease: 'outSine', stagger: Math.min(0.25, (dur * 0.7) / views.length) },
          start + 0.3,
        );
      }
      for (const [id, target] of Object.entries(beat.move)) {
        for (const p of b.ids[id] ?? []) {
          const v = p.drawn.view;
          const props: Record<string, number> = {};
          const depth = p.item.depth;
          if (target.x !== undefined)
            props['x'] = depth === 'sky' ? target.x : 640 + (target.x - 640) * b.layers[depth].f;
          if (target.y !== undefined) props['y'] = target.y;
          if (target.rotation !== undefined) props['rotation'] = target.rotation;
          if (target.alpha !== undefined) props['alpha'] = target.alpha;
          if (target.scale !== undefined)
            Object.assign(props, {
              'scale.x': target.scale * Math.sign(v.scale.x || 1),
              'scale.y': target.scale,
            });
          const x = props['x'];
          if (x !== undefined && x !== (members.get(p)?.x ?? v.x)) {
            let member = members.get(p);
            if (member === undefined)
              members.set(p, (member = { placed: p, rest: '', x: v.x, moves: [], states: [] }));
            member.moves.push({ start, end: start + dur * 0.9, dir: x >= member.x ? 1 : -1 });
            member.x = x;
          }
          tl.to(v, props, { duration: dur * 0.9, ...ease }, start);
        }
      }
      const views = (ids: string[]) =>
        ids.flatMap((id) => (b.ids[id] ?? []).map((p) => p.drawn.view));
      if (beat.show.length > 0)
        tl.fromTo(
          views(beat.show),
          { alpha: 0 },
          { alpha: 1 },
          { duration: Math.min(1.5, dur * 0.5), ease: 'outSine', stagger: 0.15 },
          start,
        );
      if (beat.hide.length > 0)
        tl.to(
          views(beat.hide),
          { alpha: 0 },
          { duration: Math.min(1.5, dur * 0.5), ease: 'inSine', stagger: 0.1 },
          start,
        );
      for (const id of beat.grow) {
        (b.ids[id] ?? []).forEach((p, i) => {
          const v = p.drawn.view;
          tl.fromTo(
            v,
            { 'scale.x': 0, 'scale.y': 0 },
            { 'scale.x': v.scale.x, 'scale.y': p.sy },
            { duration: Math.min(2.5, dur * 0.7), ease: 'outBack' },
            start + i * 0.12,
          );
        });
      }
      for (const [id, state] of Object.entries(beat.state))
        for (const p of b.ids[id] ?? []) members.get(p)?.states.push({ at: start, state });
      cursor = Math.max(cursor, start + dur);
      starts.set(beat, start);
      const w = weight(beat);
      if (w >= best) {
        best = w;
        stillAt = start + dur * 0.92;
      }
    }
    end = Math.max(cursor, 1);
    tl.call(() => undefined, end);
    if (n.mode === 'loop' && !still && !scrub && n.beats.length > 0) {
      const veil = gfx(b.root).rect(-60, -60, 1400, 840).fill(b.pal.sky[time0][0]);
      tl.fromTo(veil, { alpha: 1 }, { alpha: 0 }, { duration: 1.2, ...ease }, 0).to(
        veil,
        { alpha: 1 },
        { duration: 1.2, ...ease },
        end - 1.2,
      );
    }
    if (typeof n.still === 'string') {
      const beat = n.beats.find((x) => x.label === n.still);
      if (beat === undefined) warn(`still: no beat labelled "${n.still}"`);
      else stillAt = (starts.get(beat) ?? 0) + beat.dur * 0.92;
    } else if (typeof n.still === 'number') stillAt = n.still * end;
    // A looping story veils its last 1.2 s: the still frame stays clear of it.
    stillAt = n.beats.length === 0 ? 0 : Math.min(stillAt, Math.max(0, end - 1.3));
    if (still) tl.seek(stillAt);
  }

  let disposed = false;
  let T = 0;
  function sync(): void {
    const t = tl?.time() ?? 0;
    for (const l of layerList) l.container.x = -cam.pan * (W - 1280) * l.f;
    for (const [v, f] of follow) {
      f.position.set(v.x, v.y);
      f.rotation = v.rotation;
      f.scale.set(v.scale.x, v.scale.y);
      f.alpha = v.alpha;
    }
    for (const r of rollers) {
      const x = r.p.drawn.view.x;
      r.p.drawn.roll?.(x - r.last);
      r.last = x;
    }
    for (const m of members.values()) {
      const moving = m.moves.find((mv) => t >= mv.start && t < mv.end);
      const facing = [...m.moves].reverse().find((mv) => mv.start <= t)?.dir ?? 1;
      if (m.rig === undefined) {
        const v = m.placed.drawn.view;
        v.scale.x = Math.abs(v.scale.x) * facing;
        continue;
      }
      m.rig.face(facing);
      if (moving !== undefined) m.rig.set(m.rest === 'idle' ? 'walk' : m.rest);
      else m.rig.set([...m.states].reverse().find((st) => st.at <= t)?.state ?? m.rest);
    }
  }
  for (const fn of ambient) fn(0);
  sync();
  let sp = 0;
  let go = 0;
  s.tick?.((time) => {
    if (disposed) return;
    if (!still && A !== undefined) {
      if (scrub && tl !== undefined) {
        const target = s.scroll?.progress ?? 0;
        sp = target === 0 || target === 1 ? target : sp + (target - sp) * Math.min(1, time.dt * 5);
        tl.progress(sp);
        go += (Math.min(1, Math.abs(s.scroll?.velocity ?? 0) * 6) - go) * Math.min(1, time.dt * 4);
        for (const m of members.values()) if (m.rig !== undefined) m.rig.speed = go;
      }
      A.update(time.dt * n.speed);
      T += time.dt * n.speed;
      for (const fn of ambient) fn(T);
    }
    sync();
  });
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unpin?.();
    A?.dispose();
    if (b.root.destroyed !== true) b.root.destroy({ children: true });
    for (const f of b.fills.splice(0)) f.destroy();
  }
  s.dispose?.(dispose);
  const layer = (name: string) => b.layers[(name in b.layers ? name : 'near') as Depth];
  return {
    root: b.root,
    palette: b.pal,
    timeline: tl,
    camera: cam,
    duration: end,
    still: end > 0 ? stillAt / end : 0,
    layer: (name: string) => layer(name).art,
    lights: (name: string) => layer(name).glow,
    get: (id: string) => (b.ids[id] ?? []).map((p) => p.drawn.view),
    seek(progress: number) {
      tl?.pause();
      tl?.progress(Math.min(1, Math.max(0, progress)));
      sync();
    },
    dispose,
    get disposed() {
      return disposed;
    },
    times: TIMES,
  };
}
