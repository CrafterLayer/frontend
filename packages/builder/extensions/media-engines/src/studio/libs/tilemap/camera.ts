/*
  A follow camera for tile worlds (creative engines, 2026-10-12). It moves one container so a
  target stays in view, eases toward it, clamps to the world's edges and centres a world that is
  smaller than the screen. Pure arithmetic over x/y/scale — no Pixi import, no listeners.

    const cam = T.camera(worldLayer, { world, screen: () => ({ width: s.width, height: s.height }) });
    s.tick((time) => cam.follow(hero.x, hero.y, time.dt));
*/

export interface CameraTarget {
  x: number;
  y: number;
  scale: { x: number; y: number; set?(x: number, y?: number): void };
}

export interface CameraOptions {
  world: { readonly width: number; readonly height: number };
  screen: () => { width: number; height: number };
  /** Follow stiffness per second (0 = snap). */
  lerp?: number;
  zoom?: number;
  /** px around the centre where the target can move without the camera following. */
  deadzone?: { width: number; height: number };
}

export interface Camera {
  readonly x: number;
  readonly y: number;
  zoom: number;
  follow(x: number, y: number, dt: number): void;
  snap(x: number, y: number): void;
  /** Screen position → world position (for pointer input). */
  toWorld(screenX: number, screenY: number): { x: number; y: number };
}

export function createCamera(
  // Authored scene code is plain JavaScript: either argument may be missing or malformed.
  target: CameraTarget | null | undefined,
  input: CameraOptions | null | undefined,
): Camera {
  if (typeof target !== 'object' || target === null || typeof input?.screen !== 'function') {
    throw new TypeError('tilemap.camera needs a container and { world, screen }');
  }
  const view = target;
  const options = input;
  let zoom = Math.max(0.1, Math.min(8, options.zoom ?? 1));
  const lerp = Math.max(0, Math.min(60, options.lerp ?? 8));
  let cx = 0;
  let cy = 0;

  function clampCentre(x: number, y: number): [number, number] {
    const screen = options.screen();
    const halfW = screen.width / zoom / 2;
    const halfH = screen.height / zoom / 2;
    const { width, height } = options.world;
    const nx = width <= halfW * 2 ? width / 2 : Math.max(halfW, Math.min(width - halfW, x));
    const ny = height <= halfH * 2 ? height / 2 : Math.max(halfH, Math.min(height - halfH, y));
    return [nx, ny];
  }

  function apply(): void {
    const screen = options.screen();
    if (typeof view.scale.set === 'function') view.scale.set(zoom, zoom);
    else {
      view.scale.x = zoom;
      view.scale.y = zoom;
    }
    view.x = Math.round(screen.width / 2 - cx * zoom);
    view.y = Math.round(screen.height / 2 - cy * zoom);
  }

  return {
    get x() {
      return cx;
    },
    get y() {
      return cy;
    },
    get zoom() {
      return zoom;
    },
    set zoom(value: number) {
      if (Number.isFinite(value)) zoom = Math.max(0.1, Math.min(8, value));
      [cx, cy] = clampCentre(cx, cy);
      apply();
    },
    follow(x, y, dt) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      let tx = x;
      let ty = y;
      const zone = options.deadzone;
      if (zone !== undefined) {
        const dx = x - cx;
        const dy = y - cy;
        tx = Math.abs(dx) <= zone.width / 2 ? cx : x - Math.sign(dx) * (zone.width / 2);
        ty = Math.abs(dy) <= zone.height / 2 ? cy : y - Math.sign(dy) * (zone.height / 2);
      }
      const [gx, gy] = clampCentre(tx, ty);
      const k =
        lerp === 0 || !Number.isFinite(dt)
          ? 1
          : 1 - Math.exp(-lerp * Math.max(0, Math.min(0.1, dt)));
      cx += (gx - cx) * k;
      cy += (gy - cy) * k;
      apply();
    },
    snap(x, y) {
      [cx, cy] = clampCentre(x, y);
      apply();
    },
    toWorld(screenX, screenY) {
      return { x: (screenX - view.x) / zoom, y: (screenY - view.y) / zoom };
    },
  };
}
